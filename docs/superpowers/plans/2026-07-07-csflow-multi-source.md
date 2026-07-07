# CSFlow Multi-Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Obsługa wielu instancji CSFlow (per grupa dealerska, indywidualne URL-e API) zamiast pojedynczego `CSFLOW_API_URL`, zarządzana z panelu admina.

**Architecture:** Nowy model `CsflowSource` w bazie (nazwa, slug, apiUrl, powiązanie z `DealerGroup`, włącznik). Tożsamość oferty wyznacza para `(csflowSourceId, csflowCarId)` — `listingId` staje się identyfikatorem historycznym. Synchronizacja, archiwizacja i dopasowanie dealerów są scoped per źródło. Idempotentny bootstrap przy starcie serwera tworzy źródło `grupabemo` z `CSFLOW_API_URL` i backfilluje istniejące dane.

**Tech Stack:** Fastify 5 + Prisma 5 (PostgreSQL, deploy przez `prisma db push` — NIE `migrate`), vitest (testy backend przez `buildApp()` + `app.inject` na realnej bazie dev), React + shadcn/ui (frontend).

**Spec:** `docs/superpowers/specs/2026-07-07-csflow-multi-source-design.md`

## Global Constraints

- Deploy schematu wyłącznie przez `prisma db push` (historia migracji jest zdriftowana — `migrate dev` NIE ZADZIAŁA).
- Istniejące oferty Bemo zachowują `listingId` w formacie `csflow-{carId}` — ŻADNEJ zmiany `listingId` istniejących rekordów (katalogi cache zdjęć `/uploads/csflow-images/{listingId}/` są kluczowane po `listingId`).
- Nowe rekordy ofert (każde źródło, także nowe auta Bemo): `listingId = csflow-{slug}-{carId}`.
- VIN dedup pozostaje globalny (VIN jest `@unique` na całej tabeli `listings`).
- Globalny `AppSettings.csflowEnabled` pozostaje jako master switch.
- Komunikaty logów i UI po polsku (jak w istniejącym kodzie).
- Backend uruchamiany z katalogu `backend/` (`npm test`, `npx prisma ...`).
- Commity na branchu `dev`.

---

### Task 1: Schemat Prisma — CsflowSource + kolumny scalające

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: model `CsflowSource` (`prisma.csflowSource`), pola `Listing.csflowSourceId`, `Listing.csflowCarId`, `Dealer.csflowSourceId`, compound unique `csflowSourceId_csflowDealerId` (Dealer) i `csflowSourceId_csflowCarId` (Listing). Wszystkie kolejne taski polegają na tych nazwach.

- [ ] **Step 1: Dodaj model CsflowSource**

W `backend/prisma/schema.prisma` dodaj nowy model (obok `DealerGroup`, ok. linii 508):

```prisma
model CsflowSource {
  id            String       @id @default(cuid())
  name          String
  slug          String       @unique
  apiUrl        String       @map("api_url")
  isEnabled     Boolean      @default(true) @map("is_enabled")
  dealerGroupId String?      @map("dealer_group_id")
  lastSyncAt    DateTime?    @map("last_sync_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  dealerGroup   DealerGroup? @relation(fields: [dealerGroupId], references: [id])
  dealers       Dealer[]
  listings      Listing[]

  @@map("csflow_sources")
}
```

- [ ] **Step 2: Zmodyfikuj model Dealer**

W modelu `Dealer` (linia ~192):
- zmień linię `csflowDealerId      Int?                   @unique @map("csflow_dealer_id")` na `csflowDealerId      Int?                   @map("csflow_dealer_id")` (usunięcie `@unique`),
- dodaj pola i relację:

```prisma
  csflowSourceId      String?                @map("csflow_source_id")
  csflowSource        CsflowSource?          @relation(fields: [csflowSourceId], references: [id])
```

- dodaj pod istniejącym `@@unique([name, addressLine1])`:

```prisma
  @@unique([csflowSourceId, csflowDealerId])
```

- [ ] **Step 3: Zmodyfikuj model Listing**

W modelu `Listing` (linia ~46) dodaj pola i relację (obok innych pól, przed blokiem `@@`):

```prisma
  csflowSourceId           String?               @map("csflow_source_id")
  csflowCarId              Int?                  @map("csflow_car_id")
  csflowSource             CsflowSource?         @relation(fields: [csflowSourceId], references: [id])
```

oraz w bloku indeksów:

```prisma
  @@unique([csflowSourceId, csflowCarId])
  @@index([csflowSourceId])
```

- [ ] **Step 4: Zmodyfikuj model DealerGroup**

W modelu `DealerGroup` (linia ~490) dodaj stronę odwrotną relacji:

```prisma
  csflowSources CsflowSource[]
```

- [ ] **Step 5: Walidacja i push na bazę dev**

```bash
cd backend && npx prisma validate && npx prisma db push && npx prisma generate
```

Expected: `The schema is valid`, `Your database is now in sync with your Prisma schema`, wygenerowany klient. UWAGA: jeśli `db push` ostrzeże o utracie danych przy zmianie unique na `csflow_dealer_id` (drop starego indeksu unique to operacja bezpieczna — nie kasuje danych), zatwierdź. Gdyby chciał DROPOWAĆ KOLUMNĘ — przerwij i zgłoś.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(csflow): model CsflowSource + kolumny csflowSourceId/csflowCarId"
```

---

### Task 2: Bootstrap i backfill przy starcie serwera

**Files:**
- Create: `backend/src/services/csflow-bootstrap.ts`
- Test: `backend/src/services/__tests__/csflow-bootstrap.test.ts`
- Modify: `backend/src/server.ts` (linia ~64)

**Interfaces:**
- Consumes: `prisma.csflowSource` (Task 1).
- Produces:
  - `parseCsflowCarId(listingId: string | null): number | null` — parsuje legacy `csflow-{carId}`; zwraca `null` dla nowego formatu `csflow-{slug}-{carId}` i wszystkiego innego,
  - `bootstrapCsflowSources(prisma: PrismaClient): Promise<void>` — idempotentna; działa TYLKO gdy tabela `csflow_sources` jest pusta.

- [ ] **Step 1: Napisz failing testy dla parseCsflowCarId**

Utwórz `backend/src/services/__tests__/csflow-bootstrap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCsflowCarId } from '../csflow-bootstrap.js';

