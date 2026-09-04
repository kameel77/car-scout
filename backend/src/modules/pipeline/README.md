# Pipeline module

Deal & financing process engine. Owns everything under the `pipeline_*` tables.

**Specification:** `docs/pipeline/IMPLEMENTATION.md`, `docs/pipeline/DATA-MODEL.prisma`,
`docs/pipeline/EVENTS.md`. Read those first; this file is only the map.

## Intended layout

```
backend/src/modules/pipeline/
  index.ts                  registerPipelineModule(app) — the single wiring point in app.ts
  events/
    event-types.ts          PipelineEventType union + per-type payload map
    record-event.ts         recordEvent(tx, input) — the only writer of pipeline_events
    outbox-worker.ts        node-cron worker draining dispatched_at IS NULL
  workflow/
    phases.ts               phase order and allowed transitions
    requirements.ts         evaluates PipelinePhaseRequirement rows (SOFT / HARD)
  services/                 one file per aggregate; all take a Prisma transaction client
  routes/                   Fastify routes, Zod schemas, shared scope preHandler
  __tests__/
```

No TypeScript stubs are committed here on purpose: the module cannot compile before the Prisma
migration in M0 generates the client types. M0 creates these files.

## Two rules that are easy to break

1. **No state write without an event, in the same transaction.** `recordEvent` is the only writer of
   `pipeline_events`; every mutating service calls it before returning.
2. **Every query filters `(scopeType, scopeId)`.** One tenant today, multi-tenant by construction.
   The shared preHandler is the only place that filter is written.

## Boundary

Foreign keys into `Listing`, `RentalVehicle`, `Lead`, `User`, `FinancingProduct` are allowed and are the
reason this module lives in this database. Nothing outside the module may hold a foreign key **into** a
`pipeline_*` table. That asymmetry is the extraction seam.

## Thulium return webhook

`POST /api/pipeline/integrations/thulium/webhook` accepts Thulium's native notification payload
(see https://motolia.thulium.com/docs/api/notifications), authenticated with Basic Auth. Configure
`THULIUM_WEBHOOK_USER` / `THULIUM_WEBHOOK_PASSWORD` and enter them as the Login and Hasło fields in
the Thulium webhook form (Administracja → Zaawansowane → Webhooks), which sends them as Basic Auth.
The distinguishing field is `action`; there is no `event_id`, so idempotency keys are built from the
payload's own identifiers instead.

Each `action` resolves the case differently:
- `AGENT_RINGING` — carries a phone number but no `customer_id`. Resolved to exactly one open
  opportunity by normalized customer phone, and logs a `CALL_LOGGED` event recording the
  `connection_id`.
- `RECORDING_READY` — carries only `connection_id`, no phone and no `customer_id`. The case is found
  exclusively by looking up the earlier `CALL_LOGGED` event with that `connection_id`, and a
  `CALL_RECORDING_ATTACHED` event is recorded (pipeline events are immutable, so the recording cannot
  be merged into the original `CALL_LOGGED` row).
- `TICKET_CREATED` — carries `customer_id` but no phone. Resolved via `thuliumCustomerId` on the
  matched `PipelineCustomer`, then to exactly one of that customer's open opportunities.
- `CUSTOMER_CREATED` / `CUSTOMER_UPDATED` — carry only `customer_id`, no phone, and no way to
  discover it without a Thulium REST API client, which does not exist yet. These are accepted and
  acknowledged but never resolved.

Zero or ambiguous matches return `204` without writing; identifier conflicts return `409`.

Phone/customer fallback deliberately considers only opportunities with `status = OPEN`. The webhook
secret is platform-wide: its holder can link an opportunity in any tenant, while scope is always
derived from the resolved record and is never accepted from the callback payload.

### Dead letters

Every notification that comes back `unresolved` — `no_open_opportunity`, `ambiguous_phone`,
`unknown_connection`, `unknown_thulium_customer`, `ambiguous_customer_opportunities` — is written to
`pipeline_thulium_dead_letters` in the same transaction, so it is reviewable rather than only logged.
A payload that fails zod validation is recorded too, with `reason: 'invalid_payload'`, so we notice
if Thulium starts sending an `action` we don't yet handle; that write happens outside the transaction
and is never allowed to turn the `400` into a `500`.

The exception is `CUSTOMER_CREATED` / `CUSTOMER_UPDATED` (`not_actionable_without_thulium_client`):
these arrive in bulk and are unresolvable by design today, so recording them would just flood the
review list — they stay log-only.

Rows live in the `PLATFORM` scope, since an unmatched notification doesn't belong to any dealer; in
practice this is the scope Motolia's own advisors work in. Review and dismiss them via
`GET /api/pipeline/integrations/thulium/unmatched` and
`POST /api/pipeline/integrations/thulium/unmatched/:id/dismiss` (both `pipeline:read` /
`pipeline:write`, scoped from the JWT like every other pipeline endpoint).

## Thulium external CRM lookup

`GET /api/pipeline/integrations/thulium/customer-lookup?phone_number=<number>` implements Thulium's
native "external CRM" contract (see https://motolia.thulium.com/docs/api/external_crm): when an agent
handles a call, Thulium calls this URL and shows the returned JSON on the customer card, live and
without any sync step. Authenticated with the same `THULIUM_WEBHOOK_USER` / `THULIUM_WEBHOOK_PASSWORD`
Basic Auth credentials as the return webhook above. An unknown phone number returns `404`. Configure the
URL and credentials in Thulium under `Administracja → Zaawansowane → Integracja → Parametry zewnętrznego
CRM`.
