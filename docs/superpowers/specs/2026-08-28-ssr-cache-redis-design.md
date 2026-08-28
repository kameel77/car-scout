# SSR + API cache w Redis — brief wdrożeniowy

Data: 2026-08-28 · Autor specu: Opus 5 (strateg) · Wykonawca: Antigravity · Weryfikacja: Opus 5
Branch bazowy: `dev`

---

## Cel

Przyspieszyć TTFB stron indeksowanych przez Google i odciążyć origin (CPX22, 2 vCPU,
baseline CPU ~50%). Docelowe strony: `/`, `/nowe`, `/uzywane`, `/wynajem-dlugoterminowy`,
`/leasing`, `/kredyt`, strony marek `/samochody/:marka[/:model]`, karta oferty `/oferta/:slug`.

Model docelowy: **długi TTL + inwalidacja zdarzeniowa**. Czas nie jest wyzwalaczem
odświeżenia — dane zmienia sync (4x/dobę) i operator w panelu, i to te zdarzenia czyszczą cache.
TTL jest wyłącznie siatką bezpieczeństwa na wypadek nieudanej inwalidacji.

## Stan obecny (zweryfikowany, nie zmyślać)

- Każde żądanie HTML: `nginx → @render → backend GET /api/render?path=...` (`nginx.conf:131`).
- `backend/src/routes/render.ts` ma cache stron: `Map` w pamięci procesu,
  `PAGE_TTL_MS = 60_000`, `PAGE_CACHE_MAX = 300` (`render.ts:47-48`, `:225`).
- Nagłówki origin są już poprawne: `public, max-age=0, s-maxage=300, stale-while-revalidate=86400`
  + `Vary: Accept-Encoding` (`render.ts:944`). Cloudflare Cache Rule jest włączana osobno
  (poza zakresem tego briefu).
- Redis jest podpięty jako `fastify.redis` (ioredis, `app.ts:120`, dekorator `app.ts:305`).
  Używany dziś punktowo: `listings/options`, `featured:vehicles`, `business:offers`,
  onepager PDF, statyczne opcje rentala.
- `invalidateOfferCache` (`backend/src/services/cache-invalidation.service.ts`) czyści
  cache w pamięci + purguje Cloudflare. Wołane z `listings.ts:844,877,907`,
  `csflow.service.ts:467`, `stock-sync-engine.service.ts:536`.
- Skala: 2829 URL-i w sitemapie. HTML `/nowe` = 178 KB raw / 30 KB gzip.
  Cały serwis gzipowany w Redisie ≈ 85 MB.

## Poza zakresem

- Nie dotykać `nginx.conf` (żadnego `proxy_cache`) ani CSP.
- Nie refaktorować `resolveMeta` ani logiki SEO.
- Nie dotykać frontendu.
- Konfiguracja Cloudflare w dashboardzie — robi ją właściciel.

---

## Etap 1 — inwalidacja stron agregujących (WARUNEK KONIECZNY dla Etapu 2)

**Problem.** `affectedUrls` po syncu nigdy nie obejmuje stron listingowych. Przy TTL 60 s
to niewidoczne, przy TTL 24 h `/nowe` serwowałoby nieaktualną listę.

- `stock-sync-engine.service.ts:383-386,451-454,475-478` dodaje tylko
  `/oferta/:slug` i `/samochody/:marka[/:model]`.
- `csflow.service.ts:420` dodaje **wyłącznie** `/oferta/:slug` — nawet bez stron marek.

**Do zrobienia.**

1. W `cache-invalidation.service.ts` wyeksportować stałą:
   ```ts
   export const AGGREGATE_URLS = [
       '/', '/nowe', '/uzywane', '/samochody',
       '/leasing', '/kredyt', '/wynajem-dlugoterminowy',
   ] as const;
   ```
2. `csflow.service.ts` — doprowadzić do parytetu ze stock-sync: dopisywać
   `/samochody/:marka` i `/samochody/:marka/:model` (użyć tego samego `sanitizeForSlug`,
   co w stock-sync — jeśli nie jest eksportowany, wyeksportować, NIE duplikować implementacji).
3. Oba serwisy: gdy `inserted + updated + archived > 0`, przełączyć purge na
   `invalidateOfferCache(fastify, { purgeAll: true })`.

   **Dlaczego `purgeAll` zamiast listy URL-i:** plan Cloudflare to **Free** — nie ma
   purge-by-prefix ani Cache-Tags, a purge po URL nie obejmie wariantów z `?page=N`.
   Przy 4 syncach na dobę pełny purge jest akceptowalny: assety mają hash w nazwie,
   więc odbudują się natychmiast. Punktowy purge listy URL-i zostaje dla zmian
   operatora w panelu (`listings.ts` — bez zmian).

4. `csflow.service.ts:467` woła `invalidateOfferCache(undefined, ...)` — bez instancji
   fastify. Po Etapie 2 ta funkcja potrzebuje klienta Redis, więc **nie polegać na
   argumencie `fastify`** (patrz Etap 2, pkt 5).