describe('parseCsflowCarId', () => {
    it('parsuje legacy format csflow-{carId}', () => {
        expect(parseCsflowCarId('csflow-35203')).toBe(35203);
    });

    it('zwraca null dla nowego formatu csflow-{slug}-{carId}', () => {
        expect(parseCsflowCarId('csflow-carsed-35203')).toBeNull();
    });

    it('zwraca null dla null, pustego stringa i innych źródeł', () => {
        expect(parseCsflowCarId(null)).toBeNull();
        expect(parseCsflowCarId('')).toBeNull();
        expect(parseCsflowCarId('otomoto-123')).toBeNull();
        expect(parseCsflowCarId('csflow-')).toBeNull();
    });
});
```

- [ ] **Step 2: Uruchom test — ma failować**

Run: `cd backend && npx vitest run src/services/__tests__/csflow-bootstrap.test.ts`
Expected: FAIL — `Cannot find module '../csflow-bootstrap.js'` (lub brak eksportu).

- [ ] **Step 3: Zaimplementuj csflow-bootstrap.ts**

Utwórz `backend/src/services/csflow-bootstrap.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

/**
 * Parsuje ID auta CSFlow z legacy formatu listingId ("csflow-35203").
 * Nowy format "csflow-{slug}-{carId}" celowo NIE jest parsowany —
 * nowe rekordy mają csflowCarId zapisywany wprost przy tworzeniu.
 */
export function parseCsflowCarId(listingId: string | null): number | null {
    if (!listingId) return null;
    const m = /^csflow-(\d+)$/.exec(listingId);
    return m ? parseInt(m[1], 10) : null;
}

/**
 * Jednorazowy, idempotentny bootstrap źródeł CSFlow.
 * Gdy tabela csflow_sources jest pusta i ustawione jest CSFLOW_API_URL:
 * 1. tworzy źródło "Grupa Bemo" (slug: grupabemo) z URL-em z env,
 * 2. backfilluje csflowSourceId + csflowCarId na istniejących ofertach csflow-%,
 * 3. backfilluje csflowSourceId na dealerach z csflowDealerId.
 * Gdy tabela jest niepusta — nie robi nic.
 */
export async function bootstrapCsflowSources(prisma: PrismaClient): Promise<void> {
    const count = await prisma.csflowSource.count();
    if (count > 0) return;

    const apiUrl = process.env.CSFLOW_API_URL;
    if (!apiUrl) {
        console.log('[CSFlow Bootstrap] Brak źródeł i brak CSFLOW_API_URL — pomijam bootstrap');
        return;
    }

    const source = await prisma.csflowSource.create({
        data: { name: 'Grupa Bemo', slug: 'grupabemo', apiUrl },
    });
    console.log(`[CSFlow Bootstrap] Utworzono źródło "${source.name}" (${apiUrl})`);

    const listings = await prisma.listing.findMany({
        where: { listingId: { startsWith: 'csflow-' }, csflowSourceId: null },
        select: { id: true, listingId: true },
    });
    for (const l of listings) {
        await prisma.listing.update({
            where: { id: l.id },
            data: { csflowSourceId: source.id, csflowCarId: parseCsflowCarId(l.listingId) },
        });
    }
    console.log(`[CSFlow Bootstrap] Backfill ofert: ${listings.length}`);

    const dealers = await prisma.dealer.updateMany({
        where: { csflowDealerId: { not: null }, csflowSourceId: null },
        data: { csflowSourceId: source.id },
    });
    console.log(`[CSFlow Bootstrap] Backfill dealerów: ${dealers.count}`);
}
```

- [ ] **Step 4: Uruchom testy — mają przejść**

Run: `cd backend && npx vitest run src/services/__tests__/csflow-bootstrap.test.ts`
Expected: PASS (3 testy).

- [ ] **Step 5: Podepnij bootstrap w server.ts**

W `backend/src/server.ts`:
- dodaj import: `import { bootstrapCsflowSources } from './services/csflow-bootstrap.js';`
- przed linią `initCSFlowCron(app.prisma);` (linia ~64) dodaj:

```typescript
        try {
            await bootstrapCsflowSources(app.prisma);
        } catch (error) {
            console.error('[CSFlow Bootstrap] Błąd bootstrapu źródeł:', error);
        }
```

- [ ] **Step 6: Weryfikacja bootstrapu na bazie dev**

```bash
cd backend && CSFLOW_API_URL=https://webapi.grupabemo.csflow.pl npx tsx -e "(async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { bootstrapCsflowSources } = await import('./src/services/csflow-bootstrap.js');
  const p = new PrismaClient();
  await bootstrapCsflowSources(p);
  const src = await p.csflowSource.findMany();
  const unfilled = await p.listing.count({ where: { listingId: { startsWith: 'csflow-' }, csflowSourceId: null } });
  console.log(JSON.stringify({ sources: src.map(s => s.slug), unfilledListings: unfilled }));
  await p.\$disconnect();
})()"
```

Expected: `{"sources":["grupabemo"],"unfilledListings":0}`. Drugi run tego samego polecenia: bez zmian (idempotencja — nadal jedno źródło).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/csflow-bootstrap.ts backend/src/services/__tests__/csflow-bootstrap.test.ts backend/src/server.ts
git commit -m "feat(csflow): idempotentny bootstrap źródła grupabemo + backfill"
```

---

### Task 3: Parametryzacja klienta CSFlow

**Files:**
- Modify: `backend/src/utils/csflow-client.ts`
- Modify: `backend/src/inspect-csflow-cars.ts`, `backend/src/inspect-dealers.ts` (skrypty dev — tylko dostosowanie wywołań)

**Interfaces:**
- Produces: `getCSFlowCars(apiUrl: string): Promise<any[]>`, `getCSFlowCarDetails(apiUrl: string, id: string | number): Promise<any>`. Task 4 używa dokładnie tych sygnatur.

- [ ] **Step 1: Sparametryzuj csflow-client.ts**

W `backend/src/utils/csflow-client.ts`:
- usuń stałą modułową `CSFLOW_API_URL` (linie 3-6, razem z fallbackiem na `BRAND`),
- zmień sygnatury i konstrukcję URL-i:

```typescript
export async function getCSFlowCars(apiUrl: string): Promise<any[]> {
    const url = new URL(`${apiUrl}/cars`);
    // ... reszta bez zmian (limit z CSFLOW_LIMIT, fetchWithTimeout, obsługa błędów)
}

export async function getCSFlowCarDetails(apiUrl: string, id: string | number): Promise<any> {
    const url = new URL(`${apiUrl}/car`);
    // ... reszta bez zmian
}
```

- [ ] **Step 2: Dostosuj skrypty inspekcyjne**

