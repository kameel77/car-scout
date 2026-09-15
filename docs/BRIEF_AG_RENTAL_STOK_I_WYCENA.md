# Brief dla agenta — stok najmu + silnik wyceny (Etap 1)

Data: 2026-09-05 · Repo: `car-scout` · Zatwierdził: Kamil

Etap 1 z czterech. Poprzedza go analiza [OPTYMALIZACJA_WNIOSKOW_NAJEM_AYVENS.md](pipeline/OPTYMALIZACJA_WNIOSKOW_NAJEM_AYVENS.md);
liczby i decyzje poniżej są jej korektą po weryfikacji na realnych danych i mają pierwszeństwo.

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Cel biznesowy

Operator składający wniosek o najem łączy dziś ręcznie trzy źródła: kartę klienta w Thulium, plik
stoku (`Stok SME 24.08.26.xlsx`, 552 auta) i trzy równoległe cenniki (`Cennik Rental Plan 10082026`
w wariantach bazowym, 6% i 8%). Przepisuje z nich numer stokowy i ratę do maila na
`wnioski@leaseplan.com`. Ryzyko: zła rata, zły numer stoku, otwarty nie ten arkusz.

Etap 1 przenosi **wyłącznie warstwę danych i wyceny** do car-scouta: stok w bazie, cenniki jako
warianty, jeden endpoint zwracający ratę dla wybranego egzemplarza. Bez UI, bez maila, bez wniosku —
to Etapy 2–4.

Miara sukcesu Etapu 1: dla numeru stokowego `3460697` i parametrów z realnego maila (36 msc,
10 000 km, udział własny 1000, bez opon, wariant bazowy) endpoint zwraca **949 zł netto**.

## Dokąd to zmierza — kontekst dla decyzji projektowych

Celem całości nie jest samo wysłanie maila do rentala, tylko **obsłużenie sprawy od wniosku do
wydania pojazdu i rozliczenia prowizji**: wniosek → decyzja partnera → umowa → wydanie →
uzgodnienie prowizji na koniec okresu rozliczeniowego. Etap 1 buduje pod to fundament danych.

Dwie rzeczy z tego wynikają dla Twoich decyzji w tym etapie:

1. **Numer stokowy jest identyfikatorem uzgodnienia z partnerem** przez cały łańcuch — pojawia się
   w mailu z wnioskiem, w potwierdzeniu wydania i w zestawieniu prowizyjnym. Dlatego pozycje stoku
   są trwałe (dezaktywacja, nigdy kasowanie) i unikalne w obrębie firmy najmu.
2. **Wycena musi dać się zamrozić.** Cenniki partnera są ważne 14 dni i będą reimportowane, a
   rozliczenie następuje miesiące później. Endpoint wyceny ma zwracać komplet danych potrzebnych
   do snapshotu w ofercie: `stockNo`, `specNo`, `variant`, `months`, `annualKm`, wariant
   ubezpieczenia i opon oraz rozbicie składników raty. Nie skracaj odpowiedzi endpointu — jej
   pełność jest wymaganiem, nie ozdobnikiem.

Docelowy cykl życia sprawy jest już w schemacie (`PipelinePhase` → `FINANCIAL_DECISION`, `CONTRACT`,
`DELIVERY`; `PipelineCommission` ze statusami `EXPECTED → EARNED → INVOICED → PAID`). Etapy 2–4
podpinają najem pod te istniejące tory — nie twórz równoległych.

## Decyzje podjęte — nie renegocjuj

1. **Nie liczymy prowizji.** Algorytm różni się per firma najmu (Ayvens, Athlon, Masterlease), a
   faktyczna prowizja jest uzgadniana z rentalem na koniec okresu rozliczeniowego. Wariant cennika
   jest **etykietą wymiaru danych**, nie wynikiem obliczenia. Rata to czysty lookup.
2. **Równe stawki w wariantach to nie błąd**, tylko promocja partnera. Nie waliduj tego, nie
   raportuj jako anomalii. Bierzemy wartość z cennika.
3. **Jeden kanoniczny format importu stoku** dla wszystkich firm najmu. Pliki partnerów
   przygotowujemy do tego formatu ręcznie/skryptem poza aplikacją. Nie buduj konfigurowalnych
   adapterów per partner.
