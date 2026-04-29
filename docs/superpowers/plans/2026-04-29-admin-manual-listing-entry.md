# Admin Manual Listing Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admin (platform/group/dealer) and dealer employees to manually add and edit sale listings with photo uploads, mirroring the structure of the existing rental-vehicle form so the two flows can converge in the future.

**Architecture:** Separate `Listing` and `RentalVehicle` tables stay; a shared `<VehicleDataForm mode="sale" | "rental">` component is extracted from the existing inline rental form. Field-level whitelist gating protects CSV/CSFlow records from accidental overwrites. New per-listing `financingPriceBase` enum drives the financing calculator's amount.

**Tech Stack:** Prisma + PostgreSQL, Fastify (`@fastify/multipart` for image upload), React + TanStack Query, Vitest for backend tests.

**Spec:** `docs/superpowers/specs/2026-04-29-admin-manual-listing-entry-design.md`

**Branch:** `feat/manual-listing-entry`

**Working directory paths in this plan are relative to repo root** `/Users/kamiltonkowicz/Documents/Coding/github/car-scout/` unless absolute.

---

## File Structure

### Backend — new files

| File | Responsibility |
|---|---|
| `backend/src/services/listing-mapper.ts` | Map manual API payload → Prisma input; whitelist for CSV gating; payload validation |
| `backend/src/routes/listing-upload.ts` | Image upload/delete endpoints (mirror `rental-upload.ts`) |
| `backend/src/routes/__tests__/listings-manual.test.ts` | Integration tests for POST/PATCH/images |

### Backend — modified files

| File | What changes |
|---|---|
| `backend/prisma/schema.prisma` | New enums + 6 fields on `Listing` + 3 indexes |
| `backend/prisma/migrations/<new>/migration.sql` | Schema migration + backfill SQL |
| `backend/src/app.ts` | Register new routes, public route for `/uploads/listing-images/` |
| `backend/src/routes/listings.ts` | Add `POST` and `PATCH` endpoints |
| `backend/src/services/csv-mapper.ts` | Set `entrySource: 'CSV'` on create |
| `backend/src/services/csflow.service.ts` | Set `entrySource: 'CSFLOW'` on create |

### Frontend — new files

| File | Responsibility |
|---|---|
| `src/components/admin/VehicleForm/VehicleDataForm.tsx` | Mode-aware shared form |
| `src/components/admin/VehicleForm/types.ts` | Form state interfaces |
| `src/components/admin/VehicleForm/sections/IdentificationSection.tsx` | Make/model/version/VIN/year/condition |
| `src/components/admin/VehicleForm/sections/TechnicalSpecsSection.tsx` | Body/fuel/trans/power/capacity/drive/doors/seats/color |
| `src/components/admin/VehicleForm/sections/EquipmentSection.tsx` | 4 equipment groups |
| `src/components/admin/VehicleForm/sections/PricingSection.tsx` | Mode-aware: sale vs rental pricing |
| `src/components/admin/VehicleForm/sections/FlagsSection.tsx` | Mode-aware: chińczyk/featured/financingPriceBase |
| `src/components/admin/VehicleForm/sections/DescriptionSection.tsx` | Additional info header/content |
| `src/components/admin/VehicleForm/sections/ImagesSection.tsx` | Mode-aware image upload |
| `src/pages/admin/ListingNewPage.tsx` | Render form in create mode |
| `src/pages/admin/ListingEditPage.tsx` | Render form in edit mode with `isImported` |
| `src/utils/listingPrice.ts` | `getFinancingBasePrice` helper |

### Frontend — modified files

| File | What changes |
|---|---|
| `src/types/listing.ts` (or equivalent) | Add new fields to Listing type |
| `src/utils/listingMapper.ts` | Pass-through new fields |
| `src/services/api.ts` | New `listingsApi` methods |
| `src/pages/admin/RentalVehiclesPage.tsx` | Replace inline VehicleForm with import |
| `src/pages/admin/ListingManagementPage.tsx` | Add button, column, filters |
| `src/components/admin/ListingManagement/AdminListingItem.tsx` | Per-row Edit action |
| `src/pages/ListingDetailPage.tsx` | Use `getFinancingBasePrice` |
| `src/pages/LeadFormPage.tsx` | Use `getFinancingBasePrice` |
| `src/pages/PersonalOfferPage.tsx` | Use `getFinancingBasePrice` |
| `src/App.tsx` (or routes config) | Register `/admin/listings/new` and `/admin/listings/:id/edit` |

---

## Setup: Branch creation

- [ ] **Step 0.1: Create feature branch**

```bash
git checkout -b feat/manual-listing-entry
```

Expected: switched to new branch.

---

## Stage 1 — Schema & types (backend foundation)

### Task 1: Add Prisma enums and fields to Listing model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1.1: Add three new enums after the existing `ContactMode` enum**

In `backend/prisma/schema.prisma`, after the `enum ContactMode { ... }` block (around line 31), add:

```prisma
enum FinancingPriceBase {
  PRICE_PLN
  BROKER_PRICE_PLN
}

enum ListingCondition {
  NEW
  USED
}

enum EntrySource {
  CSV
  CSFLOW
  MANUAL
}
```

- [ ] **Step 1.2: Add 6 fields and 3 indexes to the `Listing` model**

In the `Listing` model, immediately before the `leads Lead[]` relation (around line 90), add:

```prisma
  catalogPrice       Int?               @map("catalog_price")
  condition          ListingCondition   @default(USED)
  financingPriceBase FinancingPriceBase @default(BROKER_PRICE_PLN) @map("financing_price_base")
  isChineseBrand     Boolean            @default(false)             @map("is_chinese_brand")
  lastManualEditAt   DateTime?          @map("last_manual_edit_at")
  entrySource        EntrySource?       @map("entry_source")
```

In the `Listing` model's index block (after the existing `@@index([isFeatured])` line, before `@@index([dealerId, ...])`), add:

```prisma
  @@index([condition])
  @@index([isChineseBrand])
  @@index([lastManualEditAt])
```

- [ ] **Step 1.3: Verify schema syntax**

```bash
cd backend && bun run prisma:generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 1.4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(schema): add enums and fields for manual listing entry"
```

---

### Task 2: Create migration with backfill

**Files:**
- Create: `backend/prisma/migrations/<timestamp>_add_manual_listing_entry_fields/migration.sql`

- [ ] **Step 2.1: Generate migration**

```bash
cd backend && bun run prisma migrate dev --create-only --name add_manual_listing_entry_fields
```

Expected: a new migration file is created under `backend/prisma/migrations/`. Do NOT run it yet — we need to add backfill SQL first.

- [ ] **Step 2.2: Locate the new migration file**

```bash
ls -t backend/prisma/migrations/ | head -2
```

Expected: shows the new directory `<timestamp>_add_manual_listing_entry_fields`. Open `migration.sql` inside it.

- [ ] **Step 2.3: Append backfill SQL**

At the end of the generated `migration.sql`, append:

```sql
-- Backfill entry_source from existing import_source
UPDATE "listings" SET "entry_source" = 'CSFLOW' WHERE "import_source" = 'csflow';
UPDATE "listings" SET "entry_source" = 'CSV'    WHERE "entry_source" IS NULL;
```

- [ ] **Step 2.4: Apply migration to dev DB**

```bash
cd backend && bun run prisma migrate dev
```

Expected: migration applies, `✔ Generated Prisma Client`.

- [ ] **Step 2.5: Verify backfill in DB**

```bash
cd backend && bun run prisma studio
```

Open `listings` table, sort by `created_at`, confirm `entry_source` has values for old rows (`CSV` or `CSFLOW`), and `condition`/`financing_price_base` show defaults. Close Prisma Studio.

- [ ] **Step 2.6: Commit**

```bash
git add backend/prisma/migrations/
git commit -m "feat(migration): add manual listing entry fields with backfill"
```

---

### Task 3: Wire `entrySource` into CSV importer

**Files:**
- Modify: `backend/src/services/csv-mapper.ts`

- [ ] **Step 3.1: Update `mapCSVToListing` to set entrySource**

Open `backend/src/services/csv-mapper.ts`. Find the `return { ... }` block in `mapCSVToListing` (line 6-53). Inside the returned object, immediately after `importSource: importSource || undefined,` (line 10), add:

```ts
        entrySource: 'CSV' as const,
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd backend && bun run build
```

Expected: build completes without errors.

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/services/csv-mapper.ts
git commit -m "feat(csv): set entrySource=CSV on import"
```

---

### Task 4: Wire `entrySource` into CSFlow service

**Files:**
- Modify: `backend/src/services/csflow.service.ts`

- [ ] **Step 4.1: Find Prisma create call in csflow.service.ts**

```bash
grep -n "prisma.listing.create\|prisma.listing.upsert" backend/src/services/csflow.service.ts
```

Expected: shows line numbers of create/upsert calls.

- [ ] **Step 4.2: Add `entrySource: 'CSFLOW'` to data object in each create/upsert**

For each create/upsert location identified above, add to the `data: { ... }` object:

```ts
        entrySource: 'CSFLOW' as const,
```

- [ ] **Step 4.3: Verify build**

```bash
cd backend && bun run build
```

Expected: success.

- [ ] **Step 4.4: Commit**

```bash
git add backend/src/services/csflow.service.ts
git commit -m "feat(csflow): set entrySource=CSFLOW on import"
```

---

### Task 5: Update frontend Listing type

**Files:**
- Modify: `src/types/listing.ts` (or wherever `Listing` interface lives)
- Modify: `src/utils/listingMapper.ts`

- [ ] **Step 5.1: Locate the Listing type**

```bash
grep -rn "interface Listing\|type Listing " src/types/ src/utils/
```

Expected: shows the file with the `Listing` interface declaration.

- [ ] **Step 5.2: Add new optional fields to Listing interface**

In the file from step 5.1, add to the `Listing` interface:

```ts
  catalogPrice?: number | null;
  condition: 'NEW' | 'USED';
  financingPriceBase: 'PRICE_PLN' | 'BROKER_PRICE_PLN';
  isChineseBrand: boolean;
  lastManualEditAt?: string | null;
  entrySource?: 'CSV' | 'CSFLOW' | 'MANUAL' | null;