W `backend/src/inspect-csflow-cars.ts` i `backend/src/inspect-dealers.ts` (oba zaczynają się od `process.env.CSFLOW_API_URL = 'https://webapi.grupabemo.csflow.pl';`): usuń przypisanie do env, zdefiniuj `const CSFLOW_API_URL = 'https://webapi.grupabemo.csflow.pl';` i przekaż jako pierwszy argument do wywołań `getCSFlowCars(...)` / `getCSFlowCarDetails(...)`.

- [ ] **Step 3: Weryfikacja kompilacji**

Run: `cd backend && npx tsc --noEmit`
Expected: błędy TYLKO w `src/services/csflow.service.ts` (wywołania bez `apiUrl` — naprawiane w Task 4). Jeśli błędów tam nie ma (np. tsc przerwał wcześniej), uruchom ponownie po Task 4. Inne pliki nie mogą zgłaszać nowych błędów.

- [ ] **Step 4: Commit**

```bash
git add backend/src/utils/csflow-client.ts backend/src/inspect-csflow-cars.ts backend/src/inspect-dealers.ts
git commit -m "refactor(csflow): klient API parametryzowany adresem instancji"
```

---

### Task 4: Refaktor synchronizacji — per źródło

**Files:**
- Modify: `backend/src/services/csflow.service.ts`
- Test: `backend/src/services/__tests__/csflow-sync.test.ts`

**Interfaces:**
- Consumes: `getCSFlowCars(apiUrl)`, `getCSFlowCarDetails(apiUrl, id)` (Task 3); model `CsflowSource` (Task 1).
- Produces: `syncCSFlowAPI(prisma: PrismaClient, source: CsflowSource, userId?: string)` — synchronizacja JEDNEGO źródła; bez sprawdzania `AppSettings.csflowEnabled` (przenosi się do wywołujących w Task 5). Zwraca `{ inserted, updated, archived, failed, totalRows }`.

- [ ] **Step 1: Napisz failing test synchronizacji z mockiem klienta**

Utwórz `backend/src/services/__tests__/csflow-sync.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

vi.mock('../../utils/csflow-client.js', () => ({
    getCSFlowCars: vi.fn(),
    getCSFlowCarDetails: vi.fn(),
}));
vi.mock('../csflow-image-downloader.js', () => ({
    downloadAndCacheImages: vi.fn(),
    queueListingImagesDownload: vi.fn(),
}));

import { getCSFlowCars, getCSFlowCarDetails } from '../../utils/csflow-client.js';
import { syncCSFlowAPI } from '../csflow.service.js';

const prisma = new PrismaClient();

const mockCar = (id: number, overrides: any = {}) => ({
    id,
    vin: `TESTVINCSFLOW${id}`,
    price: 100000,
    production_year: '2024',
    mileage: '10',
    brand_name: 'TestBrand',
    model_name: 'TestModel',
    invoice_vat: 1,
    tax_type_id: 1,
    dealer: {
        id: 9001,
        name: 'Test CSFlow Dealer',
        address: 'Testowa 1',
        city: 'Warszawa',
    },
    ...overrides,
});

describe('syncCSFlowAPI — multi-source', () => {
    let sourceA: any;
    let sourceB: any;
    let group: any;

    beforeAll(async () => {
        group = await prisma.dealerGroup.create({
            data: { name: 'Test Group CSFlow', slug: 'test-group-csflow' },
        });
        sourceA = await prisma.csflowSource.create({
            data: { name: 'Test A', slug: 'testa', apiUrl: 'https://webapi.testa.csflow.pl', dealerGroupId: group.id },
        });
        sourceB = await prisma.csflowSource.create({
            data: { name: 'Test B', slug: 'testb', apiUrl: 'https://webapi.testb.csflow.pl' },
        });
        // Aktywna oferta źródła B — sync A nie może jej ruszyć
        await prisma.listing.create({
            data: {
                listingId: 'csflow-testb-111',
                csflowSourceId: sourceB.id,
                csflowCarId: 111,
                make: 'B-Brand', model: 'B-Model',
                pricePln: 50000, productionYear: 2023, mileageKm: 5,
                slug: 'test-csflow-b-111',
                marketplace: 'csflow',
            },
        });
    });

    afterAll(async () => {
        await prisma.listing.deleteMany({ where: { csflowSourceId: { in: [sourceA.id, sourceB.id] } } });
        await prisma.dealer.deleteMany({ where: { csflowSourceId: { in: [sourceA.id, sourceB.id] } } });
        await prisma.csflowSource.deleteMany({ where: { id: { in: [sourceA.id, sourceB.id] } } });
        await prisma.dealerGroup.delete({ where: { id: group.id } });
        await prisma.$disconnect();
    });

    it('insertuje oferty z listingId csflow-{slug}-{carId}, nie archiwizuje innych źródeł, przypisuje dealerGroup', async () => {
        vi.mocked(getCSFlowCars).mockResolvedValue([{ id: 222 }]);
        vi.mocked(getCSFlowCarDetails).mockResolvedValue(mockCar(222));

        const result = await syncCSFlowAPI(prisma, sourceA);

        expect(result.inserted).toBe(1);
        expect(getCSFlowCars).toHaveBeenCalledWith('https://webapi.testa.csflow.pl');

        const created = await prisma.listing.findFirst({
            where: { csflowSourceId: sourceA.id, csflowCarId: 222 },
            include: { dealer: true },
        });
        expect(created).toBeTruthy();
        expect(created!.listingId).toBe('csflow-testa-222');
        expect(created!.dealer!.csflowDealerId).toBe(9001);
        expect(created!.dealer!.csflowSourceId).toBe(sourceA.id);
        expect(created!.dealer!.dealerGroupId).toBe(group.id);

        // Oferta źródła B nietknięta
        const bListing = await prisma.listing.findFirst({ where: { csflowSourceId: sourceB.id, csflowCarId: 111 } });
        expect(bListing!.isArchived).toBe(false);
    });

    it('drugi sync aktualizuje (nie insertuje) i archiwizuje auta nieobecne w API', async () => {
        vi.mocked(getCSFlowCars).mockResolvedValue([{ id: 333 }]);
        vi.mocked(getCSFlowCarDetails).mockResolvedValue(mockCar(333));

        const first = await syncCSFlowAPI(prisma, sourceA);
        expect(first.inserted).toBe(1);
        expect(first.archived).toBe(1); // auto 222 zniknęło z API

        const second = await syncCSFlowAPI(prisma, sourceA);
        expect(second.inserted).toBe(0);
        expect(second.updated).toBe(1);

        const archived = await prisma.listing.findFirst({ where: { csflowSourceId: sourceA.id, csflowCarId: 222 } });
        expect(archived!.isArchived).toBe(true);
    });
});
```

