# Spec: partia B — wyszukiwanie tekstowe (`q`) liczone raz zamiast 10 razy

Data: 2026-10-01 · Źródło: audyt logów prod + pomiary `EXPLAIN ANALYZE` na bazie prod (read-only).
Gałąź: `perf/search-ids-prefilter` (od `origin/main`). Jedna zmiana w backendzie, bez zmian schematu.

## Problem (pomiary)

`GET /api/listings?q=...` (publiczne i panel) uruchamia równolegle 10 zapytań: `findMany`, `count`,
7× `groupBy` (facety) i `dealer.findMany` (miasta). Każde zawiera pełny warunek wyszukiwania:
dla każdego słowa `OR` z 6 × `ILIKE '%słowo%'` + 4 × `equipment_* @> '{słowo}'`.

- Prod, realne zapytanie facetu (`q=NISSAN Juke`): **50–55 ms**, `shared hit=9060` buforów przy
  1495 stronach tabeli — tablice wyposażenia leżą w TOAST (śr. wiersz 2,4 kB) i są rozpakowywane
  dla każdego wiersza, dla którego `ILIKE` nie trafił.
- To samo zapytanie bez warunków na wyposażeniu: **8,6 ms**, `shared hit=1667`.
- 10 takich zapytań naraz na 2 vCPU → `/api/listings` p95 389 ms, max 1,5 s (Traefik, 26 h).
  Wynik jest cache'owany w Redisie 300 s per pełny query string, ale frazy `q` rzadko się powtarzają.

Wyszukiwanie w wyposażeniu ma sens (53 jednowyrazowe elementy, np. „ABS” — 1185 ofert, „tempomat”,
„bluetooth”, „Isofix”), więc **semantyka zostaje bez zmian** — zmieniamy tylko liczbę jej wykonań.

Odrzucone: indeksy `pg_trgm` — `OR` z warunkami na tablicach i tak wymusza przejście po wierszach,
a ręcznie zakładane indeksy wyrażeniowe znikają przy `prisma db push` (deploy).

## Zmiana

Plik: `backend/src/routes/listings.ts`, funkcja `runQuery` w handlerze `GET /api/listings`
(ok. L359–700).

1. Wydzielić warunek widoczności do stałej (dziś jest inline na końcu obiektu `where`):
   ```ts
   const visibilityWhere = authenticated
       ? {
           ...dealerFilter,
           ...(parsed.includeArchived ? {} : { isArchived: false }),
           OR: PUBLIC_LISTING_DISPLAY_MODE_OR,
       }
       : getPublicListingWhere();
   ```
   i w `where` zastąpić dotychczasowe `...dealerFilter, ...(authenticated ? {...} : getPublicListingWhere())`
   przez `...visibilityWhere` — **kolejność spreadów bez zmian względem dzisiejszej** (dziś
   `...dealerFilter` stoi przed blokiem widoczności; w wersji publicznej `dealerFilter` jest `{}`,
   więc przeniesienie go do `visibilityWhere` gałęzi authenticated nic nie zmienia — zweryfikować).

2. Jeśli `searchTerms.length > 0`: **przed** zbudowaniem `where` wykonać jedno zapytanie o ID:
   ```ts
   // Warunek q (ILIKE × 6 + tablice wyposażenia w TOAST) jest drogi — ~50 ms na zapytanie na prod.
   // Liczymy go raz, a facety/count/lista filtrują już po liście ID (PK) — ta sama semantyka.
   const searchIds = searchTerms.length > 0
       ? (await fastify.prisma.listing.findMany({
           where: { ...searchFilter, ...visibilityWhere },
           select: { id: true },
       })).map(r => r.id)
       : null;
   ```
   a w `where` zamiast `...searchFilter` użyć
   `...(searchIds ? { id: { in: searchIds } } : {})`.

   Uwaga na kolizję kluczy: `searchFilter` używa klucza `AND`, `visibilityWhere` — `OR`, więc
   `{ ...searchFilter, ...visibilityWhere }` nie nadpisuje się. Nie dodawać innych kluczy.

3. Reszta (`whereWithout*`, `Promise.all`, mapowanie facetów, cache) — bez zmian. Facety
   dalej pomijają własny wymiar, bo filtr ID dotyczy tylko `q` + widoczności, a te są wspólne
   dla wszystkich facetów.

Pusta lista ID → `id: { in: [] }` → Prisma zwraca puste wyniki i zerowe liczniki — tak samo jak dziś
przy braku trafień. Rozmiar listy: maks. liczba ofert widocznych (~2,4 tys. na prod) — mieści się
w limicie parametrów Postgresa.

## Testy

Brak dziś testów wyszukiwania `q` — dodać `backend/src/routes/__tests__/listings-search.test.ts`
(wzorem innych testów tras: `buildApp()` + `app.inject`, sprzątanie po marce testowej, np.
`make: 'TESTSEARCH…'`). Utworzyć 4–5 publicznie widocznych ofert (spełniających
`getPublicListingWhere`: `isArchived=false`, `pricePln>0`, bez `specificationId`) o różnych
`model`/`fuelType`/`bodyType` i jednej z `equipmentSafety: ['ABS']`, plus jedną zarchiwizowaną
pasującą do frazy. Asercje dla `GET /api/listings?q=...`:

1. fraza po marce zwraca dokładnie oferty tej marki, `count` się zgadza, archiwalna nie wchodzi;
2. fraza dwuwyrazowa (marka + model) zawęża (AND między słowami);
3. fraza „ABS” trafia ofertę po wyposażeniu (semantyka tablic zachowana);
4. `facets.fuelType` / `facets.bodyType` / `byCondition` mają poprawne liczniki dla frazy;
5. fraza bez trafień → `listings: []`, `count: 0`, puste facety;
6. fraza + filtr facetu (np. `q=<marka>&fuelType=...`) → lista zawężona, a `facets.fuelType`
   nadal pokazuje wszystkie paliwa w obrębie frazy (facet pomija własny wymiar).

Testy pisać tak, żeby przechodziły także na kodzie sprzed zmiany (to test równoważności) —
uruchomić je raz przed zmianą (na `origin/main`) i raz po.

## Weryfikacja

Z `backend/`:
```
npx tsc --noEmit
npx vitest run src/routes/__tests__/listings-search.test.ts src/routes/__tests__/render-facets.test.ts
```
oraz pełny `npx vitest run` — oczekiwane wyłącznie 2 znane, niezwiązane porażki z `main`
(`seo-meta.test.ts` „financing category with article…”, `leads-ratelimit.test.ts`), o ile nie
zostały już naprawione. `graphify update .` po zmianach.

Po deployu (osobny krok): w logu Traefika `/api/listings` z `q=` — p95 wyraźnie poniżej 389 ms;
w `pg_stat_statements` zapytania facetów z `ILIKE` znikają z topu, w ich miejsce `id IN (...)`.
