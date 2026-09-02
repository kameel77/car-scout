# M2 refinement plan — review (parallel applications, completeness bar, reroute delegation)

**Verdict: APPROVED WITH CHANGES.** The plan follows `PARALLEL-APPLICATIONS.md` accurately. Four things
need settling before coding — two of them are gaps the decision document left and this plan inherited.

---

## 1. `roundNumber` allocation is underspecified and will drift

Planned rule: *"if `rerouteFromId` given, `roundNumber = rerouteFrom.roundNumber + 1`; otherwise find
existing applications for this financier or default to 1."*

The reroute half is right. The other half derives a **per-opportunity** concept from **per-financier**
history, so it breaks as soon as the two disagree: after round 2 has started, adding a fresh application
to a financier never asked before yields round 1 — a round-1 row created after round 2, and the number
stops meaning "wave". Grouping in the UI and any "rounds per case" metric then rest on an inconsistent
value.

A round is a property of the opportunity, and whether a new application opens a wave or joins the current
one is a **caller decision, not derivable**. Make it explicit:

```ts
createApplication(tx, …, { roundMode: 'JOIN_CURRENT' | 'NEW_ROUND' })
// JOIN_CURRENT (default): roundNumber = max(round on this opportunity) ?? 0, floor 1
// NEW_ROUND:              roundNumber = (max(round on this opportunity) ?? 0) + 1
```

Reroute always passes `NEW_ROUND`. Adding a second financier alongside an existing submission passes
`JOIN_CURRENT`. The unique key `[opportunityId, financierId, roundNumber]` then does exactly what it
should: it blocks asking the same financier twice in one wave and permits it in the next.

## 2. The withdrawal trigger is too broad, and the winner is unidentified

### 2.1 Trigger

Planned: withdraw the others *"when `contractSignedAt` is updated **or when phase transitions to
`CONTRACT`** / `DELIVERY` / `closeWon`"*.

Entering `CONTRACT` is not the moment of commitment — that phase is "umowa i płatność", and a case can
legitimately sit there while a second financier is still worth waiting for (better terms arriving late
happens, and it is one of the few levers a broker has). Withdrawing on phase entry throws that option
away, and withdrawal is not something you take back with a financier.

**One trigger: `contractSignedAt` being set.** That is commitment, and it is already the HARD gate input
for `DELIVERY`. Keep `closeWon` as a safety net for cases closed without a recorded signature. Drop the
phase transitions.

### 2.2 Which application won?

The plan withdraws "all other active applications" without saying how the survivor is chosen. With one
approval it is inferable; with two — the situation this whole change exists to create — it is not.

Signing the contract must **name** the application:

```prisma
contractedApplicationId String? @unique @map("contracted_application_id")
```

on `PipelineOpportunity`, set in the same transaction as `contractSignedAt`. Everything else follows from
it: the withdrawal set is "active applications other than this one", and
`PARALLEL-APPLICATIONS.md` §4.4 ("commission attaches to the application that was contracted") finally
has an anchor — without this field it has none.

## 3. `APPLICATION_WITHDRAWN` needs a closed reason vocabulary

`EVENTS.md` types the payload as `{ financierCode, reason }` with `reason` free text. `CONTRACTED_ELSEWHERE`
is about to become the most common value, and it means something categorically different from the others:
**it is not a failure.**

If the reason stays free text, M3's recovery-rate and per-financier queries will count
contracted-elsewhere withdrawals as unsuccessful attempts, and every parallel submission will make the
financiers look worse than they are — the exact misreading `PARALLEL-APPLICATIONS.md` §5 warns about,
arriving through the withdrawal path instead of the rejection path.

Close the set now, in `event-types.ts` and in the service:

`CONTRACTED_ELSEWHERE` · `CUSTOMER_RESIGNED` · `EXPIRED` · `SUPERSEDED_BY_NEW_OFFER` · `OTHER` (comment required)

Only `CONTRACTED_ELSEWHERE` is excluded from failure counts. Write that rule down next to the vocabulary
so M3 does not have to guess it.

## 4. Completeness bar — say which phase it measures

"`met/total` requirements satisfied for current/next phase" names two different numbers. The useful one
is the **next** phase: the advisor wants to know whether the card will move before dragging it. Measure
requirements for `PIPELINE_PHASES[indexOf(current) + 1]`; in the last phase, or when the case is closed,
return no bar rather than a full one.

