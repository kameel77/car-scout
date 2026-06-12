# SEO Meta-Injection — Design

Data: 2026-06-12
Dotyczy: motolia.pl + carsalon.pl (wspólny kod, oba brandy)
Kontekst: audyt SEO 2026-06-12 (`~/Documents/Content/SEO/motolia.pl/audits/2026-06-12-audit-inwentaryzacja.md`) — indeksacja ~7/3067 URL-i. Przyczyny w kodzie: CSR bez meta w surowym HTML, 3 URL-e per pojazd bez widocznych canonicali, braki w sitemapie, blokada curl w nginx.

## Cel

Surowy HTML (bez wykonania JS) każdej strony zawiera unikalny `<title>`, `<meta name="description">`, `<link rel="canonical">` i JSON-LD; sitemap i robots.txt są poprawne per brand; nieistniejące strony zwracają 404. Body pozostaje CSR (pełny prerender = Faza 2).

## Decyzje (zatwierdzone przez właściciela 2026-06-12)

1. **Canonical wariantów finansowania → `/oferta/:slug`.** Warianty `/leasing/:slug` i `/kredyt/:slug` zostają w UI i routingu, ale kanonizują do `/oferta/:slug` i wypadają z sitemapy. Frazy „model + leasing/kredyt" przejmą strony tematyczne z kalkulatorami i (przyszłość) strony modelowe finansowania — poza zakresem tego projektu.
2. **Oba brandy** — rozwiązanie brand-aware przez istniejące env (`FRONTEND_URL`, `VITE_BRAND`/`BRAND`), bez feature-flag.
3. **Workflow:** branch `dev`, push po akceptacji właściciela, weryfikacja na dev.motolia.pl; merge do main robi właściciel.
4. **Nginx:** `curl/[78]` odblokowany wyłącznie dla GET/HEAD na trasach stron; na `/api/` i pozostałych lokacjach nadal 444. Reszta blokad bez zmian.

## Architektura

### Komponent 1: endpoint renderujący (backend, Fastify)

`GET /api/render?path=<ścieżka>` w nowym pliku `backend/src/routes/render.ts`:

1. **Szablon:** `index.html` pobierany z kontenera frontendu (`INTERNAL_FRONTEND_URL`, domyślnie `http://frontend:80`), cache w pamięci z TTL 5 min (przeżywa deploye frontendu). Gdy pobranie zawiedzie i brak cache → 503 (nginx wtedy serwuje statyczny fallback).
2. **Router meta:** na podstawie ścieżki wybiera builder:
   - `/oferta/:slug`, `/leasing/:slug`, `/kredyt/:slug` → builder listingu
   - `/wynajem-dlugoterminowy/:slug` → builder najmu
   - ścieżki statyczne → mapa tras (patrz tabela)
   - inne → brand default + `noindex`, status 200 (SPA pokaże swój widok)
3. **Wstrzykiwanie:** podmiana istniejących tagów `<title>`, `description`, `og:*`, `twitter:*` (te same regexy co `brand-html-transform` w `vite.config.ts`) + dopisanie `<link rel="canonical">` i `<script type="application/ld+json">` przed `</head>`. Body bez zmian.
4. **Statusy HTTP:** listing nieznaleziony lub zarchiwizowany → 404 z brand-default meta + `noindex` (naprawa soft-404). Pozostałe → 200.
5. **Cache wyników:** micro-cache w pamięci per ścieżka, TTL 60 s (chroni DB przy crawlu).

### Builder listingu

