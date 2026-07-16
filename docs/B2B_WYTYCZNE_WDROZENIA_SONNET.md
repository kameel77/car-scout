# Wytyczne wdrożenia `/dla-firm` — dla Sonnet

Data: 2026-07-15. Cel: wdrożyć nową, pełnoprawną, indeksowaną stronę marketingową
`/dla-firm` (brand = motolia) wg strategii B2B, z kontekstem FAQ i modułem ofert specjalnych.

**Źródła (przeczytaj przed startem):**
- Copy strony: [B2B_CONTENT_DLA_FIRM.md](B2B_CONTENT_DLA_FIRM.md) — teksty bierz stąd 1:1.
- Strategia: [B2B_STRATEGIA_KOMUNIKACJI_MOTOLIA.md](B2B_STRATEGIA_KOMUNIKACJI_MOTOLIA.md).
- Reguły linkowania/treści: [SEO_LINKING_STRATEGY_MOTOLIA.md](SEO_LINKING_STRATEGY_MOTOLIA.md).
- CLAUDE.md repo — zwłaszcza: Simplicity First, Surgical Changes, uruchamianie skryptów w kontenerze.

**Decyzje produktowe (zatwierdzone przez Kamila):**
1. `/dla-firm` = **nowa strona marketingowa** (indeksowana). Istniejący onepager do
   druku/PDF **przenosi się na `/dla-firmy`** (noindex).
2. Oferty specjalne dla firm = **nowa flaga `isBusinessFeatured` na `Listing` + panel admina**
   (nie reużywamy `isFeatured`).

> Zasada nadrzędna z CLAUDE.md: **minimalny kod, chirurgiczne zmiany, żadnych spekulacyjnych
> abstrakcji.** Każda zmieniona linia ma wynikać wprost z tego dokumentu. Dopasuj się do
> istniejącego stylu (Motolia: `YELLOW='#F5C518'`, `BLACK='#1A1A1A'`, wzorzec `MotoliaHomePage.tsx`).

---

## Kontekst techniczny (stan zastany — zweryfikowany w kodzie)

- **Routing:** `src/App.tsx`, lazy imports. Obecnie `Route path="/dla-firm"` → `B2BOnepagerPage`
  (linia ~127). `B2BOnepagerPage` używa `?print=1` i `?ids=`, ma `DownloadPdfButton`, backend
  `/api/onepager/offers` i `backend/src/routes/onepager.ts`.
- **Nawigacja:** `src/components/Header.tsx` — `ALL_NAV_LINKS` (linia ~32) + filtr `navItems`
  (linia ~53) sterowany `settings.navItemsVisibility`. Menu desktop i mobile.
- **Meta/SSR:** `backend/src/services/seo-meta.ts` — `STATIC_ROUTES` już zawiera wpis
  `/dla-firm` (linia ~809). SSR w `backend/src/routes/render.ts`; `NOINDEX_RE` (linia ~259)
  decyduje o noindex. Prerender/SSR listy tras w `render.ts` (`renderRoutes`, mapy tras ~273).
- **FAQ:** enum `FaqPage` w `backend/prisma/schema.prisma` (linia ~870):
  `home | offers | contact | faq | rental | financing`. Kolumna `page_context` (`FaqPageContext`)
  dodana migracją `20260410_add_page_context_and_rental_faq`. Typ front: `src/types/faq.ts`.
  API: `src/services/api.ts` → `faqApi.list({ page, pageContext, financingType })`
  (`GET /api/faq`). Admin: `src/pages/admin/FaqPage.tsx`. Render publiczny + akordeon:
  `MotoliaHomePage.tsx` (query `faqApi.list({ page:'home' })`, stan `openFaq`, sekcja `#faq`).
  Wzorzec FAQPage JSON-LD: `src/pages/ListingDetailPage.tsx` (~505–530) i
  `backend/src/services/seo-meta.ts` (`faqSectionHtml`).
- **Oferty B2B:** `src/hooks/useB2BOfferList.ts` → `GET /api/onepager/offers`. Endpoint w
  `backend/src/routes/onepager.ts` (featured + filler). Wzorzec „featured": `backend/src/routes/featured.ts`.

---

## 1. Routing — przenieś onepager, dodaj nową stronę

W `src/App.tsx`:
1. Utwórz lazy import nowej strony:
   `const MotoliaB2BPage = lazy(() => import("./pages/MotoliaB2BPage"));`
2. Zmień istniejącą trasę onepagera na `/dla-firmy`:
   `<Route path="/dla-firmy" element={<B2BOnepagerPage />} />`
3. Dodaj nową trasę marketingową:
   `<Route path="/dla-firm" element={<MotoliaB2BPage />} />`

