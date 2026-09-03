# M1 plan — review

**Verdict: APPROVED WITH CHANGES.** The structure is right and matches `IMPLEMENTATION.md` §M1.
Four items must be resolved before coding (§1), three should be (§2). Everything else is confirmed.

---

## 1. Must fix before coding

### 1.1 Opportunity numbering has no allocation mechanism — and it fails the M0 way

"Numeracja spraw `MTL-YYYY-XXXXX`, bezpiecznie alokowana w transakcji" names a property, not a mechanism.
The obvious implementation — `SELECT max(number) … + 1` then insert — races under READ COMMITTED: two
concurrent creations read the same maximum and the loser hits a unique violation. That violation aborts
the **whole business transaction**, so the customer, the opportunity and the event all disappear. This is
the same failure mode as the M0 `recordEvent` defect, one layer up.

Allocate in a single atomic statement instead. Add to the Krok 1 migration:

```prisma
model PipelineNumberSequence {
  year      Int  @id
  lastValue Int  @default(0) @map("last_value")

  @@map("pipeline_number_sequences")
}
```

```sql
INSERT INTO pipeline_number_sequences (year, last_value)
VALUES ($1, 1)
ON CONFLICT (year) DO UPDATE SET last_value = pipeline_number_sequences.last_value + 1
RETURNING last_value;
```

One statement, atomic under concurrency, no conflict to recover from, and the yearly reset is free.
Format the result as `MTL-${year}-${String(n).padStart(5, '0')}`.

**Test:** allocate 20 numbers from concurrent transactions (`Promise.all`); assert 20 distinct numbers,
no gaps within the batch, and that no transaction aborts.

### 1.2 `changePhase` must reset `phaseEnteredAt`

The plan computes `durationSeconds` but never says the update writes a new `phaseEnteredAt`. If it does
not, every subsequent duration is measured from case creation, and the funnel-timing and bottleneck
report — the reason the event log exists at all — is quietly wrong from the first transition onward.
Nothing fails, nothing throws; the numbers are simply meaningless.

Set `phaseEnteredAt = now()` in the same `update` as the phase change, in the same transaction as the
event. **Test:** two transitions with a controlled clock; assert `durationSeconds` on the second event
covers only the second phase.

### 1.3 The inbox will contain the site's entire lead history on day one

`listInboxLeads` = leads with no linked opportunity. The `leads` table holds everything motolia.pl has
ever collected. On first open, an advisor sees thousands of stale rows, concludes the inbox is noise, and
never opens it again — which kills M1's whole purpose regardless of how good the rest is.

Two things are needed:

- **A go-live cutoff.** The inbox lists only leads created at or after the module's activation date.
  Store it as configuration (an `AppSettings` row or a seeded constant), never hardcoded in a query — it
  will need adjusting during rollout.
- **A dismissal path** for junk that arrives after the cutoff. Dismissing creates an opportunity closed
  immediately as `LOST` with `QUAL_SPAM`. That costs no schema change and keeps the funnel honest: the
  volume of junk becomes a measurable number instead of an invisible one. Do **not** add a "dismissed"
  flag to the `leads` table — existing models stay untouched.

### 1.4 Authentication and scope are absent from the plan

Non-negotiable #3 (`IMPLEMENTATION.md` §1) is not addressed anywhere in the route section. The repository
already has everything needed, so this is wiring, not design:

- `fastify.authenticate` and `requirePermission(…)` from `backend/src/middleware/permissions.ts` — the
  existing pattern is `preHandler: [fastify.authenticate, requirePermission('leads:read')]`.
- `ActiveContext { scopeType, scopeId }` is already resolved per request and already honours
  platform-level memberships.

Required:

1. Add `'pipeline:read'` and `'pipeline:write'` to the `Permission` union and to `ROLE_PERMISSIONS`
   (platform roles and dealer-group admin; decide dealer-level access deliberately, do not grant by default).
