# Brief — E2: nadpisania produktów finansowych w programie pracowniczym

Data: 2026-09-17 · Repo: `car-scout` · Gałąź robocza: `dev` · Autor specyfikacji: Opus 5

## Cel

Firma partnerska ma móc narzucić, na jakich warunkach jej pracownicy widzą finansowanie: które
produkty są dostępne, kto może być stroną umowy, jaka jest minimalna i maksymalna wpłata własna
oraz jakie okresy umowy. Dziś model `EmployeeProductOverride` istnieje w bazie, ale:

- backoffice nie ma **żadnego** sposobu, by te reguły ustawić,
- kalkulator na karcie auta w portalu ich nie czyta — ma zaszyte 24–60 msc, wpłatę 0–45%, wykup
  1–30% i **wymyśloną stopę roczną 7,5%**.

Miara sukcesu: operator ustawia w panelu reguły programu, a pracownik tej firmy widzi w kalkulatorze
wyłącznie dopuszczone okresy i wpłaty, liczone stopą z konfiguracji produktu, nie z liczby w kodzie.

## Decyzje — nie renegocjuj

1. **Brak nadpisań = zero zmian w zachowaniu.** Gdy program nie ma ani jednego włączonego
   `EmployeeProductOverride`, endpoint zwraca `financing: null`, a portal działa dokładnie tak jak
   dziś, ze stopą 7,5%. To jest warunek bezpieczeństwa wdrożenia, nie uproszczenie.
2. **Stopa tylko jako suma.** Do portalu idzie jedna liczba `annualRatePct` = `referenceRate + margin`.
   Nigdy nie wysyłamy `margin`, `commission`, `provider`, `providerConfig` — to dane wewnętrzne,
   tak samo jak anonimizacja dostawcy najmu.
3. **Limity produktu są twardym sufitem.** Nadpisanie firmy może warunki tylko **zawęzić**:
   `maxDownPaymentPct` nigdy powyżej `FinancingProduct.maxInitialPayment`, okresy zawsze w przedziale
   `[minInstallments, maxInstallments]`. Próba rozszerzenia to błąd 400, nie ciche przycięcie.
4. **Kalkulator pozostaje szacunkiem.** Nie wprowadzamy rzeczywistej oferty finansującego ani
   harmonogramu. Etykieta „szacowana rata" zostaje.
5. Stos i proces bez zmian: Prisma + `prisma db push`, Fastify, Zod, Vitest, React.
   **Zmiany schematu nie są potrzebne** — model `EmployeeProductOverride` ma już wszystkie pola.
   Jeśli uznasz, że potrzeba nowego pola, zatrzymaj się i zapytaj.

## Stan obecny — zweryfikowany w kodzie

| Element | Miejsce | Uwagi |
|---|---|---|
| Model nadpisań | `prisma/schema.prisma` `EmployeeProductOverride` | `isEnabled`, `b2cStatus`, `allowedContractParties[]`, `minDownPaymentPct`, `maxDownPaymentPct`, `allowedPeriods Int[]` (pusta tablica = dziedziczenie) |
| Produkt finansowy | `prisma/schema.prisma` `FinancingProduct` | `category` ('CREDIT'/'LEASING'/'RENT'), `referenceRate`, `margin`, `maxInitialPayment`, `maxFinalPayment`, `minInstallments`, `maxInstallments`, `hasBalloonPayment`, `priority` |
| Jedyne dzisiejsze użycie nadpisań | `inquiries/employee-inquiries.routes.ts:454` | Sprawdzenie dopuszczalnej strony umowy przy zgłoszeniu — **nie ruszaj tej logiki** |
| Endpoint karty oferty | `catalog/employee-catalog.routes.ts:286` | Dwa scenariusze: `listing-<id>` ze stoku i rekord `EmployeeProgramOffer`. Payload składa `formatListingOffer` (linia 33) |
| Kalkulator w portalu | `apps/employee-portal/src/features/catalog/NewCarOfferDetailPage.tsx:69-160` | Stan: `contractType` (LEASING_B2B/CONSUMER), `months=36`, `downPaymentPct=20`, `residualPct=20`; `annualRate = 7.5` zaszyte w `useMemo` |
| Panel programu | `src/components/admin/employee-programs/CompanyDetailView.tsx`, `ProgramSettingsTab.tsx` | Wzorzec zakładek; serwis API w `src/services/employee-admin.service.ts` |
| Konwersja Decimal | `pricing/employee-pricing.utils.ts` `toNumeric` | Obsługuje `number`, `Decimal`, `string`. Wyeksportuj i użyj ponownie zamiast pisać drugą |
| Testy | `**/__tests__/*.isolated.test.ts`, runner `npm run test:employee` | Bramka markera jak w `auth/__tests__/employee-test-helper.ts` |

