# Spec: raty z własnej bazy — trwały magazyn wyników partnerów, raty dla nowych ofert, łączenie zapytań, 301 dla /samochody/<id>

Data: 2026-10-01 · Gałąź: `perf/financing-quotes-db` (od `origin/main` = `9b67f4b`).
Źródło: pomiary prod z 2026-10-01 (memory `prod-perf-audit-2026-10`), decyzja usera: rata domyślna ma
pochodzić z własnej bazy, nie z zapytania do partnera przy każdym wejściu na ofertę. Warunki partnerów
zmieniają się najwyżej kilka razy w miesiącu.

Cztery zmiany, każda w osobnym commicie (kolejność dowolna, A przed B, bo B używa A).

## Stan dziś (fakty z kodu i prod)

- Karta oferty: `src/components/FinancingCalculator.tsx` przy wejściu woła `POST /api/financing/calculate`
  z domyślnymi parametrami (efekt ok. L255–330). Na prod (`financingCalculatorLocation = sidebar`)
  `ListingDetailPage.tsx` montuje DWA kalkulatory naraz (L823 ukryty `lg:hidden` + L1130 w sidebarze) →
  dwa identyczne zapytania w tej samej sekundzie (300 par / ~1430 wywołań w 28 h).
- Route: `backend/src/routes/financing.ts` (~L90–150) — cache Redis 6 h, klucz
  `financing:calc:v1:<product.id>:<product.updatedAt ms>:<connection.updatedAt ms>:<sha1(params)>`.
- Nocny cron 03:00 `recomputeAll` (`backend/src/services/financing-calc.service.ts`, ~L622–668) liczy dla
  każdej aktywnej oferty ratę domyślną kredytu i leasingu (`calcInstallmentForProduct`, ~L493–556) z tymi
  samymi parametrami co kalkulator (60 mies., 25%, 35% / 0% bez balonu, netto = round(brutto/1,23)) —
  ale zapisuje tylko kwotę (`listings.reference_*_installment`), a pełną odpowiedź partnera wyrzuca.
- Produkty prod: INBANK/CREDIT (bez balonu), VEHIS/LEASING (balon) — parametry domyślne frontendu i crona
  są dla nich identyczne. Wyjątek: 182 oferty z `vat_margin = true` (frontend liczy netto = brutto) —
  dla nich klucze się nie spotkają; **poza zakresem** (nie zmieniamy semantyki rat referencyjnych).
- 181 aktywnych ofert dodanych dziś po 03:00 nie ma raty referencyjnej (`reference_calc_at IS NULL`) —
  importy (CSFlow, PewneAuto, Autopunkt, Otomoto) nie uruchamiają przeliczenia; czekają do 03:00.

---

## A — trwały magazyn wyników partnera (`financing_quotes`) + wspólny klucz

1. **Prisma** (`backend/prisma/schema.prisma`) — nowy model (tylko addytywnie; deploy robi `prisma db push`,
   NIE tworzyć migracji `migrate dev`):
   ```prisma
   model FinancingQuote {
     cacheKey   String   @id @map("cache_key")
     productId  String   @map("product_id")
     response   Json
     computedAt DateTime @default(now()) @map("computed_at")

     @@index([computedAt])
     @@map("financing_quotes")
   }
   ```
2. **Nowy moduł** `backend/src/services/financing-quote-cache.ts`:
   - `buildFinancingQuoteKey(product: {id, updatedAt}, connection: {updatedAt}, params)` — przenieść tu
     DOKŁADNIE obecną logikę klucza z `financing.ts` (te same pola w tej samej kolejności, brakujące → `null`,
     sha1). Wynik bez prefiksu namespace (namespace dokleja `api-cache.ts` dla Redisa).
   - `QUOTE_TTL_SECONDS = 36 * 3600` — ważność (Redis TTL i wiek wpisu w bazie). 36 h > odstęp crona (24 h).
   - `getFinancingQuote(prisma, key)`: najpierw `getJsonFromCache(key)`; jeśli brak → `prisma.financingQuote.findUnique`
     z warunkiem `computedAt >= now − 36 h`; trafienie z bazy dogrzewa Redis (`setJsonInCache(key, response, QUOTE_TTL_SECONDS)`).
     Zwraca `response` albo `null`.
   - `saveFinancingQuote(prisma, key, productId, response)`: `setJsonInCache(..., QUOTE_TTL_SECONDS)` + `upsert`
     w bazie (`computedAt: new Date()`). Błąd zapisu do bazy logować (`console.warn`) i NIE rzucać — zapis
     cache nie może psuć odpowiedzi.
3. **Route** `POST /api/financing/calculate`: zamienić obecne `getJsonFromCache/setJsonInCache` na
   `getFinancingQuote/saveFinancingQuote` (klucz z `buildFinancingQuoteKey`). Kolejność walidacji i kody
   błędów bez zmian; błędy partnera nie są zapisywane.
4. Sprzątanie: na końcu `recomputeAll` (po workerach) `deleteMany({ where: { computedAt: { lt: now − 7 dni } } })`.

