# Spec: odchudzenie głównego chunka JS motolii (etap 3)

Data: 2026-09-30 · Autor: claude-session (opus) · Status: do akceptacji

## Problem

Główny plik `assets/index-*.js` ma **589 KB (185 KB gzip)** i jest wykonywany na starcie **każdej** strony,
także `/samochody`, `/oferta/*`, `/leasing`. Na średnim Androidzie parsowanie i wykonanie to kilkaset ms
głównego wątku: rośnie TBT (lab: 164–327 ms) i opóźnienie wejścia pierwszych interakcji (INP).

Pomiar: build motolii z `rollup-plugin-visualizer` (2026-09-30, stan `origin/main`). Rozmiary „min" to
szacunek z proporcji rendered→minified (0,56), ±10%.

| Kandydat | ~KB min | Skąd w głównym chunku |
|---|---|---|
| i18next + react-i18next | 48 | `import './i18n'` w App.tsx (etap 2, osobna decyzja) |
| floating-ui + react-popper | 44 | zależność Tooltip (App.tsx) i DropdownMenu (Header) |
| embla-carousel + ui/carousel + HeroBannerCarousel | 33 | strona główna jest importowana synchronicznie (celowo, SSR shell) |
| Radix menu/dropdown/roving-focus | 31 | przełącznik języka w `Header` |
| `services/api.ts` | 30 | jeden moduł z endpointami publicznymi **i** admina |
| MotoliaHomePage + HeroVehicleFilter | 25 | celowo synchronicznie — zostaje |
| Radix Tooltip | 11 | `TooltipProvider` w App.tsx |
| i18next-browser-languagedetector | 8 | `src/i18n/index.ts` |
| `services/rental-api.ts` | 6 | `HeroVehicleFilter` (zakładka „najem") |
| consent (baner + dialog ustawień) | 4 | `ConsentBanner` w App.tsx |

## Zakres etapu 3 (niskie ryzyko, bez zmiany wyglądu)

Każdy punkt osobnym commitem, żeby dało się zmierzyć i ewentualnie cofnąć pojedynczo.

### 3.1 Tooltip lokalnie zamiast globalnego providera (~11 KB + część floating-ui)
- Usunąć `TooltipProvider` z `src/App.tsx`.
- W `src/components/ui/tooltip.tsx`: `Tooltip` = Root owinięty własnym `TooltipPrimitive.Provider delayDuration={0}`
  (wzorzec shadcn). Istniejące jawne `TooltipProvider` w komponentach zostają — działają dalej.
- Efekt: kod tooltipa trafia tylko do chunków, które go używają (ListingCard/SearchPage, szczegóły oferty, najem).

### 3.2 Przełącznik języka w Header ładowany przy pierwszej interakcji (~31 KB + reszta floating-ui)
- Przycisk wyzwalający (Globe + flaga) renderowany zwykłym `<Button>` bez Radix.
- Na `pointerenter`/`focus` → prefetch `import('./LanguageMenu')`; na kliknięcie → render leniwego `LanguageMenu`
  (DropdownMenu) otwartego od razu (`defaultOpen`), fokus na pierwszej pozycji.
- Warunek: gdy `enabledLanguages.length <= 1` przycisk w ogóle się nie renderuje (sprawdzić obecne zachowanie).
- Po 3.1 + 3.2 floating-ui/popper (~44 KB) powinny zniknąć z głównego chunka — **zweryfikować w visualizerze**;
  jeśli coś jeszcze je wciąga, zaraportować importera, nie kombinować dalej.

### 3.3 Karuzela banerów na stronie głównej bez embla na starcie (~33 KB)
- `HeroBannerCarousel`: pierwszy render = statyczny pierwszy baner (ten sam markup/klasy/`priority` obrazka co
  dziś slajd 0 — LCP strony głównej to ten obraz i SSR shell go już maluje; nie może być przeskoku).
- Gdy `banners.length > 1`: po `requestIdleCallback` (fallback `setTimeout 1500`) dynamiczny import modułu
  z karuzelą (embla + `ui/carousel`) i podmiana na karuzelę startującą od slajdu 0. Przy 1 banerze embla nigdy
  się nie ładuje.
- Wysokość kontenera identyczna w obu stanach (CLS = 0).

### 3.4 `rental-api` na żądanie w HeroVehicleFilter (~6 KB)
- `queryFn` opcji najmu: `const { rentalPublicApi } = await import('@/services/rental-api')`. Zapytanie i tak
  jest asynchroniczne — brak zmiany zachowania.

### 3.5 Podział `services/api.ts` na publiczny i admina (~15–20 KB)
- Eksporty importowane **wyłącznie** z `src/pages/admin/**` i `src/components/admin/**` przenieść do
  `src/services/api-admin.ts` (lista do ustalenia grepem; kandydaci: `importApi`, `csflowApi`, `pewneautoApi`,
  `usersApi`, `partnerManagementApi`, części `settingsApi`/`seoContentApi` z metodami zapisu).
- Wspólny helper fetch/auth zostaje w `api.ts` i jest importowany przez `api-admin.ts`.
- Obiektów współdzielonych przez publiczne i admina (np. `listingsApi`) nie dzielić w tym etapie.

### 3.6 Wykrywanie języka bez `i18next-browser-languagedetector` (~8 KB)
- Zastąpić detektor funkcją: `localStorage['i18nextLng']` (ten sam klucz — zachowuje wybór obecnych
  użytkowników) → `navigator.language` → `'pl'`; zapis do `localStorage` w `i18n.on('languageChanged')`.
- Owinąć dostęp do `localStorage` w try/catch (Safari prywatny).

### 3.7 Lazy `ConsentBanner` (~4 KB)
- W App.tsx render baneru tylko gdy brak zapisanej zgody (odczyt synchroniczny z tego samego źródła co
  `useConsent`), komponent przez `lazy()`. Link „Ustawienia cookies" w stopce musi nadal otwierać dialog.

### 3.8 Wydzielenie vendorów dla cache (0 KB, lepszy cache po deployach)
- `build.rollupOptions.output.manualChunks`: `react` (react, react-dom, scheduler, react-router, react-router-dom,
  @remix-run/router) i `query` (@tanstack/*). Sprawdzić, że `render.ts` (manifest → modulepreload) dalej
  preloaduje entry i chunk trasy; w razie potrzeby dołożyć preload vendor chunków (entry je importuje statycznie,
  więc Vite i tak wstawia `modulepreload` w index.html — zweryfikować w zbudowanym HTML).

## Poza zakresem (osobne decyzje)
- **Etap 3b — zamiana i18next na własny shim** (~48 KB): 41 plików publicznych z `useTranslation`, 3× `<Trans>`,
  brak liczby mnogiej, `DynamicTranslationsLoader` dokłada tłumaczenia z API. Duży zysk, ale dotyka całej warstwy
  tekstów — najpierw zmierzyć efekt 3.1–3.8.
- `tailwind-merge`, `react-helmet-async`, Preact — nie ruszamy.
- Synchroniczny import strony głównej — zostaje (SSR shell bez migotania).

## Kryteria akceptacji
1. Główny chunk motolii: **≤ 470 KB min** (dziś 589) — raport z visualizera przed/po, per punkt.
2. `npx vitest run` zielone; `tsc` bez nowych błędów (5 istniejących w admin/pipeline, ProgramSettingsTab,
   ListingDetailPage).
3. Brak zmian wizualnych: `/`, `/samochody`, `/oferta/*`, `/wynajem-dlugoterminowy`, panel admina (logowanie,
   lista ofert) — zrzuty przed/po; tooltip na karcie oferty, przełącznik języka (jeśli włączony), karuzela
   przy >1 banerze, baner cookies dla nowego użytkownika.
4. Lighthouse devtools, mobile, mediana z 3: TBT na `/` i `/samochody` nie gorsze niż dziś
   (327 / 164 ms), LCP bez regresji (~2,0 s).
5. Po wdrożeniu: RUM `rum-inp-report` — `inputDelay` dla interakcji w pierwszych sekundach nie rośnie.

## Kolejność i szacowany efekt
3.1 → 3.2 (razem z floating-ui ~85 KB) → 3.3 (~33 KB) → 3.5 (~15–20 KB) → 3.6, 3.4, 3.7 (~18 KB) → 3.8.
Łącznie **~150 KB min mniej** w głównym chunku (589 → ~440 KB, ok. −25%).
