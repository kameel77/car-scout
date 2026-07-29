# Wytyczne wdrożenia — system landing page'y ofertowych (`/promo/:slug`)

Data: 2026-07-29. Cel: zbudować zarządzalny z panelu system landing page'y dla ruchu płatnego
(Meta/Google Ads), QR z reklam offline/TV oraz mailingów — jedna LP na **grupę odbiorców**,
wiele kampanii i kanałów na jedną LP.

**Źródła (przeczytaj przed startem):**
- [CRO_AUDIT_MOTOLIA_2026-07.md](CRO_AUDIT_MOTOLIA_2026-07.md) — uzasadnienie biznesowe, sekcja 1 i P1.1/P1.2.
- [SEO_LINKING_STRATEGY_MOTOLIA.md](SEO_LINKING_STRATEGY_MOTOLIA.md) — reguły linkowania i noindex.
- [B2B_WYTYCZNE_WDROZENIA_SONNET.md](B2B_WYTYCZNE_WDROZENIA_SONNET.md) — wzorzec analogicznego wdrożenia.
- `CLAUDE.md` repo — zwłaszcza: Simplicity First, Surgical Changes, uruchamianie skryptów w kontenerze.

> Zasada nadrzędna: **minimalny kod, chirurgiczne zmiany, żadnych spekulacyjnych abstrakcji.**
> Każda zmieniona linia ma wynikać wprost z tego dokumentu. Dopasuj się do istniejącego stylu
> (Motolia: `YELLOW='#F5C518'`, `BLACK='#1A1A1A'`, wzorzec `MotoliaHomePage.tsx`).

---

## Decyzje produktowe (zatwierdzone przez Kamila)

