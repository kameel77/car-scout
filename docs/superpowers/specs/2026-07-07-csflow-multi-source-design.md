# CSFlow multi-source — obsługa wielu połączeń CSFlow (per grupa dealerska)

Data: 2026-07-07
Status: zaakceptowany kierunek (wariant A + powiązanie z DealerGroup), spec do review

## Problem

Integracja z CSFlow zakłada jedną instancję: adres API pochodzi z pojedynczej zmiennej
`CSFLOW_API_URL` (Coolify), a kod w kilku miejscach opiera się na założeniu „jedno źródło".
Każda grupa dealerska ma jednak własną subdomenę CSFlow (np.
`https://webapi.grupabemo.csflow.pl`, `https://webapi.carsed.csflow.pl`) i dochodzi druga
grupa. Kolizje przy naiwnym dodaniu drugiego URL-a:

- `listingId = csflow-{car.id}` — ID aut są per instancja CSFlow, więc dwa źródła mogą
  wygenerować ten sam unikalny `listingId`;
- archiwizacja działa po prefiksie `csflow-` globalnie — sync źródła A archiwizowałby
  wszystkie oferty źródła B;
- `Dealer.csflowDealerId Int? @unique` — ID dealerów też są per instancja, dealerzy z dwóch
  instancji skleiliby się w jeden rekord;
- `AppSettings.csflowEnabled` — jeden globalny włącznik, brak sterowania per źródło;
- `ImportLog` nie rozróżnia źródła;
- klient (`csflow-client.ts`) trzyma URL jako stałą modułową.

## Rozwiązanie (przyjęte: wariant A)

Źródła CSFlow przechowywane w bazie (model `CsflowSource`), zarządzane z panelu admina,
każde źródło powiązane opcjonalnie z istniejącym `DealerGroup`. Zmienna `CSFLOW_API_URL`
przestaje być źródłem prawdy — służy tylko do jednorazowego bootstrapu pierwszego źródła.

## 1. Model danych (Prisma, deploy przez `prisma db push`)

Nowy model:

```prisma
model CsflowSource {
  id            String       @id @default(cuid())
  name          String                          // "Grupa Bemo"
  slug          String       @unique            // "grupabemo" — składnik listingId nowych ofert
  apiUrl        String       @map("api_url")    // https://webapi.grupabemo.csflow.pl
  isEnabled     Boolean      @default(true) @map("is_enabled")
  dealerGroupId String?      @map("dealer_group_id")
  lastSyncAt    DateTime?    @map("last_sync_at")
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")
  dealerGroup   DealerGroup? @relation(fields: [dealerGroupId], references: [id])
  dealers       Dealer[]
  listings      Listing[]

  @@map("csflow_sources")
}
```

Zmiany w istniejących modelach:

- `Listing.csflowSourceId String? @map("csflow_source_id")` + relacja + `@@index([csflowSourceId])`;
- `Listing.csflowCarId Int? @map("csflow_car_id")` + `@@unique([csflowSourceId, csflowCarId])` —
  ID auta w systemie CSFlow; para (źródło, ID auta) jednoznacznie identyfikuje ofertę
  niezależnie od formatu `listingId`;
- `Dealer.csflowSourceId String? @map("csflow_source_id")` + relacja;
- `Dealer.csflowDealerId`: usunięcie `@unique`, w zamian `@@unique([csflowSourceId, csflowDealerId])`
  (Postgres: NULL-e nie kolidują, więc dealerzy ręczni bez źródła są bezpieczni);
- `DealerGroup.csflowSources CsflowSource[]` (strona odwrotna relacji).

Format `listingId`:

- istniejące oferty Bemo zostają bez zmian: `csflow-{carId}` (brak migracji katalogów
  cache zdjęć `/uploads/csflow-images/{listingId}/`);
- wszystkie nowe rekordy (nowe źródła oraz nowe auta w Bemo): `csflow-{slug}-{carId}` —
  formaty się nie nakładają, kolizja niemożliwa. Rozpoznanie przynależności i tożsamości
  oferty NIE odbywa się po prefiksie, tylko po kolumnach `csflowSourceId` + `csflowCarId`.

## 2. Bootstrap / backfill (idempotentny, przy starcie serwera)

Jednorazowa funkcja uruchamiana w `server.ts` przed rejestracją crona:

1. Jeśli tabela `csflow_sources` jest pusta i ustawione jest `CSFLOW_API_URL` →
   utwórz źródło `{ name: 'Grupa Bemo', slug: 'grupabemo', apiUrl: CSFLOW_API_URL }`.
2. Backfill: `UPDATE listings SET csflow_source_id = <bemo> WHERE listing_id LIKE 'csflow-%' AND csflow_source_id IS NULL`
   oraz `UPDATE dealers SET csflow_source_id = <bemo> WHERE csflow_dealer_id IS NOT NULL AND csflow_source_id IS NULL`.
   Dodatkowo `csflowCarId` parsowany z `listingId` (wzorzec `csflow-(\d+)`) dla rekordów,
   które mają `csflow_source_id` i `csflow_car_id IS NULL`.
3. Kolejne starty: tabela niepusta → nic nie rób.

Dzięki temu wszystkie trzy środowiska (dev/staging/main) migrują się same przy pierwszym
deployu, bez ręcznych kroków. Po wdrożeniu `CSFLOW_API_URL` można usunąć z Coolify.

## 3. Klient API (`csflow-client.ts`)

Parametryzacja — usunięcie stałej modułowej:

- `getCSFlowCars(apiUrl: string): Promise<any[]>`
- `getCSFlowCarDetails(apiUrl: string, id: string | number): Promise<any>`

Reszta (timeout, limit z `CSFLOW_LIMIT`, obsługa błędów) bez zmian.

