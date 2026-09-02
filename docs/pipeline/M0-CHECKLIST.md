# M0 — answers, exact artefacts, and the one way to lose data

Supplements `IMPLEMENTATION.md` §M3.M0. Where the two differ, this file wins.

---

## 1. Database

`backend/.env` points `DATABASE_URL` at `postgresql://…@localhost:5432/carscout` — a local Postgres on
the developer machine, not production. Whether it is currently running cannot be verified from the
review environment; **AG must check on the machine it runs on** before touching migrations:

```bash
cd backend
pg_isready -h localhost -p 5432          # or: docker compose ps
npx prisma migrate status                 # authoritative
```

### The one way to lose data here — read before running anything

There are 61 applied migrations. If `migrate status` reports **drift** (schema changed outside
migrations, or a migration recorded as failed), `prisma migrate dev` will offer to **reset the
database**. Accepting that wipes the local dev data.

- **Never accept a reset prompt.** If drift is reported, stop and report it; it gets resolved with
  `migrate resolve`, not by resetting.
- Run `prisma migrate dev` **only** against `localhost:5432/carscout`. Print the resolved host and
  database name before running and confirm it is not the Hetzner production instance.
- **Never run `prisma migrate deploy`** in this milestone. Production is deployed from `dev` via
  Coolify, and this branch does not go near it.
- If no local database is available, create a throwaway one
  (`docker run --rm -e POSTGRES_PASSWORD=… -p 5433:5432 postgres:16`) and point a `DATABASE_URL`
  override at it rather than reaching for a shared database.

---

## 2. M0 scope — confirmed, with three corrections

The five items AG listed are correct and complete. Three things are wrong or missing in the detail:

### 2.1 The migration must be additive-only

Inverse relation fields generate no SQL. Therefore the generated migration must contain **only**
`CREATE TYPE` and `CREATE TABLE` / `CREATE INDEX` statements. If it contains any `ALTER TABLE` or
`DROP` touching a pre-existing table, something is wrong with the schema edit — stop and report,
do not apply.

```bash
grep -iE 'alter table|drop ' prisma/migrations/*pipeline_foundation/migration.sql   # must return nothing
```

This is the strongest single guarantee that the module cannot break the live site.

### 2.2 The exact inverse relations to add — the only permitted edits to existing models

```prisma
model Lead {
  // …
  pipelineOpportunity      PipelineOpportunity?
}

model Listing {
  // …
  pipelineVehicleCandidates PipelineVehicleCandidate[]
}

model RentalVehicle {
  // …
  pipelineVehicleCandidates PipelineVehicleCandidate[]
}

model User {
  // …
  pipelineOpportunities    PipelineOpportunity[] @relation("PipelineOpportunityOwner")
  pipelineTasks            PipelineTask[]        @relation("PipelineTaskAssignee")
}

model FinancingProduct {
  // …
  pipelineOffers           PipelineOffer[]
}
```

Nothing else in existing models changes. Run `npx prisma format && npx prisma validate` before
generating the migration; fix validation errors in the pipeline block, never by altering existing models.

Known validation risks to expect: the one-to-one self relation on `PipelineApplication`
(`rerouteFrom` / `rerouteTo`, relation name `"Reroute"`), and the two distinct `User` relations which
must stay named. `PipelineCommission.applicationId` is now a real relation (fixed 2026-09-02) — its
inverse `commissions PipelineCommission[]` is already in `DATA-MODEL.prisma`.

### 2.3 Scope convention — do not invent one

`ScopeType.PLATFORM` has no row to point at. Convention, used everywhere without exception:

```ts
export const PLATFORM_SCOPE = { scopeType: 'PLATFORM', scopeId: 'PLATFORM' } as const
```

Motolia's own data is seeded at `PLATFORM` scope in v0.1. Tenant scoping switches to
`DEALER_GROUP` / `DEALER` rows only when a second tenant exists.

---

## 3. Immutability trigger — exact SQL

Put this in its own migration `pipeline_events_immutable`, created with
`prisma migrate dev --create-only` and then hand-edited.

```sql
CREATE OR REPLACE FUNCTION pipeline_events_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pipeline_events is append-only: DELETE is not permitted';
  END IF;

  IF (to_jsonb(NEW) - 'dispatched_at') IS DISTINCT FROM (to_jsonb(OLD) - 'dispatched_at') THEN
    RAISE EXCEPTION 'pipeline_events is append-only: only dispatched_at may be updated';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pipeline_events_guard_trg
  BEFORE UPDATE OR DELETE ON pipeline_events
  FOR EACH ROW EXECUTE FUNCTION pipeline_events_guard();
```

The `to_jsonb(NEW) - 'dispatched_at'` comparison is deliberate: it keeps working when the table gains
columns later, where a hand-written column-by-column comparison would silently stop protecting them.

**Tests (Vitest, raw SQL):** deleting a row raises; updating `type` raises; updating `dispatched_at`
succeeds; and a transaction that raises leaves the row untouched.

---

## 4. Seed data — exact rows

Seeds must be **idempotent** (`upsert` on the natural key), because they will be re-run.

### 4.1 Loss reasons (`pipeline_loss_reasons`)

Labels are UI strings, so Polish. Codes are English and stable — never rename a code, retire it with
`isActive = false`.