**SEO — uniknij bliźniaczego duplikatu** (`/dla-firm` vs `/dla-firmy`):
- W `backend/src/routes/render.ts` dopisz `/dla-firmy` do `NOINDEX_RE` (lub równoważnie
  ustaw `noindex` dla tej ścieżki), żeby onepager nie konkurował w indeksie z `/dla-firm`.
- Sprawdź, czy jakikolwiek kod/CTA (np. `DownloadPdfButton`, generator PDF w
  `backend/src/routes/onepager.ts`, testy `onepager.test.ts`) linkuje do `/dla-firm?print=1`
  — podmień na `/dla-firmy?print=1`. Zaktualizuj testy.
- Jeśli `/dla-firm` bywa cytowana zewnętrznie jako onepager — dodaj 301 `/dla-firm` (stary
  sens) tylko jeśli istnieje realny ruch; domyślnie pomiń (YAGNI).

## 2. Meta / SSR dla `/dla-firm`

- `STATIC_ROUTES['/dla-firm']` w `seo-meta.ts` już istnieje — **zaktualizuj** `title`, `h1`,
  `description` do wartości z [B2B_CONTENT_DLA_FIRM.md](B2B_CONTENT_DLA_FIRM.md) → sekcja „Meta / SEO".
- Upewnij się, że `/dla-firm` **nie** łapie się w `NOINDEX_RE` (dziś nie łapie).
- Strona ma być self-canonical i wpięta w oś finansowania jako czwarty filar. Jeśli istnieje
  sitemap generator — dopisz `/dla-firm` (sprawdź `backend/src/routes/seo.ts`).
- Rozważ pełny SSR/prerender listy (`render.ts` `renderRoutes`) jak dla innych stron statycznych,
  jeśli strona ma być cytowalna (GEO). Minimalnie: meta + H1 w SSR wystarczą do indeksacji.

## 3. Nowy komponent strony — `src/pages/MotoliaB2BPage.tsx`

Wzoruj się **strukturalnie i stylistycznie** na `MotoliaHomePage.tsx` (te same stałe kolorów,
`Header`, `Footer`, `FadeIn`, wzorzec sekcji, akordeon FAQ). Zbuduj sekcje 1:1 z copy:

1. **Hero** — badge, H1, sub, 3 trust badges, CTA główne + microcopy, CTA drugorzędne.
2. **„Dla kogo"** — 3 karty (JDG / 2–5 aut / 6–20 aut).
3. **Wyróżniki** — lista 5 punktów (min. 4 pierwsze obowiązkowe).
4. **„Jak pracujemy"** — 4 kroki.
5. **Oferty specjalne dla firm** — moduł dynamiczny (patrz sekcja 5 tego dokumentu).
6. **„Leasing czy najem"** — tabela + zdanie zamykające + 2 linki kontekstowe (anchor z encją).
7. **Podatki 2026** — blok + CTA + wymagany dopisek „nie stanowi porady podatkowej".
8. **Pracowniczy Program Najmu** — blok + CTA.
9. **Social proof** — renderować **tylko** przy realnych danych; inaczej sekcja ukryta.
10. **FAQ** — akordeon z `faqApi.list({ page:'business' })` + FAQPage JSON-LD (sekcja 4).
11. **CTA końcowe** — CTA + telefon i e-mail wprost (z `useAppSettings`, jak w Header).

**Reużyj istniejących komponentów `src/components/b2b/`** gdzie pasują (np. `B2BBenefitGrid`,
`B2BCtaSection`) — ale nie na siłę; onepager i strona marketingowa mają różne cele. Jeśli
komponent onepagera jest zbyt „drukowy", zbuduj sekcję inline w stylu MotoliaHomePage.

**CTA → formularz leadowy firmowy:** wszystkie CTA prowadzą do formularza z kontekstem firmowym
(telefon + liczba aut). Jeśli formularz leadowy nie ma jeszcze pola „firma/liczba aut", to
zakres Fazy 1 strategii (sekcja 4.4) — poza tym wdrożeniem, ale zlinkuj do istniejącej ścieżki
leadowej z parametrem kontekstu (np. `?context=business`), żeby CTA działały.

**Linkowanie wewnętrzne (reguły SEO):** dokładnie te linki co w copy — po 1 do `/leasing` i
`/wynajem-dlugoterminowy` z anchorem z encją; link „w dół" pod modułem ofert do `/leasing`.
**Nie** linkować wariantów `/leasing/:slug`. **FAQ bez linków.**

## 4. Kontekst FAQ dla `/dla-firm` (nowa wartość `business`)

Celem jest, by admin mógł zarządzać FAQ dla strony firm, a strona renderowała je + JSON-LD.

