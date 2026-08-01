# Plan Architektury i Wdrożenia: Kalkulator Finansowania Standalone & Strategia Contentowa (H2 2026)

**Data aktualizacji:** 31.07.2026  
**Status:** Zatwierdzony przez użytkownika – W trakcie wdrożenia  
**Dokumenty źródłowe:**  
- [docs/BRIEF_AG_KALKULATOR_STANDALONE.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/docs/BRIEF_AG_KALKULATOR_STANDALONE.md)  
- [docs/STRATEGIA_LINKI_I_CONTENT_2026-H2.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/docs/STRATEGIA_LINKI_I_CONTENT_2026-H2.md)  

---

## 1. Cel Biznesowy i Kontekst

Kalkulator finansowania na `motolia.pl` został rozbudowany o tryb samodzielnego narzędzia dla osób szukających auta poza naszą bazą (OTOMOTO, dealer, OLX) oraz użytkowników szukających fraz narzędziowych („kalkulator leasingu”, „kalkulator kredytu samochodowego”, „kalkulator najmu”).

---

## 2. Rozstrzygnięte Decyzje i Architektura

1. **Adres URL strony:** `/kalkulator-rat` (self-canonical, indeksowalna w sitemap.xml).
2. **Zakres suwaka ceny auta:** od 5 000 zł do 500 000 zł (domyślna cena: 100 000 zł brutto).
3. **Formularz kontaktowy leada & Lead Model:**  
   - Integracja z modalem `CallbackForm` (z dedykowanymi identyfikatorami `formId` w konwencji `snake_case`).
   - Zapis danych finansowych wykorzystuje natywne pola modelu `Lead` w bazie PostgreSQL (`financingAmount`, `financingDownPayment`, `financingPeriod`, `financingInstallment`, `financingFinalPayment`, `financingProductId`), z opcjonalnym polem `listingId=null`.
   - **Identyfikatory `formId` per miejsce wywołania:**
     - Strona główna kalkulatora `/kalkulator-rat`: `kalkulator_rat_callback`
     - Filar `/leasing`: `leasing_pillar_calculator_callback`
     - Filar `/kredyt`: `credit_pillar_calculator_callback`
     - Filar `/wynajem-dlugoterminowy`: `rental_pillar_calculator_callback`
     - Filar `/dla-firm`: `business_pillar_calculator_callback`
4. **Moduł Ubezpieczeń (v1):** Zbieranie intencji klienta poprzez checkbox w formularzu:  
   `[x] Dołącz bezpłatną wycenę pakietu ubezpieczenia OC/AC/GAP`.
5. **Wymogi informacyjne dla kredytu (RRSO, całkowity koszt, przykład reprezentatywny):**  
   Prezentacja raty kredytowej z zachowaniem pełnego standardu informacyjnego z karty oferty: wyliczone RRSO, całkowita kwota do zapłaty, oprocentowanie stałe/zmienne oraz interaktywny modal z Przykładem Reprezentatywnym.

---

## 3. Komponenty i Zmiany w Kodzie

- **Frontend:**
  - `src/components/financing/useFinancingCalc.ts` (wspólny hook kalkulacji)
  - `src/components/financing/StandaloneFinancingCalculator.tsx` (samodzielne narzędzie)
  - `src/pages/CalculatorPage.tsx` (strona `/kalkulator-rat` z artykułem SEO pod frazy narzędziowe)
  - Integracja w `src/components/DynamicFinancingContent.tsx` i `src/components/RentalFinancingContent.tsx`
- **Backend:**
  - `backend/src/routes/leads.ts` – obsługa zapisywania pól finansowych w leadach bez `listingId`
  - `backend/src/services/seo-meta.ts` – rejestracja metadanych i JSON-LD dla `/kalkulator-rat`
  - `backend/src/routes/render.ts` – obsługa SSR oraz `LISTINGLESS_STATIC_ROUTES`
  - `backend/src/routes/seo.ts` – sitemap.xml
