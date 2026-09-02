# M2 review

**Verdict: ACCEPTED WITH MINOR CHANGES.** Nothing blocking — the first milestone in this project without
a blocking defect. Two items to fix (§2), two process notes (§3).

Verification was static. Test results are as reported, not confirmed.

---

## 1. Verified

| Review item | Result |
|---|---|
| §1.1 M1 precondition | ✅ Fixed ahead of M2 in `8a14d9e`: `financingType` starts empty, `clientType` uses `deriveClientType(lead)` rather than a constant. |
| §1.2 DELIVERY gate | ✅ `REQ_DEL_CONTRACT_SIGNED` HARD, `REQ_DEL_COMMISSION_BASIS` seeded `SOFT` — flips to HARD in M3 with the derivation. |
| §2.1 field-path resolution | ✅ Implemented exactly as specified: `offer.*` → highest `versionNumber` not `SUPERSEDED`; `application.*` → highest `attemptSequence` not `WITHDRAWN`; missing parent yields an unmet requirement, never a throw. |
| §2.2 forward-only gating | ✅ `isForwardTransition` compares phase indices; HARD requirements evaluated only when the target is later. Backward moves pass and still emit `OPPORTUNITY_PHASE_CHANGED`. |
| §2.3 automatic materialization | ✅ Called from five service-layer sites (opportunity create and update, application create, reroute, document service itself). The endpoint is no longer the only path. |
| 422 leaves no trace | ✅ In `changePhase` the gate is evaluated **before** the `update` and before `recordEvent`; the throw rolls the transaction back, so neither the phase change nor an event survives. `StageGateViolationError` carries `statusCode`, `currentPhase`, `targetPhase`, `missing[]`. |
| Rejection never closes a case | ✅ `decideApplication` validates the reason against `pipeline_loss_reasons` (`FINANCIER`) and never touches `status`. |
| Reroute | ✅ `attemptSequence + 1`, `rerouteFromId`, forces `status: 'OPEN'`, returns to `FINANCIAL_DECISION` ungated. |
| Rate calculation | ✅ Reuses `calcOwnInstallment`; no bank API calls from the module. |

---

## 2. To fix

### 2.1 The completeness bar was dropped without being deferred

The plan put it on kanban cards and queue rows. Neither `queue.service.ts` nor
`opportunity-read.service.ts` evaluates requirements for a list, and the implementation report describes
the cards as gaining "application status and monthly rate" instead. The M2 plan review's §4 was guidance
on *how* to compute it cheaply, not permission to skip it.

It matters more than it looks. Without the bar, the only way an advisor learns a card cannot move is to
drag it and be refused. The 422 modal is a good failure message, but a system whose sole feedback channel
is rejection trains people to avoid the action — and the whole reason the gates are only two is that they
should almost never fire.

Implement per §4: one pass over the requirement rows joined against the aggregate, returning `met/total`
per opportunity in the list query — not the single-opportunity evaluator in a loop. If it is being
deferred to M3, say so explicitly in the milestone record with a reason; silent scope loss is the thing
to avoid, not the deferral.

### 2.2 `rerouteApplication` duplicates `changePhase` instead of calling it

`application.service.ts` writes `phase`, `phaseEnteredAt` and `status`, then emits
`OPPORTUNITY_PHASE_CHANGED` inline — a second copy of the logic that `changePhase` already owns.

Because the return to `FINANCIAL_DECISION` is a backward transition, `changePhase` would not gate it: the
behaviour is identical, so the duplication buys nothing. It costs later — M3 adds SLA recalculation and
commission status to phase changes, and the reroute path will silently not get them. Two places that
write the same three columns and emit the same event will drift, and the drift will show up as a case
whose timeline is subtly wrong.

Call `changePhase` from `rerouteApplication` and delete the inline copy. If a caller ever genuinely needs
to bypass gating on a forward move, that is an explicit `overridden` flag on `changePhase`, not a second
implementation.

---

## 3. Process notes

- **M2 is entirely uncommitted.** Same note as M0: a milestone that cannot be reverted on its own is not
  a milestone. Commit before M3, and keep `features_desc.md` in that commit rather than trailing it.
- **Service errors are thrown as bare `Error` with Polish messages** (`Niedozwolone przejście z fazy…`,
  `Kod powodu odrzucenia jest wymagany…`). These reach the client as 500s with Polish text in an English
  API. `StageGateViolationError` shows the right pattern — a typed error with `statusCode` and structured
  fields. Bring the remaining validation errors up to it in M3, with an English code and the Polish string
  supplied by the UI.

---

## 4. Still open from earlier milestones

- **The stopwatch.** M1 operational acceptance is still unmeasured with a real advisor. M2 has now added
  four tabs to the case view, so the walkthrough should cover the full path — qualify, pick a vehicle,
  build an offer, submit, register a rejection, reroute — not just qualification.
- **Parallel applications** (`M2-PLAN-REVIEW.md` §3) is unanswered. The implementation locks in the linear
  chain, which is fine as a decision but has not been made as one. It is cheap to change now and expensive
  after M3 builds recovery-rate reporting on it.