Keep the batch computation as planned. Add to the DoD an assertion that rendering a board of N
opportunities issues a constant number of queries, not N — that is the whole reason this was raised.

---

## 5. Migration note

Use `ALTER TABLE "pipeline_applications" RENAME COLUMN "attempt_sequence" TO "round_number"` in the
hand-written DDL. Prisma's generated migration for a rename is usually DROP + ADD, which silently discards
the column's data. Dev data is expendable today; the habit is not, and this is the first migration in the
project that is not additive-only — review it statement by statement.

Expected statements, and nothing else:
drop `pipeline_applications_reroute_from_id_key`, drop
`pipeline_applications_opportunity_id_attempt_sequence_key`, rename the column, create the new unique
index, create the index on `reroute_from_id`, add `contracted_application_id` (§2.2).

---

## 6. Confirmed as planned

- `application.*` satisfied by ANY non-`WITHDRAWN` application — matches the decision document.
- Document materialization as the union across active financiers.
- `rerouteApplication` reduced to sugar over `createApplication`, phase move delegated to the shared
  `changePhase`. This resolves `M2-REVIEW.md` §2.2.
- Applications grouped by round in the UI, multi-select successor financiers in the reroute modal,
  `R1: Ayvens + Vehis` badges on cards.
- Test list is the right one. Add two cases: a `JOIN_CURRENT` add landing in the current round rather
  than a new one (§1), and a contract signature naming one of two approved applications and withdrawing
  the other with `CONTRACTED_ELSEWHERE` (§2.2, §3).

---

## 7. Implementation review — commit `529eeab`

**Verdict: ACCEPTED WITH CHANGES.** Nothing blocking. One modelling defect that will misreport in M3
(§7.2), one item from §3 not implemented, two nits.

### 7.1 Verified

| Item | Result |
|---|---|
| Migration | ✅ Exactly the expected statements: `RENAME COLUMN`, both constraints dropped, new `(opportunity, financier, round)` unique index, `reroute_from_id` index, `contracted_application_id` with `ON DELETE SET NULL`. Nothing outside the module. |
| §1 `roundMode` | ✅ `JOIN_CURRENT` / `NEW_ROUND` explicit, reroute passes `NEW_ROUND`. Good defensive touch: `JOIN_CURRENT` escalates to a new round when that financier is already present in the current one, so the unique key can't be violated by a legitimate action. |
| §2.1 withdrawal trigger | ✅ Fires on `contractSignedAt` + `contractedApplicationId`, not on entering `CONTRACT`. |
| §2.2 contracted application named | ✅ `contractedApplicationId` on the opportunity, FK in place. |
| §4 completeness | ✅ Measures `PIPELINE_PHASES[current + 1]`, returns `nextPhase: null` in the last phase; requirements are passed in pre-loaded rather than fetched per row. |
| Commission | ✅ Only `updateMany` attaching `applicationId` to existing records — no commission is created in M2, so M3's derivation stays where it belongs. |
| `M2-REVIEW.md` §2.2 | ✅ `rerouteApplication` now calls `changePhase`; the inline copy is gone. |

### 7.2 `CONTRACTED_ELSEWHERE` is modelled as a loss reason — fix before M3

Two related choices, both wrong in the same direction:

```ts
// seeds/pipeline.ts
{ code: 'CONTRACTED_ELSEWHERE', label: 'Wybrano innego finansującego',
  category: 'APPLICATION_WITHDRAWN', … }

// opportunity.service.ts
data: { state: WITHDRAWN, rejectionReasonCode: 'CONTRACTED_ELSEWHERE', … }
```

1. It sits in `pipeline_loss_reasons`, whose categories are `FINANCIER` / `CUSTOMER` / `QUALIFICATION`,
   under an invented fourth. That table feeds the `closeLost` dictionary, so "Wybrano innego
   finansującego" becomes selectable as a reason to **lose** a case — while in reality it only ever
   occurs on a case that was **won**.
2. It is written into `rejectionReasonCode`. At row level a withdrawal is now indistinguishable from a
   refusal, so any M3 query of the shape *"rejections at this financier"* counts a financier who never
   refused anything. That is exactly the misreading `PARALLEL-APPLICATIONS.md` §5 exists to prevent —
   and it is now in the state table, not just in an event payload where a filter could still catch it.