4. **Numer specyfikacji ekstrahujemy regexem**: cyfry, opcjonalnie z jedną literą z przodu lub z
   tyłu. Surową wartość zachowujemy obok wyekstrahowanej.
5. **Stok zawiera auta niedostępne od ręki i to jest poprawne** — operator może złożyć wniosek na
   odbiór za kilka miesięcy. Data dostawy ma być widoczna, nie filtrująca.
6. Stos i proces bez zmian: Prisma + `prisma db push` (nie `migrate deploy`), Fastify, Vitest.

## Stan obecny — zweryfikowany w kodzie

Zanim cokolwiek napiszesz, przeczytaj te miejsca. Sporo z tego, co wygląda na do zbudowania, już
istnieje:

| Co | Gdzie | Stan |
|---|---|---|
| Import cennika partnera | `backend/src/services/rental-csv-mapper.ts` (`mapProviderCSVRow`) | Działa. Format „provider" czyta dokładnie kolumny cennika Ayvens: `car_id`, `calc_id`, `term_months`, `mileage_yearly`, `monthly_cost_net`, `insurance_500`, `insurance_nolim`, `tires_nolim`, `over_mileage`, `fee_pct` |
| Endpoint importu | `backend/src/routes/rental-matrix.ts` → `POST /api/rental-matrix/import` | Działa, ale patrz „Blokada" niżej |
| Model wyceny | `RentalMatrixEntry` w `backend/prisma/schema.prisma` | Ma `insuranceExcess500`, `insuranceNoLimit`, `tiresNoLimit`, `overMileageCost`, `feePct` — komplet potrzebnych pól |
| Klucz łączący | `VehicleRentalAssignment.externalVehicleId` | To jest miejsce, w którym siedzi numer specyfikacji partnera (`car_id` z importu cennika) |

### ⚠ Blokada do naprawienia w pierwszej kolejności

`backend/src/routes/rental-matrix.ts` wstawia wiersze przez `createMany({ skipDuplicates: true })`,
a klucz unikalny `RentalMatrixEntry` to:

```
[assignmentId, annualMileageKm, contractMonths, initialPaymentPct,
 initialPaymentAmountNet, initialPaymentAmountGross, offerType]
```

`feePct` **nie jest częścią klucza**, a import stosuje strategię pełnej podmiany: przed
`createMany` kasuje `deleteMany({ where: { assignmentId: { in: ... } } })` wszystkie wiersze
dopasowanych assignmentów. Skutek: import pliku 6% **kasuje stawki bazowe** i wstawia w ich miejsce
swoje, bez ostrzeżenia. W bazie przeżywa wyłącznie ostatni zaimportowany plik. Dopóki tego nie
naprawisz, warianty cennika nie mogą współistnieć.

> Sprostowanie do pierwszej wersji tego briefu: opisywałem ten błąd jako „ciche pominięcie
> duplikatów, `inserted: 0`". Faktyczny mechanizm to cicha podmiana — `deleteMany` przed wstawieniem
> robi miejsce, więc `inserted` jest pełne, a giną poprzednie warianty. Zakres naprawy bez zmian:
> `priceVariant` w kluczu unikalnym **oraz** zawężenie `deleteMany` do importowanych wariantów.

Nie próbuj tego rozwiązać dopisując `feePct` do klucza — to `Float?`, a Postgres traktuje każdy NULL
jako różny, więc deduplikacja przestałaby działać dla wierszy bez prowizji.

## Dane wejściowe — zweryfikowane liczby

Pliki źródłowe (Google Drive, `1_Motolia/_cars/_Rental/Ayvens/Cennik/`):

- `Stok SME 24.08.26.xlsx` — 552 auta, kolumny: `NR stok`, `NR Spec`, `Nr Rej`, `Nr VIN`, `Marka`,
  `Model`, `Opis Modelu`, `Typ nadwozia`, `Kolor`, `Typ paliwa`, `Nazwa Dealera`,
  `DataDostawy DokumentówDoLP`, `Data Dostawy Pojazdu`
- `Cennik Rental Plan 10082026.xlsx` (+ warianty ` 6%` i ` 8%`) — arkusz `Oferta SME`, nagłówek w
  wierszu 11, dane od wiersza 12; 686 wierszy każdy, 49 specyfikacji, okresy **36 i 48**, przebiegi
  10–40 tys. co 5 tys.

