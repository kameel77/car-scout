# motolia-pipeline — implementation strategy

**Audience:** the implementing agent (Antigravity / AG).
**Reviewer:** Kamil + Claude. Every milestone is reviewed before the next one starts.
**Branch:** `feat/pipeline-foundation`, branched from `dev`.

Read this file, `DATA-MODEL.prisma` and `EVENTS.md` in full before writing code.
Where this document and the earlier standalone-app plan disagree, this document wins.

---

## 0. Context in one paragraph

Motolia is a vehicle finance broker. The real sales funnel currently lives in a hand-maintained
spreadsheet (`Statusy 1008.xlsx`): 55 cases over three months, 74.5% financier rejection rate, 13
contracts, 6 deliveries, a 30–45 day lead-to-cash cycle. Thulium CRM owns customer communication but
models no deal process. This module replaces the spreadsheet with a deal & financing process engine
inside the existing `car-scout` codebase: an advisor work queue, a kanban board, product-aware stage
gating, multi-attempt financing with reroute after rejection, a complete event history per case and per
customer, and derived commission tracking.

---

## 1. Non-negotiables

These are architectural decisions, not preferences. Do not "improve" them without asking.

1. **The module lives in this repository and this database.** Backend under
   `backend/src/modules/pipeline/`, admin UI under `src/pages/admin/pipeline/`. Cross-module references
   to `Listing`, `RentalVehicle`, `Lead`, `User`, `FinancingProduct` are real foreign keys. There is no
   ingest API, no token exchange, no vehicle snapshot copying.
2. **Prisma models are prefixed `Pipeline`, tables `pipeline_*`.** No pipeline model may be referenced
   from an existing non-pipeline model except through the relation fields already specified in
   `DATA-MODEL.prisma`. This is the seam that keeps a future extraction cheap.
3. **Every row carries `(scopeType, scopeId)`.** Every query filters on it, even though there is exactly
   one tenant today. Authorization reuses `Membership` / `MemberRole`. Retrofitting this later means
   rewriting every query.
4. **No state write without an event, in the same transaction.** See `EVENTS.md` §2.
5. **Money is `Int` in grosze.** No `Float`, no `BigInt`, no `number` arithmetic on złoty values.
6. **No PESEL, no ID document numbers, no document files, no scans.** Documents are tracked by status only.
7. **`leadSource` is required on every opportunity**, including manually created ones. There is no
   "unknown" escape hatch — if the advisor genuinely does not know, they pick `OTHER` and fill
   `leadSourceDetail`.
8. **Stage gating defaults to SOFT.** Hard gates exist only where `PipelinePhaseRequirement.enforcement`
   is `HARD`, seeded for exactly three transitions (§M2). Do not add more without asking.

---

## 2. Stack and conventions

Use what the repository already uses. Add no new runtime dependency without asking.

- Backend: Fastify 5, Prisma 5.22, Zod, Vitest. `backend/src/routes/*.ts` is the existing route pattern —
  follow it, register the module in `backend/src/app.ts` exactly once via `registerPipelineModule`.
- Frontend: Vite + React + TypeScript + shadcn/ui + Tailwind + TanStack Query. `@dnd-kit` is already a
  dependency — use it for the board, do not add another DnD library.
- Auth: the existing JWT plugin and admin middleware. Every pipeline route is authenticated; no public
  routes in this module.
- Tests: Vitest, colocated in `backend/src/modules/pipeline/__tests__/`. Service-level tests against a
  transaction-rolled-back Prisma client, not mocks of Prisma.
- Language: code, comments, identifiers, commit messages, API fields in **English**. UI strings in
  **Polish**, through the existing i18n mechanism.
- Commits: conventional commits, scope `pipeline` (e.g. `feat(pipeline): add reroute command`).
  One milestone may be several commits; do not squash milestones together.

---

## 3. Milestones

Each milestone ends with a working, reviewable increment. Do not start the next before review.

### M0 — Schema and event foundation

