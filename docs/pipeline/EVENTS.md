# Pipeline event log — contract and catalogue

## 1. What this is (and is not)

`pipeline_events` is an **append-only audit log**, not an event-sourced write model.

- State tables (`pipeline_opportunities`, `pipeline_offers`, …) stay the source of truth for reads.
- Every state change writes **both** the state row and one event row **in the same transaction**.
- Rebuilding state from events is not a supported operation. Do not design for it.

Rationale: at this volume, full event sourcing costs Prisma ergonomics and query simplicity while buying
replay capability nobody will use. The append-only log gives us everything we actually need — case history,
customer history, funnel timing, automation triggers — at a fraction of the complexity.

## 2. Hard rules

1. **No state write without an event.** Every mutating service function takes a Prisma transaction client
   and calls `recordEvent(tx, …)` before returning. A repository write outside a transaction is a bug.
2. **Events are immutable.** A Postgres trigger rejects `DELETE` and rejects `UPDATE` of any column other
   than `dispatched_at`. Corrections are new compensating events, never edits.
3. **Roll-up keys are mandatory.** Every event sets `opportunityId` when a case exists, and `customerId`
   whenever the customer is known — including events whose aggregate is an offer or an application.
   These two indexes are the entire point of the table.
4. **Payload carries `before` / `after` for field changes.** Never store the whole entity; store what moved.
5. **`idempotencyKey` is required for anything ingested from outside** (Thulium webhook, car-scout lead,
   automation retries). Format: `<source>:<externalId>:<eventKind>`. Unique constraint does the deduplication.
6. **`correlationId` propagates through a causal chain**; `causationEventId` points at the event that
   directly produced this one. An automation-created task must be traceable back to the rejection that
   caused it, or debugging automations becomes archaeology.

## 3. Event catalogue

Payload shapes are given as TypeScript. `aggregateType` values: `OPPORTUNITY`, `OFFER`, `APPLICATION`,
`CUSTOMER`, `TASK`, `DOCUMENT`, `COMMISSION`.

### Opportunity

| type | aggregate | payload |
|---|---|---|
| `OPPORTUNITY_CREATED` | OPPORTUNITY | `{ number, leadSource, leadSourceDetail?, sourceLeadId?, clientType, createdFrom: 'INBOX' \| 'MANUAL' \| 'THULIUM' }` |
| `OPPORTUNITY_PHASE_CHANGED` | OPPORTUNITY | `{ before: Phase, after: Phase, durationSeconds, overridden: boolean, unmetRequirements?: string[] }` |
| `OPPORTUNITY_OWNER_CHANGED` | OPPORTUNITY | `{ before: userId \| null, after: userId, reason: 'MANUAL' \| 'ROUND_ROBIN' \| 'PICKUP' }` |
| `OPPORTUNITY_NEXT_ACTION_SET` | OPPORTUNITY | `{ before?: {type,dueAt}, after: {type,dueAt,note?} }` |
| `OPPORTUNITY_FIRST_CONTACT` | OPPORTUNITY | `{ at, channel, secondsFromFirstTouch }` |
| `OPPORTUNITY_WON` | OPPORTUNITY | `{ phase, applicationId?, commissionGrosze? }` |
| `OPPORTUNITY_LOST` | OPPORTUNITY | `{ phase, reasonCode, comment?, daysOpen }` |
| `OPPORTUNITY_REOPENED` | OPPORTUNITY | `{ previousStatus, reason }` |
| `OPPORTUNITY_CLIENT_TYPE_SET` | OPPORTUNITY | `{ before, after }` |
| `OPPORTUNITY_SLA_BREACHED` | OPPORTUNITY | `{ slaCode, phase, dueAt, overdueSeconds }` |

`OPPORTUNITY_PHASE_CHANGED.durationSeconds` is time spent in the previous phase. Emitting it here means
the funnel-timing report is a single aggregate over the event table, with no window functions.

### Vehicle & offer

| type | aggregate | payload |
|---|---|---|
| `VEHICLE_CANDIDATE_ADDED` | OPPORTUNITY | `{ candidateId, listingId?, rentalVehicleId?, label, priceSnapshotGrosze? }` |
| `VEHICLE_SELECTED` | OPPORTUNITY | `{ candidateId, previousCandidateId? }` |
| `OFFER_CREATED` | OFFER | `{ versionNumber, financingType, priceGrosze, monthlyRateGrosze, periodMonths }` |
| `OFFER_UPDATED` | OFFER | `{ before: Partial<Offer>, after: Partial<Offer> }` |
| `OFFER_PRESENTED` | OFFER | `{ channel: 'CALL' \| 'EMAIL' \| 'SMS', at }` |
| `OFFER_ACCEPTED` | OFFER | `{ at }` |
| `OFFER_SUPERSEDED` | OFFER | `{ bySupersedingOfferId, versionNumber }` |

### Financing application — the reroute chain