Fakty, na których opieraj testy:

- `NR Spec` w stoku występuje w 59 wariantach tekstowych, w tym: `291 (Warszawa)`, `302(Katowice)`,
  `260 - Katowice`, `306 Kraków`, `B103 (Katowice)`. Po ekstrakcji: **48 specyfikacji**.
- **31 aut** w 7 specyfikacjach nie ma odpowiednika w cenniku: `321` (20 aut), `269` (4), `285` (2),
  `259` (2), `256`, `221`, `272`. To poprawny wynik importu — mają trafić do raportu niedopasowań,
  nie do błędów.
- **99 aut nie ma `Data Dostawy Pojazdu`**, 463 nie ma VIN-u. Oba przypadki są dopuszczalne.
- Rozbicie raty (kolumny cennika): `Koszt miesięczny` (kol. 16), `Udział własny 500` (kol. 19),
  `Zniesienie udziału` (kol. 20), `Opony nielimitowane` (kol. 22). Udział własny 1000 = brak dopłaty.
- Uwaga: opłata za nadprzebieg ma **dwie kolumny** — 17 (bez opon) i 23 (z oponami nielimitowanymi).
  Zwracaj tę, która pasuje do wybranego wariantu opon.

## Zakres 1 — model danych

### 1a. `priceVariant` na `RentalMatrixEntry`

```prisma
priceVariant String @default("base") @map("price_variant")
```

Dopisz do `@@unique` jako ostatni element. Wartości: dowolna etykieta partnera (`"base"`, `"6"`,
`"8"`). Nie enum — kolejni partnerzy będą mieli własne nazwy wariantów.

`feePct` zostaw jak jest, jako pole informacyjne.

### 1b. `RentalStockUnit`

```prisma
model RentalStockUnit {
  id                  String    @id @default(cuid())
  rentalCompanyId     String    @map("rental_company_id")
  stockNo             String    @map("stock_no")
  /// Surowa wartość z pliku partnera — do reklamacji i audytu, np. "291 (Warszawa)".
  specNoRaw           String    @map("spec_no_raw")
  /// Po ekstrakcji regexem. null = nie udało się wyciągnąć; wtedy pozycja jest bez wyceny.
  specNo              String?   @map("spec_no")
  /// Reszta specNoRaw po odcięciu numeru, np. "(Warszawa)". Nośnik informacji o miejscu wydania.
  specNoNote          String?   @map("spec_no_note")
  vin                 String?
  registrationNumber  String?   @map("registration_number")
  make                String?
  model               String?
  modelDescription    String?   @map("model_description")
  bodyType            String?   @map("body_type")
  color               String?
  fuelType            String?   @map("fuel_type")
  dealerName          String?   @map("dealer_name")
  docsDeliveryDate    DateTime? @map("docs_delivery_date")
  vehicleDeliveryDate DateTime? @map("vehicle_delivery_date")
  isActive            Boolean   @default(true) @map("is_active")
  sourceFile          String?   @map("source_file")
  importedAt          DateTime  @default(now()) @map("imported_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  rentalCompany RentalCompany @relation(fields: [rentalCompanyId], references: [id])

  @@unique([rentalCompanyId, stockNo])
  @@index([rentalCompanyId, specNo])
  @@index([vehicleDeliveryDate])
  @@map("rental_stock_units")
}
```

Wdrożenie schematu: `prisma db push`. Nie generuj migracji.

## Zakres 2 — import stoku

### 2a. Kanoniczny format CSV

Jeden zestaw nagłówków dla wszystkich firm najmu:

```
stock_no, spec_no, vin, reg_no, make, model, model_description,
body_type, color, fuel, dealer, docs_delivery_date, vehicle_delivery_date
```

Wymagane: `stock_no`, `spec_no`. Reszta opcjonalna. Daty w `YYYY-MM-DD`.

### 2b. Ekstrakcja numeru specyfikacji

```
^\s*([A-Za-z]?\d+[A-Za-z]?)
```

Litera może stać z przodu (`B101` — tak jest w stoku Ayvens) lub z tyłu (`306B` — format spotykany
u innych partnerów). To, co zostaje po dopasowaniu, po przycięciu białych znaków i separatorów
(`-`, `(`, `)`) idzie do `specNoNote`.