**Tasks**
1. Append `docs/pipeline/DATA-MODEL.prisma` verbatim to `backend/prisma/schema.prisma`, wrapped in
   `// >>> PIPELINE MODULE` / `// <<< PIPELINE MODULE` markers. Add the inverse relation fields this
   requires on `Lead`, `Listing`, `RentalVehicle`, `User`, `FinancingProduct` — those are the only
   permitted edits to existing models.
2. `prisma migrate dev --name pipeline_foundation`. Inspect the generated SQL before applying.
3. Add a second migration `pipeline_events_immutable` containing raw SQL: a `BEFORE UPDATE OR DELETE`
   trigger on `pipeline_events` that raises an exception on `DELETE`, and on `UPDATE` when any column
   other than `dispatched_at` differs from `OLD`.
4. Implement `events/event-types.ts`: the `PipelineEventType` union and the per-type payload map from
   `EVENTS.md` §3. Payload types are exhaustive and exact — no index signatures, no `any`.
5. Implement `events/record-event.ts` per the `EVENTS.md` §4 contract, including idempotency-key
   collision returning the existing event id.
6. Seed script `backend/prisma/seeds/pipeline.ts`: loss reason dictionary, the Motolia financiers with
   their known parameters (Ayvens, Vehis, Velo, Athlon, Leasys, Inbank, Santander as PLATFORM scope),
   phase requirements, and document requirements. Wire it into the existing seed entry point.

**Definition of done**
- Migration applies and rolls back cleanly on a scratch database.
- A test proves `UPDATE pipeline_events SET type = …` raises, and `UPDATE … SET dispatched_at = now()` succeeds.
- A test proves calling `recordEvent` twice with the same `idempotencyKey` yields one row and the same id.
- `npm run build` passes in `backend/` with no new TypeScript errors.

### M1 — Opportunity core, inbox and the advisor queue

This milestone is what replaces the spreadsheet for new cases. It is the one that must feel fast.

**Tasks**
1. Services: `createOpportunity` (from a `Lead` or manual), `changePhase`, `assignOwner`,
   `setNextAction`, `closeWon`, `closeLost`. All take a transaction, all record events.
   Opportunity numbering: `MTL-<YYYY>-<5-digit sequence>`, allocated inside the transaction.
2. Customer matching on creation: match an existing `PipelineCustomer` by normalized phone, then email,
   then NIP. On match, attach; never merge automatically, never silently create a duplicate. If the
   match is ambiguous, attach nothing and flag the case for the advisor — see §5 note on Impressa/Pazik.
3. Routes: `GET/POST /api/pipeline/opportunities`, `GET/PATCH /api/pipeline/opportunities/:id`,
   `POST /api/pipeline/opportunities/:id/transition`, `.../assign`, `.../next-action`, `.../close`.
   Zod schemas on every body and query. Scope filter applied in a shared preHandler, never per-route.
4. Inbox: `GET /api/pipeline/inbox` lists `Lead` rows with no linked opportunity, newest first;
   `POST /api/pipeline/inbox/:leadId/qualify` creates the opportunity and links it.
5. Frontend `src/pages/admin/pipeline/QueuePage.tsx` — **the default landing route of the module**.
   Four sections in this order: Overdue, Today, No next action, New in inbox. Each row is one line with
   one-click actions (logged a call / snooze / advance / open). Keyboard navigable.
6. Frontend `BoardPage.tsx` — seven columns by `phase`, filtered to `status = OPEN`, drag to transition,
   `@dnd-kit`. Card shows: customer/company name, client-type badge, financing-type badge, owner,
   selected vehicle or candidate count, next action with due date (red when overdue), requirement
   completeness bar, latest application state, estimated commission marked as pipeline.
7. Filters shared by both views: owner, financing type, client type, SLA state, lead source.

**Definition of done**
- An advisor can take a lead from the inbox to a case with an owner and a next action in under 30 seconds.
- Creating an opportunity without `leadSource` is rejected by the schema, not by a UI check alone.
- Board and queue render from the same query layer; no duplicate fetching logic.
- The queue view is the route the module opens on. The board is a second tab.

