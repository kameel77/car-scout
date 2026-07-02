# Audyt techniczny SEO + GEO — motolia.pl (2026-07-02)

Kontekst: GSC pokazuje ~3,09 tys. znanych stron i tylko **7 zindeksowanych** (stan na 12.06.2026 — ten sam dzień, w którym wdrożono `/api/render`, commit `9bf7ba0`).

> **Status wdrożenia (2026-07-02):** Fazy 1–3 wdrożone na `dev` (commit `d7920df` + treść finansowa na wariantach). Cloudflare: blokada AI crawlers wyłączona na produkcji. Do zrobienia: promocja dev → staging → main, resubmit sitemapy w GSC. Plan średnioterminowy: sekcja 6 poniżej.

---

## 1. Co już działa dobrze (nie ruszać)

- **Meta-injection na backendzie** ([render.ts](../backend/src/routes/render.ts) + [seo-meta.ts](../backend/src/services/seo-meta.ts)): każdy request HTML przechodzi przez `@render` w nginx → backend wstrzykuje per-URL `<title>`, `description`, `canonical`, OG i JSON-LD `Vehicle`. Zweryfikowane na żywo — działa poprawnie dla brandu Motolia (title, canonical, favicon, og:image wskazują na motolia.pl).
- **Sitemap** generowany dynamicznie (1090 URL-i), proxowany przez nginx na `/sitemap.xml`.
- **Canonical policy**: warianty `/leasing/:slug` i `/kredyt/:slug` kanonikalizują do `/oferta/:slug`; slug liczony z danych, nie z requestu. Poprawne.
- **404-y z noindex** dla nieistniejących ofert.

---

## 2. Przyczyny niskiego indeksowania (wg wagi)

### P0-A: `Disallow: /api/` blokuje renderowanie stron przez Googlebota ⛔ (główna przyczyna)

[seo.ts:195](../backend/src/routes/seo.ts) — robots.txt dla Googlebota zawiera `Disallow: /api/`.

Strona to SPA z pustym `<body><div id="root"></div></body>` (zweryfikowane na żywo). Google indeksuje SPA przez renderowanie JS (WRS), ale **WRS respektuje robots.txt dla XHR/fetch**. Aplikacja do wyrenderowania czegokolwiek potrzebuje `/api/settings`, `/api/translations`, `/api/seo`, `/api/listings/...`, `/api/widgets/render` — wszystkie zablokowane. Efekt: Googlebot renderuje **pustą stronę / skeleton** → soft 404 / „Strona przeskanowana, jeszcze nie zindeksowana". To klasyczny SPA-killer i najbardziej prawdopodobne źródło wyniku „7 zindeksowanych".

**Fix**: w robots.txt jawnie dopuścić read-only endpointy potrzebne do renderu (reguła longest-match wygrywa z `Disallow: /api/`):

```
Allow: /api/settings
Allow: /api/seo
Allow: /api/translations
Allow: /api/listings
Allow: /api/widgets/render
Allow: /api/faq
Allow: /api/feature-tiles
Allow: /api/geo
Allow: /api/rental-public
Allow: /api/sitemap.xml
Disallow: /api/
```

(dla grup Googlebot, Bingbot i `*`). Endpointy auth/admin pozostają zablokowane przez `Disallow: /api/`.

**Weryfikacja**: GSC → Sprawdzenie URL → „Przetestuj wersję opublikowaną" → zrzut wyrenderowanej strony musi pokazywać treść oferty, a nie skeleton.

### P0-B: Puste `<body>` — brak treści dla crawlerów bez JS

Head jest bogaty, ale body nie zawiera ani jednego słowa treści. Nawet po naprawie robots.txt indeksowanie SPA na świeżej domenie bez autorytetu jest wolne (render queue) i podatne na „Wykryta — jeszcze nie zindeksowana". Dla LLM-ów (GEO) to całkowita ślepota — żaden crawler AI nie wykonuje JS.