**Testy** (rozszerzyć `backend/src/routes/__tests__/financing-calc-cache.test.ts`, mock `fetch` jak tam):
- wynik partnera trafia do tabeli `financing_quotes`;
- po wyczyszczeniu klucza w Redisie (użyj `getApiRedisClient()` + `getApiCacheKey`) identyczne zapytanie
  NIE woła partnera (trafienie z bazy) i ponownie zapisuje Redis;
- wpis starszy niż 36 h (ustaw `computedAt` ręcznie) → partner wołany ponownie;
- istniejące 4 testy cache przechodzą.

## B — cron zapisuje pełną odpowiedź partnera do magazynu

W `calcInstallmentForProduct` (gałąź partnera, po udanym `calcInbankInstallment`/`calcVehisInstallment`):
`await saveFinancingQuote(ctx.prisma, buildFinancingQuoteKey(product, connection, params), product.id, result)`
— `params` to obiekt już budowany tam (`CalcParams`), czyli dokładnie to, co route dostałby od kalkulatora.
`CalcContext` musi mieć `prisma` (sprawdzić; jeśli nie — dodać). Kwota referencyjna i jej zapis do `listings`
— bez zmian. Gałąź OWN — bez zmian (nie woła partnera).

**Test** (nowy lub w `financing-calc-cache.test.ts`): `computeReferenceInstallments` dla oferty testowej
z produktem INBANK (mock fetch) → następnie `POST /api/financing/calculate` z parametrami, które wysłałby
kalkulator dla tej oferty (netto = round(brutto/1,23), `downPaymentAmount = round(netto*25/100)`, `period 60`,
`initialFeePercent 25`, `finalPaymentPercent 0`, `manufacturingYear`, `mileageKm` oferty) → fetch partnera
wywołany tylko raz (przez cron), odpowiedź route równa zapisanej.

## C — raty dla nowych ofert co godzinę

W `initReferenceInstallmentsCron` dopisać drugie zadanie:
`cron.schedule('15 * * * *', ...)` → `recomputeAll({ prisma, log: console }, { onlyMissing: true })`, z logiem
`[CRON] Uzupełniono raty referencyjne dla N nowych ofert` i obsługą błędu jak w zadaniu 03:00. Nie uruchamiać,
gdy trwa poprzedni przebieg (prosta flaga modułowa `isRunning`, wspólna dla obu zadań — zadanie 03:00 też jej
pilnuje). Jedno miejsce zamiast podpinania się pod każdy silnik synchronizacji.

**Test:** jednostkowy dla flagi nie jest wymagany; wystarczy, że `recomputeAll({ onlyMissing: true })` liczy
tylko oferty z `referenceCalcAt = null` (jeśli taki test już istnieje — pozostawić; jeśli nie — dodać prosty).

## D — łączenie jednoczesnych identycznych zapytań w route

W `financing.ts` mapa modułowa `inFlight = new Map<string, Promise<result>>()` po kluczu z A:
po nietrafieniu `getFinancingQuote` → jeśli w mapie jest obietnica, `await` ją; inaczej utwórz obietnicę
(wywołanie partnera + `saveFinancingQuote`), wstaw do mapy, w `finally` usuń. Błąd partnera dostają wszyscy
oczekujący (każdy przechodzi przez obecną obsługę `FinancingCalcError` → ten sam kod HTTP).

**Test:** dwa równoległe `app.inject` z identycznym body (Promise.all) → `fetch` partnera wywołany 1 raz,
obie odpowiedzi 200 i równe; wariant z błędem partnera → obie odpowiedzi z tym samym kodem błędu.

## E — 301 z `/samochody/<id>` na ofertę

Google ma w kolejce stare adresy `/samochody/<listing-id>` (JSON-LD `ConditionPage` przed `6e9135e`,
2026-09-25) — dziś 404 dla aktywnych ofert (~6/dobę).

`backend/src/routes/render.ts`, blok `BRAND_RE` (ok. L875–890): w miejscu, gdzie po nieznalezieniu marki
(także w `getBrandCatalogAllTime`) zwracany jest 404, PRZED tym 404 dodać: jeśli segment pasuje do
`/^(?:[a-z0-9-]+-)?c[a-z0-9]{24}$/`, wywołać `resolveOfferLifecycle(fastify, segment)`:
- `ACTIVE` / `RECENTLY_SOLD` z `canonicalSlug` → 301 na `/oferta/<canonicalSlug>`;
- `LONG_GONE` z `redirectUrl` → 301 na `redirectUrl`;
- w pozostałych przypadkach → dotychczasowe 404.
Kształt odpowiedzi 301 jak w gałęzi `LONG_GONE` ofert (`...defaultMeta(ctx, { noindex: true, status: 301 }), redirectUrl, status: 301`).
Strony marek nie mogą się zmienić (sprawdzenie dopiero po nieznalezieniu marki).

