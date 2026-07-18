# Audyt CRO motolia.pl — priorytetyzowana lista poprawek

Data: 2026-07-18 · Zakres: repo car-scout (brand=motolia), serwis produkcyjny, GA4, Clarity, benchmark konkurencji (superauto.pl, carleasepolska.pl, autoplac.pl, automarket.pl, findcar.pl), persony z Knowledge_Base.

---

## 1. Diagnoza — dlaczego dużo ruchu, mało leadów

**Kluczowe liczby (GA4, 20.06–17.07):**

| Metryka | Wartość | Komentarz |
|---|---|---|
| Sesje | 23 167 | Organic Search 75,5%, Direct 21,5% (TV), zero paid |
| Engagement rate | 77,9% | Realny bounce ~22% — ruch jest dobry jakościowo |
| Śr. czas zaangażowania | 4 min 25 s | Użytkownicy czytają oferty, używają kalkulatora |
| `form_start` | 155 | — |
| `generate_lead` | **61** | **CR = 0,26%** (branżowy benchmark classified/lead-gen: 1–3%) |
| Porzucenia formularza | **~60%** | 155 form_start → 61 generate_lead |
| Landing „/" | 10 684 sesji, 38 konwersji (0,36%) | strona główna = landing kampanii TV |
| Landing /samochody | 5 566 sesji, 9 konwersji (0,16%) | najsłabszy stosunek ruch/konwersja |

**Wnioski nadrzędne:**

1. **Problem nie leży w ruchu ani w cenach — leży w lejku na stronie.** Użytkownicy angażują się (4:25 min), ale bardzo niewielu dochodzi do formularza, a z tych, którzy zaczną, 60% odpada.
2. **Połowa konwersji jest niewidoczna.** Żaden link `tel:` w serwisie nie wysyła eventu — przy 466 telefonach/mies. w CRM kanał telefoniczny (dominujący w automotive) jest w analityce niemierzalny. Realna skuteczność serwisu jest wyższa, niż pokazują raporty, ale nie wiadomo o ile i skąd.
3. **Bounce rate 88,4% z dashboardu to artefakt pomiaru, nie realne zachowanie.** GA4 pokazuje engagement 77,9%. Dashboard liczy odbicia z pageview SPA; dodatkowo GTM ładuje się dopiero po interakcji lub 5 s, więc sesje „szybkich odbić" w ogóle nie trafiają do GA4 (a do Clarity tak — stąd rozjazd Clarity ~10x vs GA4; w Clarity siedzą też boty).
4. **Kampania TV ląduje na stronie nieprzygotowanej na ten ruch**: brak social proof, callback dopiero na dole strony, a /samochody wita najtańszymi/najstarszymi autami (domyślne sortowanie price_asc → Ford Focus 2008, 243 tys. km jako pierwsza karta).

---

## 2. P0 — Quick wins (1–3 dni, wdrożyć najpierw)

### P0.1 Tracking kliknięć w telefon ⚡ (pomiar, nie CRO — ale warunkuje wszystko)
- **Problem:** żaden `tel:` link nie wysyła eventu do dataLayer (grep: zero wyników poza formularzami).
- **Fix:** wspólny handler `onClick` → `dataLayer.push({event:'phone_click', location:'header|sticky|contact|footer|offer_sidebar'})` + trigger i tag w GTM jako key event.
- **Pliki:** `src/components/Header.tsx` (~216–247), `src/components/Footer.tsx` (~202), `src/pages/MotoliaContactPage.tsx`, `src/pages/ListingDetailPage.tsx` (sticky bar, linia ~1312), `src/pages/RentalDetailPage.tsx` (~592).
- Impact: wysoki · Effort: niski