**Backend:**
1. Migracja Prisma dodająca wartość enuma:
   `ALTER TYPE "FaqPage" ADD VALUE IF NOT EXISTS 'business';`
   (wzorzec: `20260410_add_page_context_and_rental_faq/migration.sql`). Dodaj `business` do
   `enum FaqPage` w `schema.prisma` i wygeneruj klienta.
   > Uwaga: `ALTER TYPE ... ADD VALUE` w Postgres nie może działać w tej samej transakcji, w
   > której wartość jest używana — trzymaj to jako osobną migrację (jak wzorzec).
2. **Wymagane:** `backend/src/routes/faq.ts` ma whitelistę `PAGE_OPTIONS` (linia ~4:
   `['home','offers','contact','faq','rental','financing']`) używaną w `GET` (filtr) i `POST`
   (walidacja, zwraca 400 dla nieznanej `page`). **Dopisz `'business'`** — inaczej zapis wpisu
   FAQ dla firm zwróci `Invalid or missing page`.

**Frontend:**
3. `src/types/faq.ts` — rozszerz `FaqPage` o `'business'`.
4. `src/pages/admin/FaqPage.tsx` — dodaj `business` do listy stron w UI (selektor page), żeby
   redaktor mógł dodawać wpisy FAQ dla firm. Zachowaj istniejący wzorzec (jak `rental`/`financing`).
5. Render na stronie: w `MotoliaB2BPage.tsx` pobierz `faqApi.list({ page: 'business' })`,
   przefiltruj `isPublished !== false`, posortuj `sortOrder`, zbuduj akordeon jak w
   `MotoliaHomePage.tsx`.

**JSON-LD (`FAQPage`):** dołącz na stronie schema `@type: FAQPage` z `mainEntity` z pytań/odpowiedzi
(wzorzec `ListingDetailPage.tsx` ~515). Odpowiedzi samowystarczalne, bez linków. `@id` =
`{url}#faq`. Jeśli strona ma SSR — wyemituj schema też server-side (spójnie z resztą serwisu),
albo klientowo przez istniejący mechanizm `MetaHead`/`SeoManager`. Dodaj też definicyjny akapit
(GEO): pierwszy akapit sekcji cytowalny.

**Seed treści FAQ:** wprowadź 7 pytań z [B2B_CONTENT_DLA_FIRM.md](B2B_CONTENT_DLA_FIRM.md)
sekcja 10 do CMS (przez panel admina lub skrypt seed). Wypełnij PL; EN/DE — placeholdery lub
tłumaczenia wg istniejącego procesu (pola `question/answer` × `Pl/En/De` są wymagane w `FaqPayload`).

## 5. Moduł „Oferty specjalne dla firm" (`isBusinessFeatured`)

**Model danych (Prisma):**
1. Dodaj `isBusinessFeatured Boolean @default(false) @map("is_business_featured")` do modelu
   `Listing` w `schema.prisma` (obok istniejącego `isFeatured ... @map("is_featured")`, linia ~101;
   tabela mapuje się na `listings`). Rozważ `@@index([isBusinessFeatured])` (jest analogiczny `@@index([isFeatured])`).
2. Migracja: `ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "is_business_featured" BOOLEAN NOT NULL DEFAULT false;`

**Endpoint:**
3. Dodaj `GET /api/business/offers` (wzorzec `backend/src/routes/onepager.ts` i `featured.ts`):
   `where: { isBusinessFeatured: true, isArchived: false, pricePln: { gt: 0 } }`, `take: 6`,
   `orderBy: { createdAt: 'desc' }`, `include: { dealer: true }`. Cache Redis jak w `featured.ts` (10 min).
   **Fallback:** jeśli wynik pusty, zwróć `isFeatured: true` (ta sama logika co onepager), żeby
   sekcja nie była pusta.
4. Zwracaj dane potrzebne karcie (jak `B2BOffer` w `useB2BOfferList.ts`), z **ratą netto**
   (użyj istniejącej logiki kalkulacji raty firmowej — kalkulator rozróżnia `consumer`/`entrepreneur`,
   strategia 4.2; nie licz raty od zera, reużyj istniejącej funkcji).

**Frontend:**
5. Hook `src/hooks/useBusinessOfferList.ts` (analogicznie do `useB2BOfferList.ts`, endpoint
   `/api/business/offers`).
6. Sekcja w `MotoliaB2BPage.tsx`: nagłówek „Oferty specjalne dla firm", lead, siatka 4–6 kart.
   Karta: zdjęcie, marka+model+wersja+rok, **rata netto** z dopiskiem „netto — dla firmy rata
   w kosztach", badge „Oferta dla firm", CTA „Zapytaj o to auto na firmę" → formularz firmowy.
   Reużyj `B2BListingCard` jeśli pasuje, inaczej lekki własny wariant.
