# Manual Listing Entry by Admin/Dealer — Design Spec

**Status:** Draft, awaiting user review
**Date:** 2026-04-29
**Owner:** Kamil Tonkowicz

---

## 1. Cel i kontekst

Admin (na poziomie platformy lub w kontekście wybranego dealera) oraz pracownicy dealera potrzebują możliwości **ręcznego dodawania pojazdów sprzedażowych** — bez przejścia przez import CSV ani CSFlow. Karta wprowadzanego pojazdu musi mieć **strukturalną zgodność** z:

- danymi pojazdu importowanymi z CSV (model `Listing`),
- kartą pojazdu w wynajmie długoterminowym (model `RentalVehicle`).

Spójność jest wymogiem **strategicznym**: w przyszłości docelowy stan to „jeden pojazd, wiele typów ofert" (kredyt + leasing + najem długoterminowy na jednym listingu, np. dla nowych aut dealerskich). Na ten moment tabele pozostają rozdzielne, ale formularz wprowadzania jest wspólny przez parametryzowany komponent.

**Kluczowe wymagania funkcjonalne:**

- Dodawanie nowych i używanych aut w jednym formularzu (radio button steruje walidacją).
- Cena sprzedaży (`pricePln`) jest podstawą kalkulacji raty finansowania, z możliwością przełączenia per-listing na bazę z markupem brokera (`brokerPricePln`).
- Dodatkowa cena katalogowa (MSRP).
- Flaga „chińczyk" per-listing — przygotowanie pod przyszły filtr marek chińskich.
- Zdjęcia uploadowane manualnie (analogicznie do rental).
- Edycja istniejących CSV/CSFlow rekordów ograniczona do whitelisty pól (zdjęcia, opis, flagi).
- Pole `lastManualEditAt` dla wykrywania nieaktualnych ofert.

---

## 2. Architektura

### Modele danych — pozostają rozdzielne

- `Listing` (sprzedaż) i `RentalVehicle` (najem) — dwie osobne tabele.
- Spójność osiągnięta przez **wspólny komponent UI** + parytet pól, nie przez fuzję tabel.
- Migracja do unifikacji w przyszłości jest możliwa bez zmian danych.

### Komponent UI — wspólny

`<VehicleDataForm mode="sale" | "rental">` — wydzielony z istniejącego inline'owego `VehicleForm` w `RentalVehiclesPage.tsx`. Renderowanie warunkowe per `mode` w sekcjach pricing, flags, images. Field gating per-record (`isImported` prop) dla CSV/CSFlow.

### Endpointy — nowe

- `POST /api/listings` — manual create.
- `PATCH /api/listings/:id` — update z whitelistą pól dla CSV/CSFlow.
- `POST /api/listings/:id/images` — multipart upload.
- `DELETE /api/listings/:id/images` — usunięcie pojedynczego zdjęcia.

---

## 3. Schema Prisma

### Nowe enumy

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

### Nowe pola w `Listing`

```prisma
model Listing {
  // ... istniejące pola ...

  catalogPrice       Int?               @map("catalog_price")
  condition          ListingCondition   @default(USED)
  financingPriceBase FinancingPriceBase @default(BROKER_PRICE_PLN) @map("financing_price_base")
  isChineseBrand     Boolean            @default(false)             @map("is_chinese_brand")
  lastManualEditAt   DateTime?          @map("last_manual_edit_at")
  entrySource        EntrySource?       @map("entry_source")

  @@index([condition])
  @@index([isChineseBrand])
  @@index([lastManualEditAt])
}
```

### Backfill

```sql
UPDATE listings SET entry_source = 'CSFLOW' WHERE import_source = 'csflow';
UPDATE listings SET entry_source = 'CSV'    WHERE entry_source IS NULL;
-- catalog_price, last_manual_edit_at zostają NULL dla starych rekordów
-- condition = USED (default), financing_price_base = BROKER_PRICE_PLN (default)
```

### Pola pozostawione bez zmian

- `vin: String?` — opcjonalny w bazie, walidacja warunkowa po stronie aplikacji.
- `mileageKm: Int` — wymagany w bazie, default 0 dla NEW.
- `importSource: String?` — pozostaje (przechowuje nazwę pliku/URL); `entrySource` to typ kategoryczny.
- `pricePln`, `brokerPricePln` — bez zmian; `brokerPricePln` liczone tak jak dziś.

---