### P0.2 Usunąć wymuszoną zgodę marketingową z formularza leadowego
- **Problem:** `consentMarketing` jest `required` (`z.boolean().refine(v => v === true)`) — nie da się zapytać o auto bez zgody na marketing. Bariera konwersji (część z 60% porzuceń) + ryzyko prawne (zgoda marketingowa musi być dobrowolna — art. 7 RODO, UŚUDE).
- **Fix:** zgoda marketingowa opcjonalna; wymagana tylko zgoda na przetwarzanie w celu obsługi zapytania.
- **Pliki:** `src/pages/LeadFormPage.tsx` (linia ~43), `src/pages/RentalLeadFormPage.tsx` (~33).
- Impact: wysoki · Effort: bardzo niski

### ~~P0.3 Przycisk „Odśwież zdjęcia (Admin)"~~ — FAŁSZYWY ALARM (zweryfikowano)
- Przycisk jest poprawnie ukryty za `canManage` (admin/manager). Był widoczny w audycie, bo przeglądarka audytująca miała aktywną sesję admina. Bez zmian w kodzie.

### ~~P0.4 „Informacje o dealerze: Poznaniu"~~ — PROBLEM DANYCH, nie kodu (zweryfikowano)
- „Poznaniu" to wartość pola `dealer_name` w rekordzie dealera (import CSFlow, grupabemo) — a karta „Informacje o dealerze" wyświetla się tylko platform userom; anonimowy użytkownik widzi poprawne „Lokalizacja pojazdu: Poznań". **Do zrobienia:** poprawić nazwę dealera w panelu/CRM.
- Przy okazji: rekord dealera ma `google_rating` i `google_reviews_count`, ale pokazywane są tylko platform userom (`ListingDetailPage.tsx:1283`) — odsłonięcie ich publicznie to gotowy social proof (patrz P1.3 / wzorzec findcar).

