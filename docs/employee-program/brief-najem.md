# Brief -  Najem długoterminowy w portalu pracowniczym

**Dla:** Antigravity (wykonawca)
**Od:** Opus 5 (architektura, odbiór)
**Branch bazowy:** `dev` (od `2304406`)
**Data:** 2026-09-16
**Realizuje:** najem z [`strategia-katalog-pelny.md`](strategia-katalog-pelny.md) -  domyka `TODO(E3)` z E1 i uruchamia przełącznik `scopeIncludeRental`, który dziś w panelu nic nie robi.

---

## 1. Stan faktyczny -  zmierzony na żywych bazach

| | dev | **produkcja** |
|---|---|---|
| auta w najmie: `isActive` + `isPublished` + aktywne przypisanie z ≥1 stawką | 9 | **72** |
| aktywne firmy najmowe | 4 | 6 |
| publiczne stawki `RentalMatrixEntry` (`offerType`/`priceVariant`) | `all/base` 74, `business/base` 26 | `all/base` 1183, `business/base` 377 |
| **prywatne matryce pracownicze** `EmployeeMatrixSet` / wersje / wiersze | **0 / 0 / 0** | **0 / 0 / 0** |
| CHECK `check_offer_source_integrity` | **brak** | **brak** |

Wnioski, które ustawiają cały etap:

1. **Prywatnych matryc nie ma nigdzie.** Jeśli najem pracowniczy opierałby się wyłącznie na `EmployeeMatrixRow`, po wdrożeniu katalog najmu byłby pusty. Źródłem, które faktycznie coś pokaże, są **publiczne stawki Motolii** (`RentalMatrixEntry`). To zgodne z zasadą przyjętą dla kalkulatora: *jeśli firma nie ma nic wybranego, obowiązuje default Motolii*.
2. **Pojazd najmu to nie `Listing`.** To osobna encja `RentalVehicle` (własne zdjęcia, wyposażenie, `specsJson`), wiązana z firmą najmową przez `VehicleRentalAssignment`. Zapytanie E1 zakorzenione w `Listing` nie może jej objąć -  patrz §3.1.
3. **`EmployeeMatrixSet` wisi na firmie najmowej, nie na programie.** W schemacie nie ma żadnego powiązania program ↔ matryca. Dziś jedyną drogą jest `EmployeeProgramOffer.matrixVersionId` per oferta, co przy regule zasięgu nie ma zastosowania. Trzeba dodać powiązanie -  §3.2.

---

## 2. Rozstrzygnięcia architektoniczne (nie do negocjacji w trakcie implementacji)

### 2.1 Źródło stawek: prywatna matryca, a jeśli jej brak -  publiczna Motolii

Dla każdego przypisania `VehicleRentalAssignment` w katalogu programu:

```
JEŻELI program ma powiązany EmployeeMatrixSet dla assignment.rentalCompanyId
  ORAZ ten zestaw ma wersję PUBLISHED (i teraz ∈ [effectiveFrom, effectiveTo], gdy ustawione)
  ORAZ wersja ma ≥1 EmployeeMatrixRow dla tego assignmentId
  ORAZ strona umowy pracownika ∈ EmployeeMatrixSet.allowedContractParties
    → stawki PRYWATNE (EmployeeMatrixRow), source = 'EMPLOYEE_MATRIX'
W PRZECIWNYM RAZIE
    → stawki PUBLICZNE (RentalMatrixEntry), source = 'PUBLIC_MATRIX'
```

Dwie konsekwencje, które łatwo przeoczyć:

- **`allowedContractParties` zestawu ma domyślnie `[EMPLOYEE_B2B, EMPLOYER_COMPANY]` -  bez `CONSUMER`.** Pracownik składający zapytanie jako konsument **nie może** dostać stawek prywatnych i spada na publiczne. To celowe (stawki flotowe są zwykle B2B), ale musi być obsłużone i przetestowane, a nie wyjść jako „dlaczego konsument widzi inną ratę niż kolega z JDG".
- Zestaw powiązany z programem, ale **bez wierszy dla danego auta** → fallback na publiczne dla tego auta. Nie ukrywamy auta.