---

## Etap 2 — SSR pageCache w Redis

**Do zrobienia.**

1. Nowy moduł `backend/src/services/ssr-cache.ts` — cała obsługa Redis dla SSR.
   `render.ts` korzysta z niego zamiast lokalnej `Map`.

2. **Format zapisu.** Klucz `ssr:v1:<cacheKey>` (obecny `cacheKey` z `render.ts:979-985`
   bez zmian — już różnicuje `path`, `?page=N`, `make`/`model`, prod/nonprod, modulepreload).
   Wartość: `gzip(JSON.stringify({ html, status, noindex, redirectUrl, at }))` zapisana
   jako Buffer, odczyt przez `redis.getBuffer()`. Gzip jest obowiązkowy — bez niego
   2829 stron × 178 KB ≈ 500 MB zamiast ≈ 85 MB.

3. **TTL i świeżość.**
   - Hard TTL w Redis: `24 h` (`EX 86400`) — backstop.
   - Próg świeżości: `6 h` (pokrywa cykl syncu). Wpis starszy niż 6 h, ale młodszy niż 24 h
     → **oddaj stary HTML natychmiast i odśwież w tle** (bez `await`).
   - Guard przeciw cache stampede: zbiór kluczy „w trakcie odświeżania" w pamięci procesu;
     drugie żądanie na ten sam klucz nie startuje kolejnego renderu.

4. **Graceful degradation — KRYTYCZNE.** Każda operacja na Redisie owinięta try/catch.
   Awaria lub timeout Redisa musi skutkować normalnym renderem bez cache, nigdy błędem 5xx.
   SSR jest na ścieżce krytycznej całego serwisu — padnięcie Redisa nie może zdjąć strony.

5. **Dostęp do klienta Redis poza kontekstem fastify.** `evictPageCacheKeys` /
   `__resetRenderCache` są wołane z `csflow.service.ts` z `fastify === undefined`.
   Rozwiązanie: `ssr-cache.ts` eksportuje `initSsrCache(redis)` wołane raz w `app.ts`
   tuż po utworzeniu klienta (`app.ts:120`), i trzyma go w module scope.
   Nie przekazywać `fastify` przez łańcuch wywołań.

6. **Czyszczenie kluczy:** używać `SCAN` z `MATCH ssr:v1:*` i batchowym `DEL`.
   **Nigdy `KEYS`** — blokuje Redis na czas skanowania.
   Zachować obecną semantykę prefiksową `evictPageCacheKeys` (`render.ts:236-245`):
   klucz dokładny + wszystko zaczynające się od `<key>?` i `<key>/`.

7. **Nagłówki** w `getCacheControlHeader` (`render.ts:925-945`):
   - `s-maxage=300` → `s-maxage=3600`. Świadomie NIE 86400: na CF Free nie ma
     purge-by-prefix, więc luka w inwalidacji (np. `?page=2`) wisiałaby dobę.
     Godzina ogranicza skutek nieudanego purge, a i tak >95% ruchu leci z edge.
   - `request.method !== 'GET'` → dopuścić też `HEAD` (dziś HEAD dostaje `no-store`,
     mimo że powinien zwracać te same nagłówki co GET).
   - Reszta warunków (`/admin`, `NOINDEX_RE`, `noindex`, `Authorization`, status ≠ 200)
     bez zmian.

8. Odpowiedzi `noindex` i status ≠ 200 nadal wolno trzymać w Redisie (jak dziś w `Map`),
   ale z krótkim TTL (`5 min`) — nie zajmują wtedy miejsca przez dobę.

9. Usunąć martwy kod, który zostanie po `Map`: `PAGE_CACHE_MAX`, `__evictPageCache`
   (jeśli po migracji nie ma już wywołań) — ale zostawić `__resetRenderCache`
   i `evictPageCacheKeys` jako API dla `cache-invalidation.service.ts`.

---

## Etap 3 — cache JSON API (niezależny od 1 i 2)

Endpointy pod największym obciążeniem, dziś bez żadnego cache:

| Endpoint | Plik | TTL |
|---|---|---|
| `GET /api/listings` | `routes/listings.ts:230` | 180 s |
| `GET /api/rental/vehicles` | `routes/rental-public.ts:55` | 180 s |
| `GET /api/listings/by-slug/:slug` | `routes/listings.ts:653` | 300 s |
| `GET /api/rental/vehicles/:slug` | `routes/rental-public.ts:485` | 300 s |

**Do zrobienia.**

1. Helper `backend/src/services/api-cache.ts` z `getOrSetJson(key, ttlS, fn)` —
   ten sam wzorzec co istniejący cache w `listings.ts:30-72`, ale wspólny.
   Prefiks kluczy: `api:v1:`.
2. **Klucz z whitelisty parametrów.** Nie budować klucza z surowego query stringa —
   dowolny nieznany parametr rozsadziłby przestrzeń kluczy. Wziąć jawną listę
   obsługiwanych filtrów, znormalizować (lowercase, posortowane po nazwie),
   paginację sklampować.
