# Etap 3 — silnik rat referencyjnych (przelicz i zapisz)

Data: 2026-07-15
Status: zatwierdzony (przelicz+zapis; karta: ukryj gdy brak wartości)

## Problem (dlaczego Etap 2 in-render był błędny)

Realne raty pochodzą z zewnętrznych partnerów (INBANK/VEHIS) przez żywe API
(`/api/financing/calculate`). Kalkulator na detalu pokazuje dokładną ratę partnera
(np. kredyt 553 zł, RRSO 16,29%). Etap 2 liczył na kafelku ratę z formuły PMT
(`referenceRate + margin`) — dla produktów partnerskich zaniżoną i niezgodną (386 zł).
Nie da się wołać API partnera per kafelek w siatce → jedyne poprawne rozwiązanie to
przeliczyć raz i zapisać na ofercie; kafelki czytają zapis.

## Parametry referencyjne (jak w kalkulatorze, Etap 2)

Kredyt i leasing: wpłata 25%, wykup 35% (kredyt: tylko gdy `hasBalloonPayment`; inaczej 0),
okres 60 mc. Clamp do limitów produktu (`maxInitialPayment`/`maxFinalPayment`/`min|maxInstallments`).
Rata liczona tą samą ścieżką i selekcją produktu co kalkulator w stanie domyślnym → karta == kalkulator.

## Schemat — `Listing` (prisma db push, bez migrate)

- `referenceCreditInstallment Int? @map("reference_credit_installment")` — brutto (konsument/prywatny).
- `referenceLeasingInstallment Int? @map("reference_leasing_installment")` — netto.
- `referenceCalcAt DateTime? @map("reference_calc_at")`.

## Backend — serwis liczący

Nowy `backend/src/services/financing-calc.service.ts`:
- **Refaktor**: wyciągnąć logikę wołania partnerów z `backend/src/routes/financing.ts`
  (INBANK ~153-292, VEHIS ~300-410) do funkcji wielokrotnego użytku
  (`calcInbankInstallment`, `calcVehisInstallment`) + OWN PMT (`calcOwnInstallment`).
  Endpoint `/api/financing/calculate` ma dalej działać identycznie (wołać te funkcje) —
  zero zmian w zachowaniu i formacie odpowiedzi (krytyczne: kalkulator na detalu).
- **Selekcja produktu** `selectProduct(products, category, listing)` — odwzorowuje
  `candidateProduct` z `FinancingCalculator.tsx` (~158-210): filtr kategoria + dostępność
  (`creditAvailable`/`leasingAvailable`) + widełki kwotowe (`minAmount`/`maxAmount` vs
  `amountToFinance`) + `listing.creditProductId`/`leasingProductId` jako wymuszony;
  sort `priority` desc → `isDefault` desc → fallback OWN.
- **`computeReferenceInstallments(fastify, listing)`**:
  - `price = listing.pricePln` (brutto, konsument).
  - KREDYT: produkt = selectProduct('CREDIT'); params 25 / (hasBalloon?35:0) / 60 (clamp).
    OWN → PMT na brutto; INBANK → API partnera (partner liczy netto → *1.23 brutto dla konsumenta).
    Zapis `referenceCreditInstallment` (brutto).
  - LEASING: produkt = selectProduct('LEASING'); params 25 / 35 / 60 (clamp).
    OWN → PMT na netto (price/1.23); VEHIS → API partnera (netto). Zapis `referenceLeasingInstallment` (netto).
  - Brak produktu / niedostępne / błąd API → `null` dla danej raty. Ustaw `referenceCalcAt`.
- **Throttling** dla trybu masowego: ograniczona współbieżność + drobne opóźnienie
  (limity partnera). Cache w obrębie jednego przebiegu po (productId, cena, params).

## Triggery przeliczenia

1. **Pojedyncza edycja** — po `listing.create` (routes/listings.ts:132) i `listing.update`
   (POST manual :150 oraz PATCH `/api/listings/:id`) → przelicz tę ofertę (gdy zmieniła się
   cena / produkt / dostępność). Fire-and-forget (nie blokować odpowiedzi admina), z logiem błędu.