1. **Encja to `LandingPage`, nie „kampania".** LP = doświadczenie dla segmentu odbiorców
   (np. „firmy — leasing 1%", „młody kierowca", „auta do 1000 zł/mies"). Kampania reklamowa
   i kanał to **wyłącznie parametr `?src=` + UTM** na tym samym URL-u. Nie tworzymy encji
   `Campaign` — jedna LP obsługuje N kampanii, a rozbicie kanałów robi analityka.
2. **Główna konwersja to callback** (numer telefonu, jedno pole), nie pełny formularz.
   Uzasadnienie: audyt CRO — 60% porzuceń pełnego formularza, 466 telefonów/mies. w CRM.
3. **Dobór aut: tryb ręczny albo filtr.** Filtr jest domyślny dla LP evergreen — LP nie może
   pustoszeć, gdy auta się sprzedadzą. Wzorzec do skopiowania: `Widget.selectionMode` +
   `Widget.filterParams` (`backend/prisma/schema.prisma`, `backend/src/routes/widgets.ts`).
4. **Szablon ze slotami, nie page-builder.** Stała kolejność sekcji, admin włącza/wyłącza
   sekcje i edytuje ich treść. Bez drag&drop, bez edytora WYSIWYG, bez dowolnego HTML.
5. **Domyślnie `noindex`.** Flaga `isIndexable` pozwala wyjątkowo zaindeksować LP evergreen.
   LP po `validTo` → 301 na `/samochody`.
6. **Bez A/B testów w tej iteracji.** Wariantowanie robi się na razie przez dwie osobne LP
   i podział budżetu w systemie reklamowym.

---

## Kontekst techniczny (stan zastany — zweryfikowany w kodzie)

- **Routing publiczny:** `src/App.tsx`, lazy imports, trasy publiczne ~linia 100–142.
- **Oferta specjalna (rabat z URL):** `src/contexts/SpecialOfferContext.tsx` +
  `src/utils/specialOffer.ts` + `src/utils/offerParser.ts`. Provider już opakowuje `<Routes>`
  (`App.tsx` ~linia 97). Rabat i wpłata własna wstrzykiwane parametrem `offerDiscount`.
- **Lista aut po ID:** `src/hooks/useListingsByIds.ts` → `listingsApi.getListingsByIds`
  (`src/services/api.ts:620`) → `GET /api/listings/by-ids?ids=`.
- **Wzorzec strony z listą wybranych aut:** `src/pages/PersonalOfferPage.tsx`.
- **Callback:** `src/components/CallbackForm.tsx` (props: `listingId`, `message`, `formId`,
  `compact`, `financingType`, `brand`, `model`) → `leadsApi.submitQuickLead`
  (`src/services/api.ts:1217`) → `POST /api/leads/quick` (`backend/src/routes/leads.ts:380`,
  honeypot `company`, `leadType: 'quick_contact'`).
- **Wzorzec CRUD admin (backend):** `backend/src/routes/hero-banners.ts` — publiczny GET +
  chronione CRUD przez `authorizeRoles`, upload obrazu przez `optimizeAndSaveImage`,
  katalog `uploads/hero-banners`. Rejestracja w `backend/src/app.ts` (~linia 50 import, ~373 register).
- **Wzorzec CRUD admin (front):** `src/pages/admin/HeroBannersPage.tsx` + `heroBannersApi`
  (`src/services/api.ts:928`), trasa chroniona `ProtectedRoute` w `App.tsx`.
- **Wzorzec selekcji aut filtrem:** `backend/src/routes/widgets.ts` (~linia 67–220),
  enum `SelectionMode { FEATURED, FILTERED }` (`schema.prisma:897`).
- **SSR/meta/noindex:** `backend/src/routes/render.ts` — `NOINDEX_RE` (linia 265),
  `ROUTE_MODULES` (linia 273); `backend/src/services/seo-meta.ts` — `STATIC_ROUTES`.
- **Analityka:** `src/lib/analytics.ts` (`trackLeadSubmit`), GTM w `src/components/seo/SeoManager.tsx`.
- **Model `Lead`:** `schema.prisma` ~linia 162 — brak pól atrybucji marketingowej.

---

## Faza 1 — model danych

### 1.1 Nowe modele w `backend/prisma/schema.prisma`

```prisma
model LandingPage {
  id             String            @id @default(cuid())
  slug           String            @unique
  name           String                                        // nazwa robocza w panelu
  audience       String?                                       // etykieta segmentu, np. "B2B leasing"
  isActive       Boolean           @default(true) @map("is_active")
  isIndexable    Boolean           @default(false) @map("is_indexable")
  validFrom      DateTime?         @map("valid_from")
  validTo        DateTime?         @map("valid_to")

  heroTitle      String            @map("hero_title")
  heroSubtitle   String?           @map("hero_subtitle")
  heroBadge      String?           @map("hero_badge")
  heroImageUrl   String?           @map("hero_image_url")
  ctaLabel       String            @default("Oddzwońcie do mnie") @map("cta_label")

  discount       Int?                                          // rabat w zł, wstrzykiwany w SpecialOffer
  initialPayment Int?              @map("initial_payment")

  selectionMode  LpSelectionMode   @default(FILTERED) @map("selection_mode")
  listingIds     String[]          @map("listing_ids")         // dla MANUAL
  filterParams   Json?             @map("filter_params")       // dla FILTERED
  maxListings    Int               @default(12) @map("max_listings")

  sections       Json?                                         // konfiguracja slotów, patrz 1.2
  metaTitle      String?           @map("meta_title")
  metaDescription String?          @map("meta_description")

  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")

  leads          Lead[]

  @@index([isActive, slug])
  @@map("landing_pages")
}

enum LpSelectionMode {
  MANUAL
  FILTERED
}
```

### 1.2 Kształt `sections` (whitelist, walidowany na backendzie)

Stała kolejność renderowania, admin steruje wyłącznie `enabled` i treścią:

```ts
type LpSections = {
  callback?:   { enabled: boolean; title?: string; description?: string };
  listings?:   { enabled: boolean; title?: string };
  trustBar?:   { enabled: boolean; items?: string[] };       // max 4
  howItWorks?: { enabled: boolean; steps?: { title: string; text: string }[] };  // max 3
  faq?:        { enabled: boolean; items?: { q: string; a: string }[] };         // max 6
  urgency?:    { enabled: boolean; text?: string };
};
```

Nieznane klucze odrzucaj przy zapisie. Wartości tekstowe traktuj jako **plain text** —
żadnego `dangerouslySetInnerHTML`.

### 1.3 Atrybucja leadów — rozszerzenie `Lead`

```prisma
  landingPageId  String?      @map("landing_page_id")
  trafficSource  String?      @map("traffic_source")   // wartość ?src=, max 64 znaki, sanityzowana
  landingPage    LandingPage? @relation(fields: [landingPageId], references: [id], onDelete: SetNull)
```
Plus `@@index([landingPageId])`.

**Kryterium akceptacji fazy 1:** migracja przechodzi na czystej bazie i na kopii produkcyjnej,
`npx prisma generate` bez błędów, istniejące testy backendu zielone.

---

## Faza 2 — backend API

Nowy plik `backend/src/routes/landing-pages.ts`, rejestracja w `backend/src/app.ts`
(import przy ~linii 50, `await fastify.register(landingPageRoutes)` przy ~373).

### 2.1 Publiczny endpoint

`GET /api/landing-pages/public/:slug`

- 404, gdy brak LP lub `isActive === false`.
- 410, gdy `validTo < now()` — front na tej podstawie robi redirect na `/samochody`.
- Zwraca LP **razem z rozwiązaną listą aut** (jeden request, nie dwa — LCP):
  - `MANUAL` → auta po `listingIds`, kolejność zachowana jak w tablicy, pomijaj zarchiwizowane.
  - `FILTERED` → zapytanie zbudowane wg wzorca z `backend/src/routes/widgets.ts`, limit `maxListings`.
- Kształt auta w odpowiedzi identyczny jak w `/api/listings/by-ids`, żeby front mógł użyć
  istniejącego `mapBackendListingToFrontend`.

### 2.2 CRUD administracyjny

`GET | POST /api/landing-pages`, `GET | PUT | DELETE /api/landing-pages/:id` —
`authorizeRoles` z tym samym zestawem ról co `hero-banners.ts`.

- `POST /api/landing-pages/:id/hero-image` — upload przez `optimizeAndSaveImage`,
  katalog `uploads/landing-pages`, te same limity co bannery (8 MB, jpeg/png/webp).
  Przy podmianie i przy `DELETE` usuwaj stare pliki (wzorzec `unlinkBannerImage`).
- `GET /api/landing-pages/:id/preview-listings` — zwraca auta rozwiązane z bieżącej
  konfiguracji selekcji, żeby admin widział podgląd przed publikacją.
- Walidacja slug: `^[a-z0-9-]{3,48}$`, unikalny, zarezerwowane wartości odrzucaj
  (`admin`, `api`, `embed`).

### 2.3 Atrybucja w `POST /api/leads/quick`

W `backend/src/routes/leads.ts` (~linia 380) przyjmij opcjonalne `landingPageSlug` i `src`.
Zamień slug na `landingPageId` (jeśli LP istnieje), zapisz `trafficSource` po sanityzacji
(`[a-z0-9_-]`, obcięte do 64 znaków). Brak lub nieznany slug **nie może** blokować leada —
atrybucja jest opcjonalna, lead zawsze musi przejść.

**Kryterium akceptacji fazy 2:** testy w `backend/src/routes/__tests__/` pokrywają:
LP aktywna zwraca auta w obu trybach selekcji, LP wygasła zwraca 410, LP nieaktywna 404,
lead z `landingPageSlug` ma poprawny `landingPageId`, lead z nieznanym slugiem zapisuje się
bez atrybucji.

---

## Faza 3 — strona publiczna `/promo/:slug`

Nowy plik `src/pages/CampaignLandingPage.tsx`, lazy import i trasa w `src/App.tsx`
w bloku tras publicznych. Nowy hook `src/hooks/useLandingPage.ts` (react-query, wzorzec
`useListingsByIds.ts`).

**Struktura (kolejność stała, mobile-first — ruch z QR i Ads jest niemal w 100% mobilny):**

1. Pasek górny: logo brandu + telefon klikalny. **Bez nawigacji serwisu** — każdy link
   wychodzący to utracony lead. Nie używaj `<Header />`.
2. Hero: `heroBadge`, `heroTitle`, `heroSubtitle`, `heroImageUrl`.
3. **Callback bezpośrednio pod hero, nad linią załamania.** Użyj istniejącego
   `<CallbackForm compact formId={`lp_${slug}`} />` — rozszerz komponent o opcjonalne propsy
   `landingPageSlug` i `src`, przekazywane do `submitQuickLead`. Nie duplikuj logiki formularza.
4. Sekcja aut: `ListingCard` z `src/components/ListingCard.tsx`, siatka 1 kolumna mobile /
   2–3 desktop.
5. Sekcje opcjonalne wg `sections`: `urgency`, `trustBar`, `howItWorks`, `faq`.
6. Sticky bar na dole (mobile): „Zadzwoń" (`tel:`) + „Oddzwońcie" (scroll do callbacku).
7. Stopka minimalna: dane spółki, polityka prywatności, RODO. Bez menu.

**Rabat:** jeśli `discount` jest ustawiony, wstrzyknij go do `SpecialOfferContext` — najprościej
przez rozszerzenie providera o możliwość ustawienia rabatu programowo, bez sztucznego
przepisywania URL-a. Karty i kalkulator raty mają wtedy pokazać obniżoną ratę i przekreśloną
poprzednią, korzystając z istniejącej logiki.

**Parametr `?src=`:** odczytaj raz, zapisz w stanie strony, dołączaj do każdego leada i do
eventów GTM. Nie zapisuj w ciasteczku — atrybucja dotyczy tej wizyty.

**Kryterium akceptacji fazy 3:** Lighthouse mobile na LP z 12 autami — LCP < 2,0 s,
CLS < 0,1. Hero image serwowany jako WebP z `fetchpriority="high"`, obrazy aut poniżej
pierwszego ekranu z `loading="lazy"`.

---

## Faza 4 — panel administracyjny

Nowy plik `src/pages/admin/LandingPagesPage.tsx` + `landingPagesApi` w `src/services/api.ts`
(wzorzec `heroBannersApi`, linia 928). Trasa chroniona w `src/App.tsx` obok
`/admin/hero-banners`, wpis w nawigacji `src/components/admin/AdminLayout.tsx`.

Widok listy: nazwa, slug, segment, status (aktywna / zaplanowana / wygasła), liczba leadów
z ostatnich 30 dni, akcje: edytuj, duplikuj, kopiuj URL, pobierz QR.

Edytor jednej LP — sekcje formularza:
1. Podstawy: nazwa, slug (z podglądem pełnego URL), segment, aktywność, okno dat.
2. Hero: badge, tytuł, podtytuł, obraz, etykieta CTA.
3. Oferta: rabat, wpłata własna.
4. Auta: przełącznik `MANUAL` / `FILTERED`. W `MANUAL` reuse pickera aut z ustawiania
   oferty osobistej. W `FILTERED` reuse UI filtrów z `src/pages/admin/WidgetsPage.tsx`.
   Pod spodem podgląd wyników z `/preview-listings` i licznik dopasowanych aut.
5. Sekcje: lista slotów z checkboxem `enabled` i polami treści.
6. SEO: `metaTitle`, `metaDescription`, `isIndexable` z ostrzeżeniem, że indeksowanie ma sens
   tylko dla LP evergreen bez daty końca.

**Generator QR:** po stronie klienta, biblioteka `qrcode` (już dostępna w ekosystemie npm,
dodaj jako zależność frontu). Eksport PNG 1024 px z marginesem — wystarczy do druku i do
plansz wideo. QR koduje URL z `?src=qr`.

**Kryterium akceptacji fazy 4:** tworzysz nową LP wyłącznie z panelu, bez deployu, i publiczny
URL działa natychmiast po zapisie.

---

## Faza 5 — SEO i pomiar

1. `backend/src/routes/render.ts`: dopisz `/promo` do wzorca noindex **warunkowo** —
   LP z `isIndexable === true` musi zostać zaindeksowana, więc zamiast wpisu w `NOINDEX_RE`
   dodaj gałąź obsługi ścieżki `/promo/:slug`, która czyta LP z bazy i zwraca meta + flagę
   noindex na podstawie `isIndexable`. Wzorzec: obsługa `LISTING_RE` w tym samym pliku.
2. `ROUTE_MODULES` w `render.ts`: dodaj wpis dla `src/pages/CampaignLandingPage.tsx`.
3. LP wygasła (410 z API) → front robi `<Navigate to="/samochody" replace />`.
4. LP nigdy nie trafia do sitemap i nie jest linkowana z serwisu — zgodnie z
   `SEO_LINKING_STRATEGY_MOTOLIA.md` nie linkujemy do stron noindex.
5. Analityka — eventy do `dataLayer`, wszystkie z `landing_page_slug` i `traffic_source`:
   - `lp_view` przy wejściu,
   - `phone_click` przy kliknięciu w `tel:` (to zaległość P0.1 z audytu CRO — przy okazji
     dołóż ten handler także w `Header.tsx`, `Footer.tsx`, `ListingDetailPage.tsx`),
   - `form_start`, `generate_lead` przez istniejące `trackLeadSubmit`.

**Kryterium akceptacji fazy 5:** w GA4 DebugView widoczne wszystkie cztery eventy z poprawnymi
parametrami; LP z `isIndexable=false` zwraca `<meta name="robots" content="noindex">` w źródle SSR.

---

## Czego NIE robić

- Nie budować page-buildera, edytora drag&drop ani pola z dowolnym HTML/Markdown.
- Nie tworzyć encji `Campaign`, `Variant`, `Experiment` — nie ma ich w zakresie.
- Nie duplikować `CallbackForm`, `ListingCard` ani logiki kalkulatora raty. Jeśli komponent
  wymaga nowego propa, dodaj prop — nie kopiuj pliku.
- Nie ruszać `PersonalOfferPage` ani `SpecialOfferContext` ponad to, co opisano w fazie 3.
- Nie dodawać LP do sitemapy ani do nawigacji serwisu.
- Nie wdrażać multi-brandowości LP w tej iteracji — LP dziedziczy brand z `VITE_BRAND`.

---

## Kolejność pracy i weryfikacja

Fazy wykonuj po kolei, każdą kończ zielonymi testami i lintem. Po fazie 3 zgłoś się po review
wizualne, zanim zaczniesz panel — łatwiej poprawić układ przed dopięciem admina.

Przed zgłoszeniem gotowości uruchom: `npm run lint`, `npm run test`, testy backendu,
oraz `npm run build` (sprawdź, czy nowa trasa nie wpadła do głównego chunka).

Po wdrożeniu na produkcję zaproponuj wpis devlog do Vault (projekt: motolia) — zgodnie
z sekcją 5 `CLAUDE.md`.
