# Spec: raty referencyjne odporne na błędy partnera (429) — PILNE, przed cronem 03:00

Data: 2026-10-01 · Gałąź: `fix/reference-keep-on-partner-error` (od `origin/main` = `36c3348`).

## Incydent

Po `36c3348` (klucz deduplikacji w nocnym przeliczeniu zawiera rocznik i przebieg) pełne przeliczenie wysłało
więcej zapytań do partnerów. Vehis odpowiedział **HTTP 429** na 530 zapytań, Inbank 422 na 76 (kwoty > ~151 tys. —
osobny problem konfiguracyjny, poza zakresem). `computeReferenceInstallments` przy błędzie partnera zapisuje
`null` → **560 ofert straciło ratę leasingu na listingu** (1939 → 1627). Przywrócone ręcznie skryptem; bez tej
poprawki przebieg o 03:00 powtórzy problem.

## Zmiany (`backend/src/services/financing-calc.service.ts`)

1. **Status partnera w błędzie.** `FinancingCalcError` — opcjonalny 3. argument konstruktora `providerStatus?: number`
   (pole publiczne). W obu miejscach `throw new FinancingCalcError(502, { error: 'Provider request failed' })` po
   `!response.ok` (INBANK ~L140, VEHIS ~L311) przekazać `response.status`. Odpowiedź HTTP route bez zmian (ten sam kod i body).

2. **Ponawianie przy 429** w `calcInstallmentForProduct` (gałąź partnera): jeśli błąd to `FinancingCalcError` z
   `providerStatus === 429`, ponów do 3 razy z odczekaniem 2 s, 5 s, 10 s. Inne błędy — bez ponawiania.

3. **Błąd partnera nie kasuje poprzedniej raty.** Rozróżnić „brak kwalifikującego się produktu” (wynik `null`
   — legalny, zapisujemy `null` jak dziś) od „wszyscy kandydaci zwrócili błąd partnera” (zostaw poprzednią wartość):
   - `calcInstallmentForProduct` zwraca przy błędzie partnera (po wyczerpaniu ponowień) znacznik błędu zamiast `null`
     — np. typ wyniku `number | null | typeof PARTNER_ERROR` (stała `Symbol`) albo obiekt `{ value, error }`;
     wpis w lokalnej mapie `cache` przebiegu przechowuje ten sam typ.
   - `firstSuccessfulInstallment` zwraca `{ value: number | null, partnerError: boolean }`: `partnerError = true`, gdy
     żaden kandydat nie dał liczby, a przynajmniej jeden zakończył się błędem partnera.
   - `computeReferenceInstallments`: w `listing.update` pole `referenceCreditInstallment` / `referenceLeasingInstallment`
     ustawiać tylko, gdy dla danej nogi `partnerError === false`; przy `partnerError` pominąć pole (poprzednia wartość
     zostaje). `referenceCalcAt` ustawiać jak dziś. Zwracana wartość funkcji: dla nogi z błędem — poprzednia wartość z
     bazy (dociągnąć w `select`) albo `null`; ważne, żeby nie zapisywać.
   - Gałąź OWN i brak połączenia (`connection` nieznalezione) — bez zmian (to nie błąd partnera).

4. **Łagodniejsze tempo pełnego przeliczenia:** `RECOMPUTE_CONCURRENCY` 4 → 2, `RECOMPUTE_DELAY_MS` 150 → 400.
   Przebieg potrwa dłużej (szac. 10–20 min dla ~2,5 tys. ofert) — akceptowalne w nocy.

## Testy (`backend/src/routes/__tests__/financing-reference-quotes.test.ts`, mock `fetch` jak tam)

- oferta z istniejącą `referenceLeasingInstallment = 1234`; partner leasingu odpowiada 500 → po
  `computeReferenceInstallments` wartość w bazie nadal `1234`, `referenceCalcAt` zaktualizowane;
- partner odpowiada 429, potem 200 → rata zapisana, `fetch` wywołany 2 razy (użyj `vi.useFakeTimers()` albo
  wstrzyknij krótkie opóźnienia — test nie może trwać 2 s+; dopuszczalne wydzielenie tablicy opóźnień do stałej
  eksportowanej / nadpisywanej w teście);
- partner 422 (nie 429) → bez ponowienia (1 wywołanie), poprzednia wartość zostaje;
- oferta bez kwalifikującego się produktu (np. `leasingAvailable: false`) → `null` jak dziś;
- istniejące testy pliku przechodzą.

## Weryfikacja

Z `backend/`: `npx tsc --noEmit`; `npx vitest run src/routes/__tests__/financing-reference-quotes.test.ts src/routes/__tests__/financing-calc-cache.test.ts src/routes/__tests__/financing-logging.test.ts`; `graphify update .`.
