# Etap 2 — realne raty referencyjne (in-render) + domyślne parametry kalkulatora

Data: 2026-07-15
Status: zatwierdzony (wariant in-render)

## Cel

Zastąpić przybliżone raty z Etapu 1 (stałe współczynniki 1,4% / 1,2%) realną ratą liczoną
formułą PMT z parametrów produktu finansowego, przy stałych założeniach referencyjnych.
Te same założenia mają być domyślnym stanem kalkulatora na stronie oferty.

## Parametry referencyjne (od użytkownika)

- Leasing: wpłata własna 25%, wykup 35%, okres 60 miesięcy.
- Kredyt: wpłata własna 25%, wykup 35% **tylko gdy produkt kredytowy ma `hasBalloonPayment`**
  (inaczej wykup 0%), okres 60 miesięcy.
- Wszystkie wartości clampowane do limitów produktu (`maxInitialPayment`, `maxFinalPayment`,
  `minInstallments`/`maxInstallments`).

## Decyzja architektoniczna: liczenie w locie (bez zapisu w bazie)

Dla produktów `OWN` rata to czysta funkcja PMT (`referenceRate + margin`, parametry, cena) —
policzalna w locie, bez wołania API. `Listing` ma już `creditProductId`/`leasingProductId`
i flagi `creditAvailable`/`leasingAvailable` (wybór produktu per oferta istnieje). Lista
produktów jest mała i pobierana jednym, współdzielonym, cache'owanym zapytaniem
(`financingApi.listPublic`, staleTime 5 min) — tym samym, którego używa kalkulator.

Koszt renderu pomijalny (kilka operacji float/kartę), brak N+1, brak zapytań per kafelek.
Odrzucono wariant „przelicz i zapisz w bazie" (schema, backfill, joby, staleness; na dev brak
produktów do testu) — przy odczycie in-render zbędny.

Uwaga: dla produktów zewnętrznych (VEHIS/INBANK) karta pokazuje ratę z formuły
`referenceRate + margin` (nie dokładny wynik API partnera na detalu) — świadomie zaakceptowane.

## Zakres zmian

### 1. `src/utils/financingRates.ts` — rozszerzenie (util referencyjny)
Zachować istniejące `KREDYT_FACTOR`/`LEASING_FACTOR`/`VAT`/`computeMonthlyRates` (fallback).
Dodać:
- Stałe: `REFERENCE_MONTHS = 60`, `REFERENCE_INITIAL_PCT = 25`, `REFERENCE_FINAL_PCT = 35`.
- `pmtInstallment(price, { downPct, finalPct, months, annualRatePct }): number` — identyczna
  formuła jak w `FinancingCalculator` (kwoty wpłaty/wykupu zaokrąglane `Math.round`, jak
  linie 154-156, wzór PMT jak linie 371-377). Zwraca zaokrągloną ratę.
- `selectReferenceProduct(products, category, listingProductId?)` — produkt listing-specific
  (gdy `listingProductId` pasuje do kategorii), inaczej domyślny: sort po `priority` desc,
  potem `isDefault` desc, zwraca pierwszy lub `null`.
- `referenceInstallment(product, price, category): number | null` — clamp parametrów do limitów
  produktu; `downPct = min(25, maxInitialPayment)`; `finalPct`: LEASING → `min(35, maxFinalPayment)`,
  CREDIT → `hasBalloonPayment ? min(35, maxFinalPayment) : 0`; `months = clamp(60, min, max)`.
  Wywołuje `pmtInstallment` z `annualRatePct = referenceRate + margin`.

### 2. `src/hooks/useFinancingProducts.ts` — nowy hook (współdzielone zapytanie)
`useQuery({ queryKey: ['financing-calculator'], queryFn: financingApi.listPublic, staleTime: 5*60*1000 })`
zwracający `products: FinancingProduct[]`. Ten sam klucz co kalkulator → React Query dedupuje
do jednego requestu na stronę. Używany przez `ListingCard` i `DynamicWidget`.

### 3. `src/components/ListingCard.tsx` — realne raty zamiast współczynników
- Pobrać produkty przez `useFinancingProducts()`.
- Kredyt: `referenceInstallment(selectReferenceProduct(products,'CREDIT', listing.creditProductId), grossPln, 'CREDIT')`.
- Leasing: `referenceInstallment(selectReferenceProduct(products,'LEASING', listing.leasingProductId), netPln, 'LEASING')` (netPln = grossPln/VAT).
- Uszanować `creditAvailable`/`leasingAvailable` (gdy `false` → dana rata pomijana), jeśli pola
  są dostępne na typie `Listing`; w przeciwnym razie traktować jako dostępne i użyć produktu domyślnego.
- Zachować obecną semantykę netto/brutto wyświetlania (`priceType`) oraz strukturę JSX/tooltipy.
- **Fallback:** gdy produkty się ładują lub brak produktu → obecne przybliżenie współczynnikowe
  (bez pustego miejsca ani migotania). Zero zmian w layoucie.

### 4. `src/components/public/DynamicWidget.tsx` — realne raty w kafelku listingu
- Pobrać produkty przez `useFinancingProducts()`.
- Kredyt: `referenceInstallment(selectReferenceProduct(products,'CREDIT', v.creditProductId), v.price, 'CREDIT')`.
- Leasing: `referenceInstallment(selectReferenceProduct(products,'LEASING', v.leasingProductId), v.price/VAT, 'LEASING')`.
- **Fallback:** gdy produkty się ładują lub brak → obecne `computeMonthlyRates(v.price)`.
- Etykiety i układ chipów bez zmian (kredyt brutto, leasing netto, „Raty poglądowe…").

### 5. `backend/src/routes/widgets.ts` — dodatkowe pola do wyboru produktu
W formaterze listingów (oba miejsca) dodać: `creditProductId`, `leasingProductId`,
`creditAvailable`, `leasingAvailable`. Gałąź wynajmu bez zmian.

### 6. `src/components/FinancingCalculator.tsx` — domyślny stan 25 / 35 / 60
- `useState` początkowe: `months` 36→60, `initialPaymentPct` 10→25, `finalPaymentPct` 20→35.
- `useEffect` ustawiający domyślne po wyborze produktu (obecnie linie ~304-312):
  - `months = Math.max(minInstallments, Math.min(maxInstallments, 60))`.
  - fallback wpłaty własnej `10 → 25` (przy braku `offerInitialPaymentPct`); zachować override z oferty.
  - wykup: `hasBalloonPayment ? Math.max(vehisMinFinal, Math.min(35, maxFinalPayment)) : 0` (było 20).
- Nie zmieniać reszty logiki (selekcja produktu, suwaki, provider VEHIS/INBANK).

## Kryteria akceptacji

- Karty (widget + listing) pokazują raty kredyt/leasing policzone formułą PMT przy 25/35/60,
  gdy produkty istnieją; przy braku produktów → fallback do przybliżenia (bez regresji na dev).
- Kredyt bez `hasBalloonPayment` → wykup 0%; leasing → wykup 35% (clamp do `maxFinalPayment`).
- Kalkulator oferty otwiera się w stanie 25% wpłata / 35% wykup / 60 mc (clamp do limitów produktu).
- Dla produktu OWN rata na karcie == rata w kalkulatorze w stanie domyślnym (z dokładnością do
  konwencji netto/brutto karty).
- `tsc --noEmit` (frontend + backend) czysto. Jeden współdzielony request produktów na stronę.

## Poza zakresem

- Brak zmian w schemacie / migracji / backfillu.
- Brak wołania API partnerów (VEHIS/INBANK) przy renderze kart — dla nich rata z formuły.