- [ ] **Step 2: Uruchom test — ma failować**

Run: `cd backend && npx vitest run src/services/__tests__/csflow-sync.test.ts`
Expected: FAIL — `syncCSFlowAPI` przyjmuje `(prisma, userId)`, nie `(prisma, source)`; błędy typów/wywołań klienta.

- [ ] **Step 3: Refaktor csflow.service.ts**

Zmiany w `backend/src/services/csflow.service.ts` (funkcja `syncCSFlowAPI`, linie 36-408):

1. Import typu i nowa sygnatura:

```typescript
import { PrismaClient, CsflowSource } from '@prisma/client';

export async function syncCSFlowAPI(prisma: PrismaClient, source: CsflowSource, userId: string = 'system-cron') {
```

2. USUŃ blok sprawdzania `appSettings.csflowEnabled` (linie 41-45) — przenosi się do wywołujących (Task 5).

3. Prefiksuj logi nazwą źródła, np. `console.log(\`[CSFlow:${source.slug}] Start synchronizacji API\`);` (analogicznie pozostałe logi w funkcji).

4. Pobieranie listy i szczegółów z URL-em źródła:

```typescript
        const carsData = await getCSFlowCars(source.apiUrl);
        // ... w pętli batchy:
        const car = await getCSFlowCarDetails(source.apiUrl, basicCar.id);
```

5. Zapytanie o istniejące oferty — scoped po źródle, z `csflowCarId` (zastępuje `listingId: { startsWith: 'csflow-' }`, linie 59-64):

```typescript
        const existingListings = await prisma.listing.findMany({
            where: { csflowSourceId: source.id },
            select: { id: true, vin: true, listingId: true, csflowCarId: true, isArchived: true, pricePln: true }
        });

        const activeCarIdsInDB = new Set(
            existingListings.filter(l => !l.isArchived && l.csflowCarId !== null).map(l => l.csflowCarId as number)
        );
```

(usuń `activeCsflowIdsInDB`; mapa VIN-ów `allVinToListingId` zostaje bez zmian — dedup globalny).

6. W pętli po autach: `currentApiIds` → `currentCarIds = new Set<number>()`; na początku iteracji:

```typescript
                const carId = Number(car.id);
                currentCarIds.add(carId);
                const listingId = `csflow-${source.slug}-${carId}`; // tylko dla NOWYCH rekordów
```

7. Dealer — wyszukiwanie po parze (zastępuje `findUnique({ where: { csflowDealerId: d.id } })`, linia 133-135):

```typescript
                        const byId = await prisma.dealer.findUnique({
                            where: { csflowSourceId_csflowDealerId: { csflowSourceId: source.id, csflowDealerId: d.id } }
                        });
```

Przy aktualizacji istniejącego dealera (gałąź `byId`) dopisz grupę tylko gdy pusta:

```typescript
                            dealer = await prisma.dealer.update({
                                where: { id: byId.id },
                                data: {
                                    ...dealerData,
                                    ...(byId.dealerGroupId === null && source.dealerGroupId
                                        ? { dealerGroupId: source.dealerGroupId }
                                        : {}),
                                },
                            });
```

W gałęzi `byNameAddr && !byNameAddr.csflowDealerId` (podpięcie ręcznego dealera) dodaj do `data`: `csflowSourceId: source.id` obok `csflowDealerId: d.id`. Warunek gałęzi "już powiązany" zostaje (`byNameAddr.csflowDealerId` ustawione — nie nadpisuj, użyj istniejącego).

Przy tworzeniu dealera (gałąź create, linia ~169):

```typescript
                                dealer = await prisma.dealer.create({
                                    data: {
                                        csflowDealerId: d.id,
                                        csflowSourceId: source.id,
                                        dealerGroupId: source.dealerGroupId,
                                        ...dealerData,
                                    },
                                });
```

W fallbacku upsert bez `d.id` (linia ~176): do `create` dodaj `csflowSourceId: source.id, dealerGroupId: source.dealerGroupId`.

8. Dopasowanie oferty po parze (zastępuje `existingListings.find(l => l.listingId === listingId)`, linia 196):

```typescript
                const existingByCsflowId = existingListings.find(l => l.csflowCarId === carId);
```

9. W `payload` dodaj: `csflowSourceId: source.id, csflowCarId: carId`. UWAGA: w gałęzi `update` istniejącej oferty NIE nadpisuj `listingId` — usuń `listingId` z payloadu update'u (legacy `csflow-{carId}` ma zostać):

```typescript
                if (existingByCsflowId) {
                    const { listingId: _ignored, ...updatePayload } = payload;
                    savedListing = await prisma.listing.update({
                        where: { id: existingByCsflowId.id },
                        data: { ...updatePayload, isArchived: false, archivedAt: null, archivedReason: null, entrySource: 'CSFLOW' as const }
                    });
```

Gałąź create bez zmian logiki (payload zawiera nowy `listingId`). W `queueListingImagesDownload(...)` przekazuj `savedListing.listingId as string` zamiast lokalnej zmiennej `listingId` (dla legacy rekordów to stary identyfikator = istniejący katalog cache).

10. Archiwizacja — scoped po źródle i `csflowCarId` (zastępuje pętlę po `activeCsflowIdsInDB`, linie 347-361):

```typescript
        for (const l of existingListings) {
            if (!l.isArchived && l.csflowCarId !== null && !currentCarIds.has(l.csflowCarId)) {
                await prisma.listing.update({
                    where: { id: l.id },
                    data: {
                        isArchived: true,
                        archivedAt: new Date(),
                        archivedReason: `Usunięte ze źródła CSFlow (${source.name})`
                    }
                });
                result.archived++;
            }
        }
```

11. `ImportLog.fileName`: `` `Zewnętrzne API (CSFlow: ${source.name})` ``.

12. Po udanej synchronizacji, przed `return result`:

```typescript
        await prisma.csflowSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date() } });
```

13. Funkcję `initCSFlowCron` na razie zostaw wywołującą stary kod — dostanie ciało w Task 5; żeby kompilacja przeszła, tymczasowo zmień wnętrze crona na komentarz `// podpięcie w syncAllCSFlowSources (Task 5)` i pustą funkcję async. (Task 5 nadpisze.)