### 2.2 Brak rabatu procentowego na stawkach najmu

`defaultDiscountPct` / `scopeDiscountPct` programu **nie są stosowane do rat najmu.** Rata najmu to cena firmy najmowej zawierająca jej ryzyko i marżę -  procentowe obniżenie jej po stronie Motolii pokazałoby pracownikowi ratę, której firma najmowa nie zaakceptuje. Przewagą pracownika w najmie jest prywatna matryca (wynegocjowana) i pakiet benefitów.

> **Decyzja biznesowa do potwierdzenia przez właściciela produktu.** Brief przyjmuje „bez rabatu". Jeśli w trakcie okaże się, że rabat na najem jest wymagany, **zatrzymaj się i zapytaj** -  nie dokładaj go z własnej inicjatywy.

### 2.3 `offerType` -  mapowanie na stronę umowy, lustrzanie do serwisu publicznego

Publiczny endpoint filtruje `offerType: { in: [offerType, 'all'] }`. Mapowanie w portalu:

| strona umowy | publiczne `offerType` | kwota prezentowana |
|---|---|---|
| `CONSUMER` | `all` | brutto |
| `EMPLOYEE_B2B`, `EMPLOYER_COMPANY` | `business` ∪ `all` | netto |

Na liście kafli nie znamy jeszcze strony umowy -  pokazujemy **„od X zł/mies. brutto"** z najniższej stawki `all`. Wiersze prywatne nie mają `offerType`; ich zakres wyznacza `allowedContractParties` (§2.1).

**Uwaga na brutto w stawkach prywatnych:** `EmployeeMatrixRow` ma `monthlyRateGross`, ale opłatę wstępną **tylko netto** (`initialPaymentAmountNet`). Nie dopisuj VAT samodzielnie -  pokaż opłatę wstępną z etykietą „netto". Liczenie podatku to decyzja, której ten etap nie podejmuje.

### 2.4 Kalkulator najmu = wybór z siatki, nie obliczenie

Stawki najmu są dyskretne: kombinacja `contractMonths × annualMileageKm × initialPaymentPct (× initialPaymentAmountNet)`. Kalkulator **nie liczy niczego**, tylko pozwala wybrać dostępną kombinację i pokazuje dokładnie odpowiadający jej wiersz.

Logikę dopasowania wiersza **skopiuj semantycznie z publicznego** `GET /api/rental/vehicles/:slug/calculate` ([`rental-public.ts:584`](../../backend/src/routes/rental-public.ts:584)) -  dokładne dopasowanie parametrów, wybór pomiędzy przypisaniami tak samo jak tam. Najpierw przeczytaj, jak ten endpoint rozstrzyga sytuację, gdy to samo auto ma kilka firm najmowych, i **odwzoruj to zachowanie**, nie wymyślaj własnego. Jeśli uważasz, że publiczne zachowanie jest błędne -  zgłoś, nie „poprawiaj" go w portalu.

Zaleta: zero wywołań zewnętrznych API (w przeciwieństwie do kalkulatora finansowania z Inbank/Vehis), więc listę i kartę można odpytywać bez obaw o limity.

---

## 3. Zakres i kroki

Etap jest duży. Realizuj **krokami, każdy z własną bramką testową i osobnym commitem.** Nie przechodź do następnego kroku z czerwoną bramką.

### Krok 0 -  Pre-flight: bramka regresji E1

Przed jakąkolwiek zmianą: `vitest.employee.config.ts` 80/80 i integracyjne 55/55. Zapisz wynik. Po każdym kroku liczby mogą tylko rosnąć, a istniejące asercje nie mogą się zmienić.

### Krok 1 -  Schemat: powiązanie program ↔ matryca

```prisma
model EmployeeProgramMatrixSet {
  id          String            @id @default(cuid())
  programId   String            @map("program_id")
  matrixSetId String            @map("matrix_set_id")
  createdAt   DateTime          @default(now()) @map("created_at")

  program     EmployeeProgram   @relation(fields: [programId], references: [id], onDelete: Cascade)
  matrixSet   EmployeeMatrixSet @relation(fields: [matrixSetId], references: [id], onDelete: Restrict)

  @@unique([programId, matrixSetId])
  @@index([matrixSetId])
  @@map("employee_program_matrix_sets")
}
```