| code | label | category | requiresComment |
|---|---|---|---|
| `FIN_CREDITWORTHINESS` | Zdolność kredytowa / dochody | FINANCIER | no |
| `FIN_BIK_DEBT` | BIK / komornik / zadłużenie | FINANCIER | no |
| `FIN_VEHICLE_NOT_ACCEPTED` | Pojazd nieakceptowany przez finansującego | FINANCIER | no |
| `FIN_OTHER` | Inny powód po stronie finansującego | FINANCIER | **yes** |
| `CUST_NO_DOCUMENTS` | Brak dokumentów od klienta | CUSTOMER | no |
| `CUST_RESIGNED` | Rezygnacja klienta | CUSTOMER | no |
| `CUST_TERMS_REJECTED` | Warunki nie do zaakceptowania | CUSTOMER | no |
| `CUST_BOUGHT_ELSEWHERE` | Kupił w innym miejscu | CUSTOMER | no |
| `CUST_NO_CONTACT` | Brak kontaktu | CUSTOMER | no |
| `QUAL_NOT_ELIGIBLE` | Niekwalifikowany | QUALIFICATION | no |
| `QUAL_SPAM` | Spam / pomyłka | QUALIFICATION | no |
| `OTHER` | Inne | QUALIFICATION | **yes** |

These categories come from the free-text comments in the historical spreadsheet. One open question is
still unresolved with the call centre: whether "negat" in the spreadsheet meant only a financier refusal
or also customer withdrawal. The split above assumes both existed and separates them — that is the
point of the dictionary.

### 4.2 Financiers (`pipeline_financiers`, PLATFORM scope)

Seed **code, name, isActive only**. Leave `supportedFinancing`, `supportedClientTypes`, the amount and
period bounds, `maxVehicleAgeYears`, `minBusinessAgeMonths`, `eligibilityRules` and
`defaultCommissionPct` **empty / NULL**.

> Do not invent eligibility criteria or commission rates. Plausible-looking guesses here would be
> indistinguishable from real terms and would later drive the recommender and commission calculation.
> These fields are filled by Kamil from the actual partner agreements, in one pass before M4. Until the
> recommender exists (M4) empty criteria are harmless.

Codes: `AYVENS`, `VEHIS`, `VELO`, `ATHLON`, `LEASYS`, `INBANK`, `SANTANDER`.
The first five appear in the historical data; Inbank and VASH/Vehis are the integrations already live in
`car-scout`. If a partner is missing, adding one is a seed row, not a migration.

### 4.3 Phase requirements (`pipeline_phase_requirements`)

**Two HARD gates, not three.** Closing as LOST is not a phase transition — `LOST` is a `status`, and its
reason code is enforced by the `closeLost` command schema, not by a requirement row. Correct
`IMPLEMENTATION.md` §M2.5 accordingly.

HARD, `targetPhase = FINANCIAL_DECISION`:

| fieldPath | label | clientType |
|---|---|---|
| `opportunity.financingType` | Rodzaj finansowania | — |
| `offer.priceGrosze` | Cena pojazdu | — |
| `offer.monthlyRateGrosze` | Rata miesięczna | — |
| `application.financierId` | Wybrany finansujący | — |
| `customer.companyNip` | NIP firmy | `B2B` |

HARD, `targetPhase = DELIVERY`:

| fieldPath | label |
|---|---|
| `opportunity.contractSignedAt` | Data podpisania umowy |
| `commission.basisGrosze` | Podstawa naliczenia prowizji |

SOFT (completeness bar only) — seed at least these, extend freely:
`QUALIFICATION`: `opportunity.clientType`, `opportunity.leadSource`.
`SELECTION`: a selected `PipelineVehicleCandidate`.
`COMPLETING`: all mandatory `PipelineDocument` rows at status `RECEIVED` or better.

### 4.4 Document requirements (`pipeline_document_requirements`)

Seed a minimal generic set only; financier-specific packs come with §4.2's data pass.

- B2C, any financing: `ID_CONFIRMED` (Potwierdzenie tożsamości), `INCOME_PROOF` (Potwierdzenie dochodu).
- B2B, any financing: `COMPANY_REGISTRY` (Wpis CEIDG / KRS), `FINANCIAL_STATEMENTS` (Dokumenty finansowe firmy).
- CASH only: `PROFORMA` (Proforma / faktura zaliczkowa).

Caveat to be aware of: the `@@unique` on this table includes nullable columns, and Postgres treats NULLs
as distinct, so it will not stop duplicate rows where `clientType` / `financingType` / `financierId` are
NULL. The seed's `upsert` keys must therefore be explicit; if duplicates start appearing in practice,
replace the constraint with a partial unique index rather than adding application-level checks.

---

## 5. M0 definition of done — verbatim commands the reviewer will run

```bash
cd backend
npx prisma validate
grep -icE 'alter table|drop ' prisma/migrations/*pipeline_foundation/migration.sql   # 0
npx prisma migrate status                                                            # no drift, no pending
npm run build                                                                        # no new TS errors
npm test -- pipeline                                                                 # green
cd .. && git diff dev --stat                                                         # only the 4 expected files
```

Expected `git diff dev --stat` for M0: `backend/prisma/schema.prisma`,
`backend/prisma/migrations/**` (new only), `backend/prisma/seeds/pipeline.ts`,
`backend/prisma/seed.ts` (one wiring line), `backend/src/modules/pipeline/events/*`,
`backend/src/modules/pipeline/__tests__/*`, `docs/pipeline/*`. Anything else is out of scope for M0.

Do **not** touch `backend/src/app.ts` in M0 — there are no routes yet. Registration lands in M1.