## Zakres 1 — wyliczanie konfiguracji (backend)

Nowy plik `backend/src/modules/employee-program/pricing/employee-financing-config.utils.ts`:

```ts
export interface EmployeeFinancingOption {
  productId: string;
  category: string;              // 'LEASING' | 'CREDIT'
  label: string;                 // product.name ?? etykieta kategorii
  allowedContractParties: ContractPartyOption[];
  b2cStatus: ProductAvailabilityStatus;
  minDownPaymentPct: number;
  maxDownPaymentPct: number;
  maxResidualPct: number;
  periods: number[];             // rosnąco, bez duplikatów
  annualRatePct: number;
}
export interface EmployeeFinancingConfig { options: EmployeeFinancingOption[]; }

export async function resolveProgramFinancingConfig(
  prisma: PrismaClient, programId: string
): Promise<EmployeeFinancingConfig | null>
```

Reguły:
1. Czytaj `employeeProductOverride.findMany({ where: { programId, isEnabled: true }, include: { financingProduct: true } })`.
2. Brak rekordów → `null`.
3. Odrzuć pozycję, gdy: `b2cStatus === 'UNAVAILABLE'`, `allowedContractParties` puste,
   kategoria produktu to `'RENT'` (najem ma własną ścieżkę matryc).
4. `minDownPaymentPct` = `override.minDownPaymentPct ?? 0`.
   `maxDownPaymentPct` = `min(override.maxDownPaymentPct ?? product.maxInitialPayment, product.maxInitialPayment)`.
   Gdy `min > max` → pomiń pozycję i zapisz ostrzeżenie w logu (błędna konfiguracja nie może wywalić karty).
5. `maxResidualPct` = `product.hasBalloonPayment ? product.maxFinalPayment : 0`.
6. `periods`: gdy `override.allowedPeriods` niepuste — te wartości przefiltrowane do przedziału
   `[product.minInstallments, product.maxInstallments]`; gdy puste — kolejne wielokrotności 12
   z tego przedziału (np. 24, 36, 48, 60). Pusty wynik → pomiń pozycję z ostrzeżeniem.
7. `annualRatePct` = `referenceRate + margin`, zaokrąglone do dwóch miejsc.
8. Sortowanie: `priority` malejąco, potem `category` rosnąco.
9. Wartości `Decimal` konwertuj przez wyeksportowane `toNumeric`.

## Zakres 2 — konfiguracja w karcie oferty (backend)

W `GET /api/employee/offers/:offerId` dołóż do odpowiedzi pole `financing: EmployeeFinancingConfig | null`
— w **obu** scenariuszach (`listing-…` i rekord `EmployeeProgramOffer`), zaraz obok `benefit`.
Jedno wywołanie `resolveProgramFinancingConfig` na żądanie.

**Nie dotykaj** `GET /api/employee/offers` (lista) — payload listy zostaje bez zmian.

## Zakres 3 — zarządzanie w panelu (backend + UI)

Endpointy w `admin/employee-admin.routes.ts`, `preHandler: adminAuth`:

- `GET /api/admin/employee-programs/programs/:programId/product-overrides`
  → `{ products: [{ productId, category, name, limits: { maxInitialPayment, maxFinalPayment, minInstallments, maxInstallments, hasBalloonPayment }, override: {…} | null }] }`
  Lista wszystkich produktów o kategorii `LEASING` i `CREDIT` z dołączonym nadpisaniem programu.