- [ ] **Step 4: Uruchom testy — mają przejść**

Run: `cd backend && npx vitest run src/services/__tests__/csflow-sync.test.ts && npx tsc --noEmit`
Expected: PASS (2 testy), kompilacja czysta poza `routes/csflow.ts` (stare wywołanie `syncCSFlowAPI(prisma, userId)` — naprawa w Task 5).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/csflow.service.ts backend/src/services/__tests__/csflow-sync.test.ts
git commit -m "feat(csflow): synchronizacja per źródło — scoped archiwizacja i dealerzy"
```

---

### Task 5: syncAllCSFlowSources + cron + endpoint zbiorczy

**Files:**
- Modify: `backend/src/services/csflow.service.ts` (nowa funkcja + `initCSFlowCron`)
- Modify: `backend/src/routes/csflow.ts` (istniejący `POST /api/csflow/sync`)

**Interfaces:**
- Consumes: `syncCSFlowAPI(prisma, source, userId)` (Task 4).
- Produces: `syncAllCSFlowSources(prisma: PrismaClient, userId?: string): Promise<{ inserted, updated, archived, failed, totalRows, perSource: Array<{ sourceId, name, slug, error?, ...result }> , skipped?: boolean }>` — Task 6/7 polegają na tym kształcie odpowiedzi (klucze zagregowane są backward-compatible z obecnym frontem).

- [ ] **Step 1: Dodaj syncAllCSFlowSources i nowe ciało crona**

W `backend/src/services/csflow.service.ts` (na końcu pliku, zastępując tymczasowy cron z Task 4):

```typescript
export async function syncAllCSFlowSources(prisma: PrismaClient, userId: string = 'system-cron') {
    const settings = await prisma.appSettings.findUnique({ where: { id: 'default' } });
    if (settings?.csflowEnabled === false) {
        console.log('[CSFlow] Synchronizacja pominięta — integracja wyłączona w ustawieniach (master switch)');
        return { inserted: 0, updated: 0, archived: 0, failed: 0, totalRows: 0, perSource: [], skipped: true };
    }

    const sources = await prisma.csflowSource.findMany({
        where: { isEnabled: true },
        orderBy: { createdAt: 'asc' },
    });

    const totals = { inserted: 0, updated: 0, archived: 0, failed: 0, totalRows: 0 };
    const perSource: any[] = [];

    for (const source of sources) {
        try {
            const result = await syncCSFlowAPI(prisma, source, userId);
            totals.inserted += result.inserted;
            totals.updated += result.updated;
            totals.archived += result.archived;
            totals.failed += result.failed;
            totals.totalRows += result.totalRows;
            perSource.push({ sourceId: source.id, name: source.name, slug: source.slug, ...result });
        } catch (err: any) {
            console.error(`[CSFlow:${source.slug}] Błąd synchronizacji źródła:`, err);
            perSource.push({ sourceId: source.id, name: source.name, slug: source.slug, error: err.message });
        }
    }

    return { ...totals, perSource };
}

export function initCSFlowCron(prisma: PrismaClient) {
    console.log('[CSFlow] Rejestracja zadania (co 6 godzin)');
    cron.schedule('0 */6 * * *', async () => {
        console.log('[CRON] Wykonanie automatycznego importu CSFlow API');
        try {
            await syncAllCSFlowSources(prisma);
        } catch (e) {
            console.error('[CRON] Nie udało się wykonać zadania importu CSFlow:', e);
        }
    });
}
```

- [ ] **Step 2: Zaktualizuj POST /api/csflow/sync**

W `backend/src/routes/csflow.ts` zamień import i ciało handlera:

```typescript
import { FastifyPluginAsync } from 'fastify';
import { syncAllCSFlowSources } from '../services/csflow.service.js';