7. Pod siatką link w dół hierarchii: „Zobacz wszystkie auta w leasingu dla firm" → `/leasing`.

**Panel admina (zarządzanie flagą):**
8. Znajdź formularz edycji oferty (`src/components/admin/VehicleForm/…` / `ListingEditPage`).
   Dodaj checkbox „Oferta dla firm" (`isBusinessFeatured`) obok istniejącego `isFeatured`.
   Przepnij pole przez payload zapisu (`listingsApi` / backend `PUT/POST /api/listings`).
   Zaktualizuj typ oferty na froncie i schemat walidacji zapisu na backendzie.

## 6. Nawigacja „Dla firm"

W `src/components/Header.tsx`:
- Dodaj do `ALL_NAV_LINKS`: `{ key: 'dlafirm', label: 'Dla firm', to: '/dla-firm' }`.
- Domyślna widoczność: `navItems` filtruje po `settings.navItemsVisibility` (domyślnie
  `['samochody','wynajem']`). Żeby „Dla firm" było widoczne domyślnie, albo dodaj `dlafirm`
  do reguły „zawsze widoczne" (jak `faq`/`kontakt`), albo dopisz do domyślnej `navItemsVisibility`
  w źródle ustawień. **Rekomendacja:** traktuj jak `faq`/`kontakt` (zawsze widoczne), bo to
  strategiczna pozycja menu (strategia 4.1). Dodaj w desktop i mobile (oba renderują z `navItems`).
- Zweryfikuj panel admina widoczności menu (jeśli `navItemsVisibility` konfigurowalne w UI —
  `FeatureTilesPage`/ustawienia) i dopisz `dlafirm` do dostępnych opcji.

## 7. Zakres świadomie POMINIĘTY tutaj (Faza 2+ strategii)

Nie wdrażaj w tym zadaniu (osobne tickety, żeby zmiana była chirurgiczna):
- przełącznik netto/brutto na HP i listingach (strategia 4.1–4.2),
- baner flotowy na listingach, sekcja firmowa na HP,
- pole „firma/liczba aut" + routing leadów flotowych w formularzu (Faza 1 strategii, ale
  osobny obszar; tu tylko podepnij CTA do istniejącej ścieżki z `?context=business`),
- content podatkowy 2026 jako osobny artykuł/kalkulator, akapity firmowe w CMS marek/modeli.

Jeśli któryś z tych elementów jest konieczny, by CTA działały end-to-end — zgłoś to zamiast
cicho rozszerzać zakres (CLAUDE.md: „Don't assume. Surface tradeoffs.").

---

## Plan wykonania i weryfikacja (success criteria)

1. Routing: `/dla-firm` → nowa strona (200, indexable), `/dla-firmy` → onepager (200, noindex).
   → **verify:** `curl` SSR obu tras; sprawdź `<meta name="robots">` i `<title>`/`<h1>`.
2. Strona renderuje wszystkie sekcje z copy; brak żargonu CFM; dopiski podatkowe obecne.
   → **verify:** przegląd wizualny + grep copy vs plik contentu.
3. FAQ `business`: migracja przechodzi, admin pozwala dodać wpis `business`, strona renderuje
   akordeon + FAQPage JSON-LD. → **verify:** dodaj wpis w adminie, sprawdź render i walidację
   JSON-LD (Rich Results Test / lint schema).
4. Oferty specjalne: flaga zapisuje się w adminie, endpoint zwraca oznaczone oferty (+fallback),
   sekcja pokazuje ratę netto. → **verify:** oznacz 1 ofertę, sprawdź `/api/business/offers`
   i render sekcji; sprawdź fallback po odznaczeniu wszystkich.
5. Nawigacja „Dla firm" widoczna desktop + mobile, prowadzi do `/dla-firm`.
6. Testy: uzupełnij/zaktualizuj testy onepagera (zmiana trasy) i dodaj lekki test hooka/endpointu
   ofert firmowych. → **verify:** `npm test` / vitest zielone.
7. Linkowanie: audyt wg SEO_LINKING_STRATEGY (1 link/filar, anchor z encją, FAQ bez linków,
   brak linków do `/leasing/:slug`, nagłówki bez `?`).

**Uruchamianie skryptów/migracji** (CLAUDE.md §6): lokalnie z `backend/` → `npx tsx src/scripts/<name>.ts`;
w kontenerze → `node dist/scripts/<name>.js`. Migracje Prisma standardowym flow projektu.

**Po wdrożeniu na prod** (CLAUDE.md §5): zaproponuj wpis devlog do Vault (projekt: motolia,
skill `vault-devlog`) — to znaczący zakres (nowy filar B2B).