**Regex nie jest jedynym filtrem.** Wynik ekstrakcji musi zostać zwalidowany joinem do
`VehicleRentalAssignment.externalVehicleId` dla danej firmy. Pozycje bez dopasowania zapisz do stoku
(są realnymi autami), ale zaraportuj — nie zgaduj i nie odrzucaj po cichu. Zabezpiecza to przed
przypadkiem `306Kraków`, który regex zredukowałby do `306K`.

### 2c. Endpoint

```
POST /api/rental-stock/import
  multipart: file (CSV), rentalCompanyId
  uprawnienie: to samo co POST /api/rental-matrix/import
```

Odpowiedź:

```json
{
  "totalRows": 552,
  "inserted": 552,
  "updated": 0,
  "unmatched": [
    { "row": 14, "stockNo": "3417358", "specNoRaw": "321", "specNo": "321",
      "reason": "Brak specyfikacji 321 w cenniku firmy Ayvens" }
  ],
  "errors": []
}
```

Import jest **upsertem po `(rentalCompanyId, stockNo)`** — kolejny plik od partnera aktualizuje
istniejące pozycje. Pozycje obecne w bazie, a nieobecne w nowym pliku, oznacz `isActive = false`;
nie kasuj (numery stokowe pojawiają się w wysłanych wnioskach).

## Zakres 3 — wycena

```
GET /api/rental-stock/:id/quote
  ?months=36&annualKm=10000&insurance=1000|500|0&tires=false&variant=base
```

Ścieżka danych: `RentalStockUnit.specNo` → `VehicleRentalAssignment` (po `externalVehicleId` +
`rentalCompanyId`) → `RentalMatrixEntry` (po `contractMonths`, `annualMileageKm`, `priceVariant`).

Odpowiedź:

```json
{
  "stockNo": "3460697",
  "specNo": "294",
  "vehicle": { "make": "VOLKSWAGEN", "model": "Polo",
               "modelDescription": "Polo 1.0 Tsi 95km Dsg 7 Life Plus",
               "color": "Niebieski Crystal" },
  "vehicleDeliveryDate": "2027-02-01",
  "variant": "base",
  "breakdown": { "baseNet": 949, "insuranceNet": 0, "tiresNet": 0 },
  "monthlyRateNet": 949,
  "monthlyRateGross": 1167.27,
  "overMileageNet": 0.38
}
```

Zasady:

- `insurance=1000` → dopłata 0; `500` → `insuranceExcess500`; `0` → `insuranceNoLimit`
- `tires=true` → dopłata `tiresNoLimit` **i** `overMileageNet` z wariantu z oponami
- brak wiersza w matrycy dla żądanej kombinacji → `404` z listą dostępnych kombinacji
  (`months`, `annualKm`, `variant`) dla tej specyfikacji
- `specNo = null` lub brak assignmentu → `422` z czytelnym komunikatem, nie `500`
- **żadnej arytmetyki prowizji** — jeśli wariant nie istnieje w bazie, zwróć 404, nie licz go

Dodatkowo endpoint wyszukiwania, bo wycena wymaga najpierw znalezienia egzemplarza:

```
GET /api/rental-stock/search?companyId=&q=&limit=20
```

`q` szuka po `stockNo`, marce, modelu, `modelDescription` i VIN-ie. Zwraca pozycje z flagą
`hasPricing` i `vehicleDeliveryDate`. Sortowanie: pozycje z wyceną najpierw, potem po dacie dostawy
rosnąco.

## Kryteria odbioru

Testy w Vitest, obok istniejących w `backend/src/routes/__tests__/`:

1. **Regex.** Zestaw z realnych danych — `291 (Warszawa)`→`291`, `302(Katowice)`→`302`,
   `260 - Katowice`→`260`, `306 Kraków`→`306`, `B103 (Katowice)`→`B103`, `306B`→`306B`,
   `321`→`321`. Plus `specNoNote` dla wariantów z dopiskiem.
2. **Regresja na blokadzie duplikatów.** Import trzech cenników Ayvens (base, 6, 8) daje
   **3 × 686 = 2058** wierszy w `RentalMatrixEntry`. Test musi failować na dzisiejszym schemacie.