export const csflowRoutes: FastifyPluginAsync = async (fastify) => {
    // Ręczna synchronizacja WSZYSTKICH włączonych źródeł CSFlow
    fastify.post('/api/csflow/sync', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const user = request.user as { userId: string };
            const result = await syncAllCSFlowSources(fastify.prisma, user.userId);
            if ((result as any).skipped) {
                return reply.status(400).send({
                    success: false,
                    error: 'Synchronizacja z CSFlow jest wyłączona w ustawieniach.'
                });
            }
            return reply.send({ success: true, result });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Wystąpił błąd podczas ręcznej synchronizacji CSFlow API'
            });
        }
    });
};
```

- [ ] **Step 3: Weryfikacja**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/services/__tests__/csflow-sync.test.ts src/services/__tests__/csflow-bootstrap.test.ts`
Expected: kompilacja czysta w całym projekcie, testy PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/csflow.service.ts backend/src/routes/csflow.ts
git commit -m "feat(csflow): syncAllCSFlowSources — cron i endpoint iterują po źródłach"
```

---

### Task 6: CRUD źródeł — API

**Files:**
- Modify: `backend/src/routes/csflow.ts`
- Test: `backend/src/routes/__tests__/csflow-sources.test.ts`

**Interfaces:**
- Consumes: model `CsflowSource`, `syncCSFlowAPI` (Task 4), `authorizeRoles` z `../middleware/authorize.js` (wzorzec z `routes/settings.ts:180`).
- Produces (Task 7 konsumuje):
  - `GET /api/csflow/sources` → `{ sources: [{ id, name, slug, apiUrl, isEnabled, dealerGroupId, dealerGroup: { id, name } | null, lastSyncAt, activeListings }] }`
  - `POST /api/csflow/sources` body `{ name, apiUrl, slug?, dealerGroupId? }` → 201 `{ source }`
  - `PATCH /api/csflow/sources/:id` body `{ name?, apiUrl?, dealerGroupId?, isEnabled? }` → `{ source }`; `isEnabled: false` archiwizuje oferty źródła
  - `POST /api/csflow/sources/:id/sync` → `{ success, result }`

- [ ] **Step 1: Napisz failing testy routes**

Utwórz `backend/src/routes/__tests__/csflow-sources.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('CSFlow sources CRUD', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const createdIds: string[] = [];

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        adminToken = app.jwt.sign({
            userId: 'csflow-test-admin',
            email: 'csflow-admin@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { csflowSourceId: { in: createdIds } } });
        await app.prisma.csflowSource.deleteMany({ where: { id: { in: createdIds } } });
        await app.close();
    });

    it('POST tworzy źródło z wygenerowanym slugiem', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Test Źródło Ąę', apiUrl: 'https://webapi.testzrodlo.csflow.pl' },
        });
        expect(res.statusCode).toBe(201);
        const { source } = res.json();
        createdIds.push(source.id);
        expect(source.slug).toBe('test-zrodlo-ae');
        expect(source.isEnabled).toBe(true);
    });

    it('POST odrzuca URL spoza *.csflow.pl oraz duplikat sluga', async () => {
        const bad = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Zły URL', apiUrl: 'https://evil.example.com' },
        });
        expect(bad.statusCode).toBe(400);

        const dup = await app.inject({
            method: 'POST',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { name: 'Duplikat', slug: 'test-zrodlo-ae', apiUrl: 'https://webapi.dup.csflow.pl' },
        });
        expect(dup.statusCode).toBe(400);
    });

    it('GET listuje źródła z licznikiem aktywnych ofert', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/csflow/sources',
            headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
        const { sources } = res.json();
        const testSource = sources.find((s: any) => s.slug === 'test-zrodlo-ae');
        expect(testSource).toBeTruthy();
        expect(testSource.activeListings).toBe(0);
    });

    it('PATCH isEnabled=false archiwizuje oferty źródła', async () => {
        const sourceId = createdIds[0];
        await app.prisma.listing.create({
            data: {
                listingId: 'csflow-test-zrodlo-ae-777',
                csflowSourceId: sourceId,
                csflowCarId: 777,
                make: 'T', model: 'T',
                pricePln: 10000, productionYear: 2024, mileageKm: 0,
                slug: 'test-csflow-disable-777',
                marketplace: 'csflow',
            },
        });

        const res = await app.inject({
            method: 'PATCH',
            url: `/api/csflow/sources/${sourceId}`,
            headers: { authorization: `Bearer ${adminToken}` },
            payload: { isEnabled: false },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json().source.isEnabled).toBe(false);

        const listing = await app.prisma.listing.findFirst({ where: { csflowSourceId: sourceId, csflowCarId: 777 } });
        expect(listing!.isArchived).toBe(true);
        expect(listing!.archivedReason).toBe('csflow_source_disabled');
    });

    it('wymaga uprawnień admina', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/csflow/sources' });
        expect(res.statusCode).toBe(401);
    });
});
```

- [ ] **Step 2: Uruchom testy — mają failować**

Run: `cd backend && npx vitest run src/routes/__tests__/csflow-sources.test.ts`
Expected: FAIL — 404 na `/api/csflow/sources` (routes nie istnieją).

- [ ] **Step 3: Zaimplementuj routes**

Rozszerz `backend/src/routes/csflow.ts` — importy i funkcje pomocnicze na górze pliku (rozszerzając istniejący import z `csflow.service.js` o `syncCSFlowAPI`), handlery wewnątrz `csflowRoutes` poniżej istniejącego `POST /api/csflow/sync`:

```typescript
import { authorizeRoles } from '../middleware/authorize.js';
import { syncAllCSFlowSources, syncCSFlowAPI } from '../services/csflow.service.js';

function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/ł/g, 'l')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function isValidCsflowUrl(apiUrl: string): boolean {
    try {
        const u = new URL(apiUrl);
        return u.protocol === 'https:' && u.hostname.endsWith('.csflow.pl');
    } catch {
        return false;
    }
}
```

Handlery (wszystkie z `onRequest: [fastify.authenticate, authorizeRoles(['admin'])]`):

```typescript
    // Lista źródeł z licznikiem aktywnych ofert
    fastify.get('/api/csflow/sources', {
        onRequest: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (_request, reply) => {
        const sources = await fastify.prisma.csflowSource.findMany({
            orderBy: { createdAt: 'asc' },
            include: {
                dealerGroup: { select: { id: true, name: true } },
                _count: { select: { listings: { where: { isArchived: false } } } },
            },
        });
        return reply.send({
            sources: sources.map(({ _count, ...s }) => ({ ...s, activeListings: _count.listings })),
        });
    });

    // Nowe źródło
    fastify.post('/api/csflow/sources', {
        onRequest: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const body = request.body as { name?: string; apiUrl?: string; slug?: string; dealerGroupId?: string | null };
        if (!body.name?.trim() || !body.apiUrl?.trim()) {
            return reply.status(400).send({ error: 'Wymagane pola: name, apiUrl' });
        }
        if (!isValidCsflowUrl(body.apiUrl)) {
            return reply.status(400).send({ error: 'apiUrl musi być adresem https w domenie *.csflow.pl' });
        }
        const slug = (body.slug?.trim() || slugify(body.name));
        if (!slug) {
            return reply.status(400).send({ error: 'Nie udało się wygenerować sluga z nazwy — podaj slug ręcznie' });
        }
        const existing = await fastify.prisma.csflowSource.findUnique({ where: { slug } });
        if (existing) {
            return reply.status(400).send({ error: `Źródło ze slugiem "${slug}" już istnieje` });
        }
        if (body.dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: body.dealerGroupId } });
            if (!group) return reply.status(400).send({ error: 'Wskazana grupa dealerska nie istnieje' });
        }
        const source = await fastify.prisma.csflowSource.create({
            data: {
                name: body.name.trim(),
                slug,
                apiUrl: body.apiUrl.trim().replace(/\/+$/, ''),
                dealerGroupId: body.dealerGroupId || null,
            },
        });
        return reply.status(201).send({ source });
    });

    // Edycja źródła (slug niezmienialny — stabilność identyfikatorów ofert)
    fastify.patch('/api/csflow/sources/:id', {
        onRequest: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as { name?: string; apiUrl?: string; dealerGroupId?: string | null; isEnabled?: boolean };
        const existing = await fastify.prisma.csflowSource.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: 'Źródło nie istnieje' });

        if (body.apiUrl !== undefined && !isValidCsflowUrl(body.apiUrl)) {
            return reply.status(400).send({ error: 'apiUrl musi być adresem https w domenie *.csflow.pl' });
        }
        if (body.dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: body.dealerGroupId } });
            if (!group) return reply.status(400).send({ error: 'Wskazana grupa dealerska nie istnieje' });
        }

        const source = await fastify.prisma.csflowSource.update({
            where: { id },
            data: {
                ...(body.name !== undefined ? { name: body.name.trim() } : {}),
                ...(body.apiUrl !== undefined ? { apiUrl: body.apiUrl.trim().replace(/\/+$/, '') } : {}),
                ...(body.dealerGroupId !== undefined ? { dealerGroupId: body.dealerGroupId || null } : {}),
                ...(body.isEnabled !== undefined ? { isEnabled: Boolean(body.isEnabled) } : {}),
            },
        });

        // Wyłączenie źródła archiwizuje jego aktywne oferty (analogicznie do globalnego wyłącznika)
        if (existing.isEnabled === true && body.isEnabled === false) {
            const archived = await fastify.prisma.listing.updateMany({
                where: { csflowSourceId: id, isArchived: false },
                data: { isArchived: true, archivedAt: new Date(), archivedReason: 'csflow_source_disabled' },
            });
            fastify.log.info(`[CSFlow] Wyłączono źródło ${existing.slug} — zarchiwizowano ${archived.count} ofert`);
        }

        return reply.send({ source });
    });

    // Ręczna synchronizacja jednego źródła
    fastify.post('/api/csflow/sources/:id/sync', {
        onRequest: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        if (settings?.csflowEnabled === false) {
            return reply.status(400).send({ success: false, error: 'Synchronizacja z CSFlow jest wyłączona w ustawieniach.' });
        }
        const source = await fastify.prisma.csflowSource.findUnique({ where: { id } });
        if (!source) return reply.status(404).send({ success: false, error: 'Źródło nie istnieje' });
        if (!source.isEnabled) return reply.status(400).send({ success: false, error: 'Źródło jest wyłączone' });

        try {
            const user = request.user as { userId: string };
            const result = await syncCSFlowAPI(fastify.prisma, source, user.userId);
            return reply.send({ success: true, result });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ success: false, error: 'Błąd synchronizacji źródła CSFlow' });
        }
    });