**Fix:** a dedicated `withdrawalReasonCode` column on `PipelineApplication`, with its own closed
vocabulary, and leave `rejectionReasonCode` meaning only what its name says. If the column is deferred,
the minimum is that `CONTRACTED_ELSEWHERE` leaves `pipeline_loss_reasons` entirely and every rejection
query excludes withdrawn applications — written down, not remembered.

### 7.3 §3 not implemented — `APPLICATION_WITHDRAWN.reason` is still `string`

`event-types.ts` still types it as free text. The closed set was the point: `CONTRACTED_ELSEWHERE` ·
`CUSTOMER_RESIGNED` · `EXPIRED` · `SUPERSEDED_BY_NEW_OFFER` · `OTHER`, with only the first excluded from
failure counts. This is the type-level half of §7.2 and should land in the same commit.

### 7.4 Nits

- **`withdrawOtherApplicationsOnContract` is dead code.** It is exported from `application.service.ts`
  and never called; `opportunity.service.ts` carries its own inline copy of the same loop. This is the
  duplication pattern from `M2-REVIEW.md` §2.2 — correctly removed for reroute, reintroduced here.
  Keep the helper, call it, delete the inline copy.
- **`calculateOpportunityCompleteness(opportunity: any, allRequirementsForScope: any[])`** — two `any`
  in a new function, against the module's own rule. It decides what every advisor sees on every card;
  type it.
- The `customer.companyNip` special case counting as *met* for non-B2B is unreachable while the seeded
  row carries `clientType = B2B` (the filter above already drops it). Harmless today, misleading to read.
  A non-applicable requirement should be excluded from `total`, never counted as met.

### 7.5 Still open

- **The stopwatch.** Unmeasured since M1 and now covering more ground: qualify → vehicle → offer →
  application → refusal → parallel reroute. This is the last thing standing between M2 and operational
  acceptance, and it is not something the test suite can answer.
- Query-count assertion for the board (§4) — the shape is right (requirements pre-loaded), but nothing
  asserts it stays that way.

---

## 8. §7 fixes — accepted

| Item | Verification |
|---|---|
| §7.2 withdrawal isolated | ✅ `withdrawal_reason_code` added; withdrawal sets it and nulls `rejectionReasonCode`; `CONTRACTED_ELSEWHERE` removed from the seed and deleted from `pipeline_loss_reasons` by the migration. `rejection_reason_code` again means only what its name says. |
| §7.3 closed vocabulary | ✅ `ApplicationWithdrawalReason` union in `event-types.ts`, `APPLICATION_WITHDRAWN.reason` typed, with the "excluded from failure counts" rule in a comment on the member itself. |
| §7.4 duplication | ✅ `opportunity.service.ts` imports and calls `withdrawOtherApplicationsOnContract`; the inline loop is gone. |
| §7.4 typing | ✅ Zero `any` in `requirements.ts`; non-applicable requirements excluded from `total`. |

**One line to add to the migration.** `pipeline_applications_rejection_reason_code_fkey` is
`ON DELETE SET NULL`, so the `DELETE FROM pipeline_loss_reasons` silently nulls the column on any
application already withdrawn as `CONTRACTED_ELSEWHERE` — those rows end up with neither reason.
Backfill before deleting:

```sql
UPDATE "pipeline_applications" SET "withdrawal_reason_code" = 'CONTRACTED_ELSEWHERE'
WHERE "state" = 'WITHDRAWN' AND "rejection_reason_code" = 'CONTRACTED_ELSEWHERE';
```

Irrelevant on a database where the flow was never exercised, which is why it will not show up in testing.

## 9. The stopwatch benchmark measures the wrong thing

`advisor-stopwatch.test.ts` is a good test and worth keeping: it proves the nine-step flow composes
end to end, and the constant query count on the board is exactly the §4 assertion that was missing.

It is not the acceptance criterion. 223 ms is **server execution time**; the criterion was a person
completing a real qualification in under 30 seconds. The gap between them is the entire user experience —
finding the lead, reading it, deciding the owner, deciding the product, choosing a date, understanding
what the modal is asking. A flow can run in 4 ms per call and still take an advisor four minutes, and it
is the four minutes that decides whether this module replaces the spreadsheet or joins it.

The measurement that is still owed: one advisor who did not build this, one real lead, a clock, and the
number of times they stop to ask what a field means. Rename the benchmark to
`advisor-flow-performance.test.ts` so it stops standing in for that.