## 4. Backend — endpointy

### `POST /api/listings`

```ts
fastify.post('/api/listings', { preHandler: [fastify.authenticate] }, async (req, reply) => {
  const body = req.body as any;
  const scope = await resolveScope(fastify, req);

  let dealerId = body.dealerId;
  if (!dealerId && scope.activeContext.scopeType === 'DEALER') {
    dealerId = scope.activeContext.scopeId;
  }
  if (!dealerId) return reply.code(400).send({ error: 'dealerId is required' });

  if (!scope.isPlatform) {
    const allowed = scope.dealerFilter.dealerId;
    if (typeof allowed === 'string' && dealerId !== allowed) return reply.code(403).send({ error: 'Forbidden' });
    if (typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
  }

  const errors = validateListingPayload(body);
  if (errors.length) return reply.code(400).send({ errors });

  const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
  const brokerPricePln = Math.round(body.pricePln * (1 + (settings?.brokerFeePctPln ?? 3.5) / 100));

  const listing = await fastify.prisma.listing.create({
    data: {
      ...mapManualPayloadToListing(body, dealerId),
      brokerPricePln,
      entrySource: 'MANUAL',
      lastManualEditAt: new Date(),
    },
  });

  const slug = generateListingSlug(listing);
  const updated = await fastify.prisma.listing.update({
    where: { id: listing.id },
    data: { slug },
  });

  return reply.code(201).send({ listing: updated });
});
```

### `PATCH /api/listings/:id`

Field gating dla CSV/CSFlow — whitelist:

```ts
const CSV_EDITABLE_FIELDS = [
  'catalogPrice', 'financingPriceBase', 'isChineseBrand',
  'isFeatured', 'additionalInfoHeader', 'additionalInfoContent',
];

const isImported = existing.entrySource === 'CSV' || existing.entrySource === 'CSFLOW';
const updateData = isImported
  ? pick(body, CSV_EDITABLE_FIELDS)
  : mapManualPayloadToListingUpdate(body);

if (!isImported && body.pricePln !== undefined && body.pricePln !== existing.pricePln) {
  const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
  updateData.brokerPricePln = Math.round(body.pricePln * (1 + (settings?.brokerFeePctPln ?? 3.5) / 100));
}

updateData.lastManualEditAt = new Date();
```

`lastManualEditAt` aktualizowany **zawsze** gdy admin zapisze formularz (również gdy zmienił tylko whitelistowe pole na CSV-imported).

### `POST /api/listings/:id/images`

1:1 portuje pattern z `backend/src/routes/rental-upload.ts`:

- multipart, MIME whitelist (jpeg, png, webp, svg+xml), 10MB per plik.
- Storage: `uploads/listing-images/{listingId}/{timestamp}-{hash}.{ext}`.
- Body field `setPrimary=true` → pierwszy upload trafia do `primaryImageUrl`.
- Public route `GET /uploads/listing-images/:listingId/:file` w `app.ts`.
- Aktualizuje `lastManualEditAt = now()`.

### `DELETE /api/listings/:id/images`

Body: `{ url: string }`.

- Usuwa URL z `imageUrls[]`.
- Jeśli URL zaczyna się od `/uploads/listing-images/` → usuwa też plik z dysku.
- Jeśli usuwany URL to `primaryImageUrl` → ustawia primary na pierwszy z pozostałych lub NULL.
- Aktualizuje `lastManualEditAt = now()`.

### Permisje

Wszystkie 4 endpointy: `preHandler: [fastify.authenticate]` + `resolveScope` check:

| Rola | Dodaje/edytuje |
|---|---|
| `SUPERADMIN_PLATFORM` | dowolnego dealera (z aktywnym kontekstem dealera) |
| `PLATFORM_MANAGER` | dowolnego dealera (z aktywnym kontekstem dealera) |
| `DEALER_GROUP_ADMIN` | tylko dealerów w swojej grupie |
| `DEALER_ADMIN` | tylko swojego dealera |
| `DEALER_EMPLOYEE` | tylko swojego dealera |

### Zmiany w istniejących endpointach

- `csv-mapper.ts`, `csflow.service.ts`: dodać `entrySource: 'CSV'` / `'CSFLOW'` w `Prisma.ListingCreateInput`.
- `settings.ts` recalc — bez zmian (recalc oblicza `brokerPricePln` niezależnie od `financingPriceBase`).

---

## 5. Frontend