Plus relacje zwrotne na `EmployeeProgram` i `EmployeeMatrixSet`. Zmiana addytywna, wdrażana `db push` -  **nie twórz pliku migracji SQL**.

**Reguła aplikacyjna** (nie da się jej wyrazić unikalnym indeksem, bo `rentalCompanyId` siedzi na zestawie): program może mieć **najwyżej jeden** powiązany zestaw na firmę najmową. Egzekwuj w endpoincie panelu -  próba dodania drugiego zestawu tej samej firmy → `409`.

### Krok 2 -  Backend: katalog najmu

Nowy endpoint, **osobny od katalogu zakupu:**

```
GET /api/employee/rental-offers
preHandler: [verifyEmployeeAuth]
rateLimit: 60/min
query: limit (1–50, domyślnie 24), cursor (RentalVehicle.id), search (make/model/version, max 100)
```

**Dlaczego osobny endpoint, a nie dołączenie do `/api/employee/offers`:** łączenie dwóch źródeł (`Listing` i `RentalVehicle`) w jednej liście z paginacją kursorową to dokładnie pułapka scalania w pamięci, którą E1 celowo wyeliminował. Dwa endpointy = dwie niezależne, poprawne paginacje. W portalu to dwie zakładki.

Warunek widoczności auta (gdy `program.scopeIncludeRental = true`; gdy `false` → pusta lista, status 200):

- **lustrzanie do publicznego** [`rental-public.ts:138`](../../backend/src/routes/rental-public.ts:138): `RentalVehicle.isActive`, `isPublished`, istnieje przypisanie `isActive` z co najmniej jedną stawką;
- **plus** przypisanie nie jest wykluczone dla programu (§Krok 5).

Nie dokładaj warunków, których publiczny serwis nie ma (np. `rentalCompany.isActive`). Jeżeli uważasz, że powinien być -  zgłoś jako osobną pozycję.

Kształt pozycji:

```jsonc
{
  "id": "rental-<RentalVehicle.id>",
  "sourceType": "RENTAL",
  "vehicle": { "make", "model", "version", "productionYear", "fuelType", "transmission", "bodyType", "primaryImageUrl", "imageUrls" /* max 5 */ },
  "rental": {
    "fromMonthlyRateGross": 1899,          // min z dostępnych stawek 'all' po rozstrzygnięciu §2.1
    "rateSource": "PUBLIC_MATRIX",         // lub EMPLOYEE_MATRIX, jeśli najniższa pochodzi z matrycy prywatnej
    "rentalCompanies": ["Ayvens"]
  },
  "benefit": null                          // pakiet benefitów programu, jeśli skonfigurowany
}
```

`nextCursor` = `RentalVehicle.id` -  ta sama zasada co w E1: kursor liczony z encji, po której paginujesz, **niezależnie** od `id` w payloadzie.

**Wydajność:** na produkcji jest 1560 stawek publicznych. **Nie ładuj wszystkich stawek do pamięci, żeby policzyć minimum.** Dla kafla potrzebne jest jedno minimum per auto -  użyj `include` z `orderBy: { monthlyRateGross: 'asc' }, take: 1` na stawkach przefiltrowanych po `offerType`, albo agregacji. Pełną siatkę pobieraj dopiero na karcie szczegółów.

### Krok 3 -  Backend: szczegóły i siatka kalkulatora

```
GET /api/employee/rental-offers/:id        // id = rental-<RentalVehicle.id>
preHandler: [verifyEmployeeAuth]
```

Zwraca pojazd z pełnym wyposażeniem (`equipmentSafety`, `equipmentComfortExtras`, `equipmentAudioMultimedia`, `equipmentOther`, `specsJson`, `additionalInfoHeader/Content`) oraz **siatkę dostępnych kombinacji** per przypisanie, już po rozstrzygnięciu §2.1:

```jsonc
"rentalOptions": [
  {
    "assignmentId": "...",
    "rentalCompanyName": "Ayvens",
    "rateSource": "EMPLOYEE_MATRIX",
    "matrixVersionId": "...",              // null dla PUBLIC_MATRIX
    "allowedContractParties": ["EMPLOYEE_B2B", "EMPLOYER_COMPANY"],
    "rows": [
      { "contractMonths": 36, "annualMileageKm": 15000, "initialPaymentPct": 10, "initialPaymentAmountNet": 0,
        "monthlyRateNet": 1544, "monthlyRateGross": 1899, "offerType": "all" }
    ]
  }
]
```

Auto spoza zasięgu, wykluczone, nieopublikowane albo program z `scopeIncludeRental = false` → **`404`**, nie `403`.

### Krok 4 -  Backend: zgłoszenie na najem

Rozszerz istniejący `POST /api/employee/inquiries`. Dla `offerId` z prefiksem `rental-` body **musi** zawierać:

```jsonc
"rentalSelection": {
  "assignmentId": "...",
  "contractMonths": 36,
  "annualMileageKm": 15000,
  "initialPaymentPct": 10,
  "initialPaymentAmountNet": 0
}
```

Serwer **ponownie rozstrzyga** źródło stawek (§2.1) dla `contractParty` ze zgłoszenia i **sam wyszukuje wiersz**. Klient nie przysyła raty -  ta sama zasada co przy cenie zakupu. Brak pasującego wiersza → `409` „Wybrany wariant nie jest już dostępny".

`calculationSnapshot` dla najmu:

```jsonc
{
  "offerId": "rental-...", "sourceType": "RENTAL",
  "vehicle": { "make", "model", "version", "productionYear", "primaryImageUrl" },
  "rental": {
    "rateSource": "EMPLOYEE_MATRIX", "matrixVersionId": "...", "rentalCompanyName": "Ayvens",
    "assignmentId": "...", "contractMonths": 36, "annualMileageKm": 15000,
    "initialPaymentPct": 10, "initialPaymentAmountNet": 0,
    "monthlyRateNet": 1544, "monthlyRateGross": 1899
  }
}
```

**`Lead` ma już pola najmu -  wypełnij je**, żeby konsultant widział warunki w CRM bez otwierania snapshotu: `rentalVehicleId`, `rentalCompanyName`, `rentalContractMonths`, `rentalAnnualMileageKm`, `rentalInitialPaymentPct`, `rentalInitialPaymentAmountNet`, `rentalMonthlyRate`. `listingId: null`, `leadType: 'employee'`, numer `PP-…`. Zgoda RODO, idempotencja i transakcja -  bez zmian względem obecnej implementacji.

### Krok 5 -  Panel admina

1. **Ustawienia programu:** wybór powiązanych zestawów matryc (lista `EmployeeMatrixSet`, pogrupowana po firmie najmowej, najwyżej jeden na firmę). Przełącznik `scopeIncludeRental` zaczyna działać -  usuń ewentualne oznaczenia „wkrótce".
2. **Wykluczenie najmu:** w zakładce ofert specjalnych możliwość wykluczenia **przypisania** (auto + firma najmowa). Rekord: `sourceType: 'RENTAL'`, `assignmentId`, `isExcluded: true`, `isActive: true`, `listingId: null`, `matrixVersionId: null`. Auto znika z katalogu dopiero, gdy wykluczone są **wszystkie** jego kwalifikujące się przypisania.
3. **Nowy endpoint wyszukiwania przypisań** do wykluczenia -  `programId` jako **wymagany** parametr zapytania.

> **Lekcja z regresji `495f4a0`:** w E1 z wywołania `listAvailableListings` wypadł `programId` i nikt tego nie złapał, bo `employee-admin.service.ts` nie ma testów. **Dopisz test jednostkowy serwisu**, który sprawdza, że URL obu wyszukiwarek (`available-listings` i nowej dla najmu) zawiera `programId`. Test ma failować, gdy parametr zniknie.

### Krok 6 -  Portal

