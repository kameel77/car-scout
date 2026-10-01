# Spec: partia A — porządki na brzegu (robots, logi nginx, seo-content, ikony, nagłówki /uploads)

Data: 2026-10-01 · Źródło: audyt logów prod z 2026-10-01 (memory `prod-perf-audit-2026-10`).
Gałąź: `chore/edge-hygiene-batch-a` (od `origin/main`). Pięć małych, niezależnych zmian — każda
w osobnym commicie. Brak zmian w schemacie bazy.

---

## A1 — robots.txt: blokada wyszukiwania wewnętrznego + scalenie grup `User-agent: *`

**Problem.** Bingbot crawluje `/uzywane?q=<spam>` (frazy typu „100 000 zimbabwe dollars to usd”,
chińskie znaki) — 22 żądania w 2 h. Strona ma canonical `/uzywane`, ale każde wejście to ~9
ciężkich zapytań do bazy. Google zaleca blokowanie wyników wyszukiwania wewnętrznego w robots.
Dodatkowo plik ma dwie grupy `User-agent: *` (pierwsza zawiera tylko `Content-Signal`).

**Plik:** `backend/src/routes/seo.ts`, handler `GET /api/robots.txt` (ok. L264), stała `body`.

**Zmiana:**
1. W **każdej** grupie, która ma reguły `Disallow` (Googlebot, Bingbot, SemrushBot, `*`), dopisać
   po `Disallow: /*/zapytanie$`:
   ```
   Disallow: /*?q=
   Disallow: /*&q=
   ```
   Uwaga: grupa Googlebot/Bingbot zastępuje grupę `*` (nie dziedziczy), więc reguła musi być w każdej.
   `Allow: /api/listings` jest dłuższe niż `/*?q=`, więc wywołania API z `q` dalej są dozwolone
   (Google stosuje najdłuższe dopasowanie) — tak ma zostać.
2. Usunąć pierwszą grupę (`User-agent: *` + `Content-Signal: ...` + pusta linia) i przenieść linię
   `Content-Signal: search=yes, ai-input=yes, ai-train=no` do ostatniej grupy `User-agent: *`,
   bezpośrednio pod `User-agent: *`. Treść pozostałych grup bez zmian.
3. Dopisać nad `const body` jedno-dwuzdaniowy komentarz (po polsku, styl jak istniejące) z powodem
   blokady `q=`.

Gałąź nieprodukcyjna (`Disallow: /`) — bez zmian.

**Testy:** `backend/src/routes/__tests__/seo.test.ts` (tam są testy robots) — dodać asercje:
- body zawiera `Disallow: /*?q=` w grupie Googlebot i w grupie `*` (np. sprawdzić, że występuje
  co najmniej 4 razy — po jednym na grupę z regułami);
- `User-agent: *` występuje w body dokładnie raz;
- `Content-Signal:` występuje dokładnie raz.
Istniejące testy robots i `deindexing-guard.test.ts` muszą przejść.

---

## A2 — logi nginx: czas odpowiedzi i prawdziwe IP klienta

**Problem.** Domyślny `log_format main` z obrazu nginx nie ma czasu odpowiedzi, a `$remote_addr`
to IP brzegu Cloudflare. Diagnoza wydajności wymaga dziś łączenia logów nginx z logami Traefika.

**Pliki:** `nginx-rate-limit.conf` (kontekst http — kopiowany do `/etc/nginx/conf.d/rate-limit.conf`)
i `nginx.conf` (szablon `default.conf`, kontekst server).

**Zmiana:**
1. W `nginx-rate-limit.conf` dopisać na końcu:
   ```nginx
   # Access log z czasem odpowiedzi i realnym IP klienta (CF-Connecting-IP) —
   # $remote_addr za Cloudflare+Traefikiem to IP brzegu CF.
   log_format timed '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent" '
                    'cf_ip=$http_cf_connecting_ip rt=$request_time urt=$upstream_response_time '
                    'cache=$upstream_cache_status';
   ```
   (`$upstream_cache_status` usunąć, jeśli `nginx -t` go nie zna — nie ma proxy_cache; wtedy bez tego pola.)
2. W `nginx.conf`, w bloku `server { ... }` na górze (obok innych dyrektyw serwera), dodać:
   ```nginx
   access_log /var/log/nginx/access.log timed;
   ```
   Format musi być zdefiniowany przed użyciem — conf.d jest includowany w http przed server, więc OK
   (weryfikuje to `nginx -t` poniżej).

Uwaga: `nginx.conf` przechodzi przez `envsubst '${BACKEND_URL} ${VITE_TURNSTILE_SITE_KEY}'` — zmienne
nginx (`$request_time` itp.) NIE są podmieniane, bo envsubst ma jawną listę. Nie zmieniać tej listy.

**Weryfikacja:** test konfiguracji w czystym kontenerze:
```bash
docker run --rm -v "$PWD/nginx.conf:/tmp/t.conf:ro" -v "$PWD/nginx-rate-limit.conf:/etc/nginx/conf.d/rate-limit.conf:ro" \
  -e BACKEND_URL=http://127.0.0.1:3000 -e VITE_TURNSTILE_SITE_KEY=x nginx:alpine \
  sh -c "envsubst '\${BACKEND_URL} \${VITE_TURNSTILE_SITE_KEY}' < /tmp/t.conf > /etc/nginx/conf.d/default.conf && nginx -t"
```
Musi zwrócić `syntax is ok` / `test is successful`. (Jeśli `nginx -t` padnie na `resolver`/`host not found`
niezwiązanym z tą zmianą, sprawdzić ten sam test na `origin/main` i porównać — raportować różnicę.)

