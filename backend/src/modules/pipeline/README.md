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

`POST /api/pipeline/integrations/thulium/webhook` accepts authenticated Thulium ticket/customer
identifiers. Configure `THULIUM_WEBHOOK_USER` / `THULIUM_WEBHOOK_PASSWORD` and enter them as the Login
and Hasło fields in the Thulium webhook form (Administracja → Zaawansowane → Webhooks), which sends
them as Basic Auth. The route resolves an
explicit opportunity ID, or exactly one open opportunity by normalized customer phone. Zero or
ambiguous phone matches return `204` without writing; identifier conflicts return `409`.

Phone fallback deliberately considers only opportunities with `status = OPEN`; callbacks for won,
lost, or archived cases need an explicit opportunity ID. The webhook secret is platform-wide: its
holder can link an opportunity in any tenant, while scope is always derived from the resolved record
and is never accepted from the callback payload.