```

- [ ] **Step 5.3: Update listingMapper.ts to pass through new fields**

Open `src/utils/listingMapper.ts`. In the function that maps backend response to frontend `Listing`, add the new fields:

```ts
  catalogPrice: backend.catalogPrice ?? null,
  condition: backend.condition ?? 'USED',
  financingPriceBase: backend.financingPriceBase ?? 'BROKER_PRICE_PLN',
  isChineseBrand: backend.isChineseBrand ?? false,
  lastManualEditAt: backend.lastManualEditAt ?? null,
  entrySource: backend.entrySource ?? null,
```

- [ ] **Step 5.4: Verify TS compiles**

```bash
bun run build
```

Expected: build succeeds. If TS errors about uninitialized properties in mock data, search for them and add defaults.

- [ ] **Step 5.5: Commit**

```bash
git add src/types/ src/utils/listingMapper.ts
git commit -m "feat(types): add manual listing entry fields to frontend Listing"
```

---

## Stage 2 — Backend endpoints

### Task 6: Create listing-mapper service with payload mapping and validation

**Files:**
- Create: `backend/src/services/listing-mapper.ts`

- [ ] **Step 6.1: Create the file with mapping and validation functions**

Create `backend/src/services/listing-mapper.ts`:

```ts
import { Prisma } from '@prisma/client';

export const CSV_EDITABLE_FIELDS = [
    'catalogPrice',
    'financingPriceBase',
    'isChineseBrand',
    'isFeatured',
    'additionalInfoHeader',
    'additionalInfoContent',
] as const;

export type ListingValidationError = { field: string; message: string };

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validateListingPayload(body: any): ListingValidationError[] {
    const errors: ListingValidationError[] = [];
    const currentYear = new Date().getFullYear();

    if (!body.make || typeof body.make !== 'string' || !body.make.trim()) {
        errors.push({ field: 'make', message: 'Make is required' });
    }
    if (!body.model || typeof body.model !== 'string' || !body.model.trim()) {
        errors.push({ field: 'model', message: 'Model is required' });
    }
    if (typeof body.productionYear !== 'number' || body.productionYear < 1990 || body.productionYear > currentYear + 1) {
        errors.push({ field: 'productionYear', message: `Year must be between 1990 and ${currentYear + 1}` });
    }
    if (typeof body.pricePln !== 'number' || body.pricePln <= 0 || body.pricePln > 10_000_000) {
        errors.push({ field: 'pricePln', message: 'Price must be a positive number up to 10,000,000' });
    }
    if (body.condition !== 'NEW' && body.condition !== 'USED') {
        errors.push({ field: 'condition', message: 'Condition must be NEW or USED' });
    }
    if (body.condition === 'NEW') {
        if (typeof body.mileageKm !== 'number' || body.mileageKm < 0 || body.mileageKm >= 100) {
            errors.push({ field: 'mileageKm', message: 'New vehicle mileage must be between 0 and 99 km' });
        }
    } else if (body.condition === 'USED') {
        if (typeof body.mileageKm !== 'number' || body.mileageKm < 0) {
            errors.push({ field: 'mileageKm', message: 'Used vehicle mileage is required and must be non-negative' });
        }
    }
    if (body.vin && !VIN_REGEX.test(body.vin)) {
        errors.push({ field: 'vin', message: 'VIN must be 17 alphanumeric chars (no I, O, Q)' });
    }
    if (body.financingPriceBase && body.financingPriceBase !== 'PRICE_PLN' && body.financingPriceBase !== 'BROKER_PRICE_PLN') {
        errors.push({ field: 'financingPriceBase', message: 'Invalid financingPriceBase value' });
    }

    return errors;
}

export function mapManualPayloadToListing(body: any, dealerId: string): Prisma.ListingCreateInput {
    return {
        make: body.make.trim().slice(0, 100),
        model: body.model.trim().slice(0, 100),
        version: body.version || undefined,
        vin: body.vin || undefined,
        productionYear: body.productionYear,
        mileageKm: body.mileageKm,
        pricePln: body.pricePln,
        catalogPrice: body.catalogPrice ?? undefined,
        condition: body.condition,
        financingPriceBase: body.financingPriceBase || 'BROKER_PRICE_PLN',
        isChineseBrand: body.isChineseBrand ?? false,
        fuelType: body.fuelType || undefined,
        transmission: body.transmission || undefined,
        enginePowerHp: body.enginePowerHp ?? undefined,
        engineCapacityCm3: body.engineCapacityCm3 ?? undefined,
        drive: body.drive || undefined,
        bodyType: body.bodyType || undefined,
        doors: body.doors ?? undefined,
        seats: body.seats ?? undefined,
        color: body.color || undefined,
        paintType: body.paintType || undefined,
        registrationNumber: body.registrationNumber || undefined,
        firstRegistrationDate: body.firstRegistrationDate || undefined,
        equipmentAudioMultimedia: body.equipmentAudioMultimedia || [],
        equipmentSafety: body.equipmentSafety || [],
        equipmentComfortExtras: body.equipmentComfortExtras || [],
        equipmentOther: body.equipmentOther || [],
        additionalInfoHeader: body.additionalInfoHeader || undefined,
        additionalInfoContent: body.additionalInfoContent || undefined,
        isFeatured: body.isFeatured ?? false,
        dealer: { connect: { id: dealerId } },
    };
}

export function mapManualPayloadToListingUpdate(body: any): Prisma.ListingUpdateInput {
    const { dealer, ...rest } = mapManualPayloadToListing(body, 'placeholder') as any;
    return rest;
}

export function pickCsvEditableFields(body: any): Prisma.ListingUpdateInput {
    const result: any = {};
    for (const field of CSV_EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
            result[field] = body[field];
        }
    }
    return result;
}
```

- [ ] **Step 6.2: Verify TS compiles**

```bash
cd backend && bun run build
```

Expected: success.

- [ ] **Step 6.3: Commit**

```bash
git add backend/src/services/listing-mapper.ts
git commit -m "feat(backend): add listing payload mapper and validator"
```

---

### Task 7: Write failing tests for POST /api/listings

**Files:**
- Create: `backend/src/routes/__tests__/listings-manual.test.ts`

- [ ] **Step 7.1: Create test file with happy-path and validation tests**

Create `backend/src/routes/__tests__/listings-manual.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Manual Listing Entry — POST /api/listings', () => {
    let app: FastifyInstance;
    let platformToken: string;
    let dealerAdminToken: string;
    let dealerId: string;
    let otherDealerId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        // Create test dealers
        const dealerA = await app.prisma.dealer.create({
            data: { name: 'Test Dealer A', addressLine1: 'Addr A' },
        });
        dealerId = dealerA.id;
        const dealerB = await app.prisma.dealer.create({
            data: { name: 'Test Dealer B', addressLine1: 'Addr B' },
        });
        otherDealerId = dealerB.id;

        platformToken = app.jwt.sign({
            userId: 'platform-test',
            email: 'p@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        dealerAdminToken = app.jwt.sign({
            userId: 'dealer-admin-test',
            email: 'da@test.com',
            memberships: [{
                id: 'm1',
                scopeType: 'DEALER',
                scopeId: dealerId,
                role: 'DEALER_ADMIN',
                isDefaultContext: true,
            }],
            activeContext: { scopeType: 'DEALER', scopeId: dealerId },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId: { in: [dealerId, otherDealerId] } } });
        await app.prisma.dealer.deleteMany({ where: { id: { in: [dealerId, otherDealerId] } } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId: { in: [dealerId, otherDealerId] } } });
    });

    const validBody = (overrides: Partial<any> = {}) => ({
        make: 'Toyota',
        model: 'Yaris',
        productionYear: 2026,
        pricePln: 95000,
        mileageKm: 0,
        condition: 'NEW',
        financingPriceBase: 'BROKER_PRICE_PLN',
        ...overrides,
    });

    it('creates a manual listing with entrySource=MANUAL and lastManualEditAt set', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody(),
        });

        expect(response.statusCode).toBe(201);
        const { listing } = response.json();
        expect(listing.entrySource).toBe('MANUAL');
        expect(listing.lastManualEditAt).toBeTruthy();
        expect(listing.brokerPricePln).toBeGreaterThan(listing.pricePln);
        expect(listing.dealerId).toBe(dealerId);
        expect(listing.slug).toBeTruthy();
    });

    it('rejects NEW with mileageKm >= 100', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ mileageKm: 200 }),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'mileageKm' })])
        );
    });

    it('rejects USED without mileageKm', async () => {
        const body = validBody({ condition: 'USED' });
        delete body.mileageKm;
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: body,
        });
        expect(response.statusCode).toBe(400);
    });

    it('rejects invalid VIN format', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ vin: 'INVALIDOOO0000000' }),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().errors).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: 'vin' })])
        );
    });

    it('forbids dealer admin from creating for another dealer', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: validBody({ dealerId: otherDealerId }),
        });
        expect(response.statusCode).toBe(403);
    });

    it('uses dealerId from active context when missing in body', async () => {
        const body = validBody();
        delete body.dealerId;
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: body,
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().listing.dealerId).toBe(dealerId);
    });

    it('platform admin can create for any dealer with explicit dealerId', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/listings',
            headers: { authorization: `Bearer ${platformToken}` },
            payload: validBody({ dealerId: otherDealerId }),
        });
        expect(response.statusCode).toBe(201);
        expect(response.json().listing.dealerId).toBe(otherDealerId);
    });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

```bash
cd backend && bun run test -- listings-manual
```

Expected: all tests FAIL because endpoint does not exist yet (404 responses or compile errors).

---

### Task 8: Implement POST /api/listings

**Files:**
- Modify: `backend/src/routes/listings.ts`

- [ ] **Step 8.1: Add imports at the top of listings.ts**

Open `backend/src/routes/listings.ts`. Below the existing imports, add:

```ts
import { mapManualPayloadToListing, validateListingPayload } from '../services/listing-mapper.js';
```

- [ ] **Step 8.2: Add POST endpoint inside `listingRoutes`**

In the `listingRoutes` function, after the `GET /api/listings/options` block but before the existing `GET /api/listings`, add:

```ts
    fastify.post('/api/listings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const body = request.body as any;
        const scope = await resolveScope(fastify, request);

        let dealerId = body.dealerId;
        if (!dealerId && scope.activeContext.scopeType === 'DEALER') {
            dealerId = scope.activeContext.scopeId;
        }
        if (!dealerId) {
            return reply.code(400).send({ error: 'dealerId is required' });
        }

        if (!scope.isPlatform) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && dealerId !== allowed) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
            if (allowed && typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(dealerId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }

        const errors = validateListingPayload(body);
        if (errors.length > 0) {
            return reply.code(400).send({ errors });
        }

        const dealer = await fastify.prisma.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) {
            return reply.code(400).send({ error: 'Dealer not found' });
        }

        if (body.vin) {
            const existingByVin = await fastify.prisma.listing.findUnique({ where: { vin: body.vin } });
            if (existingByVin) {
                return reply.code(409).send({
                    error: 'VIN already exists',
                    existingListingId: existingByVin.id,
                });
            }
        }

        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        const brokerFeePct = settings?.brokerFeePctPln ?? 3.5;
        const brokerPricePln = Math.round(body.pricePln * (1 + brokerFeePct / 100));

        const listing = await fastify.prisma.listing.create({
            data: {
                ...mapManualPayloadToListing(body, dealerId),
                brokerPricePln,
                entrySource: 'MANUAL',
                lastManualEditAt: new Date(),
            },
        });

        const slug = generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            listing.id
        );
        const updated = await fastify.prisma.listing.update({
            where: { id: listing.id },
            data: { slug },
        });

        return reply.code(201).send({ listing: updated });
    });
```

- [ ] **Step 8.3: Run tests to verify they pass**

```bash
cd backend && bun run test -- listings-manual
```

Expected: all 7 tests in the suite PASS.

- [ ] **Step 8.4: Commit**

```bash
git add backend/src/routes/listings.ts backend/src/routes/__tests__/listings-manual.test.ts
git commit -m "feat(api): add POST /api/listings for manual entry"
```

---

### Task 9: Write failing tests for PATCH /api/listings/:id

**Files:**
- Modify: `backend/src/routes/__tests__/listings-manual.test.ts`

- [ ] **Step 9.1: Add PATCH tests at the bottom of the test file**

Append to `backend/src/routes/__tests__/listings-manual.test.ts` (before the final closing `});`):

```ts
});

describe('Manual Listing Entry — PATCH /api/listings/:id', () => {
    let app: FastifyInstance;
    let platformToken: string;
    let dealerAdminToken: string;
    let dealerId: string;
    let manualListingId: string;
    let csvListingId: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        const dealer = await app.prisma.dealer.create({
            data: { name: 'PATCH Test Dealer', addressLine1: 'PATCH Addr' },
        });
        dealerId = dealer.id;

        platformToken = app.jwt.sign({
            userId: 'p-patch',
            email: 'pp@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        dealerAdminToken = app.jwt.sign({
            userId: 'da-patch',
            email: 'dap@test.com',
            memberships: [{
                id: 'mp',
                scopeType: 'DEALER',
                scopeId: dealerId,
                role: 'DEALER_ADMIN',
                isDefaultContext: true,
            }],
            activeContext: { scopeType: 'DEALER', scopeId: dealerId },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId } });
        await app.prisma.dealer.delete({ where: { id: dealerId } });
        await app.close();
    });

    beforeEach(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId } });

        const manual = await app.prisma.listing.create({
            data: {
                make: 'Toyota', model: 'Yaris', productionYear: 2026,
                pricePln: 95000, brokerPricePln: 98325, mileageKm: 0,
                condition: 'NEW', financingPriceBase: 'BROKER_PRICE_PLN',
                entrySource: 'MANUAL', dealerId,
            },
        });
        manualListingId = manual.id;

        const csv = await app.prisma.listing.create({
            data: {
                make: 'Volvo', model: 'XC60', productionYear: 2024,
                pricePln: 250000, brokerPricePln: 258750, mileageKm: 30000,
                condition: 'USED', financingPriceBase: 'BROKER_PRICE_PLN',
                entrySource: 'CSV', dealerId,
            },
        });
        csvListingId = csv.id;
    });

    it('MANUAL: updates pricePln and recalculates brokerPricePln', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${manualListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { pricePln: 100000, make: 'Toyota', model: 'Yaris', productionYear: 2026, mileageKm: 0, condition: 'NEW' },
        });
        expect(response.statusCode).toBe(200);
        const { listing } = response.json();
        expect(listing.pricePln).toBe(100000);
        expect(listing.brokerPricePln).toBeGreaterThan(100000);
        expect(listing.lastManualEditAt).toBeTruthy();
    });

    it('CSV: ignores pricePln in payload (not whitelisted)', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${csvListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { pricePln: 999999, isFeatured: true },
        });
        expect(response.statusCode).toBe(200);
        const { listing } = response.json();
        expect(listing.pricePln).toBe(250000);
        expect(listing.isFeatured).toBe(true);
        expect(listing.lastManualEditAt).toBeTruthy();
    });

    it('CSV: accepts catalogPrice and isChineseBrand', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/${csvListingId}`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { catalogPrice: 280000, isChineseBrand: false },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().listing.catalogPrice).toBe(280000);
    });

    it('returns 404 for nonexistent listing', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: `/api/listings/cnonexistentid000000000000`,
            headers: { authorization: `Bearer ${dealerAdminToken}` },
            payload: { isFeatured: true },
        });
        expect(response.statusCode).toBe(404);
    });
});
```

- [ ] **Step 9.2: Run tests to verify they fail**

```bash
cd backend && bun run test -- listings-manual
```

Expected: PATCH tests FAIL (404 or method not allowed).

---

### Task 10: Implement PATCH /api/listings/:id

**Files:**
- Modify: `backend/src/routes/listings.ts`

- [ ] **Step 10.1: Add import**

In `backend/src/routes/listings.ts`, update the import line from Task 8 to include the additional helpers:

```ts
import {
    mapManualPayloadToListing,
    mapManualPayloadToListingUpdate,
    pickCsvEditableFields,
    validateListingPayload,
} from '../services/listing-mapper.js';
```

- [ ] **Step 10.2: Add PATCH endpoint after the POST endpoint**

Immediately after the closing `});` of the POST endpoint added in Task 8, add:

```ts
    fastify.patch('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const scope = await resolveScope(fastify, request);

        const existing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        if (!scope.isPlatform && existing.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && existing.dealerId !== allowed) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
            if (allowed && typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(existing.dealerId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }

        const isImported = existing.entrySource === 'CSV' || existing.entrySource === 'CSFLOW';

        let updateData: any;
        if (isImported) {
            updateData = pickCsvEditableFields(body);
        } else {
            const errors = validateListingPayload({
                ...existing,
                ...body,
            });
            if (errors.length > 0) {
                return reply.code(400).send({ errors });
            }
            updateData = mapManualPayloadToListingUpdate(body);
        }

        if (!isImported && body.pricePln !== undefined && body.pricePln !== existing.pricePln) {
            const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
            const brokerFeePct = settings?.brokerFeePctPln ?? 3.5;
            updateData.brokerPricePln = Math.round(body.pricePln * (1 + brokerFeePct / 100));
        }

        updateData.lastManualEditAt = new Date();

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: updateData,
        });

        return reply.send({ listing: updated });
    });
```

- [ ] **Step 10.3: Run tests to verify they pass**

```bash
cd backend && bun run test -- listings-manual
```

Expected: all PATCH tests PASS. POST tests also still PASS.

- [ ] **Step 10.4: Commit**

```bash
git add backend/src/routes/listings.ts backend/src/routes/__tests__/listings-manual.test.ts
git commit -m "feat(api): add PATCH /api/listings/:id with CSV field gating"
```

---

### Task 11: Create image upload/delete routes

**Files:**
- Create: `backend/src/routes/listing-upload.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 11.1: Create the upload route file**

Create `backend/src/routes/listing-upload.ts`:

```ts
import { FastifyInstance } from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    return `${Date.now()}-${hash}${ext}`;
}

export async function listingUploadRoutes(fastify: FastifyInstance) {
    fastify.post('/api/listings/:id/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const parts = request.parts();
        const uploadedUrls: string[] = [];
        let setPrimary = false;

        const listingDir = path.join(uploadsRoot, 'listing-images', id);
        await fs.mkdir(listingDir, { recursive: true });

        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'setPrimary') {
                    setPrimary = part.value === 'true';
                }
                continue;
            }
            if (part.type !== 'file') continue;

            if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
                return reply.code(400).send({ error: `Unsupported MIME: ${part.mimetype}` });
            }

            const filename = generateFilename(part.filename);
            const filepath = path.join(listingDir, filename);
            await pipeline(part.file, createWriteStream(filepath));

            const stats = await fs.stat(filepath);
            if (stats.size > MAX_FILE_SIZE) {
                await fs.unlink(filepath);
                return reply.code(413).send({ error: 'File too large (max 10MB)' });
            }

            uploadedUrls.push(`/uploads/listing-images/${id}/${filename}`);
        }

        const newImageUrls = [...(listing.imageUrls || []), ...uploadedUrls];
        const newPrimary = setPrimary && uploadedUrls.length > 0
            ? uploadedUrls[0]
            : listing.primaryImageUrl;

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls: newImageUrls,
                primaryImageUrl: newPrimary,
                imageCount: newImageUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated, uploadedUrls });
    });

    fastify.delete('/api/listings/:id/images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { url } = request.body as { url: string };

        if (!url) {
            return reply.code(400).send({ error: 'url is required' });
        }

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const newImageUrls = (listing.imageUrls || []).filter(u => u !== url);
        const newPrimary = listing.primaryImageUrl === url
            ? (newImageUrls[0] || null)
            : listing.primaryImageUrl;

        if (url.startsWith('/uploads/listing-images/')) {
            const filepath = path.join(uploadsRoot, url.replace('/uploads/', ''));
            try {
                await fs.unlink(filepath);
            } catch {
                // file already gone — ignore
            }
        }

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: {
                imageUrls: newImageUrls,
                primaryImageUrl: newPrimary,
                imageCount: newImageUrls.length,
                lastManualEditAt: new Date(),
            },
        });

        return reply.send({ listing: updated });
    });
}
```

