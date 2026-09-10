# Raport Baseline - Stan Początkowy Repozytorium (Etap P0 - Rewizja 2)

**Data wykonania:** 2026-09-10  
**Środowisko:** macOS, Node.js 20+  
**Gałąź bazowa:** `feat/employee-portal` (utworzona z `dev` na commit `8531642c0acdf5bed0eb817d48aacc06fd1f6bac`)  
**Status repozytorium:** Brak modyfikacji w plikach śledzonych (`tracked`). Nowe, nieśledzone pliki dokumentacji w `docs/employee-program/`.  

---

## 1. Zestawienie wyników bazowych (Baseline Matrix)

| Komenda | Cel weryfikacji | Wynik | Szczegóły / Status |
| :--- | :--- | :--- | :--- |
| `npm run build` | Kompilacja i bundling frontendu publicznej Motolii (Vite/Rollup) | **PASS** (kod wyjścia 0) | Czas: 5.43s. 89 chunków wygenerowanych pomyślnie. |
| `npm --prefix backend run build` | Kompilacja TypeScript backendu (`tsc`) | **PASS** (kod wyjścia 0) | Czas: ~4s. Zero błędów typowania w backendzie. |
| `npm run test -- --run` | Testy jednostkowe i komponentowe frontendu (Vitest) | **PASS** (kod wyjścia 0) | 16/16 plików testowych (64/64 testów zaliczonych). Zero błędów. |
| `npm --prefix backend test -- src/middleware/__tests__/permissions.test.ts` | Próbny test jednostkowy backendu (Vitest) | **PASS** (kod wyjścia 0) | 1/1 plik testowy (11/11 testów zaliczonych). Zero błędów. |
| `npm run lint` | Statyczna analiza kodu ESLint (frontend + backend) | **FAIL** (kod wyjścia 1) | **Błędy zastane (pre-existing):** 2 błędy i 55 ostrzeżeń. Nie blokują prac nad nowym modułem. |
| `git diff --check` | Weryfikacja białych znaków i konfliktów | **PASS** (kod wyjścia 0) | Brak błędów formatowania git. |

---

## 2. Analiza statyczna ESLint - Rozróżnienie błędów zastanych i blockerów

Komenda `npm run lint` zakończyła się kodem błędu 1 z powodu problemów istniejących już w gałęzi bazowej `dev`:

### A. Zastane błędy krytyczne ESLint (Pre-existing errors):
* Plik: `backend/src/services/rental-stock-parser.ts`
  * Linia 65:30: `error Unnecessary escape character: \[ no-useless-escape`
  * Linia 66:29: `error Unnecessary escape character: \[ no-useless-escape`
* Przyczyna: Zbędny ukośnik ucieczki przed nawiasem kwadratowym w wyrażeniu regularnym parsera stocku najmu.
* Wpływ na moduł pracowniczy: **Brak wpływu (nie jest blockerem)**. Moduł programu pracowniczego w `apps/employee-portal/` oraz `backend/src/modules/employee-program/` będzie posiadał własne testy i konfigurację lintera, a ten plik nie jest częścią nowego kodu.

### B. Zastane ostrzeżenia (55 warnings):
* Głównie ostrzeżenia `react-hooks/exhaustive-deps` w plikach takich jak `src/pages/ConditionPage.tsx`, `src/pages/SearchPage.tsx`, `src/pages/MotoliaB2BPage.tsx` oraz `src/pages/admin/pipeline/components/OfferEditorSection.tsx`.
* Żadne z nich nie blokuje procesu budowania produkcyjnego (`npm run build` ignoruje ostrzeżenia ESLint).

---

## 3. Rzeczywisty audyt czyszczenia danych w testach integracyjnych backendu

Weryfikacja kodu testów w `backend/src/routes/__tests__/` pod kątem operacji na bazie danych:

1. **Rzeczywiste zachowanie `backend/src/routes/__tests__/auth-and-users.test.ts` (linie 21-26 oraz 40-56):**
   * Plik ten w `beforeAll` i `afterAll` czyści rekordy **wyłącznie z filtrem testowym**:
     * `await app.prisma.importLog.deleteMany({ where: { user: { email: { in: testEmailsToCleanup } } } });`
     * `await app.prisma.user.deleteMany({ where: { email: { in: testEmailsToCleanup } } });`
   * Nie występuje w nim bezwarunkowe `deleteMany({})` bez klauzuli `where`.
2. **Zachowanie w pozostałych testach integracyjnych:**
   * Testy operujące na ogłoszeniach i stronach CMS (np. `render.test.ts`, `hero-banners.test.ts`, `seo-content.test.ts`) również stosują selektywne filtry danych syntetycznych, np.:
     * `where: { make: 'TEST_RENDER' }`
     * `where: { altText: { startsWith: 'TEST_BANNER' } }`
     * `where: { urlPath: { startsWith: '/samochody/test-seo-content' } }`
3. **Rzeczywiste ryzyko i uzasadnienie potrzeby dedykowanej bazy testowej:**
   * Mimo że istniejące testy posiadają filtry na dane testowe, uruchamianie testów integracyjnych bezpośrednio na wspólnej lokalnej bazie deweloperskiej niesie ryzyko:
     * Kolizji unikalności (np. jeśli lokalna baza zawiera już rekord o testowym e-mailu lub slug'u).
     * Zakłócenia asercji oczekujących pustego stanu początkowego w wybranych scenariuszach.
     * Zanieczyszczenia lokalnego środowiska deweloperskiego nieusuniętymi rekordami w przypadku przerwania testu błędem.
   * W związku z tym potwierdzono zasadę: **testy integracyjne Prisma dla nowego modułu programu pracowniczego w etapie P2/P3 będą uruchamiane wyłącznie na dedykowanej bazie testowej (np. `carscout_test`)**.
   * Testy jednostkowe tworzone w etapie P1 będą w 100% odizolowane od Postgresa (działanie w pamięci).

---

## 4. Status zakończenia etapu P0

Etap **P0 (Discovery, Baseline i ADR)** został w pełni zrewidowany:
1. Potwierdzono stan gita: brak zmian w kodzie śledzonym, pliki P0 w `docs/employee-program/`.
2. Zaktualizowano raport baseline o dokładną analizę kodu testów (sprostowano nieprawdziwe twierdzenie o bezwarunkowym `deleteMany` i usunięto zbędny opis connection stringa).
3. Usunięto nieistniejącą składnię `@@foreignKey` i zastąpiono ją w 100% poprawnymi relacjami Prisma 5.22.0.
4. Schemat Prisma z `docs/employee-program/architecture.md` pomyślnie przeszedł walidację `prisma validate` w połączeniu z istniejącym schematem w izolowanym pliku tymczasowym (kod 0, zero ostrzeżeń).
5. Zdefiniowano precyzyjny kontrakt cache Redis, wielodostawczość matryc, hierarchię kwalifikacji B2C oraz bezpieczną architekturę runtime config w Dockerze.