### Struktura plików

```
src/components/admin/VehicleForm/
├── VehicleDataForm.tsx
├── sections/
│   ├── IdentificationSection.tsx
│   ├── TechnicalSpecsSection.tsx
│   ├── EquipmentSection.tsx
│   ├── PricingSection.tsx
│   ├── FlagsSection.tsx
│   ├── DescriptionSection.tsx
│   └── ImagesSection.tsx
└── types.ts

src/pages/admin/
├── ListingNewPage.tsx           (route: /admin/listings/new)
└── ListingEditPage.tsx          (route: /admin/listings/:id/edit)

src/utils/
└── listingPrice.ts              (helper getFinancingBasePrice)
```

### Sygnatura `<VehicleDataForm>`

```tsx
interface VehicleDataFormProps {
  mode: 'sale' | 'rental';
  vehicle?: Listing | RentalVehicle;
  dealers: Array<{ id: string; name: string; city?: string }>;
  companies?: RentalCompany[];
  isImported?: boolean;          // tylko mode='sale' — true → field gating
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}
```

### Renderowanie warunkowe per `mode`

| Sekcja | mode='sale' | mode='rental' |
|---|---|---|
| Identification | + `vin`, + radio `condition` | bez `vin`, bez `condition` |
| Technical | identyczne | identyczne |
| Equipment | identyczne | identyczne |
| Pricing | `catalogPrice`, `pricePln` ("Cena sprzedaży brutto"), `mileageKm`, `firstRegistrationDate`, `registrationNumber` | `catalogPrice`, `sellingPrice` |
| Flags | `isChineseBrand`, `isFeatured`, radio `financingPriceBase` | `isFeatured` |
| Description | identyczne | identyczne |
| Images | endpoint `/api/listings/:id/images` | endpoint `/api/rental-vehicles/:id/images` |

### Field gating dla CSV/CSFlow

- `<fieldset disabled>` na sekcjach Identification, Technical, Equipment.
- W Pricing: `catalogPrice` i `financingPriceBase` enabled, reszta disabled.
- Sekcje Flags, Description, Images zawsze enabled (whitelist + zdjęcia).
- Wizualnie: szary background na disabled fieldset + tooltip „To pole pochodzi z importu CSV/CSFlow i jest zarządzane automatycznie".

### Zmiany w `ListingManagementPage`

- Przycisk **„Dodaj pojazd"** (góra prawa) → `/admin/listings/new`.
- Per-row akcja **„Edytuj"** → `/admin/listings/:id/edit`.
- Nowa kolumna **„Ostatnia ręczna edycja"** (sortowalna). Format: relatywna data + tooltip absolutny. NULL → „—".
- Filtr toggle **„Tylko ręcznie wprowadzone"** → `entrySource=MANUAL`.
- Filtr toggle **„Nieedytowane od >30 dni"** → `lastManualEditAt < now-30d AND entrySource=MANUAL`.

### Zmiany w `RentalVehiclesPage`

- Usunięcie inline'owego `VehicleForm` (linie 47-315 w `src/pages/admin/RentalVehiclesPage.tsx`).
- Import `<VehicleDataForm mode="rental" />`.
- Dialog assignmentów, lista, bulk akcje — bez zmian.

### Routing

```tsx
<Route path="/admin/listings/new"
       element={<ProtectedRoute><ListingNewPage /></ProtectedRoute>} />
<Route path="/admin/listings/:id/edit"
       element={<ProtectedRoute><ListingEditPage /></ProtectedRoute>} />
```

`<ProtectedRoute>` musi przepuszczać wszystkie 5 ról wymienione w sekcji 4 (permisje).

---

## 6. Walidacja

### Wspólne (zawsze wymagane)

| Pole | Reguła |
|---|---|
| `make` | non-empty, max 100 |
| `model` | non-empty, max 100 |
| `productionYear` | int, 1990 ≤ x ≤ current_year + 1 |
| `pricePln` | int, > 0, ≤ 10_000_000 |
| `dealerId` | string, istniejący dealer w scope |
| `condition` | enum NEW lub USED |

### Warunkowe per `condition`

| Pole | NEW | USED |
|---|---|---|
| `mileageKm` | wymagany, **0 ≤ x < 100** (twardy blocker) | wymagany, x ≥ 0 |
| `vin` | opcjonalny | opcjonalny (warning gdy brak, nie blocker) |
| `firstRegistrationDate` | opcjonalny | opcjonalny |
| `registrationNumber` | opcjonalny | opcjonalny |

