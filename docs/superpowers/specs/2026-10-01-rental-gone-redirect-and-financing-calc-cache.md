# Spec: 301 dla wycofanych aut najmu + cache kalkulacji finansowania

Data: 2026-10-01 · Źródło: analiza logów prod (nginx, Traefik 26 h, Postgres) z 2026-10-01.

Dwie niezależne zmiany w backendzie. Każda w osobnym commicie, jedna gałąź od `main`
(np. `perf/rental-gone-301-financing-cache`). Bez zmian we frontendzie.

---

## Zmiana A — wycofane auto najmu: 301 na listę wynajmu zamiast 404

### Problem

`/wynajem-dlugoterminowy/:slug` dla auta, które istnieje w bazie, ale ma `isPublished=false`
lub `isActive=false`, zwraca 404. Na prod 50 ze 172 aut jest nieopublikowanych; w 2 h logów
12 takich 404 (Googlebot, Bingbot, użytkownicy z zewnętrznych linków). Oferty sprzedaży robią
to lepiej: po okresie „sprzedane” 301 na hub modelu (`resolveOfferLifecycle`, stan `LONG_GONE`).

### Zmiana

Plik: `backend/src/routes/render.ts`, blok `const rm = path.match(RENTAL_RE)` (ok. L665–692).

Obecnie:
```ts
const rental = await fastify.prisma.rentalVehicle.findFirst({
    where: { slug: rm[1], isActive: true, isPublished: true },
    select: { ... },
});
if (!rental) return defaultMeta(ctx, { noindex: true, status: 404 });
```

Docelowo: gdy `rental` jest `null`, sprawdzić, czy auto o tym slugu w ogóle istnieje
(bez filtrów `isActive`/`isPublished`, `select: { id: true }`):

- istnieje → zwrócić 301 na `/wynajem-dlugoterminowy`, dokładnie wzorem gałęzi `LONG_GONE` ofert:
  ```ts
  return {
      ...defaultMeta(ctx, { noindex: true, status: 301 }),
      redirectUrl: '/wynajem-dlugoterminowy',
      status: 301,
  };
  ```
- nie istnieje → bez zmian: 404.

Dodatkowe zapytanie idzie tylko w ścieżce „nie znaleziono”, więc nie dotyka renderu
opublikowanych aut. Obsługa `redirectUrl`/301 w handlerze i w cache SSR już istnieje
(`render.ts` ok. L1227, L1438, L1464) — nie ruszać. Wpisy ze statusem ≠ 200 mają w cache SSR
krótki TTL (5 min, `SHORT_TTL_SECONDS`), a edycja/archiwizacja/przywrócenie auta już woła
`invalidateOfferCache` (`rental-vehicles.ts`), więc ponowna publikacja przywraca 200 bez
dodatkowej logiki.

Poza zakresem: endpoint JSON `/api/rental/vehicles/:slug` zostaje z 404 (SPA pokazuje NotFound;
po SSR-owym 301 przeglądarka i tak tam nie trafi).

Decyzja (zatwierdzona 2026-10-01): cel to hub `/wynajem-dlugoterminowy`. Nie ma stron najmu per marka/model, a strona
sprzedaży (`/samochody/...`) to inna intencja niż najem.

### Testy (`backend/src/routes/__tests__/render.test.ts`, wzorem istniejących testów najmu ok. L300–370)

1. Auto z `isPublished: false` → `GET /api/render?path=/wynajem-dlugoterminowy/<slug>` daje 301,
   nagłówek `Location: /wynajem-dlugoterminowy`.
2. Auto z `isActive: false` (opublikowane) → to samo, 301.
3. Nieistniejący slug → 404 (regresja).
4. Opublikowane, aktywne auto → 200 (istniejące testy muszą przejść bez zmian).

Testy sprzątają utworzone rekordy, jak pozostałe w pliku.

---

## Zmiana B — cache wyniku `POST /api/financing/calculate`

### Problem

Najwolniejszy publiczny endpoint: 1173 wywołań/dobę, p50 238 ms, p99 1,5 s, max 4,6 s
(Traefik, 26 h). Każde wywołanie idzie na żywo do API Inbank lub Vehis; nic nie jest
zapamiętywane. Wynik zależy wyłącznie od parametrów zapytania i konfiguracji produktu/połączenia,
więc te same kombinacje (domyślne suwaki na danej ofercie) można serwować z Redisa.