```

- [ ] **Step 4: Uruchom testy — mają przejść**

Run: `cd backend && npx vitest run src/routes/__tests__/csflow-sources.test.ts && npx tsc --noEmit`
Expected: PASS (5 testów), kompilacja czysta.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/csflow.ts backend/src/routes/__tests__/csflow-sources.test.ts
git commit -m "feat(csflow): CRUD źródeł + sync per źródło (API admina)"
```

---

### Task 7: Panel admina — zarządzanie źródłami

**Files:**
- Modify: `src/services/api.ts` (nowy `csflowApi`, obok `importApi` ~linia 310)
- Create: `src/components/admin/CSFlowSourcesManager.tsx`
- Modify: `src/pages/admin/ImportPage.tsx` (linia ~29, pod `<CSFlowImporter />`)

**Interfaces:**
- Consumes: endpointy z Task 6; `GET /api/dealer-groups` (istniejący, zwraca listę grup; wymaga tokena); komponenty `@/components/ui/{button,input,label,switch,card,badge}`; `useAuth` z `@/contexts/AuthContext`.
- Produces: `csflowApi = { getSources, createSource, updateSource, syncSource }` w `src/services/api.ts`; komponent `<CSFlowSourcesManager />`.

- [ ] **Step 1: Dodaj csflowApi do api.ts**

W `src/services/api.ts`, po obiekcie `importApi`:

```typescript
// CSFlow Sources API
export const csflowApi = {
    getSources: async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Nie udało się pobrać źródeł CSFlow');
        return response.json();
    },

    createSource: async (data: { name: string; apiUrl: string; slug?: string; dealerGroupId?: string | null }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się utworzyć źródła');
        }
        return response.json();
    },

    updateSource: async (id: string, data: { name?: string; apiUrl?: string; dealerGroupId?: string | null; isEnabled?: boolean }, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Nie udało się zaktualizować źródła');
        }
        return response.json();
    },

    syncSource: async (id: string, token: string) => {
        const response = await fetch(`${API_BASE_URL}/api/csflow/sources/${id}/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Synchronizacja źródła nie powiodła się');
        }
        return response.json();
    },
};
```

- [ ] **Step 2: Utwórz CSFlowSourcesManager.tsx**

Utwórz `src/components/admin/CSFlowSourcesManager.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { csflowApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/(api\/?)?$/, '') ?? '';

interface CsflowSource {
    id: string;
    name: string;
    slug: string;
    apiUrl: string;
    isEnabled: boolean;
    dealerGroupId: string | null;
    dealerGroup: { id: string; name: string } | null;
    lastSyncAt: string | null;
    activeListings: number;
}

interface DealerGroupOption {
    id: string;
    name: string;
}