## 4. Serwis synchronizacji (`csflow.service.ts`)

`syncCSFlowAPI(prisma, source: CsflowSource, userId)` — logika jak dziś, ze zmianami:

- **Zakres**: wszystkie zapytania o istniejące oferty CSFlow filtrowane po
  `csflowSourceId: source.id` (zamiast `listingId startsWith 'csflow-'`);
- **Archiwizacja**: tylko oferty z `csflowSourceId = source.id` nieobecne w bieżącym
  pobraniu; powód `'Usunięte ze źródła CSFlow ({source.name})'`;
- **Dopasowanie ofert**: istniejąca oferta wyszukiwana po parze
  `(csflowSourceId, csflowCarId)` — nie po `listingId`. `listingId` staje się
  identyfikatorem historycznym: rekordy legacy zachowują `csflow-{carId}`, wszystkie nowe
  rekordy (także nowe auta w źródle bemo) dostają `csflow-{slug}-{carId}`. Mieszane
  formaty w ramach źródła są dopuszczalne, bo tożsamość oferty wyznacza `csflowCarId`.
- **Dealer**: wyszukiwanie po `(csflowSourceId, csflowDealerId)` zamiast samego
  `csflowDealerId`; przy **tworzeniu** dealera ustawiane `dealerGroupId = source.dealerGroupId`;
  przy **aktualizacji** `dealerGroupId` ustawiane tylko, gdy dotychczas było `NULL`
  (ręczne przypisanie do innej grupy nie jest nadpisywane przez sync);
- **VIN dedup**: bez zmian — globalny (VIN jest `@unique` w całej tabeli), pierwsza
  synchronizacja „wygrywa", konflikt logowany;
- **ImportLog**: `fileName: 'Zewnętrzne API (CSFlow: {source.name})'`;
- **lastSyncAt**: aktualizowane po udanej synchronizacji źródła.

Nowa funkcja `syncAllCSFlowSources(prisma, userId?)`:

- respektuje globalny `AppSettings.csflowEnabled` (master switch — bez zmian zachowania),
- iteruje **sekwencyjnie** po `CsflowSource where isEnabled: true`,
- błąd jednego źródła nie przerywa pozostałych (log + kontynuacja).

Cron (co 6h) woła `syncAllCSFlowSources`.

## 5. API (routes)

Rozszerzenie `routes/csflow.ts` (wszystko za `fastify.authenticate`, admin):

- `GET    /api/csflow/sources` — lista źródeł (+ liczba aktywnych ofert per źródło),
- `POST   /api/csflow/sources` — utworzenie (walidacja: `apiUrl` musi być https i hostem
  `*.csflow.pl`; slug generowany z nazwy lub podany, unikalny),
- `PATCH  /api/csflow/sources/:id` — edycja `name`, `apiUrl`, `dealerGroupId`, `isEnabled`;
  przejście `isEnabled: true → false` archiwizuje oferty tego źródła
  (`archivedReason: 'csflow_source_disabled'`) — analogicznie do dzisiejszego globalnego wyłącznika,
- `POST   /api/csflow/sources/:id/sync` — ręczna synchronizacja jednego źródła,
- `POST   /api/csflow/sync` — (istniejący endpoint) synchronizuje wszystkie włączone źródła.

Usuwania źródeł nie ma w tym zakresie — wyłączenie (`isEnabled: false`) wystarcza;
kasowanie rodziłoby pytania o osierocone oferty/dealerów.

## 6. Panel admina (frontend)

W `SettingsModule` (sekcja CSFlow, obok istniejącego przełącznika globalnego) lista źródeł:

- kolumny: nazwa, URL, grupa dealerska (select z istniejących `DealerGroup`), status
  (włączone/wyłączone), ostatnia synchronizacja, liczba ofert,
- akcje: dodaj źródło (formularz: nazwa, URL, grupa dealerska), edytuj, włącz/wyłącz,
  „Synchronizuj teraz" per źródło,
- istniejący globalny przełącznik `csflowEnabled` zostaje jako master switch z opisem.

## 7. Obsługa błędów

- Niedostępne API jednego źródła → log, `ImportLog` ze statusem `failed` dla tego źródła,
  pozostałe źródła synchronizują się normalnie; **brak archiwizacji** przy błędzie pobrania
  listy (jak dziś — wyjątek przerywa przed pętlą archiwizacji tego źródła).
- Duplikat sluga / URL-a przy tworzeniu źródła → 400 z czytelnym komunikatem.
- Zmiana `apiUrl` istniejącego źródła nie zmienia `slug` (identyfikatory ofert stabilne).

## 8. Testy / weryfikacja

1. Bootstrap na kopii bazy dev: po starcie istnieje źródło `grupabemo`, wszystkie oferty
   `csflow-%` i dealerzy z `csflowDealerId` mają `csflowSourceId`, `csflowCarId` sparsowany.
2. Sync bemo po migracji: 0 nowych insertów (wszystko dopasowane po
   `(csflowSourceId, csflowCarId)`), brak fałszywych archiwizacji.
3. Dodanie drugiego źródła (carsed) i sync: oferty dostają `csflow-carsed-{id}`,
   dealerzy carsed dostają `dealerGroupId` grupy Carsed, oferty bemo nietknięte.
4. Wyłączenie źródła carsed: archiwizują się tylko oferty carsed.
5. Konflikt VIN między źródłami: oferta pomijana, log obecny.

## Poza zakresem

- Kasowanie źródeł i czyszczenie osieroconych danych.
- Uwierzytelnianie do CSFlow (API nadal bez autoryzacji, dostęp per subdomena).
- Zmiany w publicznym froncie (oferty niezależnie od źródła wyglądają tak samo).