- [ ] **Step 11.2: Register routes and add public download path in app.ts**

Open `backend/src/app.ts`. Find the line `import { rentalUploadRoutes } from './routes/rental-upload.js';` and add below it:

```ts
import { listingUploadRoutes } from './routes/listing-upload.js';
```

Find `await fastify.register(rentalUploadRoutes);` (around line 254) and add below it:

```ts
    await fastify.register(listingUploadRoutes);
```

Find the public route `fastify.get('/uploads/rental-images/:vehicleId/:file', ...)` (around line 291) and add a parallel route below it:

```ts
    fastify.get('/uploads/listing-images/:listingId/:file', async (request, reply) => {
        const { listingId, file } = request.params as { listingId: string; file: string };
        const filePath = path.join(uploadsRoot, 'listing-images', listingId, file);
        return reply.sendFile(file, path.dirname(filePath));
    });
```

- [ ] **Step 11.3: Verify build**

```bash
cd backend && bun run build
```

Expected: success.

- [ ] **Step 11.4: Manual smoke test of upload (optional but recommended)**

Start dev server: `cd backend && bun run dev`. With curl:

```bash
curl -X POST http://localhost:3001/api/listings/<some-listing-id>/images \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/test.jpg" \
  -F "setPrimary=true"
```

Expected: 200 response with updated listing.

- [ ] **Step 11.5: Commit**

```bash
git add backend/src/routes/listing-upload.ts backend/src/app.ts
git commit -m "feat(api): add image upload/delete for listings"
```

---

### Task 12: Verify CSV import regression

**Files:**
- Modify: `backend/src/routes/__tests__/listings-manual.test.ts`

- [ ] **Step 12.1: Add a regression test asserting CSV import sets new fields correctly**

At the end of `listings-manual.test.ts` (before the final `});`), add a small `describe` block:

```ts
});

describe('CSV Import Regression', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    it('csv-mapper sets entrySource=CSV and uses default condition/financingPriceBase', async () => {
        const { mapCSVToListing } = await import('../../services/csv-mapper.js');
        const row: any = {
            listing_id: 'test-id',
            make: 'Audi', model: 'A4', production_year: '2020',
            mileage_km: '50000', price_pln: '100000',
            fuel_type: 'Diesel', transmission: 'Automatyczna',
        };
        const mapped = mapCSVToListing(row);
        expect(mapped.entrySource).toBe('CSV');
    });
});
```

- [ ] **Step 12.2: Run all tests**

```bash
cd backend && bun run test -- listings-manual
```

Expected: all PASS, including the regression test.

- [ ] **Step 12.3: Commit**

```bash
git add backend/src/routes/__tests__/listings-manual.test.ts
git commit -m "test(csv): regression test for entrySource on CSV import"
```

---

## Stage 3 — Frontend refactor: extract `<VehicleDataForm>` (CHECKPOINT)

### Task 13: Create VehicleForm directory and types

**Files:**
- Create: `src/components/admin/VehicleForm/types.ts`

- [ ] **Step 13.1: Create directory and types file**

```bash
mkdir -p src/components/admin/VehicleForm/sections
```

Create `src/components/admin/VehicleForm/types.ts`:

```ts
export type VehicleFormMode = 'sale' | 'rental';

export interface VehicleFormState {
    // Identification
    make: string;
    model: string;
    version: string;
    vin: string;                       // sale only
    productionYear: string;
    condition: 'NEW' | 'USED';         // sale only

    // Technical
    bodyType: string;
    fuelType: string;
    transmission: string;
    enginePowerHp: string;
    engineCapacityCm3: string;
    drive: string;
    doors: string;
    seats: string;
    color: string;
    paintType: string;

    // Pricing — sale
    pricePln: string;                  // sale only
    catalogPrice: string;
    sellingPrice: string;              // rental only
    mileageKm: string;                 // sale only
    firstRegistrationDate: string;     // sale only
    registrationNumber: string;        // sale only

    // Flags — sale
    isChineseBrand: boolean;           // sale only
    isFeatured: boolean;
    financingPriceBase: 'PRICE_PLN' | 'BROKER_PRICE_PLN'; // sale only

    // Description
    additionalInfoHeader: string;
    additionalInfoContent: string;

    // Equipment (newline-separated text in form, array in payload)
    equipmentAudioMultimedia: string;
    equipmentSafety: string;
    equipmentComfortExtras: string;
    equipmentOther: string;

    // Provider — rental only
    providerId: string;
}

export interface SectionProps {
    form: VehicleFormState;
    setField: (field: keyof VehicleFormState, value: any) => void;
    mode: VehicleFormMode;
    /** When true, immutable identification/technical/equipment fields disabled (CSV/CSFLOW guard) */
    isImported?: boolean;
}
```

- [ ] **Step 13.2: Commit**

```bash
git add src/components/admin/VehicleForm/types.ts
git commit -m "feat(form): scaffold VehicleForm types"
```

---

### Task 14: Extract IdentificationSection

**Files:**
- Create: `src/components/admin/VehicleForm/sections/IdentificationSection.tsx`

- [ ] **Step 14.1: Create the component**

Create `src/components/admin/VehicleForm/sections/IdentificationSection.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

export function IdentificationSection({ form, setField, mode, isImported }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            {isImported && (
                <p className="text-xs text-amber-700 mb-2">
                    Pola pochodzą z importu CSV/CSFlow i są zarządzane automatycznie.
                </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Marka *</label>
                    <Input value={form.make} onChange={e => setField('make', e.target.value)} required placeholder="np. BMW" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Model *</label>
                    <Input value={form.model} onChange={e => setField('model', e.target.value)} required placeholder="np. X3" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Wersja</label>
                    <Input value={form.version} onChange={e => setField('version', e.target.value)} placeholder="np. xDrive20d" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Rok produkcji *</label>
                    <Input type="number" value={form.productionYear} onChange={e => setField('productionYear', e.target.value)} required />
                </div>
                {mode === 'sale' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">VIN</label>
                            <Input value={form.vin} onChange={e => setField('vin', e.target.value.toUpperCase())} placeholder="17 znaków" maxLength={17} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Stan *</label>
                            <div className="flex gap-4 pt-2">
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={form.condition === 'NEW'} onChange={() => setField('condition', 'NEW')} />
                                    <span>Nowy</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="radio" checked={form.condition === 'USED'} onChange={() => setField('condition', 'USED')} />
                                    <span>Używany</span>
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </fieldset>
    );
}
```

- [ ] **Step 14.2: Commit**

```bash
git add src/components/admin/VehicleForm/sections/IdentificationSection.tsx
git commit -m "feat(form): extract IdentificationSection"
```

---

### Task 15: Extract TechnicalSpecsSection

**Files:**
- Create: `src/components/admin/VehicleForm/sections/TechnicalSpecsSection.tsx`

- [ ] **Step 15.1: Create component**

Create `src/components/admin/VehicleForm/sections/TechnicalSpecsSection.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

const BODY_TYPES = ['SUV', 'Sedan', 'Kombi', 'Hatchback', 'Coupe', 'Kabriolet', 'Van', 'Pickup'];
const FUEL_TYPES = ['Benzyna', 'Diesel', 'Hybryda', 'Plug-in Hybrid', 'Elektryczny', 'LPG'];

export function TechnicalSpecsSection({ form, setField, isImported }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Typ nadwozia</label>
                    <select value={form.bodyType} onChange={e => setField('bodyType', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Paliwo</label>
                    <select value={form.fuelType} onChange={e => setField('fuelType', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Skrzynia biegów</label>
                    <select value={form.transmission} onChange={e => setField('transmission', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        <option value="Automatyczna">Automatyczna</option>
                        <option value="Manualna">Manualna</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Moc (KM)</label>
                    <Input type="number" value={form.enginePowerHp} onChange={e => setField('enginePowerHp', e.target.value)} placeholder="np. 190" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Pojemność (cm³)</label>
                    <Input type="number" value={form.engineCapacityCm3} onChange={e => setField('engineCapacityCm3', e.target.value)} placeholder="np. 1998" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Napęd</label>
                    <select value={form.drive} onChange={e => setField('drive', e.target.value)} className="w-full h-10 px-3 rounded-md border text-sm">
                        <option value="">Wybierz</option>
                        <option value="Przedni">Przedni</option>
                        <option value="Tylny">Tylny</option>
                        <option value="4x4">4x4</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Drzwi</label>
                    <Input type="number" value={form.doors} onChange={e => setField('doors', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Miejsca</label>
                    <Input type="number" value={form.seats} onChange={e => setField('seats', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Kolor</label>
                    <Input value={form.color} onChange={e => setField('color', e.target.value)} placeholder="np. Czarny" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Rodzaj lakieru</label>
                    <Input value={form.paintType} onChange={e => setField('paintType', e.target.value)} placeholder="np. Metalik" />
                </div>
            </div>
        </fieldset>
    );
}
```

- [ ] **Step 15.2: Commit**

```bash
git add src/components/admin/VehicleForm/sections/TechnicalSpecsSection.tsx
git commit -m "feat(form): extract TechnicalSpecsSection"
```

---

### Task 16: Extract EquipmentSection

**Files:**
- Create: `src/components/admin/VehicleForm/sections/EquipmentSection.tsx`

- [ ] **Step 16.1: Create component**

Create `src/components/admin/VehicleForm/sections/EquipmentSection.tsx`:

```tsx
import { Textarea } from '@/components/ui/textarea';
import type { SectionProps } from '../types';

const GROUPS: Array<{ key: keyof Pick<import('../types').VehicleFormState, 'equipmentAudioMultimedia' | 'equipmentSafety' | 'equipmentComfortExtras' | 'equipmentOther'>; label: string }> = [
    { key: 'equipmentAudioMultimedia', label: 'Audio i multimedia' },
    { key: 'equipmentSafety', label: 'Bezpieczeństwo' },
    { key: 'equipmentComfortExtras', label: 'Komfort' },
    { key: 'equipmentOther', label: 'Inne' },
];

export function EquipmentSection({ form, setField, isImported }: SectionProps) {
    return (
        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
            <p className="text-xs text-gray-500 mb-3">Każda pozycja w nowej linii.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GROUPS.map(g => (
                    <div key={g.key} className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{g.label}</label>
                        <Textarea
                            value={form[g.key]}
                            onChange={e => setField(g.key, e.target.value)}
                            rows={4}
                        />
                    </div>
                ))}
            </div>
        </fieldset>
    );
}
```

- [ ] **Step 16.2: Verify Textarea import path matches your project**

```bash
ls src/components/ui/ | grep -i textarea
```

Expected: `textarea.tsx` exists. If named differently, update the import.

- [ ] **Step 16.3: Commit**

```bash
git add src/components/admin/VehicleForm/sections/EquipmentSection.tsx
git commit -m "feat(form): extract EquipmentSection"
```

---

### Task 17: Extract PricingSection (mode-aware)

**Files:**
- Create: `src/components/admin/VehicleForm/sections/PricingSection.tsx`

- [ ] **Step 17.1: Create component**

Create `src/components/admin/VehicleForm/sections/PricingSection.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import type { SectionProps } from '../types';

export function PricingSection({ form, setField, mode, isImported }: SectionProps) {
    const technicalDisabled = isImported;

    return (
        <div>
            {/* Catalog price + main price always editable for sale (catalogPrice whitelisted) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        Cena katalogowa (PLN) {mode === 'rental' ? '*' : ''}
                    </label>
                    <Input type="number" value={form.catalogPrice} onChange={e => setField('catalogPrice', e.target.value)} required={mode === 'rental'} />
                </div>

                {mode === 'sale' && (
                    <div className="space-y-2">
                        <fieldset disabled={isImported} className={isImported ? 'opacity-60' : ''}>
                            <label className="text-sm font-medium text-gray-700">Cena sprzedaży brutto (PLN) *</label>
                            <Input type="number" value={form.pricePln} onChange={e => setField('pricePln', e.target.value)} required />
                        </fieldset>
                    </div>
                )}

                {mode === 'rental' && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Cena sprzedaży (PLN)</label>
                        <Input type="number" value={form.sellingPrice} onChange={e => setField('sellingPrice', e.target.value)} />
                    </div>
                )}
            </div>

            {mode === 'sale' && (
                <fieldset disabled={technicalDisabled} className={`mt-4 ${technicalDisabled ? 'opacity-60' : ''}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Przebieg (km) {form.condition === 'NEW' ? '(< 100)' : '*'}
                            </label>
                            <Input type="number" value={form.mileageKm} onChange={e => setField('mileageKm', e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Data pierwszej rejestracji</label>
                            <Input type="text" value={form.firstRegistrationDate} onChange={e => setField('firstRegistrationDate', e.target.value)} placeholder="YYYY-MM-DD" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Numer rejestracyjny</label>
                            <Input value={form.registrationNumber} onChange={e => setField('registrationNumber', e.target.value)} />
                        </div>
                    </div>
                </fieldset>
            )}
        </div>
    );
}
```

- [ ] **Step 17.2: Commit**

```bash
git add src/components/admin/VehicleForm/sections/PricingSection.tsx
git commit -m "feat(form): extract PricingSection (mode-aware)"
```

---

### Task 18: Extract FlagsSection (mode-aware)

**Files:**
- Create: `src/components/admin/VehicleForm/sections/FlagsSection.tsx`

- [ ] **Step 18.1: Create component**

Create `src/components/admin/VehicleForm/sections/FlagsSection.tsx`:

```tsx
import type { SectionProps } from '../types';