**Fix (SSR-lite, bez przepisywania na Next)**: rozszerzyć `injectHead`/`resolveMeta` tak, by dla ofert i stron statycznych wstrzykiwać do `<div id="root">` prosty, semantyczny HTML: `<h1>`, tabela specyfikacji (cena, rocznik, przebieg, paliwo, nadwozie, skrzynia), 1–2 akapity opisu, zdjęcie główne (`<img alt>`), breadcrumb z linkami, linki do ofert powiązanych. Frontend używa `createRoot().render()` (nie `hydrateRoot`), więc React po prostu nadpisze ten HTML — zero ryzyka hydration mismatch. To ta sama treść dla wszystkich agentów, więc nie jest to cloaking.

### P1-A: Rate limiting może serwować 429 Googlebotowi

[nginx.conf:100-102](../nginx.conf) — `location /` ma **dwie** strefy: `general` (10r/s) i `scanner` (**2r/s, burst 5**). Każda strona przechodzi przez strefę scanner. Googlebot crawlując z jednego IP > 2r/s dostanie 429. Przy 3 tys. URL-i to realnie dławi crawl budget.

**Fix**: wyłączyć strefę `scanner` dla zweryfikowanych botów (map po UA `Googlebot|Bingbot` → osobny klucz/strefa) albo po prostu usunąć strefę scanner z `location /` (strefa general 10r/s zostaje). Sprawdzić w GSC → Ustawienia → Statystyki indeksowania, czy występują odpowiedzi 429.

### P1-B: Nieznane ścieżki zwracają 200 zamiast 404

[render.ts:114](../backend/src/routes/render.ts) — `buildStaticMeta` → null → `defaultMeta({noindex, status: 200})`. Google klasyfikuje to jako soft 404. **Fix**: status 404 dla nieznanych ścieżek statycznych.

### P2: Sitemap — fałszywy lastmod

[seo.ts:69](../backend/src/routes/seo.ts) — strony statyczne mają zawsze `lastmod = dziś` i `changefreq=daily`. Google uczy się ignorować taki lastmod (utrata zaufania do sitemap). **Fix**: stały/realny lastmod dla stron statycznych; `changefreq`/`priority` można usunąć (Google je ignoruje).

---

## 3. GEO — stan obecny: **zero widoczności dla LLM**