### VIN — format gdy podany

- 17 znaków, alfanumeryczne, bez `I`, `O`, `Q` (ISO 3779).
- Unikalność per baza (Prisma `@unique`). Duplikat → 409 z linkiem do istniejącego rekordu.

### Ceny

- `pricePln` — int, > 0, ≤ 10_000_000.
- `catalogPrice` — opcjonalny, > 0. Warning gdy `catalogPrice < pricePln` (ale nie blocker).
- `financingPriceBase` — enum, default `BROKER_PRICE_PLN`.

### Sanitization

- `additionalInfoContent` — sanitize (DOMPurify lub równoważne; sprawdzić istniejący pattern w projekcie).
- `make`, `model` — trim, max 100 znaków.

### UX zmian condition w trybie edit

- Zmiana `USED` → `NEW` przy `mileageKm > 100`: blokada submitu, czerwony toast „Pojazd nowy nie może mieć przebiegu powyżej 100 km".
- Zmiana `USED` → `NEW`: dialog konfirmacji „Zmiana stanu wyzeruje przebieg i datę pierwszej rejestracji. Kontynuować?"

---

## 7. Wpływ na kalkulator finansowania

### Helper

```ts
// src/utils/listingPrice.ts
export function getFinancingBasePrice(listing: Listing): number {
  return listing.financingPriceBase === 'PRICE_PLN'
    ? listing.pricePln
    : (listing.brokerPricePln ?? listing.pricePln);
}
```

Fallback `?? pricePln` chroni przed historycznymi rekordami z NULL `brokerPricePln`.

### Miejsca użycia

W każdym pliku, który przekazuje `amount` do `<FinancingCalculator>` lub liczy ratę:

- `src/pages/ListingDetailPage.tsx`
- `src/pages/LeadFormPage.tsx`
- `src/pages/PersonalOfferPage.tsx`
- `src/components/DynamicFinancingContent.tsx` (sprawdzić przy implementacji)

```tsx
import { getFinancingBasePrice } from '@/utils/listingPrice';
// ...
<FinancingCalculator amount={getFinancingBasePrice(listing)} />
```

### Co NIE zmieniamy

- Wyświetlanie ceny na karcie/liście — dalej `PriceSettingsContext` (pricePln vs brokerPricePln).
- Sortowanie po cenie w `listings.ts:77` — dalej `brokerPricePln`.
- `RentalFinancingContent` — własna logika z `RentalMatrixEntry`, niezależne.
- Recalc `brokerPricePln` w `settings.ts` — bez zmian.

### Backend serializer

`GET /api/listings/:id` musi zwracać `financingPriceBase` w response. Prisma zwraca wszystkie pola domyślnie — auto-included po migracji. `src/utils/listingMapper.ts` (frontend mapper) — dodać `financingPriceBase` do typu i pass-through.

---

## 8. Plan testów

### Backend — testy integracyjne (`backend/src/routes/__tests__/listings.test.ts`)

**`POST /api/listings`:**
- ✅ create z minimalnym validnym body, `entrySource=MANUAL`, `lastManualEditAt=now`, brokerPricePln policzony
- ✅ `condition=NEW` + `mileageKm=50` → success
- ❌ `condition=NEW` + `mileageKm=200` → 400
- ❌ `condition=USED` + bez `mileageKm` → 400
- ❌ duplikat VIN → 409 z linkiem
- ❌ format VIN niepoprawny → 400
- ✅ scope check: DEALER_ADMIN dealera A → dealer B → 403
- ✅ scope: DEALER_ADMIN bez `dealerId` → bierze z activeContext
- ✅ SUPERADMIN_PLATFORM z `dealerId` → bez ograniczeń
- ✅ slug generowany po insercie

**`PATCH /api/listings/:id`:**
- ✅ MANUAL: zmiana `pricePln` → przelicza `brokerPricePln`, update `lastManualEditAt`
- ✅ CSV: zmiana `pricePln` w body → ignorowane (whitelist), brak błędu
- ✅ CSV: zmiana `isFeatured` → przepuszczone, update `lastManualEditAt`
- ✅ CSV: zmiana `catalogPrice` → przepuszczone
- ❌ scope: edycja cudzego dealera → 403
- ❌ zmiana `condition` USED → NEW przy `mileageKm=10000` → 400