2. **Masowy recalc cen** — na końcu `recalculateAllPrices` (routes/settings.ts:121) → przelicz
   wszystkie (throttled).
3. **Nocny cron** — `node-cron` (wzorzec z services/csflow.service.ts), np. 03:00 — przelicz
   wszystkie aktywne oferty (dryf stóp partnera).
4. **Backfill** — `backend/src/scripts/backfill-reference-installments.ts` (wzorzec
   scripts/backfill-image-variants.ts). Uruch.: `node dist/scripts/backfill-reference-installments.js`
   w kontenerze; liczy dla wszystkich (lub gdzie `referenceCalcAt` null). To moment „zapłonu" rat.

## API passthrough

- `backend/src/routes/widgets.ts` (formatery listingów, oba miejsca): dodać
  `creditInstallment: l.referenceCreditInstallment`, `leasingInstallment: l.referenceLeasingInstallment`.
  Usunąć wcześniej dodane `creditProductId/leasingProductId/creditAvailable/leasingAvailable`
  z Etapu 2 (już niepotrzebne na kafelku — selekcja jest server-side).
- Publiczne API listingów (feed `/samochody`): dołączyć `referenceCreditInstallment`,
  `referenceLeasingInstallment` do zwracanego obiektu; dodać pola do typu `Listing` (frontend).

## Frontend — karty czytają zapis, ukrywają gdy brak

- `src/components/public/DynamicWidget.tsx`: gałąź listingu używa `v.creditInstallment` (brutto)
  i `v.leasingInstallment` (netto). Chipy rat renderowane **tylko gdy przynajmniej jedna wartość
  jest obecna**; brak → blok rat ukryty (zostają cena, tagi, rabat). Usunąć użycie
  `computeMonthlyRates`/`referenceInstallment`/`selectReferenceProduct` w tym pliku.
- `src/components/ListingCard.tsx`: kredyt = `listing.referenceCreditInstallment` (brutto),
  leasing = `listing.referenceLeasingInstallment` (netto). Blok rat **tylko gdy jest wartość**;
  brak → ukryty. Zachować semantykę netto/brutto wyświetlania (`priceType`, wtórna wartość
  przez ±VAT) i tooltipy. Usunąć fallback współczynnikowy i użycie util referencyjnego.
- `src/utils/financingRates.ts`: funkcje `pmtInstallment`/`selectReferenceProduct`/
  `referenceInstallment`/`computeMonthlyRates` mogą stać się nieużywane na froncie — usunąć
  martwe wraz z niepotrzebnymi importami (albo zostawić tylko realnie używane). Stałe REFERENCE_*
  zostają jako źródło parametrów kalkulatora, jeśli używane.
- Kalkulator (`FinancingCalculator.tsx`) — domyślne 25/35/60 z Etapu 2 zostają (zgodność karta==kalkulator).

## Kryteria akceptacji

- Po backfillu na środowisku z produktami: rata kredyt/leasing na kafelku == rata w kalkulatorze
  w stanie domyślnym dla tej oferty (produkt OWN i partnerski).
- Brak zapisanej wartości → kafelek nie pokazuje rat (żadnych błędnych liczb).
- Endpoint `/api/financing/calculate` działa identycznie jak przed refaktorem (kalkulator detalu bez regresji).
- Nowa/edytowana oferta liczy się od razu; nocny cron odświeża wszystkie; backfill zapełnia istniejące.
- `tsc --noEmit` frontend + backend czysto. Throttling chroni limity partnera.

## Ryzyka / uwagi

- Lokalna baza dev (backend npm run dev) ma 0 produktów → funkcjonalny test tylko na środowisku
  z produktami (dev.motolia.pl po deployu + backfill). Weryfikacja lokalna = tsc + review + logika.
- Refaktor `/api/financing/calculate` musi być zachowawczy (te same wyniki i format).
- `db push` na środowiskach doda kolumny; wartości null do czasu backfillu (kafelki ukryte).