export function FlagsSection({ form, setField, mode }: SectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <input
                    id="isFeatured"
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={e => setField('isFeatured', e.target.checked)}
                />
                <label htmlFor="isFeatured" className="text-sm">Wyróżnij na liście</label>
            </div>

            {mode === 'sale' && (
                <>
                    <div className="flex items-center gap-2">
                        <input
                            id="isChineseBrand"
                            type="checkbox"
                            checked={form.isChineseBrand}
                            onChange={e => setField('isChineseBrand', e.target.checked)}
                        />
                        <label htmlFor="isChineseBrand" className="text-sm">Marka chińska</label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Baza ceny do raty finansowania</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.financingPriceBase === 'BROKER_PRICE_PLN'}
                                    onChange={() => setField('financingPriceBase', 'BROKER_PRICE_PLN')}
                                />
                                <span className="text-sm">Cena brokera (z markupem)</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    checked={form.financingPriceBase === 'PRICE_PLN'}
                                    onChange={() => setField('financingPriceBase', 'PRICE_PLN')}
                                />
                                <span className="text-sm">Cena sprzedaży brutto</span>
                            </label>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
```

- [ ] **Step 18.2: Commit**

```bash
git add src/components/admin/VehicleForm/sections/FlagsSection.tsx
git commit -m "feat(form): extract FlagsSection (mode-aware)"
```

---

### Task 19: Extract DescriptionSection

**Files:**
- Create: `src/components/admin/VehicleForm/sections/DescriptionSection.tsx`

- [ ] **Step 19.1: Create component**

Create `src/components/admin/VehicleForm/sections/DescriptionSection.tsx`:

```tsx
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { SectionProps } from '../types';

export function DescriptionSection({ form, setField }: SectionProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nagłówek opisu dodatkowego</label>
                <Input value={form.additionalInfoHeader} onChange={e => setField('additionalInfoHeader', e.target.value)} />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Treść opisu dodatkowego</label>
                <Textarea value={form.additionalInfoContent} onChange={e => setField('additionalInfoContent', e.target.value)} rows={6} />
            </div>
        </div>
    );
}
```

- [ ] **Step 19.2: Commit**

```bash
git add src/components/admin/VehicleForm/sections/DescriptionSection.tsx
git commit -m "feat(form): extract DescriptionSection"
```

---

### Task 20: Extract ImagesSection (mode-aware)

**Files:**
- Create: `src/components/admin/VehicleForm/sections/ImagesSection.tsx`

- [ ] **Step 20.1: Inspect existing rental ImagesSection or upload UI**

```bash
grep -rn "rental-images\|primaryImageUrl" src/components/admin/ src/pages/admin/RentalVehiclesPage.tsx | head -10
```

Expected: shows where rental image upload is currently handled. We re-implement parallel for both modes.

- [ ] **Step 20.2: Create the component**

Create `src/components/admin/VehicleForm/sections/ImagesSection.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { VehicleFormMode } from '../types';

interface ImagesSectionProps {
    mode: VehicleFormMode;
    vehicleId?: string;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    onUpdated: (data: { primaryImageUrl: string | null; imageUrls: string[] }) => void;
}

export function ImagesSection({ mode, vehicleId, primaryImageUrl, imageUrls = [], onUpdated }: ImagesSectionProps) {
    const { token } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);

    const uploadEndpoint = mode === 'sale'
        ? `/api/listings/${vehicleId}/images`
        : `/api/rental-vehicles/${vehicleId}/images`;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!vehicleId) {
            toast({ title: 'Najpierw zapisz pojazd', description: 'Zdjęcia można dodać po utworzeniu rekordu.' });
            return;
        }
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (const f of Array.from(files)) {
            formData.append('files', f);
        }
        if (imageUrls.length === 0) {
            formData.append('setPrimary', 'true');
        }

        setUploading(true);
        try {
            const res = await fetch(uploadEndpoint, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            const updated = mode === 'sale' ? data.listing : data.vehicle;
            onUpdated({
                primaryImageUrl: updated.primaryImageUrl,
                imageUrls: updated.imageUrls,
            });
            toast({ title: 'Zdjęcia wgrane' });
        } catch (err) {
            toast({ title: 'Błąd uploadu', variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (url: string) => {
        if (!vehicleId || !token) return;
        try {
            const res = await fetch(uploadEndpoint, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            if (!res.ok) throw new Error('Delete failed');
            const data = await res.json();
            const updated = mode === 'sale' ? data.listing : data.vehicle;
            onUpdated({
                primaryImageUrl: updated.primaryImageUrl,
                imageUrls: updated.imageUrls,
            });
        } catch {
            toast({ title: 'Błąd usuwania', variant: 'destructive' });
        }
    };

    const handleSetPrimary = async (url: string) => {
        // For now: client-side reorder; primary is the first one. Backend extension out of scope.
        const reordered = [url, ...imageUrls.filter(u => u !== url)];
        onUpdated({ primaryImageUrl: url, imageUrls: reordered });
    };

    if (!vehicleId) {
        return <p className="text-sm text-gray-500">Zdjęcia będzie można dodać po zapisaniu pojazdu.</p>;
    }

    return (
        <div className="space-y-4">
            <div>
                <input type="file" multiple accept="image/*" onChange={handleUpload} disabled={uploading} />
                {uploading && <span className="ml-2 text-sm text-gray-500">Wgrywanie...</span>}
            </div>
            {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {imageUrls.map(url => (
                        <div key={url} className={`relative border rounded ${url === primaryImageUrl ? 'ring-2 ring-blue-500' : ''}`}>
                            <img src={url} alt="" className="w-full h-32 object-cover" />
                            <div className="absolute top-1 right-1 flex gap-1">
                                {url !== primaryImageUrl && (
                                    <Button type="button" size="sm" variant="secondary" onClick={() => handleSetPrimary(url)}>Primary</Button>
                                )}
                                <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(url)}>×</Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 20.3: Commit**

```bash
git add src/components/admin/VehicleForm/sections/ImagesSection.tsx
git commit -m "feat(form): extract ImagesSection (mode-aware upload)"
```

---

### Task 21: Wire up `<VehicleDataForm>` parent

**Files:**
- Create: `src/components/admin/VehicleForm/VehicleDataForm.tsx`

- [ ] **Step 21.1: Create the parent component**

Create `src/components/admin/VehicleForm/VehicleDataForm.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IdentificationSection } from './sections/IdentificationSection';
import { TechnicalSpecsSection } from './sections/TechnicalSpecsSection';
import { EquipmentSection } from './sections/EquipmentSection';
import { PricingSection } from './sections/PricingSection';
import { FlagsSection } from './sections/FlagsSection';
import { DescriptionSection } from './sections/DescriptionSection';
import { ImagesSection } from './sections/ImagesSection';
import type { VehicleFormMode, VehicleFormState } from './types';

interface VehicleDataFormProps {
    mode: VehicleFormMode;
    vehicle?: any;
    dealers: Array<{ id: string; name: string; city?: string }>;
    companies?: Array<{ id: string; name: string }>;
    isImported?: boolean;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}

const arrayToText = (arr?: string[] | null): string => (arr || []).join('\n');
const textToArray = (text: string): string[] =>
    text.split('\n').map(l => l.trim()).filter(Boolean);

function buildInitialState(mode: VehicleFormMode, vehicle?: any): VehicleFormState {
    const defaultProvider = vehicle?.dealerId
        ? `dealer_${vehicle.dealerId}`
        : vehicle?.ownerRentalCompanyId
        ? `company_${vehicle.ownerRentalCompanyId}`
        : '';
    return {
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        version: vehicle?.version || '',
        vin: vehicle?.vin || '',
        productionYear: vehicle?.productionYear?.toString() || new Date().getFullYear().toString(),
        condition: vehicle?.condition || 'USED',
        bodyType: vehicle?.bodyType || '',
        fuelType: vehicle?.fuelType || '',
        transmission: vehicle?.transmission || '',
        enginePowerHp: vehicle?.enginePowerHp?.toString() || '',
        engineCapacityCm3: vehicle?.engineCapacityCm3?.toString() || '',
        drive: vehicle?.drive || '',
        doors: vehicle?.doors?.toString() || '',
        seats: vehicle?.seats?.toString() || '',
        color: vehicle?.color || '',
        paintType: vehicle?.paintType || '',
        pricePln: vehicle?.pricePln?.toString() || '',
        catalogPrice: vehicle?.catalogPrice?.toString() || '',
        sellingPrice: vehicle?.sellingPrice?.toString() || '',
        mileageKm: vehicle?.mileageKm?.toString() || (vehicle?.condition === 'NEW' ? '0' : ''),
        firstRegistrationDate: vehicle?.firstRegistrationDate || '',
        registrationNumber: vehicle?.registrationNumber || '',
        isChineseBrand: vehicle?.isChineseBrand ?? false,
        isFeatured: vehicle?.isFeatured ?? false,
        financingPriceBase: vehicle?.financingPriceBase || 'BROKER_PRICE_PLN',
        additionalInfoHeader: vehicle?.additionalInfoHeader || '',
        additionalInfoContent: vehicle?.additionalInfoContent || '',
        equipmentAudioMultimedia: arrayToText(vehicle?.equipmentAudioMultimedia),
        equipmentSafety: arrayToText(vehicle?.equipmentSafety),
        equipmentComfortExtras: arrayToText(vehicle?.equipmentComfortExtras),
        equipmentOther: arrayToText(vehicle?.equipmentOther),
        providerId: defaultProvider,
    };
}

export function VehicleDataForm({ mode, vehicle, dealers, companies, isImported, onSave, onCancel, isSaving }: VehicleDataFormProps) {
    const [form, setForm] = useState<VehicleFormState>(() => buildInitialState(mode, vehicle));
    const [images, setImages] = useState<{ primaryImageUrl: string | null; imageUrls: string[] }>({
        primaryImageUrl: vehicle?.primaryImageUrl ?? null,
        imageUrls: vehicle?.imageUrls ?? [],
    });

    const setField = (field: keyof VehicleFormState, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'sale' && form.condition === 'NEW' && parseInt(form.mileageKm || '0') >= 100) {
            alert('Pojazd nowy nie może mieć przebiegu powyżej 100 km');
            return;
        }

        const basePayload: any = {
            make: form.make,
            model: form.model,
            version: form.version || null,
            bodyType: form.bodyType || null,
            fuelType: form.fuelType || null,
            transmission: form.transmission || null,
            enginePowerHp: form.enginePowerHp ? parseInt(form.enginePowerHp) : null,
            engineCapacityCm3: form.engineCapacityCm3 ? parseInt(form.engineCapacityCm3) : null,
            productionYear: parseInt(form.productionYear),
            color: form.color || null,
            paintType: form.paintType || null,
            doors: form.doors ? parseInt(form.doors) : null,
            seats: form.seats ? parseInt(form.seats) : null,
            drive: form.drive || null,
            catalogPrice: form.catalogPrice ? parseInt(form.catalogPrice) : null,
            additionalInfoHeader: form.additionalInfoHeader || null,
            additionalInfoContent: form.additionalInfoContent || null,
            isFeatured: form.isFeatured,
            equipmentAudioMultimedia: textToArray(form.equipmentAudioMultimedia),
            equipmentSafety: textToArray(form.equipmentSafety),
            equipmentComfortExtras: textToArray(form.equipmentComfortExtras),
            equipmentOther: textToArray(form.equipmentOther),
        };

        if (mode === 'sale') {
            await onSave({
                ...basePayload,
                vin: form.vin || null,
                pricePln: form.pricePln ? parseInt(form.pricePln) : 0,
                mileageKm: form.mileageKm ? parseInt(form.mileageKm) : 0,
                firstRegistrationDate: form.firstRegistrationDate || null,
                registrationNumber: form.registrationNumber || null,
                condition: form.condition,
                financingPriceBase: form.financingPriceBase,
                isChineseBrand: form.isChineseBrand,
            });
        } else {
            let dealerId = null;
            let ownerRentalCompanyId = null;
            if (form.providerId.startsWith('dealer_')) dealerId = form.providerId.replace('dealer_', '');
            else if (form.providerId.startsWith('company_')) ownerRentalCompanyId = form.providerId.replace('company_', '');

            await onSave({
                ...basePayload,
                sellingPrice: form.sellingPrice ? parseInt(form.sellingPrice) : null,
                dealerId,
                ownerRentalCompanyId,
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <Section title="Identyfikacja">
                <IdentificationSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Parametry techniczne">
                <TechnicalSpecsSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Wyposażenie">
                <EquipmentSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Ceny i stan">
                <PricingSection form={form} setField={setField} mode={mode} isImported={isImported} />
            </Section>
            <Section title="Flagi">
                <FlagsSection form={form} setField={setField} mode={mode} />
            </Section>
            <Section title="Opis dodatkowy">
                <DescriptionSection form={form} setField={setField} mode={mode} />
            </Section>
            <Section title="Zdjęcia">
                <ImagesSection
                    mode={mode}
                    vehicleId={vehicle?.id}
                    primaryImageUrl={images.primaryImageUrl}
                    imageUrls={images.imageUrls}
                    onUpdated={setImages}
                />
            </Section>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel}>Anuluj</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
            </div>
        </form>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
            {children}
        </div>
    );
}
```

- [ ] **Step 21.2: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 21.3: Commit**

```bash
git add src/components/admin/VehicleForm/VehicleDataForm.tsx
git commit -m "feat(form): wire VehicleDataForm parent component"
```

---

### Task 22: Replace inline VehicleForm in RentalVehiclesPage

**Files:**
- Modify: `src/pages/admin/RentalVehiclesPage.tsx`

- [ ] **Step 22.1: Read current usage of inline VehicleForm**

```bash
grep -n "VehicleForm" src/pages/admin/RentalVehiclesPage.tsx
```

Expected: shows the function definition (~line 61) and two render call-sites (~lines 870, 885).

- [ ] **Step 22.2: Add import at the top of the file**

After the existing imports in `src/pages/admin/RentalVehiclesPage.tsx`, add:

```tsx
import { VehicleDataForm } from '@/components/admin/VehicleForm/VehicleDataForm';
```

- [ ] **Step 22.3: Delete the inline `VehicleForm` function**

Delete lines 47-315 of `src/pages/admin/RentalVehiclesPage.tsx` (the entire `function VehicleForm(...)` block including its `// ─── Vehicle Form ───` header). Also delete the helper `arrayToText` and `textToArray` functions if they're no longer used elsewhere in this file.

- [ ] **Step 22.4: Replace render call-sites**

Find the two `<VehicleForm ... />` JSX usages and replace each with:

```tsx
<VehicleDataForm
    mode="rental"
    vehicle={editingVehicle}
    dealers={dealers}
    companies={rentalCompanies}
    onSave={handleSave}
    onCancel={() => setIsFormOpen(false)}
    isSaving={isSaving}
/>
```

(Adjust prop names — `editingVehicle`, `dealers`, `rentalCompanies`, `handleSave`, `setIsFormOpen`, `isSaving` — to match the existing variables in `RentalVehiclesPage.tsx`.)

- [ ] **Step 22.5: Verify build**

```bash
bun run build
```

Expected: success. Fix any TS errors about removed helpers or missing prop types.

- [ ] **Step 22.6: Commit**

```bash
git add src/pages/admin/RentalVehiclesPage.tsx
git commit -m "refactor(rental): use shared VehicleDataForm component"
```

---

### Task 23: CHECKPOINT — Manual rental form regression test

- [ ] **Step 23.1: Start dev environment**

```bash
bun run dev
```

(In another terminal: `cd backend && bun run dev`.)

- [ ] **Step 23.2: Open browser to `/admin/rental-vehicles`**

- [ ] **Step 23.3: Verify inline checklist**

- ☐ List of rental vehicles renders.
- ☐ Click "Dodaj pojazd" — dialog/form opens with all 7 sections.
- ☐ Fill all required fields, click Save — vehicle is created.
- ☐ Click Edit on existing — form pre-fills with current values.
- ☐ Edit and Save — changes persist after reload.
- ☐ Image upload — drag & drop or file picker works, primary image can be changed.
- ☐ Image delete — works.
- ☐ Cancel button — closes form without saving.

- [ ] **Step 23.4: If any check fails — fix before continuing.** Rollback option:

```bash
git log --oneline -5  # Find the refactor commit
git revert <commit-hash>
```

- [ ] **Step 23.5: Once all checks pass, mark checkpoint complete**

```bash
git commit --allow-empty -m "chore: rental form regression checkpoint passed"
```

---

## Stage 4 — Frontend pages and integration

### Task 24: Add API client methods

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 24.1: Locate `listingsApi` object**

```bash
grep -n "listingsApi\|export const listingsApi" src/services/api.ts
```

Expected: shows the export line.

- [ ] **Step 24.2: Add 4 new methods inside `listingsApi`**

Inside the `listingsApi` object, add:

```ts
    createListing: async (data: any, token: string) => {
        const res = await fetch(`${API_BASE}/api/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Create failed');
        return res.json();
    },
    updateListing: async (id: string, data: any, token: string) => {
        const res = await fetch(`${API_BASE}/api/listings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
        return res.json();
    },
    uploadImages: async (id: string, files: File[], setPrimary: boolean, token: string) => {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        fd.append('setPrimary', String(setPrimary));
        const res = await fetch(`${API_BASE}/api/listings/${id}/images`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
    },
    deleteImage: async (id: string, url: string, token: string) => {
        const res = await fetch(`${API_BASE}/api/listings/${id}/images`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error('Delete failed');
        return res.json();
    },
```

If `API_BASE` is named differently in the file, use the existing constant.

- [ ] **Step 24.3: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 24.4: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(api): add listingsApi methods for create/update/images"
```

---

### Task 25: Create `getFinancingBasePrice` helper with unit test

**Files:**
- Create: `src/utils/listingPrice.ts`
- Create: `src/utils/__tests__/listingPrice.test.ts`

- [ ] **Step 25.1: Verify Vitest is set up for frontend**

```bash
grep -E "vitest|test" package.json | head -5
```

If Vitest is set up — proceed. If not — skip Step 25.3 and rely on backend test only.

- [ ] **Step 25.2: Create the helper**

Create `src/utils/listingPrice.ts`:

```ts
import type { Listing } from '@/types/listing';

export function getFinancingBasePrice(listing: Pick<Listing, 'pricePln' | 'brokerPricePln' | 'financingPriceBase'>): number {
    if (listing.financingPriceBase === 'PRICE_PLN') {
        return listing.pricePln;
    }
    return listing.brokerPricePln ?? listing.pricePln;
}
```

(Adjust the `import type { Listing }` path to match your project's type location.)

- [ ] **Step 25.3: Create unit test (only if Vitest configured for frontend)**

Create `src/utils/__tests__/listingPrice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getFinancingBasePrice } from '../listingPrice';

describe('getFinancingBasePrice', () => {
    it('returns brokerPricePln when financingPriceBase is BROKER_PRICE_PLN', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: 103500,
            financingPriceBase: 'BROKER_PRICE_PLN',
        });
        expect(result).toBe(103500);
    });

    it('returns pricePln when financingPriceBase is PRICE_PLN', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: 103500,
            financingPriceBase: 'PRICE_PLN',
        });
        expect(result).toBe(100000);
    });

    it('falls back to pricePln when brokerPricePln is null', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: null as any,
            financingPriceBase: 'BROKER_PRICE_PLN',
        });
        expect(result).toBe(100000);
    });
});
```

- [ ] **Step 25.4: Verify build/tests**

```bash
bun run build
# If frontend tests are set up:
bun run test -- listingPrice
```

Expected: success.

- [ ] **Step 25.5: Commit**

```bash
git add src/utils/listingPrice.ts src/utils/__tests__/listingPrice.test.ts
git commit -m "feat(utils): add getFinancingBasePrice helper"
```

---

### Task 26: Use helper in ListingDetailPage, LeadFormPage, PersonalOfferPage

**Files:**
- Modify: `src/pages/ListingDetailPage.tsx`
- Modify: `src/pages/LeadFormPage.tsx`
- Modify: `src/pages/PersonalOfferPage.tsx`

- [ ] **Step 26.1: Find FinancingCalculator usage**

```bash
grep -rn "FinancingCalculator\|brokerPricePln" src/pages/ | grep -v "RentalVehicles\|Search"
```

Expected: shows the locations to update.

- [ ] **Step 26.2: For each file from Step 26.1, add import**

At the top:

```tsx
import { getFinancingBasePrice } from '@/utils/listingPrice';
```

- [ ] **Step 26.3: Replace amount calculation**

Wherever the code uses `listing.brokerPricePln` (or `listing.pricePln`) as the input to `<FinancingCalculator>` or financing-rate calculation, replace with:

```tsx
getFinancingBasePrice(listing)
```

For example:
```tsx
<FinancingCalculator amount={getFinancingBasePrice(listing)} ... />
```

- [ ] **Step 26.4: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 26.5: Commit**

```bash
git add src/pages/ListingDetailPage.tsx src/pages/LeadFormPage.tsx src/pages/PersonalOfferPage.tsx
git commit -m "feat(financing): use per-listing financingPriceBase via helper"
```

---

### Task 27: Create ListingNewPage

**Files:**
- Create: `src/pages/admin/ListingNewPage.tsx`

- [ ] **Step 27.1: Create the page**

Create `src/pages/admin/ListingNewPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VehicleDataForm } from '@/components/admin/VehicleForm/VehicleDataForm';
import { useAuth } from '@/contexts/AuthContext';
import { listingsApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

async function fetchDealers(token: string) {
    const res = await fetch(`/api/dealers-admin`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load dealers');
    return res.json();
}

export default function ListingNewPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const { data: dealersData } = useQuery({
        queryKey: ['dealers-admin'],
        queryFn: () => fetchDealers(token!),
        enabled: !!token,
    });

    const handleSave = async (data: any) => {
        if (!token) return;
        setIsSaving(true);
        try {
            const result = await listingsApi.createListing(data, token);
            toast({ title: 'Pojazd dodany' });
            navigate(`/admin/listings/${result.listing.id}/edit`);
        } catch (e: any) {
            toast({ title: 'Błąd', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dodaj pojazd</h1>
            <VehicleDataForm
                mode="sale"
                dealers={dealersData?.dealers || dealersData || []}
                onSave={handleSave}
                onCancel={() => navigate('/admin/listings')}
                isSaving={isSaving}
            />
        </div>
    );
}
```

(Adjust dealer fetch URL to match the actual existing endpoint — check with `grep "dealers-admin\|dealers/admin" src/services/api.ts`.)

- [ ] **Step 27.2: Commit**

```bash
git add src/pages/admin/ListingNewPage.tsx
git commit -m "feat(admin): add ListingNewPage"
```

---

### Task 28: Create ListingEditPage

**Files:**
- Create: `src/pages/admin/ListingEditPage.tsx`

- [ ] **Step 28.1: Create the page**

Create `src/pages/admin/ListingEditPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VehicleDataForm } from '@/components/admin/VehicleForm/VehicleDataForm';
import { useAuth } from '@/contexts/AuthContext';
import { useListing } from '@/hooks/useListings';
import { listingsApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

async function fetchDealers(token: string) {
    const res = await fetch(`/api/dealers-admin`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load dealers');
    return res.json();
}

export default function ListingEditPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const { data: listingData, isLoading } = useListing(id);
    const { data: dealersData } = useQuery({
        queryKey: ['dealers-admin'],
        queryFn: () => fetchDealers(token!),
        enabled: !!token,
    });

    const listing = listingData?.listing;
    const isImported = listing?.entrySource === 'CSV' || listing?.entrySource === 'CSFLOW';

    const handleSave = async (data: any) => {
        if (!token || !id) return;
        setIsSaving(true);
        try {
            await listingsApi.updateListing(id, data, token);
            toast({ title: 'Zapisano zmiany' });
            navigate('/admin/listings');
        } catch (e: any) {
            toast({ title: 'Błąd', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Ładowanie...</div>;
    if (!listing) return <div>Pojazd nie znaleziony</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Edytuj pojazd</h1>
            {isImported && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800">
                    Ten pojazd pochodzi z importu {listing.entrySource}. Edytować można tylko: cenę katalogową, flagi, opis dodatkowy i zdjęcia.
                </div>
            )}
            <VehicleDataForm
                mode="sale"
                vehicle={listing}
                dealers={dealersData?.dealers || dealersData || []}
                isImported={isImported}
                onSave={handleSave}
                onCancel={() => navigate('/admin/listings')}
                isSaving={isSaving}
            />
        </div>
    );
}
```

- [ ] **Step 28.2: Commit**

```bash
git add src/pages/admin/ListingEditPage.tsx
git commit -m "feat(admin): add ListingEditPage with CSV import banner"
```

---

### Task 29: Register routes

**Files:**
- Modify: `src/App.tsx` (or wherever routes are defined)

- [ ] **Step 29.1: Locate routes config**

```bash
grep -rn "/admin/listings\b\|ListingManagementPage" src/App.tsx src/main.tsx 2>/dev/null
```

Expected: shows the file and lines defining admin routes.

- [ ] **Step 29.2: Add imports and routes**

In the routes file, add imports:

```tsx
import ListingNewPage from '@/pages/admin/ListingNewPage';
import ListingEditPage from '@/pages/admin/ListingEditPage';
```

Inside the `<Routes>` block, add the two new routes (above or near the existing `/admin/listings` route, wrapped in the same `<ProtectedRoute>` wrapper used by the admin section):

```tsx
<Route path="/admin/listings/new" element={<ProtectedRoute><ListingNewPage /></ProtectedRoute>} />
<Route path="/admin/listings/:id/edit" element={<ProtectedRoute><ListingEditPage /></ProtectedRoute>} />
```

- [ ] **Step 29.3: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 29.4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routes): register listing new/edit pages"
```

---

### Task 30: Add "Add vehicle" button and per-row Edit on ListingManagementPage

**Files:**
- Modify: `src/pages/admin/ListingManagementPage.tsx`
- Modify: `src/components/admin/ListingManagement/AdminListingItem.tsx`

- [ ] **Step 30.1: Add `useNavigate` and Plus icon import in ListingManagementPage**

In `src/pages/admin/ListingManagementPage.tsx`, update the lucide-react import to include `Plus`:

```tsx
import { Search, Car, Filter, Archive, RotateCcw, X, Trash2, Plus } from 'lucide-react';
```

Add at the top of imports:

```tsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 30.2: Use navigate inside the component**

Inside the `ListingManagementPage` function (after the existing `useState` calls), add:

```tsx
    const navigate = useNavigate();
```

- [ ] **Step 30.3: Add the Add button next to the counter**

Find the counter `<div>` near the top header (the one showing "{count} pojazdów w bazie"). Wrap it and the new button in a flex group, replacing that section with:

```tsx
                <div className="flex items-center gap-3">
                    <Button onClick={() => navigate('/admin/listings/new')} className="h-10">
                        <Plus className="w-4 h-4 mr-2" />
                        Dodaj pojazd
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
                        <Car className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-blue-700">{data?.count || 0}</span>
                        <span>pojazdów w bazie</span>
                    </div>
                </div>
```

- [ ] **Step 30.4: Add per-row Edit action in AdminListingItem**

Open `src/components/admin/ListingManagement/AdminListingItem.tsx`. Add to imports:

```tsx
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
```

Inside the component function, add:

```tsx
    const navigate = useNavigate();
```

In the actions area of each row (near the existing archive/restore/delete buttons), add an Edit button:

```tsx
<Button
    variant="ghost"
    size="sm"
    onClick={() => navigate(`/admin/listings/${listing.id}/edit`)}
    title="Edytuj"
>
    <Pencil className="w-4 h-4" />
</Button>
```

- [ ] **Step 30.5: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 30.6: Commit**

```bash
git add src/pages/admin/ListingManagementPage.tsx src/components/admin/ListingManagement/AdminListingItem.tsx
git commit -m "feat(admin): add Add/Edit actions on listing management"
```

---

### Task 31: Add `lastManualEditAt` column and stale filter

**Files:**
- Modify: `src/components/admin/ListingManagement/AdminListingItem.tsx`
- Modify: `src/pages/admin/ListingManagementPage.tsx`

- [ ] **Step 31.1: Show `lastManualEditAt` next to row metadata in AdminListingItem**

In `src/components/admin/ListingManagement/AdminListingItem.tsx`, add a small subtitle showing the last manual edit. In the JSX where row metadata is rendered (price, year, mileage etc.), add:

```tsx
{listing.lastManualEditAt && (
    <span
        className="text-xs text-gray-500"
        title={new Date(listing.lastManualEditAt).toLocaleString()}
    >
        Edytowano: {formatRelative(listing.lastManualEditAt)}
    </span>
)}
```

Add a helper at the top of the file:

```tsx
function formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days < 1) return 'dziś';
    if (days < 30) return `${days} dni temu`;
    const months = Math.floor(days / 30);
    return `${months} mies. temu`;
}
```

- [ ] **Step 31.2: Add filter toggle for stale entries on ListingManagementPage**

In `src/pages/admin/ListingManagementPage.tsx`, near the existing search/sort controls, add:

```tsx
const [showStaleOnly, setShowStaleOnly] = useState(false);
const [showManualOnly, setShowManualOnly] = useState(false);
```

In the controls bar (after the sort select), add:

```tsx
<label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={showManualOnly} onChange={e => setShowManualOnly(e.target.checked)} />
    Tylko ręcznie
</label>
<label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={showStaleOnly} onChange={e => setShowStaleOnly(e.target.checked)} />
    Nieedytowane >30 dni
</label>
```

Pass these states to `useListings` (which maps to query params). If the hook does not support them, also extend `useListings` and the corresponding backend GET handler:

- Frontend `useListings` hook: add `entrySource` and `staleSince` to filters, pass as query params.
- Backend `GET /api/listings` (around line 33 of `backend/src/routes/listings.ts`): in the `where` clause builder, support:

```ts
if (request.query.entrySource) where.entrySource = String(request.query.entrySource);
if (request.query.lastManualEditBefore) {
    where.lastManualEditAt = { lt: new Date(String(request.query.lastManualEditBefore)) };
    where.entrySource = 'MANUAL';
}
```

Consult the existing query builder in that file and merge into it.

- [ ] **Step 31.3: Verify build**

```bash
bun run build
```

Expected: success.

- [ ] **Step 31.4: Commit**

```bash
git add src/components/admin/ListingManagement/AdminListingItem.tsx src/pages/admin/ListingManagementPage.tsx src/hooks/useListings.ts backend/src/routes/listings.ts
git commit -m "feat(admin): show lastManualEditAt and add manual/stale filters"
```

---

## Stage 5 — Polish

### Task 32: Run full smoke checklist

- [ ] **Step 32.1: Start full dev environment**

```bash
cd backend && bun run dev   # terminal 1
bun run dev                 # terminal 2
```

- [ ] **Step 32.2: Walk through smoke checklist from spec section 8**

- ☐ `/admin/listings` — "Dodaj pojazd" visible, click → `/admin/listings/new`.
- ☐ Form create — all fields available.
- ☐ Toggle condition NEW ↔ USED — required-field markers update.
- ☐ Submit min required → 201, redirect, record visible.
- ☐ Upload 3 images — loaded, primary changeable, deletable.
- ☐ Edit MANUAL — all fields editable.
- ☐ Edit CSV — Identification/Technical/Equipment disabled, banner visible.
- ☐ Edit CSV — catalogPrice, flags, description, images: enabled.
- ☐ RentalVehiclesPage post-refactor — works as before.
- ☐ MANUAL with `financingPriceBase=PRICE_PLN` → calculator uses pricePln.
- ☐ MANUAL with `financingPriceBase=BROKER_PRICE_PLN` → calculator uses brokerPricePln.
- ☐ "Nieedytowane >30 dni" filter — works.
- ☐ DEALER_EMPLOYEE in dealer A context → can add for A.
- ☐ DEALER_EMPLOYEE → URL `/admin/listings/{otherDealer-id}/edit` → 403/redirect.

- [ ] **Step 32.3: Fix any failures**

For each failed item, diagnose, fix, re-run.

- [ ] **Step 32.4: Run all backend tests**

```bash
cd backend && bun run test
```

Expected: all tests PASS.

---

### Task 33: PR description

- [ ] **Step 33.1: Push branch**

```bash
git push -u origin feat/manual-listing-entry
```

- [ ] **Step 33.2: Open PR**

```bash
gh pr create --title "feat: admin manual listing entry" --body "$(cat <<'EOF'
## Summary

- New endpoints `POST /api/listings`, `PATCH /api/listings/:id`, image upload/delete
- Shared `<VehicleDataForm mode>` component extracted from rental form
- Per-listing `financingPriceBase` enum + `getFinancingBasePrice` helper
- New fields: `catalogPrice`, `condition`, `isChineseBrand`, `entrySource`, `lastManualEditAt`
- CSV/CSFlow records: edit gating to whitelisted fields only
- Spec: `docs/superpowers/specs/2026-04-29-admin-manual-listing-entry-design.md`
- Plan: `docs/superpowers/plans/2026-04-29-admin-manual-listing-entry.md`

## Test plan

- [ ] All backend tests pass (`cd backend && bun run test`)
- [ ] Smoke checklist (14 items) — see plan Task 32
- [ ] Migration applied cleanly on staging DB
- [ ] Rental form regression confirmed (Task 23 checkpoint)
EOF
)"
```

- [ ] **Step 33.3: Capture PR URL** for the user.

---

## Self-Review

**Spec coverage check:**
- §1 Cel — covered by all stages collectively.
- §2 Architektura (rozdzielne tabele, mode-aware form) — Tasks 1, 13, 21.
- §3 Schema (enums, fields, indexes, backfill) — Tasks 1-2.
- §4 Backend endpoints — Tasks 6-12.
- §5 Frontend (VehicleDataForm, sections, pages, ListingManagement changes) — Tasks 13-22, 27-31.
- §6 Walidacja (NEW/USED, VIN, ranges) — Task 6 (validateListingPayload), Task 21 (frontend NEW guard).
- §7 Wpływ na kalkulator (helper, miejsca użycia) — Tasks 25-26.
- §8 Plan testów — Tasks 7, 9, 12, 25, 32.
- §9 Plan implementacji 5 etapów — Tasks 1-33 grouped into stages, with checkpoint at Task 23.
- §10 Decyzje pominięte — flagged in spec, no tasks needed.
- §11 Otwarte pytania (DOMPurify, Zod, ProtectedRoute roles) — flagged for implementer; not blocking.

**Placeholder scan:** none of "TBD", "implement later", "add appropriate". Inline notes ("Adjust prop names to match existing variables") are acceptable contextual instructions, not placeholders.

**Type consistency:**
- `condition` → `'NEW' | 'USED'` consistent across types, validator, mapper, form.
- `financingPriceBase` → `'PRICE_PLN' | 'BROKER_PRICE_PLN'` consistent.
- `entrySource` → `'CSV' | 'CSFLOW' | 'MANUAL'` consistent.
- `getFinancingBasePrice` signature consistent across helper file, test, usage tasks.
- `mapManualPayloadToListing(body, dealerId)` signature matches usage in POST endpoint.
- `pickCsvEditableFields(body)` matches usage in PATCH endpoint.

All consistent. Plan is ready for execution.

---

**End of plan.**