2. Every pipeline route carries `[fastify.authenticate, requirePermission('pipeline:read' | 'pipeline:write')]`.
3. One shared helper derives `(scopeType, scopeId)` from `request.activeContext` and every query uses it.
   **No scope value is ever read from a body, query string or path parameter** — that is a tenant-crossing
   hole waiting for the second tenant.

---

## 2. Should fix

### 2.1 Drop `commissionGrosze` from `closeWon` in M1

Commission arrives in M3 with a derivation from `FinancingProduct.commission` / `RentalMatrixEntry.feePct`
/ `PipelineFinancier.defaultCommissionPct`. A hand-typed amount in M1 reproduces exactly the spreadsheet
pathology this module exists to remove — 36% of booked commission sitting on cases with no contract. The
`OPPORTUNITY_WON` payload keeps the optional field; nothing writes it until M3.
Same for `applicationId`: there are no applications until M2.

### 2.2 `logContact` is missing, so `firstContactAt` is never written

The queue has a "Zaloguj kontakt" action but no service behind it, and nothing in the plan sets
`firstContactAt`. Time-to-first-contact is the metric behind the "wstępna decyzja w 24h" promise in the
90-day strategy, and it is only measurable if it is captured from the first day of use.

Add `logContact(tx, { id, channel })`: set `firstContactAt` when null, emit `OPPORTUNITY_FIRST_CONTACT`
with `secondsFromFirstTouch`, and bump the next action. It is the most-used button in the queue.

### 2.3 Customer matching drops the ambiguity rule

The plan reduces matching to "match → attach, else create". Two cases are missing, and both corrupt
`PipelineCustomer` — the entity whose entire purpose is customer history:

- **More than one match.** Attach nothing, create the case against a new customer, and flag it for the
  advisor. Never pick the first row. Never merge automatically.
- **Unmatchable numbers.** Normalize to E.164; treat withheld/anonymous placeholders as unmatchable
  rather than matching them to each other. A shared switchboard number silently glues unrelated people
  into one customer record, and unpicking that later is manual work.

Also state explicitly, because the opposite is the "helpful" default: **qualifying a second lead from a
matched customer always creates a second opportunity.** It never attaches to their open one. Two cars at
once is two cases (Impressa); only a reroute is one case (Pazik), and that is M2.

---

## 3. Confirmed as planned

- Queue as the default route with the four sections in that order; board as the second tab. Correct.
- Manual owner pickup at qualification rather than round-robin — right call at 3–5 advisors. Do not build
  round-robin.
- `closeLost` keeps `phase` and requires a dictionary reason. Correct, and it is enforced by the command
  schema, not by a phase requirement row.
- Krok 1's `PipelinePhaseRequirement.code` follow-up — fold `PipelineNumberSequence` (§1.1) into the same
  migration so M1 ships exactly one.
- **Phase transition validation in M1 is ordering only.** No SOFT/HARD requirement evaluation — that is
  M2. Do not let gating leak in early; the completeness bar can render as a placeholder.

---

## 4. M1 definition of done

Beyond the plan's own tests:

```bash
cd backend
npx prisma migrate status
npm run build
npm test -- pipeline
# no state write outside services:
grep -rn "prisma\.\(pipeline\|\$transaction\)" src/modules/pipeline/routes/    # must return nothing
# no scope taken from user input:
grep -rn "scopeId" src/modules/pipeline/routes/ | grep -iE "body|query|params"  # must return nothing
cd .. && git diff dev --stat
```

Expected `git diff dev --stat` for M1 — existing files touched only in: `backend/prisma/schema.prisma`
(marked block), `backend/src/app.ts` (one registration line), `backend/src/middleware/permissions.ts`
(two permission entries), `src/App.tsx` (route), `src/components/admin/AdminSidebar.tsx` (nav item).
Anything else means the module is leaking.

**The acceptance test is the 30-second path**, and it is a stopwatch, not a checkbox: open
`/admin/pipeline` → pick a lead in the inbox → qualify with owner and due date → the case appears in
"Dzisiejsze". If that takes more than 30 seconds with a real advisor, M1 is not done regardless of what
the test suite says.
