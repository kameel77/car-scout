# Bot Prerender (Faza 2) — Design

Data: 2026-06-13
Dotyczy: motolia.pl + carsalon.pl (wspólny kod, oba brandy)
Kontekst: Faza 1 (spec `2026-06-12-seo-meta-injection-design.md`, wdrożona na prod 2026-06-13) daje botom per-URL title/meta/canonical/JSON-LD w surowym HTML, ale body pozostaje pustą skorupą CSR. Google renderuje JS sam; boty AI (search/user-fetch) nie wykonują JS — widzą tylko head. Faza 2 serwuje botom pełny, wyrenderowany HTML.

## Cel

Bot z listy (wyszukiwarki + AI search + social preview) otrzymuje pełny HTML strony — z treścią body identyczną z tym, co widzi użytkownik po wykonaniu JS. Użytkownicy: zero zmian (ta sama ścieżka co dziś, ani bajta więcej). Degradacja przy awarii nigdy poniżej stanu z Fazy 1.

## Decyzje (zatwierdzone przez właściciela 2026-06-13)

1. **Zakres botów: wyszukiwarki + AI search, bez botów trenujących.** Lista UA: Googlebot, Bingbot, DuckDuckBot, Applebot, PerplexityBot, OAI-SearchBot, ChatGPT-User, Claude-User + social preview (facebookexternalhit, Twitterbot, LinkedInBot, WhatsApp). GPTBot/ClaudeBot/CCBot poza listą — zarządzany robots.txt Cloudflare (`Content-Signal: ai-train=no`, `Disallow: /`) pozostaje bez zmian.
2. **Podejście: dedykowany mikro-serwis Playwright** (nie SSR, nie gotowy prerender.io, nie server-side body w /api/render). Uzasadnienie: 100% parność treści (zero ryzyka cloakingu), zero zmian w aplikacji React, odwracalność (wyłączenie = 1 linia w nginx), pełna kontrola nad cache i limitami RAM.
3. **Cache TTL 24 h** (404 — 1 h). Bot może widzieć dane do doby w tyle; użytkownik zawsze aktualne.
4. **Zasoby VPS nieznane** → projekt zachowawczy: `mem_limit 768m`, concurrency 1, kaskada fallbacków; weryfikacja RAM po deployu w checklistach ops.

## Architektura

```
Bot                                   Człowiek
 │                                       │
 ▼                                       ▼
Cloudflare ─► Traefik (Coolify) ─► nginx (kontener frontend)
                                       │ map UA → $is_prerender_bot
                          ┌────────────┴────────────┐
                          │ bot                     │ nie-bot
                          ▼                         ▼
                 @render → prerender:3000   @render → backend
                 GET /api/render?path=...   GET /api/render?path=...
                          │ 502/503/504/timeout     │ awaria
                          ▼                         ▼
                 @render_meta (backend) ──awaria──► @spa_fallback
```

### Komponent 1: serwis `prerender` (nowy katalog `prerender/` w repo)

Node + Playwright (obraz bazowy `mcr.microsoft.com/playwright:<pinned>-jammy`, Chromium). Trzy moduły:

- **`server`** — HTTP, kontrakt identyczny z backendem: `GET /api/render?path=<ścieżka>` (+ `GET /health`). Dzięki temu nginx wybiera upstream jedną mapą, a kaskada `error_page` jest wspólna.
- **`renderer`** — jedna współdzielona instancja Chromium; kolejka renderów: `MAX_CONCURRENCY=1`, max 10 oczekujących, nadmiar → 503 (nginx robi fallback do backendu). Restart przeglądarki co 50 renderów (wycieki pamięci Chromium). Render: otwarcie `${TARGET_URL}${path}` z normalnym UA Chrome + nagłówkiem `X-Prerender: 1`; czekanie na `networkidle` z twardym timeoutem `RENDER_TIMEOUT_MS=15s`; status HTTP odpowiedzi = status dokumentu (404 z Fazy 1 propaguje się automatycznie).
- **`postprocess`** (czysta funkcja, unit-testy): usunięcie `<script>` poza `application/ld+json`; usunięcie `<link rel="modulepreload">` i preloadów JS; przepisanie wewnętrznego originu na publiczny (`http://frontend:80` i `http://frontend` → `PUBLIC_ORIGIN`) — naprawia canonical/og:url budowane przez `MetaHead.tsx:23` z `window.location.origin`.
- **`cache`** (czysta logika + dysk, unit-testy): klucz `host+path`, wolumen `CACHE_DIR`, TTL 24 h (404: 1 h), zapis statusu+HTML; stale-if-error (render padł → serwujemy przeterminowany wpis, jeśli jest); limit wpisów 10 000 (LRU po mtime).