3. **Wycena zgodna z realnym mailem.** `stockNo=3460697`, `months=36`, `annualKm=10000`,
   `insurance=1000`, `tires=false`, `variant=base` → `monthlyRateNet = 949`.
4. **Rozbicie składników.** Ten sam egzemplarz: `insurance=500` → 1010; `insurance=0` → 1129;
   `tires=true` → 1069 oraz `overMileageNet = 0.53` zamiast `0.38` (kolumna wariantu z oponami).
5. **Raport niedopasowań.** Import pełnego stoku 552 aut daje `unmatched` zawierający dokładnie
   31 pozycji w 7 specyfikacjach (`321`, `269`, `285`, `259`, `256`, `221`, `272`).
6. **Upsert.** Powtórny import tego samego pliku: `inserted: 0`, `updated: 552`, brak duplikatów.

Do testów 2–5 przygotuj fixture CSV wycięte z realnych plików (kilkanaście specyfikacji wystarczy,
ale muszą być w nich Polo `294` i wszystkie 7 specyfikacji bez cennika). Nie commituj pełnych
cenników partnera do repo.

## Uzupełnienia po review planu implementacji (2026-09-05)

### BLOKUJĄCE: brak pola na nadprzebieg w wariancie z oponami

Kryterium odbioru 4 wymaga zwrócenia `overMileageNet = 0.53` przy `tires=true`, ale
`RentalMatrixEntry` ma **tylko jedno** pole `overMileageCost` (kolumna 17 cennika, wariant bez
opon), a `mapProviderCSVRow` czyta wyłącznie `over_mileage`. Kolumna 23 cennika (nadprzebieg przy
oponach nielimitowanych) nie ma gdzie wylądować. Bez poniższej zmiany kryterium 4 jest
niewykonalne.

Zmiana — dorób razem z `priceVariant`, jednym `db push`:

```prisma
// RentalMatrixEntry
overMileageTiresNoLimit Float? @map("over_mileage_tires_no_limit")
```

- `ProviderCSVRow`: nowe opcjonalne pole `over_mileage_tires`
- `mapProviderCSVRow`: `overMileageTiresNoLimit = safeFloat(row.over_mileage_tires)`
- nie dodawaj tego do `@@unique`, to wartość, nie wymiar

Zachowanie endpointu wyceny przy `tires=true`:

- pole wypełnione → zwróć je jako `overMileageNet`
- pole puste (starsze importy) → `overMileageNet: null` **oraz** `overMileageUnavailable: true`

Nie podstawiaj w tym przypadku `overMileageCost` — różnica 0.38 vs 0.53 to 40% na opłacie
rozliczeniowej, a ta trafia potem do rozliczenia z partnerem.

### Precedencja `priceVariant`

Plan przewiduje dwa źródła: kolumnę `price_variant` w CSV i query param. Ustal jednoznacznie:
**kolumna w wierszu ma pierwszeństwo, query param jest wartością domyślną dla wierszy bez
kolumny.** Gdy nie ma żadnego z nich → `"base"`.

### Dezaktywacja przy imporcie stoku — zakres i raport

Oznaczanie `isActive = false` dla pozycji nieobecnych w pliku obowiązuje **wyłącznie w obrębie
`rentalCompanyId` z żądania**. Nigdy globalnie.

Dodaj `deactivated` do odpowiedzi importu — operator musi zobaczyć, że wgranie okrojonego pliku
wyłączyło mu 300 pozycji:

```json
{ "totalRows": 552, "inserted": 552, "updated": 0, "deactivated": 0, "unmatched": [], "errors": [] }
```

### Warstwy: parser nie chodzi do bazy

`rental-stock-parser.ts` ma być czysty — regex, mapowanie kolumn, parsowanie dat, zero Prismy.
Walidacja dopasowania do `VehicleRentalAssignment` należy do trasy/serwisu importu. Dzięki temu
test kryterium 1 (regex) jest testem jednostkowym bez bazy.

### Kryterium 2 — asercja na liczbie, nie na kształcie

