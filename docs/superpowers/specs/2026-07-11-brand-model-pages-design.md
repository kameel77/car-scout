# Strony marek/modeli + CMS treści SEO — projekt (2026-07-11)

Zatwierdzony przez Kamila 2026-07-11. Cel: warstwa pośrednia architektury pod ruch non-brand
(sSEO) i cytowalność w LLM (GEO). Kontekst: 100% obecnego ruchu to zapytania brandowe;
1694 oferty wiszą płasko na paginowanym `/samochody`.

## 1. URL-e, routing, indeksacja

- Nowe trasy: `/samochody/:marka` i `/samochody/:marka/:model` (SPA: `SearchPage` z prefiltrem;
  SSR-lite: rozszerzenie `resolveMeta`/`buildStaticMeta` lub dedykowany builder w `seo-meta.ts`).
- Slugi: normalizacja jak w ofertach — lowercase, spacje→`-`, transliteracja PL/diakrytyków
  (Škoda→`skoda`, Citroën→`citroen`), znaki specjalne usunięte. Resolver slug→(make, model)
  na bazie distinct makes/models z listings (endpoint już istnieje: `listings.ts` distinct).
  Kolizje rozstrzyga pierwsze dopasowanie case-insensitive; nieznany slug → 404 + noindex.
- **Polityka progowa indeksacji:**
  - strona marki: zawsze self-canonical, zawsze w sitemapie;
  - strona modelu: self-canonical + sitemap gdy `aktywne oferty ≥ 2` LUB opublikowana treść CMS;
    w przeciwnym razie 200 + `noindex` + poza sitemapą.
- **Zero ofert (rotacja stocku):** strona zostaje (200). Jeśli ma treść CMS → nadal indeksowalna:
  treść + sekcja „podobne auta" (ta sama marka, fallback segment) + formularz waitlist.
  Bez treści CMS → noindex.
- Waitlist: formularz „Zostaw dane, damy znać, gdy pojawi się taka oferta" → istniejący model
  `Lead` z tagiem poszukiwanej marki/modelu (pole source/notes wg istniejącej konwencji Lead),
  widoczny w miniCRM.
- Canonicale filtrów: `/samochody?make=X` kanonikalizuje na `/samochody/x`
  (dziś: na `/samochody` — do zmiany w `seo-meta.ts`). Pozostałe filtry bez zmian.
- Paginacja: wzorzec z `/samochody` (self-canonical `?page=N`, crawlable hrefs) — reużyć.

## 2. CMS (model + admin)

- Prisma: `SeoContentPage { id, urlPath @unique, contentMd, metaTitle?, metaDescription?,
  isPublished (default false), createdAt, updatedAt }`. Deploy przez `prisma db push`
  (NIE migrate — zgodnie z konwencją repo).
- Admin: zakładka „Treści SEO" (wzorzec: `FaqPage.tsx`/`FeatureTilesPage.tsx`): lista wpisów,
  edytor markdown z podglądem, picker URL = dropdown marka (distinct z bazy) + opcjonalnie model,
  pola meta title/description, toggle publikacji.
- Render markdown→HTML **na backendzie** (whitelist tagów: p, h2, h3, ul/ol/li, strong, em, a,
  table..., sanityzacja), cache w pamięci z inwalidacją po `updatedAt`. Ten sam HTML do SSR
  i do SPA przez publiczny endpoint (`GET /api/seo-content?path=...`) — identyczna treść dla
  wszystkich User-Agentów (zero cloakingu).
- PL-only w v1. Meta z CMS **nadpisuje** domyślne generowane.

## 3. SSR-lite + dane strukturalne

- H1: marka — „Samochody [Marka] dostępne od ręki — nowe i używane"; model — „[Marka] [Model] —
  dostępne od ręki". Title domyślny: „[Marka] ([N] ofert) — nowe i używane | Motolia" itp.
- Body SSR: breadcrumb (Strona główna → Samochody → Marka [→ Model]) + H1 + listing (linki ofert
  z cenami) + treść CMS + FAQ + linki do modeli marki i innych marek.
- JSON-LD: `ItemList` (oferty), `BreadcrumbList`; FAQ → `FAQPage`.
- **FAQ dwuwarstwowe:**
  - dynamiczne (2–3 pozycje z żywych danych, wzorzec ze stron najmu): przedział cen aktywnych
    ofert, dostępne modele/liczba ofert, formy finansowania; znika przy 0 ofert;
  - redakcyjne: konwencja `## Pytanie?` w markdownie CMS — parser wykrywa nagłówki kończące się
    `?` i emituje je do FAQPage JSON-LD (spójność treść↔schema).
  - Zakaz szablonowych pytań ogólnych powtarzanych na wielu stronach (lekcja z duplikacji najmu).

## 4. GEO

- Treść w surowym HTML (prerender — crawlery AI nie wykonują JS).
- Strony marek dopisane do `llms.txt` (sekcja „Marki").
- FAQPage + ItemList jako struktury cytowalne; FAQ dynamiczne z realnych liczb.

## 5. Linkowanie wewnętrzne

- Breadcrumb na kartach ofert (`buildListingMeta`): Strona główna → Samochody → [Marka] →
  [Marka Model] → oferta (linki na nowe strony).
- `/samochody` (SSR + SPA): blok „Popularne marki" z linkami.
- Sitemap: wpisy wg polityki progowej; lastmod = max(updatedAt treści CMS, updatedAt ofert).

## 6. Fazowanie

- **F1 — fundament (kod):** routing SPA + SSR + resolver slugów + polityka progowa + canonicale
  filtrów + sitemap + linkowanie (breadcrumby, popularne marki) + FAQ dynamiczne + testy.
- **F2 — CMS (kod):** model + db push + API admin/public + render markdown + FAQ redakcyjne
  z markdownu + zakładka admin + testy.
- **F3 — waitlist (kod):** formularz na pustych stronach + Lead z tagiem + testy.
- **F4 — treść (proces):** briefy/teksty top ~10 marek skillami sseo-brief/sseo-writer
  (workspace ~/Documents/Content/SEO/motolia.pl), publikacja przez CMS.
- Pomiar: filtr `/samochody/` w GSC; KPI: indeksacja stron marek ≤4 tyg., pierwsze non-brand
  kliknięcia 6–8 tyg.

## Ograniczenia twarde

- Żadnych zmyślonych danych w treści generowanej (ceny/raty tylko z bazy).
- Escapowanie wzorcami z `seo-meta.ts` (`escapeHtml`).
- Nie zmieniać polityki canonical ofert ani mechanizmu cache `render.ts` poza zakresem.
- Deploy: dev → staging → main; `prisma db push`.