Env: `TARGET_URL` (default `http://frontend:80`), `PUBLIC_ORIGIN` (= `FRONTEND_URL`), `CACHE_DIR`, `CACHE_TTL_MS`, `NOT_FOUND_TTL_MS`, `RENDER_TIMEOUT_MS`, `MAX_CONCURRENCY`, `PORT=3000`.

### Komponent 2: nginx (`nginx.conf` w repo — kontener frontendu, nie proxy Coolify)

- `map $http_user_agent $is_prerender_bot` — lista z decyzji 1; druga mapa nadpisuje na `0`, gdy obecny nagłówek `X-Prerender` (ochrona przed pętlą: prerender → frontend nginx → znowu prerender).
- `map $is_prerender_bot $render_upstream { 1 → http://prerender:3000; default → $backend_addr; }`.
- `@render`: `proxy_pass $render_upstream/api/render?path=$request_uri`; `proxy_read_timeout` podniesiony do 20 s (zimny render); `error_page 502 503 504 = @render_meta`.
- Nowy `@render_meta`: zawsze `$backend_addr/api/render?...` (stan z Fazy 1); `error_page 502 503 504 = @spa_fallback`. Dla ruchu ludzkiego (`$render_upstream` = backend) kaskada próbuje backendu drugi raz — akceptowalny koszt prostoty.
- `location /` i `location = /` bez zmian (kierują do `@render` jak dziś).

### Komponent 3: compose + CI

- `docker-compose.coolify.yml`: nowy serwis `prerender` — image `ghcr.io/kameel77/car-scout-prerender:${IMAGE_TAG:-dev}`, env j.w. (`PUBLIC_ORIGIN: ${FRONTEND_URL}`), wolumen nazwany na cache, `mem_limit: 768m`, sieć `carscout-private`, healthcheck `GET /health`. Jeden kontener per stack brandu (stacki Coolify mają osobne sieci) — 2 kontenery na VPS.
- `.github/workflows/docker.yml`: nowy wpis matrixa `prerender` (context `./prerender`, brand `none`) — obraz buduje się i taguje jak backend.

## Error handling

Kaskada dla bota: prerender (cache → render) → awaria/timeout/503 → meta-injection z backendu (= dziś) → awaria → statyczny shell. OOM-kill kontenera prerender dotyka wyłącznie botów (fallback), nigdy użytkowników. Degradacja nigdy poniżej stanu Fazy 1.

## Testy

1. Unit (vitest, bez przeglądarki): `postprocess` (strip skryptów z zachowaniem JSON-LD, rewrite originu, preloady) i `cache` (TTL, TTL 404, stale-if-error, klucz host+path, LRU).
2. `nginx -t` w Dockerze (envsubst + nginx:alpine) — jak w Fazie 1.
3. Build obrazu prerender lokalnie lub w CI przed merge.

## Kryteria akceptacji (na dev.motolia.pl)

1. `curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" https://dev.motolia.pl/oferta/<slug>` → pełny HTML: nazwa pojazdu i cena **w body** (nie tylko w head), zero `<script type="module">`, canonical/og:url z originem `https://dev.motolia.pl`, JSON-LD zachowany.
2. To samo żądanie ze zwykłym UA przeglądarki → obecny shell z meta (Faza 1), bundle JS nietknięty.
3. Drugi hit bota w ten sam URL → odpowiedź z cache (szybka, < 0,5 s).
4. UA bota + nieistniejący slug → 404.
5. Zatrzymany kontener prerender → UA bota dostaje odpowiedź meta-injection z backendu (stan z Fazy 1), status 200.
6. UA PerplexityBot → prerender; UA GPTBot → ścieżka jak zwykły ruch (poza listą).
7. Testy jednostkowe prerendera zielone; pełna suita backendu bez nowych regresji.

## Ops (checklist dla właściciela)

- Redeploy obu stacków w Coolify po merge (nowy serwis pojawi się z compose).
- Po starcie: weryfikacja RAM na VPS (Coolify/htop) — czy 2× prerender (limit 768 MB każdy, realnie ~300-500 MB) mieści się w zapasie; w razie potrzeby zmniejszenie limitu lub wyłączenie jednego brandu.
- Cloudflare: bez zmian (ai-train=no zostaje; boty z listy dostają dziś 200 — zweryfikowane 2026-06-13).
- Po wdrożeniu: Google Search Console URL Inspection („Test live URL" pokazuje wyrenderowany HTML), monitoring indeksacji.

## Poza zakresem

- Warm-up cache z sitemapy (cron prerenderujący wszystkie URL-e z wyprzedzeniem) — do rozważenia, jeśli zimne rendery okażą się problemem dla crawl budgetu.
- Zmiany polityki ai-train / odblokowanie botów trenujących — decyzja biznesowa właściciela, poza tym projektem.
- Prerender dla stacka staging (IMAGE_TAG=staging działa automatycznie, ale weryfikujemy tylko dev + prod).