### Zmiana

Plik: `backend/src/routes/financing.ts`, handler `fastify.post('/api/financing/calculate', ...)` (ok. L90).
Użyć istniejących helperów z `backend/src/services/api-cache.ts` (`getJsonFromCache`,
`setJsonInCache`) — namespacing per brand/env/host jest już tam.

1. Walidacja, pobranie `product` i `connection` oraz zwroty 404/400/409 — bez zmian, przed cache.
2. Klucz cache, budowany po tych sprawdzeniach:
   ```
   financing:calc:v1:<product.id>:<product.updatedAt ms>:<connection.updatedAt ms>:<sha1(JSON parametrów)>
   ```
   gdzie „parametry” to sparsowany `data` bez `productId`, z kluczami w stałej kolejności
   (`price, downPaymentAmount, period, initialFeePercent, finalPaymentPercent, manufacturingYear, mileageKm`;
   brakujące jako `null`). `updatedAt` w kluczu sprawia, że każda edycja produktu lub połączenia
   w panelu automatycznie omija stare wpisy — bez osobnej inwalidacji. Hash: `node:crypto`
   `createHash('sha1')`.
3. Trafienie w cache → zwrócić zapisany obiekt (ten sam kształt co dziś, 200).
4. Brak w cache → wywołać `calcInbankInstallment` / `calcVehisInstallment` jak dziś; zapisać
   wynik przez `setJsonInCache(key, result, 21600)` (6 h) i zwrócić.
5. Błędy NIE są cache'owane: `FinancingCalcError` i każdy inny wyjątek idą ścieżką jak dziś
   (zapis tylko po udanym wyniku).
6. Brak Redisa (`getJsonFromCache` zwraca `null`, `setJsonInCache` nic nie robi) → zachowanie
   identyczne jak dziś. Nie dodawać własnej obsługi błędów Redisa ponad to, co robią helpery.

Nie używać `getOrSetJson` — jego dedup in-flight jest OK, ale miesza się z rzucaniem
`FinancingCalcError`; prosty get → compute → set jest czytelniejszy. Nie dodawać nagłówków
HTTP cache (to POST, Cloudflare go nie cache'uje).

Decyzja (zatwierdzona 2026-10-01): TTL 6 h. Oprocentowanie u partnerów zmienia się rzadko, a zmiany
konfiguracji po naszej stronie i tak zmieniają klucz. Krócej = mniejszy zysk; dłużej = ryzyko
nieaktualnej raty po zmianie cennika u partnera.

### Testy (`backend/src/routes/__tests__/financing-logging.test.ts` lub nowy `financing-calc-cache.test.ts`, wzorem istniejącego)

Z zamockowanym `fetch` partnera (jak w `financing-logging.test.ts`) i działającym Redisem
testowym (jeśli Redis w testach niedostępny — mock `api-cache` z in-memory Map):

1. Dwa identyczne wywołania → `fetch` do partnera wywołany raz, obie odpowiedzi 200 i równe.
2. Inny `period` → drugie wywołanie partnera.
3. Po `financingProduct.update` (zmiana `updatedAt`) → ponowne wywołanie partnera.
4. Partner zwraca błąd (502 z `FinancingCalcError`) → kolejne identyczne wywołanie znów woła
   partnera (błąd nie trafił do cache).
5. Istniejący test „does not return raw provider body in 502 error” przechodzi.

---

## Weryfikacja (całość)

Z katalogu `backend/`:
```
npx tsc --noEmit
npx vitest run src/routes/__tests__/render.test.ts src/routes/__tests__/financing-logging.test.ts
```
(+ nowy plik testów, jeśli powstał). Po zmianie kodu: `graphify update .` w katalogu repo.

Po deployu na prod (osobny krok, nie część implementacji):
- `curl -sI -A "Mozilla/5.0" "https://motolia.pl/wynajem-dlugoterminowy/kia-sportage-l-1-6-t-gdi-7dct-fwd-tec-2025-suv-benzyna-cmsovksyk011s141u6vjwdrru?cb=1"`
  → `301`, `location: /wynajem-dlugoterminowy`.
- Po dobie: w logu Traefika p50 `/api/financing/calculate` wyraźnie poniżej obecnych 238 ms.