Test ma sprawdzać **liczbę wierszy** po imporcie trzech wariantów (`3 × N`, gdzie N to liczba
wierszy fixture'u), a nie tylko obecność trzech różnych wartości `priceVariant`. Cicha utrata
wierszy przez `skipDuplicates` to dokładnie ten błąd, który ten test ma łapać.

## Czego nie robić w tym etapie

- Żadnego UI. Ani panelu importu stoku, ani kreatora wniosku.
- Żadnej wysyłki maila do partnera i żadnego dotykania `PipelineApplication` — to Etap 2, który
  będzie **kompozycją istniejących** endpointów `create → submit`, nie nowym endpointem wniosku.
- Żadnego liczenia prowizji, nawet „na wszelki wypadek" za flagą.
- Żadnego pola PESEL — jest zaplanowane, ale w Etapie 2, razem z szyfrowaniem i uprawnieniem.
- Nie ruszaj `thulium-crm-lookup.service.ts`. Rozszerzenie o numer stokowy to Etap 4.
- Nie zmieniaj istniejącego formatu `internal` w `rental-csv-mapper.ts`.

## Warunek wstępny — ROZSTRZYGNIĘTY 2026-09-05

Założenie potwierdzone: `car_id` w imporcie cennika to numer specyfikacji, a katalog najmu z
assignmentami i matrycą **istnieje na produkcji** (`motolia.pl/wynajem-dlugoterminowy` serwuje m.in.
BMW X3 xDrive20 M Sport i Citroën C3 Aircross Max Hybrid 145km — specyfikacje `252` i `312`/`B103`
z cennika Ayvens). Pustka dotyczy wyłącznie lokalnej bazy deweloperskiej.

Wiązanie matrycy przez `VehicleRentalAssignment` zostaje bez zmian. Nie refaktoryzuj tego.

### Skąd brać dane do pracy i testów

**Testy: fixtures w teście, zawsze.** Każdy test tworzy własne rekordy w `beforeAll` i sprząta po
sobie (konwencja z `rental-operator-financials.test.ts`). Żaden test nie może zależeć od stanu
lokalnej bazy ani od seeda — w szczególności test regresyjny na blokadzie duplikatów musi failować
na dzisiejszym schemacie u każdego, kto go uruchomi.

**Praca ręczna: mały seed deweloperski.** `backend/src/scripts/seed-rental-ayvens-dev.ts`, tylko
firma Ayvens i specyfikacje potrzebne do dema (nie 49 „na zapas"), encje z `isPublished: false`
**oraz** `isActive: false`.

> **Twardy warunek:** skrypt sprawdza `DATABASE_URL` i przerywa z błędem, jeśli host nie jest
> `localhost`/`127.0.0.1`. Skrypt tworzący wpisy w katalogu publikowanym na motolia.pl nie może
> dać się uruchomić przez pomyłkę na dev ani na produkcji.

**Nie ściągaj zrzutu z produkcji ani stagingu.** Baza produkcyjna zawiera dane osobowe klientów
(`pipeline_customers`), a Etap 1 nie dotyka modułu pipeline w ogóle.

### Reguła: jedna specyfikacja → wiele assignmentów

`externalVehicleId` nie jest unikalny — jeden numer specyfikacji może wskazywać kilka pojazdów
(ten sam model w różnych kolorach; patrz komentarz w `rental-matrix.ts` przy dopasowywaniu
assignmentów, oraz `car_id` w formacie `"139,207"` w historycznych szablonach importu).

Dla wyceny oznacza to, że `specNo` może rozwiązać się do N zestawów wierszy matrycy. Zasada:

- stawki dla wszystkich dopasowanych assignmentów tej samej firmy **muszą być identyczne** —
  wybierz deterministycznie (najniższe `assignmentId`) i policz ratę
- jeśli się różnią, zwróć `409` z listą rozbieżnych wartości zamiast wybierać po cichu; to znaczy,
  że cennik zaimportowano niespójnie i operator nie może dostać przypadkowej raty

## Uruchamianie i wdrożenie

- Skrypty pomocnicze lokalnie: `npx tsx src/scripts/<nazwa>.ts` z katalogu `backend/`
- W kontenerze Coolify: `node dist/scripts/<nazwa>.js` (obraz nie zawiera `src/` ani `tsx`)
- Schemat: `prisma db push`, nigdy `migrate dev` (historia migracji jest rozjechana)
- Gałąź: `dev`