1. Zakładki w katalogu: **„Zakup i leasing"** (istniejący `/katalog`) oraz **„Najem długoterminowy"** (nowa trasa `/najem`), obie za `ProtectedRoute`.
2. Lista najmu: kafle z „od X zł/mies. brutto", nazwami firm najmowych, plakietką benefitu. Cztery stany: loading, lista, pusto, błąd -  wzorem `CatalogPage`.
3. Karta `/najem/:id`: galeria, dane techniczne, cztery grupy wyposażenia, kalkulator jako selektory okresu, limitu kilometrów i wkładu -  **wyłącznie z kombinacji zwróconych w `rows`**, bez wpisywania wartości z ręki. Wybór strony umowy zmienia prezentację netto/brutto i dostępne źródło stawek (§2.1, §2.3). Przycisk „Zapytaj o ten wariant" otwiera istniejący `InquiryModal` z przekazanym `rentalSelection`.
4. `credentials: 'same-origin'`, bez nowych bibliotek, `useState` + `AbortController` -  jak dotąd.

---

## 4. Pułapki

1. **Nie współdzielimy jeszcze komponentów z głównym frontendem.** Strategia mówi „ekstrakcja przy drugim użyciu", a karta najmu w portalu to drugie użycie karty z `RentalDetailPage.tsx` (706 linii). **Ale:** Dockerfile portalu robi `COPY . .` z kontekstu `apps/employee-portal`, a Coolify ma `base_directory = /apps/employee-portal`. Pakiet w korzeniu repo **nie zostanie zobaczony przez build** i deploy padnie. Zmiana kontekstu budowania to operacja w Coolify, której AG nie wykona. **W tym etapie implementuj prezentację lokalnie w portalu** i dopisz do `new_features.md` pozycję: ekstrakcja `packages/vehicle-ui` wymaga zmiany `base_directory` portalu w Coolify i kontekstu Dockerfile.
2. **CHECK constraint istnieje tylko w lokalnej bazie deweloperskiej** (założonej przez `prisma migrate`). Dev, produkcja i testy integracyjne (runner robi `db push`) go **nie mają**. Rekord wykluczenia najmu (`matrixVersionId: null`) **zostanie odrzucony lokalnie**, a przejdzie wszędzie indziej. Nie „naprawiaj" tego, dostosowując dane do constrainta. Walidację spójności `sourceType` rób w aplikacji (zod/serwis), a jeśli lokalna baza blokuje pracę, usuń constraint jednorazowo i odnotuj w raporcie: `ALTER TABLE employee_program_offers DROP CONSTRAINT IF EXISTS check_offer_source_integrity;`
3. **Testy katalogu dzielą stan bazy i zależą od kolejności** (wykazane mutacją w E1: złamanie testu 7 wywróciło test 8). Nowe testy najmu pisz jako niezależne -  każdy tworzy i sprząta własne dane.
4. **Nazwy plików testów:** czysta logika bez bazy → `*.isolated.test.ts`. W E1 `employee-pricing.test.ts` bez sufiksu trafił do przebiegu na Dockerze zamiast do szybkiej suity.
5. **Import CSV matrycy nie ma limitu wierszy** (znane z audytu). Ten etap go nie dotyka, ale nie buduj na nim dodatkowej logiki masowej.
6. **Zdjęcia:** `RentalVehicle.primaryImageUrl` bywa względny (`/uploads/rental-images/...`). Nginx portalu proxuje `/uploads/` od `82988ea` -  nie dokładaj własnego rozwiązywania adresów.
7. **Nie dodawaj zmiennych środowiskowych.** Jeśli uznasz, że są konieczne -  zatrzymaj się i zapytaj.

---

## 5. Testy -  warunek odbioru

Integracyjne, na realnym PostgreSQL i Redis:

1. `scopeIncludeRental = false` → `GET /rental-offers` zwraca pustą listę, `GET /rental-offers/:id` → 404.
2. `scopeIncludeRental = true`, brak powiązanych matryc → auta widoczne ze stawkami **publicznymi**, `rateSource: 'PUBLIC_MATRIX'`.
3. Program z powiązanym zestawem i **opublikowaną** wersją z wierszami → stawki prywatne dla `EMPLOYEE_B2B`.
4. **Ten sam program i auto, strona `CONSUMER`** → fallback na publiczne (`allowedContractParties` bez `CONSUMER`).
5. Wersja `DRAFT` → ignorowana, fallback na publiczne. Wersja `PUBLISHED` z `effectiveTo` w przeszłości → ignorowana.
6. Zestaw powiązany, ale **bez wierszy dla danego auta** → to auto na publicznych stawkach, nie znika.
7. **Izolacja tenantów:** zestaw powiązany z programem B nie wpływa na stawki programu A; `GET /rental-offers/:id` nie ujawnia matrycy obcego programu.
8. Wykluczenie jednego z dwóch przypisań auta → auto widoczne z pozostałą firmą; wykluczenie obu → auto znika; dezaktywacja wykluczenia (`isActive: false`) → wraca.
9. Paginacja: druga strona po `nextCursor` bez `P2025` i bez duplikatów.
10. Zgłoszenie na najem: serwer ignoruje podrzuconą ratę w body, zapisuje wiersz z bazy; `Lead` ma wypełnione pola `rental*`, numer `PP-…`.
11. **Niezmienność snapshotu:** po opublikowaniu nowej wersji matrycy z inną ratą zgłoszenie zachowuje ratę z chwili złożenia.
12. Brak pasującego wiersza w momencie zgłoszenia → `409`.
13. Panel: dodanie drugiego zestawu tej samej firmy najmowej do programu → `409`.
14. **Regresja E1:** katalog zakupu (`/api/employee/offers`) -  wszystkie dotychczasowe testy bez zmiany asercji.

Jednostkowe (`*.isolated.test.ts`): funkcja rozstrzygająca źródło stawek (§2.1) dla wszystkich gałęzi; mapowanie `offerType` (§2.3); **test serwisu admina na obecność `programId`** (Krok 5).

Weryfikacja mutacyjna, którą wykonam przy odbiorze, więc testy muszą ją przetrwać: usunięcie warunku `allowedContractParties` (test 4 musi pęknąć) oraz usunięcie warunku `status: PUBLISHED` (test 5 musi pęknąć).

Bramki:
```bash
cd backend && npx tsc --noEmit && npx vitest run --config vitest.employee.config.ts
node backend/scripts/test-employee-integration.mjs
npx tsc --noEmit && npx eslint src/components/admin/employee-programs src/services/employee-admin.service.ts
cd apps/employee-portal && npx tsc --noEmit && npx eslint . && npx vitest run
```

---

## 6. Definition of done

- [ ] Na dev, z włączonym `scopeIncludeRental` dla Finareny, zakładka „Najem długoterminowy" pokazuje **9 aut** (tyle kwalifikuje się dziś na dev według reguły publicznej).
- [ ] Karta auta pokazuje wyposażenie i siatkę wariantów; wybór wariantu zmienia ratę bez żadnego wywołania do zewnętrznego API.
- [ ] Zgłoszenie na najem tworzy `Lead` z polami `rental*` widocznymi w CRM.
- [ ] Wszystkie bramki z §5 zielone, testy integracyjne liczbowo powyżej 55, wcześniejsze asercje niezmienione.
- [ ] Commity per krok, wyłącznie w zakresie etapu. W drzewie mogą leżeć cudze zmiany (np. `backend/src/routes/external/feeds.ts`) -  **nie dodawaj ich**, nigdy `git add -A`.

---

## 7. Czego nie ruszać

- warstwa auth: `employee-auth.middleware.ts`, `.service.ts`, `employee-session.helpers.ts`, `platform-jwt.ts`;
- publiczne trasy najmu `backend/src/routes/rental-public.ts` -  czytasz, nie modyfikujesz;
- logika katalogu zakupu z E1 -  poza ewentualnym wydzieleniem wspólnych helperów **bez zmiany zachowania** (asercje testów E1 niezmienione);
- import CSV matrycy w `employee-admin.routes.ts`.

Jeśli którykolwiek z tych obszarów wydaje się wymagać zmiany -  **zatrzymaj się i zapytaj.**