### M2 — Offers, applications, reroute, documents

**Tasks**
1. Vehicle candidates: add from listing search, from rental vehicles, or custom. Select one.
2. Offers: create/update, one current offer per opportunity edited in place; superseding creates a new
   version and emits `OFFER_SUPERSEDED`. **No wizard.** Reuse the existing financing calculation service
   for rate computation — do not reimplement it, do not call Inbank/VASH directly from this module.
3. Applications: create, submit (precheck / full), decide. Rejection requires a reason code from
   `pipeline_loss_reasons` where `category = 'FINANCIER'`.
4. **Reroute command**: `POST /api/pipeline/applications/:id/reroute` with a target financier. Creates a
   new `PipelineApplication` with `attemptSequence + 1` and `rerouteFromId` set, keeps the opportunity
   `OPEN`, moves it back to `FINANCIAL_DECISION`, emits `APPLICATION_REROUTED`. A rejection must never
   close a case by itself.
5. Stage gating: `workflow/requirements.ts` evaluates `PipelinePhaseRequirement` rows against the
   opportunity aggregate. `SOFT` misses feed the completeness bar; `HARD` misses return 422 with
   `{ error, currentPhase, targetPhase, missing: [{fieldPath,label}] }`. Seed exactly three HARD gates:
   entering `FINANCIAL_DECISION` (financier + financing type + offer price + monthly rate), entering
   `DELIVERY` (signed contract date + commission basis), and closing `LOST` (reason code).
6. Documents: materialize `PipelineDocument` rows from `PipelineDocumentRequirement` when the financing
   type and financier are known; status transitions with timestamps; surface as a checklist on the case.
7. `OpportunityDetailPage.tsx`: customer card with a Thulium deep link, vehicle candidates, current offer,
   application list with the reroute button, document checklist, tasks, and the event timeline.

**Definition of done**
- Rejecting an application and rerouting to another financier keeps one opportunity with two attempts,
  and the timeline reads as a coherent story.
- A hard-gated transition returns 422 **and leaves the database unchanged** — assert both.
- Requirement rows drive gating; there is no `if (financingType === …)` branch in transition code.

### M3 — Commission, reporting, Thulium timeline

**Tasks**
1. Commission derivation: basis and rate from `FinancingProduct.commission`,
   `RentalMatrixEntry.feePct`, or `PipelineFinancier.defaultCommissionPct`, in that precedence.
   `EXPECTED` on offer acceptance, `EARNED` on contract, `INVOICED`/`PAID` manually. Manual amount
   requires `isManualOverride` and `overrideReason`.
2. Reports (server-side aggregation, no client-side math):
   - funnel by phase with median transition time, from `OPPORTUNITY_PHASE_CHANGED`;
   - rejection rate and approval rate **per financier**, plus recovery rate after reroute;
   - **cohort report**: opportunities created in month X and where they stand today — not conversions
     divided by same-window sessions, which is arithmetically fine and commercially meaningless at a
     30–45 day cycle;
   - commission pipeline vs earned, never in one column.
3. Thulium timeline ingestion: endpoint `POST /api/pipeline/ingest/communication`, authenticated with a
   service token, idempotent by `idempotencyKey`, called by `crm-connector`. Writes `CALL_LOGGED`,
   `EMAIL_LOGGED`, `TICKET_LINKED` events against the matching opportunity (match by
   `thuliumCustomerId`, then phone). Unmatched payloads go to a small dead-letter table for review —
   never dropped silently.

**Definition of done**
- Every number on every report traces to a query over `pipeline_events` or the state tables, with no
  hand-maintained inputs.
- A replayed Thulium webhook creates no duplicate timeline entries.

### M4 — Automation and the financier recommender

**Tasks**
1. Outbox worker: `node-cron` job every minute (the repo already depends on `node-cron`; do **not** add
   Redis or BullMQ), selecting `pipeline_events WHERE dispatched_at IS NULL` ordered by `occurredAt`,
   evaluating `PipelineAutomationRule`, executing actions, stamping `dispatched_at`. Actions must be
   idempotent; a crash mid-batch may replay.