**`POST /api/listings/:id/images`:**
- ✅ upload 1 JPG → URL w `imageUrls[]`
- ✅ upload 5 → wszystkie, kolejność zachowana
- ✅ `setPrimary=true` → pierwszy URL jako `primaryImageUrl`
- ❌ plik > 10MB → 413
- ❌ MIME application/pdf → 400
- ✅ `lastManualEditAt` zaktualizowany

**`DELETE /api/listings/:id/images`:**
- ✅ usunięcie URL z `imageUrls[]`
- ✅ usunięcie z dysku gdy `/uploads/listing-images/...`
- ✅ DB-only gdy zewnętrzny URL
- ✅ usunięcie URL == primary → primary na pierwszy z pozostałych lub null

**CSV regression:**
- ✅ import: nowe rekordy mają `entrySource=CSV`, `condition=USED`, `financingPriceBase=BROKER_PRICE_PLN`, `lastManualEditAt=null`
- ✅ ponowny import nie nadpisuje `lastManualEditAt`, `isFeatured` ręcznie ustawionych

**Helper `getFinancingBasePrice` — unit:**
- ✅ `BROKER_PRICE_PLN` → `brokerPricePln`
- ✅ `PRICE_PLN` → `pricePln`
- ✅ `BROKER_PRICE_PLN` + `brokerPricePln=null` → fallback `pricePln`

### Frontend — smoke checklist (do uzupełnienia w PR)

1. ☐ `/admin/listings` — przycisk „Dodaj pojazd" widoczny, klik → `/admin/listings/new`
2. ☐ Formularz create — wszystkie pola dostępne
3. ☐ Toggle `condition` NEW ↔ USED — wymagalność pól się aktualizuje
4. ☐ Submit minimum required → 201, redirect, rekord widoczny
5. ☐ Upload 3 zdjęć — wczytane, primary changeable, deletable
6. ☐ Edit MANUAL — wszystkie pola edytowalne
7. ☐ Edit CSV — Identification/Technical/Equipment disabled, tooltip
8. ☐ Edit CSV — `catalogPrice`, flags, opis, zdjęcia: enabled
9. ☐ `RentalVehiclesPage` po refaktorze działa identycznie
10. ☐ MANUAL z `financingPriceBase=PRICE_PLN` → kalkulator z `pricePln`
11. ☐ MANUAL z `financingPriceBase=BROKER_PRICE_PLN` → kalkulator z `brokerPricePln`
12. ☐ Filtr „Nieedytowane od >30 dni" — działa
13. ☐ DEALER_EMPLOYEE w kontekście dealera A — widzi „Dodaj pojazd", może dodać dla A
14. ☐ DEALER_EMPLOYEE → URL `/admin/listings/{id-cudzego-dealera}/edit` → 403/redirect

### Out of scope

- E2E framework (projekt nie ma tej infrastruktury).
- Performance test uploadu wielu zdjęć równolegle.
- Visual regression kalkulatora.

---

## 9. Plan implementacji

5 etapów na jednej feature branchy `feat/manual-listing-entry`. Etap 3 jest checkpointem przed kontynuacją.

### Etap 1 — Schema + migracja + typy (backend)

1. `backend/prisma/schema.prisma`: enumy + 6 pól + 3 indeksy.
2. `prisma migrate dev --name add_manual_listing_entry_fields`.
3. SQL backfill: `entrySource` z `import_source`.
4. `csv-mapper.ts`, `csflow.service.ts`: `entrySource: 'CSV' / 'CSFLOW'`.
5. `src/types/listing.ts`, `src/utils/listingMapper.ts`: nowe pola.

**Verify:** `bun run db:generate` ok, migracja czysto na kopii prod, CSV import działa, TS compile ok.

### Etap 2 — Backend endpointy

1. `backend/src/routes/listings.ts`: 4 nowe endpointy.
2. `backend/src/services/listing-mapper.ts` (nowy): `mapManualPayloadToListing`, `mapManualPayloadToListingUpdate`, `validateListingPayload`, `pickCsvEditableFields`.
3. `backend/src/app.ts`: public route `GET /uploads/listing-images/:listingId/:file`.
4. `backend/src/routes/__tests__/listings.test.ts`: testy z sekcji 8.

**Verify:** wszystkie testy przechodzą, scope check potwierdzony.

### Etap 3 — Refaktor `<VehicleDataForm>` (CHECKPOINT REGRESJI)