3. **NIE cache'ować, gdy obecny jest nagłówek `Authorization`.** `/api/listings`
   nakłada `scopeDealerFilter` dla zalogowanego dealera (`listings.ts:233-240`) —
   wspólny klucz wyciekłby wyniki spoza scope'u innemu użytkownikowi.
   To jest wymóg bezpieczeństwa, nie optymalizacja.
4. Nagłówki na tych odpowiedziach: `Cache-Control: public, max-age=0, s-maxage=180`
   oraz nadpisać `Vary` na `Accept-Encoding`. Globalny `@fastify/cors` ustawia
   `Vary: Origin` w hooku `onRequest`, a Cloudflare honoruje wyłącznie
   `Vary: Accept-Encoding` — z innym `Vary` edge cache jest nieprzewidywalny.
   Wzorzec do skopiowania: `render.ts:1002-1008` (razem z komentarzem wyjaśniającym).
5. Rozszerzyć `invalidateOfferCache` o czyszczenie prefiksu `api:v1:` (`SCAN`, nie `KEYS`).

---

## Pułapki (wszystkie zweryfikowane w kodzie)

1. `Authorization` → bezwzględnie omijać cache (Etap 3 pkt 3).
2. `Vary: Origin` z CORS psuje edge cache — nadpisywać na `Accept-Encoding`.
3. Awaria Redisa nie może wywalić SSR — try/catch + fallback do renderu.
4. `csflow.service.ts` woła inwalidację bez instancji fastify.
5. `SCAN`, nigdy `KEYS`.
6. Precedencja `and`/`or` — dotyczy reguły Cloudflare, nie kodu (informacyjnie).
7. Nie zmieniać kształtu `cacheKey` w `render.ts` — jest przemyślany i pokryty testami.

## Kryteria akceptacji

- [ ] `npm test` w `backend/` przechodzi w całości (szczególnie `render.test.ts`,
      `deindexing-guard.test.ts`, `offer-lifecycle.test.ts`, `csflow-sync.test.ts`).
- [ ] `npm run lint` i `npx tsc --noEmit` bez błędów.
- [ ] Nowe testy:
  - inwalidacja po syncu obejmuje wszystkie `AGGREGATE_URLS` (Etap 1);
  - drugie żądanie `/api/render?path=/nowe` trafia w Redis (brak ponownego renderu);
  - wpis starszy niż próg świeżości zwraca stary HTML i planuje odświeżenie w tle;
  - **przy niedostępnym Redisie `/api/render` zwraca 200, nie 5xx**;
  - żądanie z nagłówkiem `Authorization` do `/api/listings` nie czyta i nie zapisuje cache.
- [ ] `GET /api/render?path=/nowe` zwraca `s-maxage=3600` i `Vary: Accept-Encoding`.
- [ ] `HEAD` na stronie indeksowanej zwraca te same nagłówki cache co `GET`.
- [ ] `/admin/*` i strony `noindex` nadal zwracają `private, no-store`.

## Uwagi wykonawcze

- **Weryfikacja `/api/*` na prod wymaga User-Agenta przeglądarki.** `location /api/`
  w `nginx.conf:273` ma `if ($block_curl = "1") { return 444; }`, więc curl z domyślnym
  UA dostaje 502 ze strony błędu Cloudflare (z mylącym `private, no-store,
  post-check=0, pre-check=0` — to nagłówek CF, nie aplikacji). Testować tak:
  `curl -H "User-Agent: Mozilla/5.0 ..." -D - https://motolia.pl/api/listings/options`.
  Strony HTML tego problemu nie mają.
- **Cloudflare Cache Rule jest już wdrożona i zweryfikowana (2026-08-28).**
  `/`, `/nowe`, `/uzywane`, `/wynajem-dlugoterminowy`, `/leasing`, `/kredyt`
  i `/oferta/:slug` zwracają `cf-cache-status: HIT`; `/admin` zostaje `DYNAMIC`
  + `private, no-store`. Podniesienie `s-maxage` do 3600 (Etap 2 pkt 7) zadziała
  bez żadnych dalszych zmian w dashboardzie — reguła respektuje nagłówek z origin.

- Repo ma graf graphify (`graphify-out/graph.json`). Przed grepowaniem użyć
  `graphify query "<pytanie>"` / `graphify explain`. Po zmianach: `graphify update .`.
- Skrypty backendu lokalnie: `npx tsx src/scripts/<name>.ts` (w kontenerze
  `node dist/scripts/<name>.js` — obraz nie zawiera `src/` ani tsx).
- Zmiany surgiczne: każda zmieniona linia musi wynikać z tego briefu.
  Nie „poprawiać przy okazji" sąsiedniego kodu, nie usuwać zastanego martwego kodu.
- Commity per etap, po polsku, w konwencji repo (`feat(cache): ...`, `fix(cache): ...`).