Zweryfikowane na żywo: Cloudflare (opcja „AI bots blocking" / managed robots.txt) dokleja na początku robots.txt sekcję blokującą **wszystkie** crawlery AI:

```
User-agent: ClaudeBot / GPTBot / CCBot / Google-Extended / Amazonbot /
            Applebot-Extended / Bytespider / meta-externalagent
Disallow: /
Content-Signal: search=yes, ai-train=no, use=reference
```

Skutki:
- ChatGPT, Claude, Perplexity (częściowo), Gemini grounding (Google-Extended) **nie mogą czytać serwisu** → Motolia nie ma szans pojawić się w odpowiedziach AI.
- Nawet po odblokowaniu: crawlery AI nie wykonują JS → widzą tylko head + JSON-LD (dlatego P0-B jest też fundamentem GEO).

**Rekomendacje GEO (wymagają decyzji biznesowej — trade-off: scraping vs widoczność w AI):**
1. **Cloudflare dashboard**: wyłączyć blokadę AI crawlers (lub selektywnie odblokować GPTBot, ClaudeBot, PerplexityBot, Google-Extended). Content-Signal ustawić na `search=yes, ai-input=yes, ai-train=no` — pozwala na cytowanie w odpowiedziach AI (RAG), nadal zastrzega trening.
2. **SSR-lite body** (P0-B) — warunek konieczny, żeby LLM miał co czytać.
3. **`/llms.txt`** — endpoint na backendzie (analogicznie do robots): krótki opis serwisu, linki do kluczowych stron kategorii i sitemap. Opcjonalnie `/llms-full.txt` z listą ofert (make/model/rok/cena/URL) generowaną jak sitemap.
4. **Wzbogacenie JSON-LD** (czytają je i Google, i LLM-y):
   - `Vehicle` → dodać `image`, `vehicleTransmission`, `itemCondition` (`NewCondition`/`UsedCondition`), `offers.itemCondition`, `url`;
   - `Organization` na stronie głównej → dodać `logo`, `contactPoint`, `sameAs` (profile społecznościowe);
   - `BreadcrumbList` na stronach ofert;
   - `FAQPage` na `/faq` (dane już są w `/api/faq`!);
   - `ItemList` na stronach kategorii (`/samochody`, `/nowe`, `/uzywane`) z pierwszymi ~20 ofertami.
5. **og:image per oferta** — `injectHead` podmienia og:url, ale nie og:image; wstrzyknąć zdjęcie główne oferty.

---

## 4. Drobiazgi (przy okazji)

- [index.html](../index.html) w repo ma zaszyte meta CarSalon — na produkcji Motolia jest nadpisywane przez render, ale fallback `@spa_fallback` (gdy backend leży) serwuje surowy plik. Sprawdzić, czy build per-brand podmienia też og:image/favicon w statycznym pliku (na żywo jest OK).
- `SeoManager` (Helmet) po hydratacji nadpisuje title globalnym `homeTitle` na stronach bez własnego `MetaHead` — audyt, czy wszystkie indeksowalne strony mają `MetaHead`.
- Dwa `<h1>` na stronie oferty ([ListingDetailPage.tsx:584 i 601](../src/pages/ListingDetailPage.tsx)) — zostawić jeden.
- GSC screenshot jest z 12.06 — dnia wdrożenia renderera. Po wdrożeniu P0 poprosić o ponowne zindeksowanie (sitemap resubmit + „Poproś o zindeksowanie" dla kluczowych stron) i patrzeć na świeże dane.

---

## 5. Strategia wdrożenia — podział na zadania dla modeli

Zasada: zadania mechaniczne i dobrze wyspecyfikowane → tańszy/szybszy model (Gemini Flash / Sonnet); zadania dotykające architektury renderu i nginx → mocniejszy model (Opus/Fable) + review. Każde zadanie ma samodzielny prompt i kryterium weryfikacji.

### Faza 1 — odblokowanie indeksowania (1 dzień, największy zwrot)

| # | Zadanie | Pliki | Model | Weryfikacja |
|---|---------|-------|-------|-------------|
| 1.1 | robots.txt: Allow dla read-only API (lista w P0-A) | `backend/src/routes/seo.ts` | Sonnet / Gemini | `curl motolia.pl/robots.txt`; GSC test wyrenderowanej strony pokazuje treść |
| 1.2 | Usunąć strefę `scanner` z `location /` lub wyłączyć dla Googlebot/Bingbot | `nginx.conf`, `nginx-rate-limit.conf` | Opus (nginx łatwo zepsuć) | Statystyki indeksowania GSC: 0 odpowiedzi 429 |
| 1.3 | Status 404 dla nieznanych ścieżek | `backend/src/routes/render.ts` | Sonnet / Gemini | `curl -I motolia.pl/nieistnieje` → 404 |
| 1.4 | Cloudflare: decyzja + odblokowanie AI crawlers, Content-Signal `ai-input=yes` | dashboard CF (ręcznie, Kamil) | — | `curl motolia.pl/robots.txt` bez sekcji `ClaudeBot Disallow` |

### Faza 2 — SSR-lite: treść w body (2–3 dni, fundament SEO i GEO)

| # | Zadanie | Pliki | Model | Weryfikacja |
|---|---------|-------|-------|-------------|
| 2.1 | Rozszerzyć `PageMeta` o `bodyHtml`; `injectHead` wstrzykuje do `#root`; dla ofert: h1 + tabela spec + zdjęcie + breadcrumb + linki powiązane; dla kategorii: h1 + lista 20 ofert z linkami | `backend/src/services/seo-meta.ts`, `render.ts` | Opus/Fable (projekt) → Sonnet (implementacja wg specu) | `curl` strony oferty: body zawiera h1 i cenę; React nadal działa w przeglądarce (createRoot nadpisuje) |
| 2.2 | Testy jednostkowe render/inject (escaping, 404, cache) | `backend/src/routes/__tests__` | Sonnet | `npm test` zielone |

### Faza 3 — dane strukturalne i GEO (2 dni)

| # | Zadanie | Pliki | Model | Weryfikacja |
|---|---------|-------|-------|-------------|
| 3.1 | JSON-LD: Vehicle+image+itemCondition+transmission, BreadcrumbList, Organization(logo/sameAs), FAQPage z `/api/faq`, ItemList na kategoriach | `seo-meta.ts` | Sonnet / Gemini | Google Rich Results Test bez błędów |
| 3.2 | og:image per oferta (główne zdjęcie) | `seo-meta.ts`, `render.ts` | Gemini | curl + podgląd w opengraph.xyz |
| 3.3 | `/llms.txt` (+ opcjonalnie `/llms-full.txt`) na backendzie + proxy w nginx | `seo.ts`, `nginx.conf` | Gemini | `curl motolia.pl/llms.txt` |
| 3.4 | Sitemap: realny lastmod, usunąć changefreq/priority, dodać `<image:image>` do ofert | `seo.ts` | Gemini | walidator XML sitemap |

### Faza 4 — monitoring (ongoing)

- Po Fazie 1: resubmit sitemap w GSC + „Poproś o zindeksowanie" dla strony głównej i kategorii.
- Tygodniowo: raport indeksowania GSC (cel: >50% ofert w 6–8 tygodni), statystyki crawl (429/5xx = 0).
- GEO smoke-test: zapytać ChatGPT/Perplexity/Claude o „leasing [model] dostępny od ręki" i sprawdzić, czy motolia.pl pojawia się w źródłach (realnie 4–8 tygodni po odblokowaniu).

## 6. Plan strategiczny — średni termin (07.2026 → 01.2027)

Kontekst decyzji: warianty `/kredyt/:slug` i `/leasing/:slug` kanonikalizują do `/oferta/:slug` — Google traktuje je jako duplikaty i nie indeksuje osobno. To celowa ochrona świeżej domeny przed ~3× duplikacją. Treść finansowa i FAQ wstrzykiwane na tych wariantach (Opcja A, wdrożona) pracują wyłącznie na GEO — crawlery LLM czytają treść niezależnie od canonical.

### Horyzont 0–1 mies. (07.2026) — fundament i pomiar

- [ ] Promocja `dev` → `staging` → `main`; po deployu resubmit sitemapy w GSC + test wyrenderowanej strony (Sprawdzenie URL).
- [ ] Cotygodniowy przegląd GSC: liczba zindeksowanych `/oferta`, rozkład „przyczyn niezindeksowania" (soft 404 powinny zniknąć), Statystyki indeksowania (429/5xx = 0).
- [ ] GEO smoke-test co 2 tyg.: zapytania typu „kredyt na [marka model] dostępny od ręki", „leasing [model] bez wkładu" w ChatGPT/Perplexity/Claude — czy motolia.pl pojawia się w źródłach.
- [ ] Uzupełnić FAQ w CMS: `Strona oferty` z podziałem na Finansowanie (kredyt/leasing) → renderuje się na `/kredyt/:slug` i `/leasing/:slug`; `Strona najmu` → renderuje się na `/wynajem-dlugoterminowy/:slug`. Treść wstrzykiwana serwerowo jest tak dobra, jak wpisy w bazie.

### Horyzont 2–3 mies. (09–10.2026) — decyzja o usamodzielnieniu wariantów (Opcja B)

Cel: strony `/leasing/:slug` jako samodzielnie indeksowalne landingi pod frazy „leasing [marka model]" — rdzeń biznesu Motolii.

**Kryteria wejścia (wszystkie muszą być spełnione — inaczej czekamy):**
- ≥50% stron `/oferta` zindeksowanych w GSC,
- zero soft 404 / błędów renderowania w GSC,
- pierwsze wejścia organiczne na `/oferta` widoczne w Skuteczności.

**Zasady pilotażu:**
1. Tylko jeden wariant na start (leasing — wyższa wartość biznesowa, mniejsza konkurencja SERP niż kredyt).
2. Pilot na 50–100 ofertach (np. najpopularniejsze modele), nie na całym katalogu.
3. Warunek konieczny: treść **faktycznie odrębna** od `/oferta` — tytuł/opis/h1 pod leasing, sekcja rat i warunków (z kalkulatora — realne liczby produktu finansowego, nie kopia specyfikacji), FAQ leasingowe, Offer JSON-LD z ratą. Jeśli nie umiemy wygenerować odrębnej treści → nie zdejmujemy canonical.
4. Zmiany techniczne: self-canonical na pilotowych URL-ach, dodanie ich do sitemapy, osobny segment w GSC do pomiaru.
5. Pomiar 4–6 tyg.: indeksacja pilotowych stron, kanibalizacja (czy `/oferta` nie traci pozycji), CTR/konwersja leadów.
6. Rollback = przywrócenie canonical do `/oferta` (odwracalne w jednym deployu).

**Ryzyko do pilnowania:** płytka, szablonowa treść na tysiącach stron = wzorzec doorway pages; karą jest spadek zaufania do całej domeny. Lepiej 100 dobrych landingów niż 3000 szablonów.

### Horyzont 3–6 mies. (10.2026–01.2027) — autorytet tematyczny i treść

- [ ] Topical map dla klastra „finansowanie samochodu" (leasing konsumencki vs firmowy, kredyt vs leasing, najem długoterminowy — porównania, koszty, podatki) — do zbudowania skillami `sseo-project` → `sseo-topical-map` → `sseo-brief` → `sseo-writer`.
- [ ] Sekcja poradnikowa (blog) linkująca wewnętrznie do stron kategorii i ofert — to buduje autorytet domeny, którego teraz brakuje najbardziej.
- [ ] E-E-A-T: strona „O nas", dane firmy w stopce spójne z Organization JSON-LD, `sameAs` (profile społecznościowe) w schemacie Organization.
- [ ] llms-full.txt: monitorować limit `take: 2000` przy wzroście katalogu; rozważyć paginację.
- [ ] Po ustabilizowaniu indeksacji: hreflang + wersje EN/DE (pola w SeoConfig już istnieją), jeśli ekspansja poza PL jest w planach biznesowych.

### KPI (przegląd co miesiąc)

| Wskaźnik | Stan startowy (06.2026) | Cel 3 mies. | Cel 6 mies. |
|---|---|---|---|
| Zindeksowane strony (GSC) | 7 | >500 | >1500 |
| Kliknięcia organiczne / tydz. | ~0 | >100 | >500 |
| Cytowania w AI (smoke-test 10 zapytań) | 0/10 | 2/10 | 4/10 |
| Soft 404 / błędy renderu | dominują | 0 | 0 |
| Landingi leasingowe (pilot Opcji B) | — | decyzja go/no-go | 50–100 zindeksowanych |

---

### Wskazówki dla modelu wykonującego (wkleić do promptu zadania)

- Repo: `car-scout`, brand przez env `BRAND=motolia`, deploy przez Coolify (`prisma db push`, nie migrate).
- Nie zmieniaj polityki canonical ani mechanizmu cache w `render.ts` poza zakresem zadania.
- Każda zmiana w nginx.conf musi przejść `nginx -t` w obrazie przed deployem.
- Treść wstrzykiwana w body musi być identyczna dla wszystkich User-Agentów (bez cloakingu).
- Escapuj wszystko, co pochodzi z danych (`escapeAttr` / `<` już są w `seo-meta.ts` — użyj tych samych wzorców).