- ID pojazdu = ostatni segment sluga (slug generowany przez `generateListingSlug` kończy się `-{id}`); lookup Prisma po ID (`isArchived: false`), pojedyncze zapytanie.
- `title`: `{make} {model} {version} {productionYear} — {cena} zł | {brandName}`; dla `/leasing/` i `/kredyt/` z dopiskiem wariantu (np. `— leasing | …`).
- `description`: zdanie z danymi pojazdu (rok, paliwo, nadwozie, cena) + site-wide n-gram („samochody dostępne od ręki u dealerów" dla motolii; carsalon analogicznie wg `brandMeta`).
- `canonical`: **zawsze** `{FRONTEND_URL}/oferta/{slug}` — dla wszystkich trzech wariantów.
- JSON-LD: `Vehicle` + `Offer` (marka, model, rok, cena, waluta, dostępność) — tylko na `/oferta/`; warianty dostają sam canonical.

### Builder najmu

Analogicznie: lookup `rentalVehicle` po slugu, self-canonical, `Vehicle` + `Offer`.

### Mapa tras statycznych (w `render.ts`, brand-aware)

| Ścieżka | title (wzór motolia) | uwagi |
|---|---|---|
| `/` | brand default z `brandMeta` | + JSON-LD `Organization` |
| `/samochody` | `Samochody dostępne od ręki — nowe i używane \| Motolia` | |
| `/nowe` | `Nowe samochody z rabatem dostępne u dealerów \| Motolia` | |
| `/uzywane` | `Samochody używane od dealera z gwarancją \| Motolia` | |
| `/wynajem-dlugoterminowy` | `Najem długoterminowy samochodów \| Motolia` | |
| `/dla-ciebie` | `Oferta dopasowana do Ciebie \| Motolia` | |
| `/dla-firm` | `Samochody i finansowanie dla firm \| Motolia` | |
| `/faq` | `Najczęstsze pytania \| Motolia` | |
| `/kontakt` | `Kontakt \| Motolia` | |

Teksty carsalon analogiczne (brand z env `BRAND`; nazwa brandu i domena z `FRONTEND_URL`). Descriptions per trasa w tej samej mapie. Trasy `/admin/*`, `/login`, `/embed/*` → brand default + `noindex`.

### Komponent 2: nginx

- `location /` (SPA fallback): zamiast `try_files … /index.html` → `proxy_pass` do `{BACKEND_URL}/api/render?path=$uri`; `proxy_intercept_errors on` + `error_page 502 503 504 = @spa_fallback`; named location `@spa_fallback` serwuje statyczny `/index.html` jak dziś. Rate limity i `limit_except GET HEAD` bez zmian.
- Blokada skanerów: warunek `curl/[78]` przeniesiony tak, by obowiązywał wszędzie POZA `location /` (strony GET/HEAD). Pozostałe wzorce (sqlmap, nikto, nuclei itd.) globalnie bez zmian.
- `location = /robots.txt` → proxy do backendu (nowy endpoint `GET /api/robots.txt`).
- Hook Fazy 2: w `location /` przyszły warunek na UA bota kieruje do kontenera prerender zamiast `/api/render`; statyczny fallback zostaje ten sam.

### Komponent 3: sitemap + robots (backend, `seo.ts`)

- Sitemap: usunięcie pętli generującej `/leasing/` i `/kredyt/` (zostaje `/oferta/`); dodanie do `staticPages`: `/uzywane`, `/nowe`, `/dla-firm`.
- Nowy endpoint `GET /api/robots.txt`: treść dzisiejszego `public/robots.txt`, ale `Sitemap: {FRONTEND_URL}/sitemap.xml`; `public/robots.txt` usunięty z frontendu (źródłem jest backend).

### Komponent 4: frontend (jedna zmiana)

`src/pages/ListingDetailPage.tsx`: canonical w `MetaHead` zmienia się z self-canonical na zawsze ścieżkę `/oferta/:slug` (spójność klient–serwer). Komentarz o self-canonical z linii ~356 usunięty. Analogicznie komentarz w `backend/src/routes/seo.ts:144` przestaje być aktualny (kod i tak usuwany).

## Poza zakresem (checklist ops dla właściciela)

- Cloudflare: przegląd nadpisywania robots.txt (live ≠ repo) i blokad AI-botów (istotne dla Fazy GEO); ewentualny rate-limit/challenge dla nie-przeglądarkowych UA, gdy ruch śmieciowy urośnie.
- Merge `dev` → `main` i deploy produkcyjny.
- Po wdrożeniu: zgłoszenie sitemapy w GSC i monitoring indeksacji (`site:`, GSC Coverage).
- Faza 2 (prerender dla botów) — osobny spec, gdy dane pokażą, że meta-injection nie wystarcza.

## Kryteria akceptacji (na dev.motolia.pl, czysty curl bez podszywania UA)

1. `curl -s https://dev.motolia.pl/oferta/<istniejący-slug>` → HTML z nazwą pojazdu w `<title>`, unikalnym description, `<link rel="canonical" href="https://dev.motolia.pl/oferta/<slug>">`, JSON-LD `Vehicle`.
2. `curl -s https://dev.motolia.pl/leasing/<slug>` → canonical wskazuje `/oferta/<slug>`, title z dopiskiem leasingu.
3. `curl -s -o /dev/null -w "%{http_code}" https://dev.motolia.pl/oferta/nieistniejacy-99999999` → `404`.
4. `curl -s https://dev.motolia.pl/sitemap.xml` → zero ścieżek `/leasing/`, `/kredyt/`; zawiera `/uzywane`, `/nowe`, `/dla-firm`; domena z env.
5. `curl -s https://dev.motolia.pl/robots.txt` → linia `Sitemap: https://dev.motolia.pl/sitemap.xml`.
6. `curl -s https://dev.motolia.pl/api/listings` (lub inny endpoint API) → nadal blokowany dla UA curl (444/drop).
7. Zatrzymany kontener backendu → strona główna nadal serwuje statyczny `index.html` (fallback).
8. Testy jednostkowe backendu: parser ID ze sluga, buildery meta (listing/najem/statyczne/404), generator sitemapy bez wariantów.
