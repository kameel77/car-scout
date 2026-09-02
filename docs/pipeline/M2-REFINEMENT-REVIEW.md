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