2. Seed four rules:
   - inbox lead untouched for 60 minutes → high-priority task + notification;
   - `APPLICATION_DECIDED` with `REJECTED` → reroute task carrying the recommender's next suggestion;
   - contract signed → "issue commission invoice" task + commission status `EARNED`;
   - vehicle delivered → analytics event to `ga-analytics` carrying `leadSource`, closing the marketing loop.
3. Recommender v0 — `services/financier-recommender.ts`: filter financiers by hard criteria
   (`supportedFinancing`, `supportedClientTypes`, amount, period, vehicle age, business age,
   `eligibilityRules`), then rank by historical approval rate within scope, falling back to PLATFORM-wide
   data when the tenant has fewer than 20 decided applications. Return ranked candidates with the reason
   each was included or excluded. Log `recommenderRank` / `recommenderScore` on every application created
   from a suggestion so the recommender's own value is measurable later.

**Definition of done**
- Rules are rows, not code. Adding a fifth rule requires no deployment.
- The recommender explains itself — an advisor sees why Ayvens ranks above Vehis for this case.

### M5 — Historical migration

Import the 55 spreadsheet rows as historical cases **after** M0–M4 are stable, with synthetic events
carrying their real dates so the funnel and cohort reports include them. The file has nine known defects
(out-of-order stages, year typos including 2027, a commission cell coerced to a date, one case both
signed and rejected, four contracts with no recorded application, a PESEL checksum mismatch, a `Total`
row inside the data). Correct them in a reviewed CSV first; the importer must reject, not guess.
**Do not import PESEL.**

---

## 4. What not to build

- Ingest queue, idempotent lead intake, payload hashing — replaced by a foreign key.
- Offer wizard with multi-step version comparison.
- `workflowVersion`, `rowVersion`, optimistic locking, formal override-with-justification flow — 3–5
  concurrent advisors do not need it; role permission plus the event log is enough.
- Tenant onboarding, billing, self-service configuration. The scope dimension in the data is the whole
  SaaS preparation for now.
- A customer portal, magic links, or any public route.
- Redis, BullMQ, a separate worker process, a second database.

---

## 5. Known traps

- **Two cars for one customer is two opportunities; one car rerouted to a second financier is one.**
  The spreadsheet contains both (Impressa: two parallel cases, same contract date; Pazik: one case,
  Ayvens then Vehis). No heuristic distinguishes them — the advisor decides. Do not auto-merge and do not
  auto-split.
- **A rejection is not a closed case.** Roughly one in six rejections in the historical data was later
  recovered at a different financier. Any code path that sets `status = LOST` from a financier decision
  is a bug.
- **Phase must survive closing.** `status` and `phase` are separate columns for exactly this reason.
  Never write `phase = LOST`.
- **Withheld or shared phone numbers** produce false customer matches. Normalize to E.164, and treat
  known anonymous-caller placeholders as unmatchable rather than matching them to each other.
- **`GET /api/pipeline/*` without a scope filter leaks across tenants.** The shared preHandler is the
  only place that filter is written; do not bypass it "just for this admin report".

---

## 6. Review checklist (used by the reviewer at each milestone)

1. Does every mutating service take a transaction client and record an event inside it?
2. Is there any state write reachable without an event? Grep for `prisma.pipeline` outside services.
3. Is `(scopeType, scopeId)` in every `where` clause?
4. Any `Float`, `BigInt`, or złoty-denominated `number` in the pipeline module?
5. Any PESEL, ID number, or file upload path?
6. Does a hard-gate rejection leave the database untouched (transaction rolled back)?
7. Does the module still compile and pass tests without touching non-pipeline behaviour?
   `git diff dev --stat` should show existing files touched only in: `schema.prisma` (marked block plus
   inverse relations), `app.ts` (one registration line), the seed entry point, and the admin router.
8. Is the queue the default route, and does it answer "who do I call now" without a click?
