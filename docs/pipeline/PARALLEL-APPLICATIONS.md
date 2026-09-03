# Decision — parallel financing applications are allowed

**Decided 2026-09-02 by Kamil.** One opportunity may have several applications open at different
financiers **at the same time**. This supersedes the linear-chain assumption baked into M0's schema and
M2's gate semantics (`M2-PLAN-REVIEW.md` §3).

Do this **before M3**. M2 is not yet committed and M3's reporting is built directly on these shapes;
after that, changing them means migrating data and rewriting the metrics that were already published.

---

## 1. Why the current model forbids it

Three things enforce a single live attempt:

| Constraint | Effect |
|---|---|
| `@@unique([opportunityId, attemptSequence])` | only one application may hold a given position |
| `rerouteFromId String? @unique` | a rejected application can spawn at most one successor |
| `application.*` resolves to "the latest attempt" | with two open attempts, "latest" is arbitrary |

The first two are schema; the third is the gate evaluator, and it is the one that would fail silently.

---

## 2. Schema changes

### 2.1 `attemptSequence` becomes `roundNumber`

An attempt sequence implies a line. A **round** is a wave of submissions: round 1 may be Ayvens and Vehis
together; if both refuse, round 2 is Leasys. This keeps the reportable notion — *how many rounds did this
case need* — while allowing width.

```prisma
roundNumber  Int  @map("round_number")

@@unique([opportunityId, financierId, roundNumber])
```

Replaces `attemptSequence` and `@@unique([opportunityId, attemptSequence])`. The new key says: **the same
financier may not be asked twice in the same round.** Going back to a financier after a refusal is a new
round, which is exactly how it should read in the history.

### 2.2 `rerouteFromId` stops being unique

One rejection may spawn several parallel successors — Ayvens refuses, so the case goes to Vehis *and*
Leasys at once. Drop `@unique`; the relation becomes many-to-one and `rerouteTo` becomes a list:

```prisma
rerouteFromId String?               @map("reroute_from_id")
rerouteFrom   PipelineApplication?  @relation("Reroute", fields: [rerouteFromId], references: [id])
rerouteTo     PipelineApplication[] @relation("Reroute")
```

### 2.3 Reroute becomes sugar, not a primitive

The primitive is "add an application", with an optional parent. A reroute is an add whose
`rerouteFromId` points at the refusal that motivated it. Keep the `POST /applications/:id/reroute`
endpoint — it is the one-click action advisors want — but implement it in terms of `createApplication`.

A migration is required (the constraints are already applied). Additive-only no longer holds for
`pipeline_applications`: the migration drops two constraints and renames a column on a table this module
owns. That is fine — no data outside the module is touched — but review the generated SQL as carefully
as M0's.

---

## 3. Gate semantics — the part that fails quietly if missed

`M2-PLAN-REVIEW.md` §2.1 defined `application.*` as "the latest attempt whose state is not `WITHDRAWN`".
With parallel applications that sentence no longer names a row.

**New rule: an `application.*` requirement is met when at least one non-`WITHDRAWN` application meets
it.** The gate asks "may this case enter the financial-decision phase", and the honest answer is yes if
any application is ready. Resolution therefore stops returning a row and starts returning a predicate
over a set. Update `requirements.ts` and the §2.1 table with it.

The same shift applies to the completeness bar: `met/total` counts requirements satisfied by *some*
application, not by a designated one.

---

## 4. Operational rules that only exist once applications run in parallel

1. **A refusal still never closes a case.** Unchanged, and now obviously right — the other application
   may still be alive.
2. **The first approval that gets contracted wins; every other open application is withdrawn.** When the
   contract is signed, all remaining `PRECHECK_SUBMITTED` / `FULL_SUBMITTED` / `APPROVED` applications on
   that opportunity move to `WITHDRAWN` with `APPLICATION_WITHDRAWN` and reason `CONTRACTED_ELSEWHERE`.
   This is not tidiness: an application left open at a financier the customer did not use costs the
   customer credit inquiries and costs Motolia the relationship.
3. **Documents are the union, not the latest.** Materialization currently keys on the latest
   application's financier; with parallel submissions it must union the requirements of every open
   application's financier, or the advisor collects Ayvens's pack and is missing Vehis's.
4. **Commission attaches to the application that was contracted**, set when the contract is signed —
   `PipelineCommission.applicationId` already exists for this. With two approvals, an unattached
   commission record is ambiguous.

---

## 5. Reporting — read this before building M3

Parallel submission **mechanically raises the number of refusals while lowering the number of lost
cases**. A dashboard that does not separate the two will show the rejection rate climbing at the exact
moment the tactic starts working, and someone will draw the opposite of the correct conclusion.

Three metrics, defined separately, never derived from one another:

| Metric | Unit | Definition |
|---|---|---|
| **Approval rate per financier** | application | decided applications at that financier that were approved. The recommender's input. Unaffected by parallelism. |
| **Case outcome** | opportunity | `WON` / `LOST` on the opportunity. Never inferred from application counts. |
| **Recovery rate** | opportunity | share of cases with ≥1 refusal that still ended `WON`. Works unchanged, and is the number that shows whether parallel submission pays. |

The historical 74.5% from the spreadsheet is a **case-level** figure from an era of sequential
submissions. Once parallel submission is in use it is not comparable with per-financier rejection counts,
and the M3 report must label it as such rather than letting the two sit in one chart.

Add one metric that only becomes meaningful now: **applications per won case**. It is the cost side of
this tactic — every parallel submission is advisor work and a credit inquiry on the customer. If it
climbs without recovery rate climbing, the tactic is being overused.

---

## 6. Checklist

```
[ ] schema: roundNumber replaces attemptSequence; @@unique([opportunityId, financierId, roundNumber])
[ ] schema: rerouteFromId no longer @unique; rerouteTo becomes a list
[ ] migration reviewed statement by statement (drops constraints — no longer additive-only)
[ ] requirements.ts: application.* satisfied by ANY non-WITHDRAWN application
[ ] M2-PLAN-REVIEW.md §2.1 resolution table updated
[ ] createApplication is the primitive; reroute implemented in terms of it
[ ] contract signature withdraws the other open applications, with events
[ ] document materialization unions all open financiers' requirements
[ ] commission attaches to the contracted application
[ ] tests: two open applications, one refused one approved, case stays OPEN then WON
[ ] tests: gate passes with two applications where only one has a financier
[ ] tests: contracting one application withdraws the others
```