1. Utworzyć `src/components/admin/VehicleForm/` ze strukturą sekcji.
2. Przenieść `VehicleForm` z `RentalVehiclesPage.tsx` (linie 47-315) → `VehicleDataForm.tsx` z prop `mode`.
3. Wyciąć sekcje do `sections/`.
4. Refaktor `RentalVehiclesPage`: import `<VehicleDataForm mode="rental" />`.

**Verify:** `RentalVehiclesPage` działa identycznie jak przed refaktorem (smoke 9), `bun run build` ok, istniejące testy nie pękają. **Stop, manualnie potwierdź przed Etapem 4.**

### Etap 4 — Frontend strony i integracja

1. `ListingNewPage.tsx`, `ListingEditPage.tsx`.
2. `services/api.ts`: `listingsApi.createListing`, `updateListing`, `uploadImages`, `deleteImage`.
3. `utils/listingPrice.ts`: helper.
4. Modyfikacja `ListingDetailPage`, `LeadFormPage`, `PersonalOfferPage`: użycie helpera.
5. Routing: `/admin/listings/new`, `/admin/listings/:id/edit` z `<ProtectedRoute>`.
6. `ListingManagementPage`: przycisk „Dodaj pojazd", per-row edit, kolumna „Ostatnia ręczna edycja", filtry.
7. `AdminListingItem.tsx`: per-row akcja edit.

**Verify:** smoke checklist 1-14, wszystkie 3 scenariusze finansowania działają.

### Etap 5 — Polish + dokumentacja

1. PR description z wypełnioną smoke checklist.
2. Aktualizacja `features_desc.md` lub `new_features.md`.
3. Skrót zmian w commit message.
4. (opcjonalnie) zrzut ekranu formularza w PR.

**Verify:** PR review-ready.

### Szacowana wielkość

| Etap | Pliki | Linie |
|---|---|---|
| 1 — schema | 4 | ~80 |
| 2 — endpointy | 4 | ~400 |
| 3 — refaktor formularza | 12 (10 nowych) | ~600 (z czego ~270 to migracja istniejącego, ~330 nowego/zmienionego) |
| 4 — frontend strony | 9 | ~450 |
| 5 — polish | 2 | ~30 |
| **suma** | **~30** | **~1560** |

Realistycznie: **2-3 dni roboczych dla jednej osoby**.

---

## 10. Decyzje pominięte / przyszła praca

- **Unifikacja `Listing` + `RentalVehicle` w jeden model `Vehicle`** — nie teraz, ale obecny design ma na to nie blokować (parytet pól, wspólny komponent UI).
- **Brand-level metadata dla flagi „chińczyk"** — obecnie per-listing flag (zgodnie z prośbą użytkownika). Docelowo lepiej trzymać jako metadanę marki w słowniku marek; ścieżka migracji: dodać tabelę `Brand` z polem `originCountry`, wycofać `Listing.isChineseBrand`.
- **Dodatkowe wartości `FinancingPriceBase`** (np. `DEALER_NET_PRICE_PLN`) — obecnie 2 wartości, łatwo dodać kolejne enumy bez breaking change'u (helper `getFinancingBasePrice` rozszerzalny).
- **Bulk import nowych aut z formularza** (np. wgrywanie pliku XLS dealera) — out of scope, można dodać później jako osobny endpoint.
- **Historia zmian per-listing** (audit log) — out of scope. `lastManualEditAt` daje minimum info do filtrowania nieaktualnych ofert.

---

## 11. Otwarte pytania / ryzyka

- **`additionalInfoContent` sanitization**: do potwierdzenia przy implementacji, jakiej biblioteki używa już projekt (DOMPurify? sanitize-html?). Jeśli żadnej — dodać DOMPurify.
- **Walidacja Zod vs manual**: do decyzji przy implementacji w zależności od konwencji projektu. Jeśli nie ma Zod w projekcie, zostać przy manual validation w endpoincie.
- **`<ProtectedRoute>` z listą ról**: do sprawdzenia, czy istniejący komponent przyjmuje `requiredRoles` prop. Jeśli nie — krótka rozbudowa.
- **Migracja na produkcji**: dodanie 6 pól + 3 indeksy na tabeli `listings` (która ma realny rozmiar). Indeksy — operacja minutowa. Najlepiej w oknie serwisowym.

---

**End of spec.**