- `PUT /api/admin/employee-programs/programs/:programId/product-overrides`
  body: `{ overrides: [{ financingProductId, isEnabled, b2cStatus, allowedContractParties[], minDownPaymentPct|null, maxDownPaymentPct|null, allowedPeriods: number[] }] }`
  Semantyka pełnego zastąpienia w jednej transakcji: `deleteMany` nadpisań programu spoza listy,
  `upsert` pozostałych. Walidacja Zod + reguły biznesowe, każde naruszenie to 400 z czytelnym
  komunikatem po polsku:
  - `minDownPaymentPct` i `maxDownPaymentPct` w zakresie 0–100, `min <= max`;
  - `maxDownPaymentPct <= product.maxInitialPayment`;
  - każdy okres w `[minInstallments, maxInstallments]`, maks. 12 pozycji, bez duplikatów;
  - `allowedContractParties` niepuste, gdy `isEnabled === true`;
  - nieznany `financingProductId` lub produkt kategorii `RENT` → 400.

UI: nowa zakładka **„Produkty finansowe"** w widoku programu (wzorzec zakładek z `CompanyDetailView`).
Tabela produktów: przełącznik „dostępny", checkboxy stron umowy, pola min/max wpłaty w %, chipsy
okresów z zakresu produktu, jeden przycisk „Zapisz" wysyłający całość jednym `PUT`. Pod polami
widoczna podpowiedź z limitem produktu (np. „maks. wpłata wg produktu: 45%").
Metody API w `src/services/employee-admin.service.ts`.

## Zakres 4 — kalkulator w portalu

W `NewCarOfferDetailPage.tsx`, gdy `offer.financing` ma co najmniej jedną pozycję:

- wybór formy finansowania budowany z `options` (kategoria `LEASING` → „Leasing operacyjny (B2B)",
  `CREDIT` → „Kredyt / finansowanie konsumenckie"); domyślnie pierwsza pozycja;
- `months` wyłącznie z `periods` wybranej opcji (domyślnie wartość najbliższa 36);
- chipsy wpłaty własnej przycięte do `[minDownPaymentPct, maxDownPaymentPct]`, wartość domyślna
  wpasowana w ten przedział;
- `residualPct` ograniczony przez `maxResidualPct`; gdy równy 0 — sekcja wykupu ukryta;
- stopa roczna z `annualRatePct` zamiast zaszytego 7.5;
- zmiana opcji przelicza i w razie potrzeby koryguje bieżące wartości, bez pustego ekranu.

Gdy `offer.financing` jest `null` lub ma pustą listę — zachowanie **identyczne jak dziś**.
Do tekstu `inquiryInitialNotes` dopisz jedną linię z etykietą wybranego produktu.

## Bramka testowa

Backend (`npm run test:employee`):
- program bez nadpisań → `financing: null` w karcie oferty;
- włączone nadpisanie → w `options` tylko produkty włączone; `UNAVAILABLE` i `RENT` odfiltrowane;
- okresy spoza zakresu produktu odcięte; `maxDownPaymentPct` przycięty limitem produktu;
- payload **nie zawiera** `margin`, `commission`, `provider`, `providerConfig` (asercja na treści JSON);
- błędna konfiguracja (min > max, pusta lista okresów) nie wywraca żądania — pozycja znika;
- `PUT` bez uprawnień → 401/403; przekroczenie limitu produktu → 400; pełne zastąpienie usuwa
  nadpisanie pominięte w payloadzie.

Portal (`npm test` w `apps/employee-portal`):
- z konfiguracją: renderują się wyłącznie dopuszczone okresy i wpłaty, rata policzona stopą z konfiguracji;
- bez konfiguracji: zachowanie i wynik jak przed zmianą.

Całość: `npx tsc --noEmit` w `backend/`, `apps/employee-portal/` i katalogu głównym; `npm run lint`
i `npm run build` w portalu.

## Zasady wykonania

- Commit(y) na gałęzi `dev`, opisowe komunikaty w konwencji repo.
- Bez zmian schematu Prisma. Bez nowych zależności npm.
- Nie ruszaj logiki zgłoszeń, najmu, matryc ani modułu resetu hasła.
- Raport końcowy: lista zmienionych plików, wynik każdej komendy z bramki, każde odstępstwo z uzasadnieniem.
