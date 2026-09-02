# M2 plan — review

**Verdict: CHANGES REQUESTED.** The plan covers §M2 of `IMPLEMENTATION.md` accurately and the reroute
model is right. Two items block the start (§1), three change the design (§2), one is a business question
only Motolia can answer (§3).

---

## 1. Blocking

### 1.1 The M1 precondition is missing from the plan

`M1-REVIEW.md` §6.1 ends: *"do not build the `FINANCIAL_DECISION` gate until §6.1 lands"*. The plan makes
`opportunity.financingType` the first HARD requirement of that gate and does not mention §6.1 anywhere.

`QualifyLeadModal` still initialises `financingType` to `'LEASING'` and `clientType` to `'B2C'` as
constants. Build the gate on top of that and it passes on a value nobody chose, for every case an advisor
did not explicitly correct — and it will look like it is working. A gate whose input is defaulted is not
a control, it is a formality that also corrupts the product-mix reporting it feeds.

**Do §6.1 first, in its own commit:** both fields start empty, `financingType` optional at qualification,
`clientType` pre-selected only where a NIP or company name on the lead genuinely implies it, `UNKNOWN`
otherwise. Then build the gate.

### 1.2 The DELIVERY gate requires `commission.basisGrosze`, which M3 delivers

The plan seeds `commission.basisGrosze` as HARD for entering `DELIVERY`. There is no commission service
until M3 — `PipelineCommission` has a model and nothing that writes it. As specified, no case can ever
reach `DELIVERY` in M2: the gate is unsatisfiable and advisors hit a wall on the last step of a real deal.

This is my sequencing error in `M0-CHECKLIST.md` §4.3, not the plan's. Correcting it:

- **M2:** `DELIVERY` gate = `opportunity.contractSignedAt` only, HARD.
- **M3:** `commission.basisGrosze` becomes HARD at the same time as the derivation that fills it.

Seed the row now with `enforcement = 'SOFT'` so it shows on the completeness bar, and flip it to `HARD`
in M3. `M0-CHECKLIST.md` §4.3 is corrected accordingly.

---

## 2. Design changes

### 2.1 Requirement field paths are ambiguous — define resolution before writing the evaluator

`evaluatePhaseRequirements` resolves dot paths "against the aggregated opportunity object". An
opportunity has **many** offers and **many** applications, so `offer.priceGrosze` and
`application.financierId` do not name a row. The evaluator will pick something, and after the first
reroute — the flow M2 exists to introduce — it will pick unpredictably.

Define it in `requirements.ts`, in one place, as data the evaluator receives:

| prefix | resolves to |
|---|---|
| `opportunity.` | the opportunity row |
| `customer.` | its `PipelineCustomer` |
| `offer.` | the current offer: highest `versionNumber` whose status is not `SUPERSEDED`; none → all `offer.*` unmet |
| `application.` | the latest attempt: highest `attemptSequence` whose state is not `WITHDRAWN`; none → all `application.*` unmet |
| `commission.` | the single non-`REVERSED` commission record; none → unmet |

A missing parent is an unmet requirement, never a thrown error — the point of the gate is to report what
is missing, not to fail on it.

### 2.2 Gates apply to forward transitions only

`isPhaseTransitionAllowed` currently accepts any transition between known phases, with no direction. Wire
the gate into `changePhase` as planned and a case can no longer move **backwards** — DELIVERY back to
COMPLETING when the delivery falls through, FINANCIAL_DECISION back to SELECTION when the customer
changes car. Those are exactly the moments the advisor needs the board to follow reality, and the gate
would refuse because a later phase's requirements are unmet.

Rule: evaluate HARD requirements only when `PIPELINE_PHASES.indexOf(target) > indexOf(current)`.
A backward move is always allowed and emits `OPPORTUNITY_PHASE_CHANGED` like any other — the event log
is what makes back-and-forth legible later. Add a test for a backward transition with unmet forward
requirements succeeding.

This also settles the reroute ordering: create the new application first, then move the phase. Coming
from `CONTRACT` or later, the return to `FINANCIAL_DECISION` is backwards and ungated; coming from
`FINANCIAL_DECISION` it is a no-op.

### 2.3 Materialize documents automatically, not through an endpoint

`POST /api/pipeline/opportunities/:id/documents/materialize` is a button someone has to remember to
press. It will not get pressed, and "brak dokumentów od klienta" is one of the top controllable loss
reasons — the checklist only helps if it exists before anyone needs it.

Call `materializeDocuments` from the service layer whenever `financingType`, `clientType` or the latest
application's financier changes, idempotently (existing rows keep their status; only genuinely new
requirements are added; requirements that no longer apply are marked `WAIVED`, never deleted — a
document already received must not vanish because the product changed). Keep the endpoint if useful for
repair, but nothing in the normal flow should depend on it.

---

## 3. Business question — parallel applications

`PipelineApplication` has `@@unique([opportunityId, attemptSequence])` and `rerouteFromId @unique`, so
attempts form a strictly linear chain: Ayvens → Vehis → Leasys, one live attempt at a time. That matches
the historical spreadsheet, where reroutes read as sequential.

**Does Motolia ever submit one case to two financiers at the same time?** At a 74.5% rejection rate it
would be a rational tactic, and if it is done — or is likely within a year — the model needs to allow two
open attempts now, while changing it is a migration rather than a rewrite of the reporting built on it.
The linear chain is a fine answer; it just has to be a decided one. Kamil to confirm before M2 starts.

---

## 4. Note — completeness bar on the board

The bar is planned for every kanban card and queue row. Evaluating requirements per opportunity turns
one board render into N evaluations, each touching offers, applications, documents and the customer. With
50 open cases that is a visibly slow board and the first thing an advisor will complain about.

Compute it in the list query — one pass over the requirement rows joined against the aggregate, returning
`met/total` per opportunity — not by calling the single-opportunity evaluator in a loop. If that proves
awkward, denormalize a `requirementsMet` / `requirementsTotal` pair on the opportunity, refreshed in the
same transaction as any change that could affect it.

---

## 5. Confirmed as planned

- Applications owned by the opportunity, `offerId` optional; rejection requires a `FINANCIER` dictionary
  code; rejection never closes the case. Correct, and it is the point of the milestone.
- Reroute creates `attemptSequence + 1` with `rerouteFromId` and emits `APPLICATION_REROUTED`.
- Offer edited in place, no wizard; supersede bumps the version and emits `OFFER_SUPERSEDED`;
  `OFFER_UPDATED` carries only changed fields.
- Rate calculation reuses `calcOwnInstallment` from `backend/src/services/financing-calc.service.ts`
  (verified present) — no bank API calls from this module.
- Documents tracked by status only, no files, no personal data.
- 422 with `{ error, currentPhase, targetPhase, missing }` and a fully rolled-back transaction; assert
  both halves, and assert that **no event was written** on the failed attempt.
- Exactly two HARD gates, subject to §1.2 reducing DELIVERY to one requirement in M2.

## 6. Definition of done — additions

Beyond the plan's tests:

```
- backward transition with unmet forward requirements succeeds and emits the event
- gate failure writes no pipeline_events row (not just no phase change)
- after a reroute, `application.*` requirements resolve against attempt 2, not attempt 1
- an opportunity with a superseded offer resolves `offer.*` against the current version
- documents materialize without anyone calling the endpoint
```