| type | aggregate | payload |
|---|---|---|
| `APPLICATION_CREATED` | APPLICATION | `{ financierCode, attemptSequence, offerId?, rerouteFromId?, recommenderRank?, recommenderScore? }` |
| `APPLICATION_SUBMITTED` | APPLICATION | `{ stage: 'PRECHECK' \| 'FULL', financierCode, externalReference? }` |
| `APPLICATION_DECIDED` | APPLICATION | `{ financierCode, decision: 'APPROVED' \| 'CONDITIONALLY_APPROVED' \| 'REJECTED', reasonCode?, conditions?, decisionDays }` |
| `APPLICATION_REROUTED` | APPLICATION | `{ fromFinancierCode, toFinancierCode, fromApplicationId, rejectionReasonCode }` |
| `APPLICATION_WITHDRAWN` | APPLICATION | `{ financierCode, reason }` |

`recommenderRank` / `recommenderScore` are written when the advisor picked a financier the recommender
suggested. Without them there is no way to tell later whether the recommender actually helped — log it
from day one, even before the recommender is smart.

### Documents, tasks, commission

| type | aggregate | payload |
|---|---|---|
| `DOCUMENT_REQUESTED` | DOCUMENT | `{ code, label, requestedVia }` |
| `DOCUMENT_RECEIVED` | DOCUMENT | `{ code, hoursSinceRequest }` |
| `DOCUMENT_VERIFIED` | DOCUMENT | `{ code }` |
| `DOCUMENT_WAIVED` | DOCUMENT | `{ code, reason }` |
| `TASK_CREATED` | TASK | `{ title, kind, dueAt?, assignedUserId?, createdBy: 'USER' \| 'AUTOMATION', ruleCode? }` |
| `TASK_COMPLETED` | TASK | `{ title, kind, overdueSeconds }` |
| `COMMISSION_ESTIMATED` | COMMISSION | `{ basisGrosze, ratePct, amountGrosze, source: 'PRODUCT' \| 'FINANCIER' \| 'MATRIX' }` |
| `COMMISSION_STATUS_CHANGED` | COMMISSION | `{ before, after, amountGrosze, invoiceNumber? }` |
| `COMMISSION_OVERRIDDEN` | COMMISSION | `{ before: amountGrosze, after: amountGrosze, reason }` |

### Communication (ingested, not authored here)

| type | aggregate | payload |
|---|---|---|
| `CALL_LOGGED` | OPPORTUNITY | `{ thuliumConnectionId, direction, durationSeconds, agentName?, recordingUrl?, topic? }` |
| `EMAIL_LOGGED` | OPPORTUNITY | `{ thuliumTicketId, direction, subject? }` |
| `TICKET_LINKED` | OPPORTUNITY | `{ thuliumTicketId, thuliumCustomerId }` |
| `NOTE_ADDED` | OPPORTUNITY | `{ content }` |

These arrive from `crm-connector`, with `actorType = THULIUM` and an `idempotencyKey`. They require no
advisor effort, which is precisely why they matter: they are what makes the case view worth opening.

## 4. `recordEvent` contract

```ts
type RecordEventInput = {
  scopeType: ScopeType
  scopeId: string
  type: PipelineEventType          // union of the strings above, not `string`
  aggregateType: AggregateType
  aggregateId: string
  opportunityId?: string
  customerId?: string
  actor: { type: PipelineActorType; userId?: string; label?: string }
  payload: Record<string, unknown>
  occurredAt?: Date                // defaults to now(); set explicitly for ingested events
  correlationId?: string
  causationEventId?: string
  idempotencyKey?: string
}

async function recordEvent(tx: Prisma.TransactionClient, input: RecordEventInput): Promise<string>
```

Returns the new event id so a caller can chain `causationEventId`. On unique violation of
`idempotencyKey`, returns the existing event id instead of throwing — ingestion retries must be safe.

`PipelineEventType` is a TypeScript union generated from the catalogue above and payload types are
mapped per event type. An event whose payload does not typecheck is a compile error, not a runtime surprise.

## 5. Reading the log

Three queries carry almost all the value; build them as named repository functions, not ad-hoc:

1. `getOpportunityTimeline(opportunityId)` — ordered by `occurredAt`, for the case detail view.
2. `getCustomerHistory(customerId)` — across all their opportunities, for "have we spoken before".
3. `getFunnelTransitions(scope, dateRange)` — `OPPORTUNITY_PHASE_CHANGED` aggregated by
   `(before, after)` with median `durationSeconds`; this is the funnel and the bottleneck report,
   and it is cohort-correct because every event carries its own date.

## 6. Retention

Events carry no PESEL, no ID numbers, no document files. They do carry names, phone numbers and case
content, so they fall under the same retention policy as `leads`. Add an anonymization job before the
first tenant other than Motolia is onboarded — out of scope for v0.1, in scope before SaaS.