### P0.5 Zmienić domyślne sortowanie /samochody z `price_asc`
- **Problem:** pierwsza strona katalogu (największy landing organiczny: 5,5 tys. sesji, CR 0,16%) otwiera się na Ford Focus 2008 (243 tys. km), Opel Corsa 2011… Pierwsze wrażenie „szrot", szczególnie dla ruchu z kampanii TV „nowe i używane w finansowaniu".
- **Fix:** bez deployu — zmiana `AppSettings.defaultSortCars` w panelu admina (np. `year_desc` jak na /kredyt, wprowadzone tam po audycie SEO) albo sortowanie „polecane" mieszające roczniki/segmenty. Schemat: `backend/prisma/schema.prisma:328`, fallbacki: `backend/src/routes/render.ts:126`, `src/pages/SearchPage.tsx:212`.
- Impact: wysoki · Effort: zerowy (ustawienie) / niski (nowy tryb „polecane")

### P0.6 GTM: skrócić/wyeliminować lazy-load
- **Problem:** GTM wstrzykiwany po pierwszej interakcji lub po 5 s (`src/components/seo/SeoManager.tsx:96–136`) → sesje krótsze niż 5 s bez interakcji są niewidoczne w GA4; dane o realnym bounce z TV są zaniżone/zafałszowane.
- **Fix:** ładować GTM natychmiast po consent (Consent Mode v2 już jest w `src/lib/consent.ts`), ewentualnie `requestIdleCallback` zamiast 5 s. Zmierzyć wpływ na LCP przed/po.
- Impact: wysoki (jakość decyzji) · Effort: niski

---

## 3. P1 — Główne dźwignie konwersji (1–2 tygodnie)

### P1.1 Wielopoziomowe mikro-konwersje na stronie oferty (wzorzec findcar.pl)
- **Problem:** jedyna ścieżka z oferty to „Zapytaj o ofertę" → **osobna strona** z 5 wymaganymi polami + 2 checkboxy + captcha. Desktop-sidebar nie ma w ogóle CTA telefonicznego. CallbackForm (1 pole) jest dopiero na samym dole strony.
- **Fix:** w sidebarze (desktop) i sticky barze (mobile) trzy poziomy zaangażowania obok siebie:
  1. **„Zadzwoń"** (tel:, z trackingiem z P0.1),
  2. **„Zamów rozmowę"** — inline pole telefonu (istniejący `CallbackForm`, submitQuickLead z `form_id: offer_sidebar_callback` + kontekst pojazdu!),
  3. „Wyślij zapytanie" — dotychczasowy pełny formularz.
- Quick-callback z kontekstem pojazdu jest kluczowy: persona „Kowalski" nie chce pisać wiadomości, chce, żeby ktoś oddzwonił i powiedział, ile rata.
- **Pliki:** `src/pages/ListingDetailPage.tsx` (sidebar + sticky), `src/components/CallbackForm.tsx` (przyjąć `listingId`).
- Impact: bardzo wysoki · Effort: średni

### P1.2 Odchudzić pełny formularz (60% porzuceń!)
- Telefon zamiast e-maila jako pole główne (e-mail opcjonalny) — CRM i tak dzwoni; persony pytają głosowo.
- Usunąć wymóg „Wiadomość min. 10 znaków" — jest prefill, ale wymóg blokuje; zrobić opcjonalne.
- Turnstile w trybie invisible/managed zamiast widocznego widgetu.
- Rozważyć osadzenie formularza inline na stronie oferty (sekcja pod kalkulatorem) zamiast przejścia na `/lead` — jeden krok mniej. Przy okazji ujednolicić route (CTA prowadzi dziś na legacy `/listing/:id/lead` zamiast `/oferta/:slug/lead`).
- **Pliki:** `src/pages/LeadFormPage.tsx`, `src/pages/RentalLeadFormPage.tsx`.
- Impact: bardzo wysoki · Effort: średni

### P1.3 Strona główna jako landing TV
- **Hero:** dodać inline pole „Zostaw numer — oddzwonimy w 15 minut" (obietnica już jest w hero jako tekst, ale bez pola; formularz callback jest dopiero na dole — 10 ekranów niżej). Ruch z TV (Direct, 5 tys. sesji/28 dni) to widzowie z telefonem w ręku.
- **Social proof:** brak jakichkolwiek opinii (superauto: „4153 opinie Google" nad headerem; findcar: rating per dealer). Dodać widget ocen Google + liczbę obsłużonych klientów + realne opinie przy sekcji CTA.
- **Spójność z TV:** sekcja/baner nawiązujący do spotu („Widziałeś nas w TV? Oto oferty ze spotu") z boardowanymi autami.
- **Pliki:** `src/pages/MotoliaHomePage.tsx` (hero ~227–241, sekcja #kontakt ~621), CMS `FeatureTilesSection`.
- Impact: wysoki · Effort: średni

### P1.4 Floating callback widget — audyt skuteczności
- Na prod jest pływający żółty przycisk (prawy dolny róg). Zweryfikować w Clarity, czy jest klikany, czy generuje dead-clicki (strona główna: 1 157 dead clicks, /samochody: 1 320 — do przejrzenia w nagraniach, częsty winowajca to elementy wyglądające na klikalne karty/piguły filtrów).
- Impact: średni · Effort: niski (analiza) 

### P1.5 Rata jako pierwszy komunikat cenowy — konsekwentnie
- Karty na /samochody już pokazują „Kredyt od 171 zł/mc" (dobrze — zgodne z personą „pyta o ratę zanim o cokolwiek"). Upewnić się, że każda karta ma ratę (backend `referenceCreditInstallment`), a na stronie oferty rata z kalkulatora jest widoczna above the fold także na mobile.
- Impact: średni · Effort: niski

---

## 4. P2 — Zaufanie, zgodność, technika (2–4 tygodnie)

1. **Omnibus:** przy przekreślonych cenach („-23%", „Oszczędzasz 23 016 zł") brak „najniższej ceny z 30 dni" — automarket i findcar pokazują ją przy każdej ofercie; to wymóg prawny przy komunikowaniu obniżek, nie tylko dobra praktyka.
2. **Lead magnet „Pobierz ofertę PDF"** (wzorzec carleasepolska) — mikro-konwersja bez telefonu, z e-mailem do nurture.
3. **„Auto w rozliczeniu" (trade-in)** — CTA na stronie oferty (superauto/carleasepolska); dodatkowa dźwignia dla Kowalskiego wymieniającego auto.
4. **Zgody RODO na szybkich formularzach:** callback/kontakt/home nie mają żadnego checkboxa (pełny formularz ma 2) — dodać jedną zgodę obsługową (spójność + compliance), ale NIE marketingową.
5. **Wydajność mobile:** Lighthouse (czerwiec, dev): LCP 5,7 s / FCP 3,5 s na mobile — 74% ruchu to mobile (Clarity). Zweryfikować na prod (PSI/CrUX w GSC) po zmianie GTM; cel LCP < 2,5 s.
6. **CSP wyłączone** (`backend/src/app.ts:214–220`) — przywrócić politykę z whitelistą GTM/GA4/Clarity/Turnstile (bezpieczeństwo, nie CRO).
7. **Clarity vs GA4 — higiena danych:** Clarity raportuje ~10x więcej sesji niż GA4 (dashboard, 3 dni: 18 988 sesji, tylko 95 wykluczonych botów, **1,01 strony/sesję, 99,93% nowych użytkowników, active time 44 s**) — ten profil wskazuje na masowy, nieodfiltrowany ruch botów (m.in. crawlery AI wykonujące JS) i/lub sesje, których GA4 nie widzi przez lazy-load GTM. Po naprawie GTM (P0.6) porównać ponownie; skonfigurować wykluczenia botów/IP w Clarity; do tego czasu Clarity traktować wyłącznie kierunkowo (nagrania, heatmapy — tak; liczby bezwzględne — nie).
8. **Historia pojazdu / redukcja ryzyka na ofercie używanego auta** (wzorzec automarket: 75-pkt inspekcja, historia serwisowa): sekcja „Stan i historia" (przebieg potwierdzony, liczba właścicieli, raport VIN — chips „Raport historii i VIN" już istnieje na formularzu, przenieść wyżej na ofertę).

---

## 5. Kolejność wdrożenia i pomiar sukcesu

**Tydzień 1 (P0):** tracking telefonów → zgoda marketingowa → admin button/literówka → sortowanie → GTM.
**Tydzień 2–3 (P1):** mikro-konwersje na ofercie + odchudzony formularz.
**Tydzień 3–4 (P1.3–P2):** strona główna/TV, social proof, Omnibus.

**Kryteria sukcesu (mierzone po P0, żeby mieć bazę):**
- CR formularzy: 0,26% → cel 0,8–1% w 6 tygodni (≈ 3–4x leadów przy tym samym ruchu).
- Porzucenia form_start→generate_lead: 60% → < 35%.
- `phone_click`: baza po 2 tyg. pomiaru; cel: przypisanie ≥ 50% telefonów z CRM do źródła w serwisie.
- Mobile LCP < 2,5 s (CrUX).

**Uwaga metodologiczna:** wdrażać P0 w całości (to pomiar + higiena), ale zmiany P1 w miarę możliwości po kolei lub A/B (np. sortowanie i mikro-konwersje osobno), żeby dało się przypisać efekt.

---

## 6. Źródła i dowody
- GA4 property motolia.pl (a368056036p504637386): raporty Strona docelowa, Zdarzenia, Traffic acquisition (20.06–17.07.2026).
- Microsoft Clarity (MCP): popularne strony, rage/dead clicks, urządzenia, kanały (8–18.07.2026).
- Repo car-scout: pliki wskazane przy każdej rekomendacji.
- Zrzuty prod: strona główna, /samochody, oferta Ford Focus Titanium 2017, formularz leadowy (18.07.2026).
- Benchmark: superauto.pl, carleasepolska.pl, automarket.pl, findcar.pl (autoplac.pl — czysty SPA, nieoceniony bez JS).
- Persony i obiekcje: Knowledge_Base (personas.md, objections.md).