**Testy** (`render.test.ts`, wzorem testów ofert): `/samochody/<id aktywnej oferty>` → 301 na `/oferta/<slug>`;
`/samochody/<nieistniejący-cuid>` → 404; istniejące testy stron marek przechodzą.

---

## Weryfikacja

Z `backend/`:
```
npx prisma db push --skip-generate   # lokalna baza — tylko jeśli model nie istnieje lokalnie; potem npx prisma generate
npx tsc --noEmit
npx vitest run src/routes/__tests__/financing-calc-cache.test.ts src/routes/__tests__/financing-logging.test.ts src/routes/__tests__/render.test.ts
```
oraz pełny `npx vitest run` (znane niestabilne: `leads-ratelimit` pod obciążeniem, `advisor-flow-performance`).
`graphify update .` po zmianach.

Po deployu na prod (osobny krok, robi koordynator):
1. `node dist/scripts/backfill-reference-installments.js` w kontenerze API prod (wypełnia `financing_quotes`).
2. Pierwsze wejście na losową ofertę (kredyt, cena bez VAT-marży) → w logu Traefika `POST /api/financing/calculate` < 30 ms.
3. Po godzinie: `select count(*) from listings where not is_archived and reference_calc_at is null` ≈ 0.
4. `curl -sI -A Mozilla/5.0 https://motolia.pl/samochody/cmtbtxx3300fo9s4hkt23hpht` → 301 na `/oferta/...`.

## F — VAT-marża: podstawa jak w kalkulatorze (decyzja usera 2026-10-01)

Reguła biznesowa dla ofert z `vatMargin = true`:
- **kwota do kalkulacji raty (wysyłana do partnera) = cena oferty** — dla kredytu i leasingu (bez dzielenia przez 1,23;
  tak już liczy kalkulator: `price / vatMultiplier`, gdzie `vatMultiplier = 1` dla VAT-marży);
- **kredyt:** netto i brutto to ta sama kwota → rata brutto = rata od partnera (mnożnik 1);
- **leasing:** wartość brutto = kwota VAT-marży + 23% VAT → rata brutto leasingu = rata netto × 1,23.

1. **Cron** (`financing-calc.service.ts`): `calcInstallmentForProduct` i `computeReferenceInstallments` muszą znać
   `vatMargin` oferty (dodać do `select` i `ListingForCalc`/parametrów). Dla VAT-marży:
   `nettoPrice = Math.round(grossPricePln)` (zamiast `/ VAT`), a konwersja wyniku kredytu do brutto z mnożnikiem 1
   (zamiast `* VAT`). Leasing: zapisywana kwota referencyjna pozostaje netto (bez zmian semantyki).
   Kwoty do wyboru produktu (`creditAmountToFinance`/`leasingAmountToFinance` w `computeReferenceInstallments`,
   `netPrice = price / VAT`) — dla VAT-marży także bez dzielenia przez VAT (spójnie z `amountToFinance` kalkulatora).
   Dla ofert bez VAT-marży — zero zmian. Dzięki temu klucz z crona (B) spotka się z kluczem kalkulatora także dla
   182 ofert z VAT-marżą.
2. **Frontend** (`src/components/FinancingCalculator.tsx`): dziś `vatMultiplier = vatMargin ? 1 : 1.23` jest używany
   zarówno do podstawy, jak i do przeliczenia raty netto→brutto (L141, L310, L641–642). Zostawić podstawę bez zmian,
   a do przeliczenia RATY netto↔brutto użyć mnożnika zależnego od kategorii:
   `installmentVatMultiplier = (vatMargin && activeCategory !== 'LEASING') ? 1 : 1.23`
   (kredyt z VAT-marżą: 1; leasing zawsze 1,23; oferty bez VAT-marży: 1,23 jak dziś). Zastosować w tych trzech
   miejscach przeliczenia raty; `price / vatMultiplier` (L280) i podstawy (`price` w `ListingDetailPage`) — bez zmian.
   Sprawdzić `ListingCard.tsx` / inne miejsca pokazujące `referenceLeasingInstallment` jako brutto dla klienta
   prywatnego — jeśli przeliczają z `vatMargin`, zastosować tę samą regułę; jeśli nie dotykają VAT-marży, nie ruszać.

**Testy:** backend — `computeReferenceInstallments` dla oferty z `vatMargin: true` (mock fetch): partner dostaje
`amount`/`price` równe cenie oferty (nie /1,23), kredyt referencyjny = rata partnera (bez ×1,23); oferta bez VAT-marży
— jak dotąd. Frontend — jeśli istnieją testy `FinancingCalculator` (vitest/RTL), dodać przypadek: VAT-marża + leasing
+ klient prywatny → wyświetlana rata = netto × 1,23; VAT-marża + kredyt → bez ×1,23. Jeśli testów komponentu brak —
wydzielić mnożnik do małej czystej funkcji i przetestować ją jednostkowo.

Poza zakresem (odnotowane): frontend montujący dwa kalkulatory (D niweluje koszt po stronie partnera); 117 błędów
„Provider request failed” w nocnym przeliczeniu (osobna diagnoza).