export function CSFlowSourcesManager() {
    const { token } = useAuth();
    const [sources, setSources] = useState<CsflowSource[]>([]);
    const [groups, setGroups] = useState<DealerGroupOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formGroupId, setFormGroupId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        setError(null);
        try {
            const [sourcesRes, groupsRes] = await Promise.all([
                csflowApi.getSources(token),
                fetch(`${API_BASE_URL}/api/dealer-groups`, {
                    headers: { Authorization: `Bearer ${token}` },
                }).then(r => (r.ok ? r.json() : [])),
            ]);
            setSources(sourcesRes.sources);
            setGroups(Array.isArray(groupsRes) ? groupsRes : (groupsRes.dealerGroups ?? groupsRes.groups ?? []));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async () => {
        if (!token || !formName.trim() || !formUrl.trim()) return;
        setIsSaving(true);
        setError(null);
        try {
            await csflowApi.createSource(
                { name: formName.trim(), apiUrl: formUrl.trim(), dealerGroupId: formGroupId || null },
                token
            );
            setFormName(''); setFormUrl(''); setFormGroupId('');
            setShowForm(false);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggle = async (source: CsflowSource, enabled: boolean) => {
        if (!token) return;
        if (!enabled && !window.confirm(
            `Wyłączenie źródła "${source.name}" zarchiwizuje ${source.activeListings} aktywnych ofert. Kontynuować?`
        )) return;
        try {
            await csflowApi.updateSource(source.id, { isEnabled: enabled }, token);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleGroupChange = async (source: CsflowSource, dealerGroupId: string) => {
        if (!token) return;
        try {
            await csflowApi.updateSource(source.id, { dealerGroupId: dealerGroupId || null }, token);
            await loadData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleSync = async (source: CsflowSource) => {
        if (!token) return;
        setSyncingId(source.id);
        setSyncMessage(null);
        try {
            const { result } = await csflowApi.syncSource(source.id, token);
            setSyncMessage(
                `${source.name}: dodano ${result.inserted}, zaktualizowano ${result.updated}, zarchiwizowano ${result.archived}, błędy ${result.failed}`
            );
            await loadData();
        } catch (err: any) {
            setSyncMessage(`${source.name}: błąd — ${err.message}`);
        } finally {
            setSyncingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Źródła CSFlow</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
                    <Plus className="h-4 w-4 mr-1" /> Dodaj źródło
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {syncMessage && <p className="text-sm text-muted-foreground">{syncMessage}</p>}

                {showForm && (
                    <div className="border rounded-md p-4 space-y-3">
                        <div>
                            <Label htmlFor="csflow-src-name">Nazwa</Label>
                            <Input id="csflow-src-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="np. Grupa Carsed" />
                        </div>
                        <div>
                            <Label htmlFor="csflow-src-url">Adres API</Label>
                            <Input id="csflow-src-url" value={formUrl} onChange={e => setFormUrl(e.target.value)} placeholder="https://webapi.carsed.csflow.pl" />
                        </div>
                        <div>
                            <Label htmlFor="csflow-src-group">Grupa dealerska (opcjonalnie)</Label>
                            <select
                                id="csflow-src-group"
                                className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                                value={formGroupId}
                                onChange={e => setFormGroupId(e.target.value)}
                            >
                                <option value="">— brak —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <Button onClick={handleCreate} disabled={isSaving || !formName.trim() || !formUrl.trim()}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Zapisz źródło
                        </Button>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie źródeł...
                    </div>
                ) : sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Brak skonfigurowanych źródeł CSFlow.</p>
                ) : (
                    <div className="space-y-3">
                        {sources.map(source => (
                            <div key={source.id} className="border rounded-md p-4 flex flex-wrap items-center gap-4">
                                <div className="flex-1 min-w-[220px]">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{source.name}</span>
                                        <Badge variant={source.isEnabled ? 'default' : 'secondary'}>
                                            {source.isEnabled ? 'Włączone' : 'Wyłączone'}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{source.apiUrl}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Aktywne oferty: {source.activeListings}
                                        {source.lastSyncAt && ` · Ostatnia synchronizacja: ${new Date(source.lastSyncAt).toLocaleString('pl-PL')}`}
                                    </p>
                                </div>
                                <select
                                    className="h-9 border rounded-md px-2 text-sm bg-background"
                                    value={source.dealerGroupId ?? ''}
                                    onChange={e => handleGroupChange(source, e.target.value)}
                                    title="Grupa dealerska"
                                >
                                    <option value="">— brak grupy —</option>
                                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                                <Switch
                                    checked={source.isEnabled}
                                    onCheckedChange={checked => handleToggle(source, checked)}
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!source.isEnabled || syncingId !== null}
                                    onClick={() => handleSync(source)}
                                >
                                    {syncingId === source.id
                                        ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        : <RefreshCw className="h-4 w-4 mr-1" />}
                                    Synchronizuj
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
```

UWAGA dla implementującego: sprawdź w `src/components/admin/ContextSwitcher.tsx:43` jak parsowana jest odpowiedź `GET /api/dealer-groups` (kształt listy) i jak budowany jest `API_BASE_URL` — użyj DOKŁADNIE tego samego wzorca importu/parsowania zamiast powyższej linii `const API_BASE_URL = ...`, jeśli się różni.

- [ ] **Step 3: Podepnij komponent na ImportPage**

W `src/pages/admin/ImportPage.tsx`:
- dodaj import: `import { CSFlowSourcesManager } from '@/components/admin/CSFlowSourcesManager';`
- pod `<CSFlowImporter />` (linia ~29) dodaj `<CSFlowSourcesManager />` (w tym samym kontenerze/gridzie co CSFlowImporter — dopasuj do istniejącego layoutu strony).

- [ ] **Step 4: Weryfikacja buildu frontendu**

Run: `npm run build` (root projektu)
Expected: build przechodzi bez błędów TS.

- [ ] **Step 5: Weryfikacja w przeglądarce (dev)**

Uruchom dev server (preview) z backendem, zaloguj się do panelu admina → strona Import. Sprawdź: lista pokazuje źródło „Grupa Bemo" z liczbą ofert; formularz dodawania waliduje URL; przełącznik wyłączenia pyta o potwierdzenie.

- [ ] **Step 6: Commit**

```bash
git add src/services/api.ts src/components/admin/CSFlowSourcesManager.tsx src/pages/admin/ImportPage.tsx
git commit -m "feat(csflow): panel zarządzania źródłami CSFlow w adminie"
```

---

### Task 8: Weryfikacja końcowa i notatki wdrożeniowe

**Files:**
- Brak nowych — weryfikacja + ewentualne poprawki.

- [ ] **Step 1: Pełny test suite backendu**

Run: `cd backend && npm test`
Expected: wszystkie testy PASS (w tym istniejące — regresja). Jeśli istniejące testy failują z powodów niezwiązanych ze zmianami (sprawdź na `git stash`), odnotuj i pomiń; jeśli failują przez zmiany — napraw.

- [ ] **Step 2: Kompilacja obu warstw**

Run: `cd backend && npx tsc --noEmit && cd .. && npm run build`
Expected: zero błędów.

- [ ] **Step 3: Smoke test pełnego cyklu na dev**

Uruchom backend lokalnie (`cd backend && npm run dev`) i sprawdź logi startu:
- `[CSFlow Bootstrap]` — utworzenie źródła lub cisza (idempotencja),
- brak błędów Prisma.

Następnie ręczny sync przez API (token admina z panelu):
`POST /api/csflow/sync` → w odpowiedzi `perSource` z wpisem `grupabemo`, `inserted: 0` (wszystko dopasowane po backfillu), `archived: 0` (brak fałszywych archiwizacji). TO JEST KLUCZOWY TEST MIGRACJI — jeśli `inserted > 0` lub `archived > 0` przy niezmienionym stocku, dopasowanie po `(csflowSourceId, csflowCarId)` nie działa; przerwij i debuguj.

- [ ] **Step 4: Notatki wdrożeniowe (do przekazania użytkownikowi)**

Po deployu (Coolify, trzy środowiska):
1. Deploy uruchomi `prisma db push` + bootstrap przy starcie — bez ręcznych kroków.
2. Zweryfikować log `[CSFlow Bootstrap]` na każdym środowisku.
3. Po weryfikacji można usunąć `CSFLOW_API_URL` ze zmiennych Coolify (URL jest już w bazie).
4. Dodanie grupy Carsed: panel admina → Import → Źródła CSFlow → „Dodaj źródło" (`https://webapi.carsed.csflow.pl`), wybrać/utworzyć wcześniej grupę dealerską.

- [ ] **Step 5: Commit końcowy (jeśli były poprawki)**

```bash
git add -A && git commit -m "chore(csflow): poprawki po weryfikacji end-to-end multi-source"
```