---

## A3 — `/api/seo-content`: brak treści = 200 `null` zamiast 404

**Problem.** Strony marek/modeli bez treści CMS pytają `/api/seo-content?path=...` i dostają 404
(~100/dobę, także renderer Googlebota) — szum 404 w statystykach indeksowania.

**Plik:** `backend/src/routes/seo-content.ts`, handler `GET /api/seo-content` (ok. L29).

**Zmiana:** gdy `content` jest puste — zwrócić **200 z ciałem JSON `null`** zamiast 404, zostawiając
ten sam nagłówek `Cache-Control: public, max-age=0, s-maxage=60`. Komentarz: dlaczego 200 a nie 404/204.

Dlaczego `null`, a nie 204: frontend (`src/services/api.ts`, `seoContentApi.getPublic`) robi
`if (status === 404) return null; ... return response.json()`. Na 204 `response.json()` rzuca — a stary
bundle JS może jeszcze siedzieć w cache przeglądarek. `200 null` działa z obecnym frontendem bez zmian.
**Frontendu nie zmieniamy.**

400 dla braku `path` — bez zmian.

**Testy:** `backend/src/routes/__tests__/seo-content.test.ts` — test(y) oczekujące 404 dla
nieopublikowanej/nieistniejącej strony zmienić na: status 200, `JSON.parse(body) === null`,
nagłówek Cache-Control jak wyżej. Pozostałe testy bez zmian.

---

## A4 — ikony w katalogu głównym (`/favicon.ico`, `/apple-touch-icon*.png`)

**Problem.** Przeglądarki i boty pytają o `/favicon.ico`, `/apple-touch-icon.png`,
`/apple-touch-icon-precomposed.png` niezależnie od `<link rel="icon">` → 404. Favicon jest per marka
(`vite.config.ts`, `meta.favicon` = `/brands/<brand>/favicon.png`), a nginx nie zna marki.

**Zmiana:**
1. `vite.config.ts`, plugin `brand-html-transform`: dodać hook `generateBundle` emitujący asset
   `apple-touch-icon.png` (w katalogu głównym `dist/`) z zawartością pliku `public${meta.favicon}`
   (`this.emitFile({ type: 'asset', fileName: 'apple-touch-icon.png', source: fs.readFileSync(...) })`).
   Dzięki temu `/apple-touch-icon.png` serwuje `location /` (`try_files $uri`) jako plik statyczny.
2. `nginx.conf`: dodać dwie lokacje dokładne (obok innych `location =`):
   ```nginx
   # Ikony pytane przez przeglądarki/boty spoza <link rel="icon"> — favicon marki
   # emitowany przy buildzie jako /apple-touch-icon.png (vite.config.ts).
   location = /favicon.ico {
       default_type image/png;
       try_files /apple-touch-icon.png =404;
       add_header Cache-Control "public, max-age=86400";
   }
   location = /apple-touch-icon-precomposed.png {
       try_files /apple-touch-icon.png =404;
       add_header Cache-Control "public, max-age=86400";
   }
   ```
   Uwaga: `add_header` w lokacji kasuje dziedziczone nagłówki bezpieczeństwa z poziomu server —
   dla ikon to akceptowalne (tak samo działa `/brands/`).

Poza zakresem: `public/favicon.png` (to ikona carsalon, serwowana też na motolia pod `/favicon.png`) —
nie ruszać, nic go nie linkuje; tylko odnotować w raporcie.

**Weryfikacja:** `VITE_BRAND=motolia npx vite build` (lub skrypt build z package.json z tą zmienną) →
`cmp dist/apple-touch-icon.png public/brands/motolia/favicon.png` zgodne; to samo dla `carsalon`.
`nginx -t` jak w A2.

---

## A5 — `/uploads/`: jeden nagłówek Cache-Control

**Problem.** `expires 30d;` + `add_header Cache-Control "public, no-transform";` dają dwa nagłówki
`Cache-Control` w odpowiedzi (`max-age=2592000` i `public, no-transform`).

**Plik:** `nginx.conf`, `location /uploads/`.

**Zmiana:** usunąć `expires 30d;`, a `add_header` zamienić na
`add_header Cache-Control "public, max-age=2592000, no-transform";` (jak w `location /brands/`).
`expires` dokładał też nagłówek `Expires` — przy `max-age` jest zbędny.

**Weryfikacja:** `nginx -t` jak w A2.

---

## Weryfikacja całości

Z `backend/`:
```
npx tsc --noEmit
npx vitest run src/routes/__tests__/seo.test.ts src/routes/__tests__/seo-content.test.ts src/routes/__tests__/deindexing-guard.test.ts
```
Z katalogu głównego repo: test `nginx -t` (A2) oraz build obu marek (A4).
Po zmianach: `graphify update .`.

Po deployu na prod (osobny krok):
- `curl -s -A "Mozilla/5.0" https://motolia.pl/robots.txt` — `Disallow: /*?q=` w grupach, jedna grupa `*`.
- `curl -sI -A "Mozilla/5.0" "https://motolia.pl/favicon.ico?cb=1"` → 200 `image/png`.
- `curl -sI -A "Mozilla/5.0" "https://motolia.pl/uploads/<dowolny obraz>?cb=1"` → jeden `cache-control`.
- `docker logs --tail 5 <frontend prod>` → linie z `cf_ip=` i `rt=`.
