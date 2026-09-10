# Program pracowniczy by Motolia - Architektura i ADR (Etap P0 - Rewizja 3)

**Data dokumentu:** 2026-09-10  
**Status:** Rewizja 3 po walidacji narzędziowej Prisma 5.22.0 (w pełni odtwarzalna z dokumentacji)  
**Gałąź bazowa:** `feat/employee-portal` (utworzona z `dev` na commit `8531642c0acdf5bed0eb817d48aacc06fd1f6bac`)  
**Repozytorium:** `kameel77/car-scout`  

---

## 1. Kontekst i cele biznesowe

Celem modułu jest uruchomienie zamkniętego portalu samochodowego dla pracowników firm partnerskich (pierwszy pilotaż: Action, ~700 uprawnionych pracowników).
Portal funkcjonuje pod osobną marką `[nazwa] by Motolia`, z własną domeną, korzystając ze wspólnego katalogu pojazdów Motolii, lecz z niezależnymi warunkami handlowymi, dedykowanymi matrycami najmu, rabatami na nowe auta oraz pakietem benefitów (karta paliwowa Moya, dedykowany opiekun/konsultant).

---

## 2. Architektoniczny Rekord Decyzyjny (ADR)

### ADR-01: Wspólne repozytorium bez forka i bez wymuszonego monorepo
* **Decyzja:** Tworzymy dedykowaną aplikację frontendową w katalogu `apps/employee-portal/` jako autonomiczny projekt z własnym `package.json` i `package-lock.json`. Współdzielimy backend w `backend/src/modules/employee-program/`.
* **Uzasadnienie:** Forking repozytorium stworzyłby dług technologiczny synchronizacji katalogu, parserów i integracji leasingowych. Z kolei wymuszenie npm workspaces w roocie (`workspaces: ["apps/*", "backend"]`) rodzi wysokie ryzyko regresji dla istniejących skryptów CI/CD i produkcyjnych deploymentów Motolii na Coolify.
* **Konsekwencje:** Osobny proces instalacji (`npm --prefix apps/employee-portal install`), odrębny `Dockerfile` dla portalu, zero wpływu na `package.json` w katalogu głównym.

### ADR-02: Pełna separacja tożsamości pracownika od kont administratorów i ochrona sesji
* **Decyzja:** Nie wykorzystujemy modelu `User` ani domyślnej roli `admin` do rejestracji pracowników. Wprowadzamy odrębny model `EmployeeAccount`, `EmployeeMembership` oraz audyt `EmployeeMembershipAudit`.
* **Uzasadnienie:** W obecnym `backend/prisma/schema.prisma` model `User` domyślnie posiada uprawnienia `admin`. Jakikolwiek błąd w middleware lub regresja w rolach mogłaby nadać pracownikowi dostęp do panelu zarządczego Motolii.
* **Konsekwencje:** 
  * Odrębny realm autoryzacji: token JWT podpisany z `realm: 'employee'` oraz `aud: 'employee-portal'`.
  * Fastify hook `verifyEmployeeAuth` bezwzględnie weryfikuje `realm === 'employee'` i `aud === 'employee-portal'`. Odwrotnie: `verifyAdmin` w panelu zarządczym natychmiast odrzuca tokeny o innym realmie.
  * Ciasteczka sesyjne: host-only `HttpOnly`, `Secure`, `SameSite=Lax` powiązane wyłącznie z domeną portalu pracowniczego.
  * Ochrona CSRF: kontrakt **Double-Submit Cookie**. Backend ustawia ciasteczko `__Host-ep-csrf` (Secure, SameSite=Strict, HttpOnly=false). Klient wysyła token w nagłówku `X-CSRF-Token` przy żądaniach modyfikujących (POST/PUT/DELETE). Middleware Fastify porównuje token z nagłówka z ciasteczkiem oraz waliduje nagłówki `Origin` i `Referer`.

### ADR-03: Całkowita izolacja prywatnych matryc najmu od publicznych
* **Decyzja:** Prywatne matryce najmu są przechowywane w dedykowanych tabelach `EmployeeMatrixSet`, `EmployeeMatrixVersion` (immutable po publikacji) i `EmployeeMatrixRow`.
* **Uzasadnienie:** Istniejący moduł publicznego najmu (`rental-matrix.ts`) wykonuje operacje `deleteMany` podczas importu i nie wersjonuje stawek. Wymieszanie matryc partnerskich z publicznymi groziłoby wyciekiem stawek prywatnych do wyszukiwarki publicznej Motolii lub skasowaniem ofert Action przez publiczny import CSV.
* **Konsekwencje:**
  * `EmployeeMatrixSet` powiązany relacją FK z istniejącą tabelą dostawców `RentalCompany` (`rental_companies`).
  * Wiersze matrycy `EmployeeMatrixRow` powiązane relacją FK z przypisaniem `VehicleRentalAssignment` (`vehicle_rental_assignments`), co gwarantuje spójność: pojazd $\rightarrow$ dostawca $\rightarrow$ matryca.
  * Publiczne zapytania SQL i cache Redis nigdy nie odpytują tabel pracowniczych.
  * Nowy import ma postać wersji roboczej (DRAFT) i staje się aktywny dopiero po jawnej, transakcyjnej publikacji.

### ADR-04: Referencyjna integralność źródeł ofert i wielodostawczość
* **Decyzja:** Model `EmployeeProgramOffer` posiada jawne klucze obce do `Listing` (finansowanie) oraz `VehicleRentalAssignment` (najem), zabezpieczone warunkiem PostgreSQL Check Constraint. W przypadku najmu unikalność oferty opiera się na parze `[programId, assignmentId]`.
* **Uzasadnienie:** Ponieważ `VehicleRentalAssignment` w istniejącym schemacie reprezentuje unikalną relację pojazdu i firmy wynajmującej (`vehicleId + rentalCompanyId`), powiązanie oferty z `assignmentId` umożliwia oferowanie tego samego modelu samochodu w jednym programie od różnych dostawców (np. BMW 3 od Ayvens i od Athlon), zapobiegając jednocześnie dublowaniu ofert od tego samego dostawcy.
* **Wpływ `onDelete: Restrict` na istniejące kontrolery usuwania:**
  * W kontrolerach `backend/src/routes/listings.ts` (linie 1066, 1262) oraz `backend/src/routes/rental-vehicles.ts` (linia 478) administrator posiada możliwość twardego usunięcia ogłoszenia lub pojazdu.
  * Zastosowanie `onDelete: Restrict` celowo blokuje fizyczne usunięcie rekordu w bazie, jeśli pojazd jest powiązany z ofertą w `EmployeeProgramOffer` (kod błędu Prisma `P2003`).
  * W tych kontrolerach błąd `P2003` zostanie przechwycony i zwróci odpowiedź HTTP `409 Conflict`: *„Nie można usunąć pojazdu powiązanego z programem pracowniczym. Wycofaj ofertę z programu przed usunięciem pojazdu.”*
  * Standardowy proces scrapingu i synchronizacji ofert nie wykonuje fizycznego `DELETE`, lecz ustawia `isArchived = true`, co nie jest blokowane przez `onDelete: Restrict`.

### ADR-05: Izolowana kalkulacja rat referencyjnych dla programów (Redis Cache Kontrakt)
* **Decyzja:** Nie używamy funkcji `computeReferenceInstallments` z `financing-calc.service.ts` do wyliczania rat programowych. Wprowadzamy dedykowany serwis `EmployeeProgramPricingService` z dedykowanym cache w Redis.
* **Uzasadnienie:** Funkcja `computeReferenceInstallments` zapisuje wyniki bezpośrednio do kolumn `referenceCreditInstallment` i `referenceLeasingInstallment` w publicznej tabeli `Listing`. Użycie jej dla Action spowodowałoby nadpisanie publicznych cen Motolii stawkami pracowniczymi.
* **Kontrakt Redis Cache i reguła Pricing Fingerprint:**
  * Klucz cache:
    `ep:rate:v1:{programId}:{listingId}:{contractParty}:{pricingFingerprint}:{paramsHash}`
    gdzie:
    * `pricingFingerprint`: skrót SHA256 z kanonicznego JSON wszystkich parametrów wpływających na wycenę:
      - `programDefaultDiscount`: `EmployeeProgram.defaultDiscountPct`
      - `productOverride`: konfiguracja `EmployeeProductOverride` (min/max wpłata, dozwolone okresy)
      - `offerOverrides`: `EmployeeProgramOffer.customPricePln`, `EmployeeProgramOffer.discountPct`
      - `sourcePrice`: `Listing.pricePln`
      - `partnerConfig`: `FinancingProduct.providerConfig`
      Dzięki temu jakakolwiek zmiana warunków w programie, nadpisania w ofercie, ceny bazowej auta w Motolii czy parametrów partnera **automatycznie zmienia fingerprint**, co uniemożliwia zwrócenie nieaktualnej raty z cache.
    * `contractParty`: `CONSUMER` | `EMPLOYEE_B2B` | `EMPLOYER_COMPANY`.
    * `paramsHash`: skrót z JSON wybranych parametrów kalkulacji (okres, wpłata, productId).
  * Wartość:
    `{ monthlyRateNet: number, monthlyRateGross: number, downPaymentNet: number, periodMonths: number, productId: string, provider: string, calculatedAt: string }`
  * TTL: 3600 sekund (1h).

### ADR-06: Bezpieczny Runtime Config w Dockerze
* **Decyzja:** Konfiguracja marki (nazwa, logo, URL, kontakt) jest generowana przy starcie kontenera Nginx do statycznego pliku JSON `/usr/share/nginx/html/runtime-config.json`.
* **Uzasadnienie:** Wyklucza to jakiekolwiek błędy wstrzykiwania kodu w skryptach powłoki. Aplikacja pobiera plik podczas bootstrapu za pomocą `fetch('/runtime-config.json')`.
* **Konsekwencje:**
  * Skrypt `entrypoint.sh` weryfikuje poprawność zmiennych:
    * `PORTAL_API_URL` musi być ścieżką względną do same-origin (domyślnie `/api` lub `/api/*`) albo zaufanym adresem HTTPS.
    * `PORTAL_PUBLIC_URL` musi używać protokołu `http://` lub `https://`.
  * Nginx serwuje `runtime-config.json` z nagłówkiem `Cache-Control: no-cache, no-store, must-revalidate`.
  * W finalnym obrazie kontenera `Dockerfile` narzędzie `node` (lub dedykowany generator) jest dostępne w etapie startu.

### ADR-07: Uproszczenie obsługi benefitu Moya (MVP)
* **Decyzja:** W MVP rezygnujemy z modułu `EmployeeBenefitFulfillment`, rejestru kodów kart Moya, e-maili o wydaniu oraz checkboxów odbioru pojazdu. Aplikacja prezentuje obiecany pakiet (kwota zasilenia, rabat, warunek odbioru auta) i utrwala go w niezmiennym snapshotcie zgłoszenia (`EmployeeInquiry`). Fizyczne wydanie karty realizuje operator poza systemem.
* **Uzasadnienie:** Eliminacja przedwczesnej automatyzacji i zbędnych stanów bazy danych. Konsultant otrzymuje kompletne dane w zgłoszeniu, a system nie obiecuje automatycznej integracji, której nie posiada.

---

## 3. Mapa ponownego wykorzystania kodu (Code Reuse Map)

| Komponent / Usługa | Ścieżka w repozytorium | Rola w programie pracowniczym | Dozwolone nadpisania w programie | Czego nie wolno modyfikować |
| :--- | :--- | :--- | :--- | :--- |
| **Finansowanie partnerów (Inbank, Vehis)** | `backend/src/services/financing-calc.service.ts` | Wyliczanie rat leasingu / kredytu dla nowych aut z `Listing`. | - Efektywna cena auta (`customPricePln` lub rabat procentowy programu).<br>- Biała lista dozwolonych okresów (`allowedPeriods`).<br>- Zakres wpłaty własnej (`minDownPaymentPct`, `maxDownPaymentPct`). | - Wewnętrzne formuły i endpointy partnerów.<br>- Globalne konfiguracje providerów w Motolii.<br>- Dowolne wpisywanie prowizji/marż nieobsługiwanych przez API partnera. |
| **Nowy serwis cen programowych** | `backend/src/modules/employee-program/pricing.service.ts` | Wyliczanie rat referencyjnych i kalkulacji ofert bez mutacji `Listing`. | Dedykowany cache Redis `ep:rate:v1:*`. | Zakaz wywoływania `computeReferenceInstallments` mutującego bazę publiczną. |
| **Kalkulator najmu długoterminowego** | `backend/src/services/rental-quote.service.ts` | Wzorzec dla wyliczania raty najmu z matrycy (okres, km, ubezpieczenie, opony). | Program przypisuje dedykowany zestaw matrycy (`EmployeeMatrixVersion`) z określonym poziomem fee (np. 6%). | Zakaz przeliczania raty przez mnożenie o procent; stawka wynika wprost z wiersza matrycy. |
| **Parser plików CSV matryc** | `backend/src/services/rental-csv-mapper.ts` | Ponowne wykorzystanie parsera formatów PL, liczb i kolumn matryc dostawców. | Import do prywatnych tabel DRAFT z walidacją spójności przed publikacją. | Zakaz kierowania importu do tabeli `rental_matrix_entries` i kasowania istniejących wierszy. |

---

## 4. Kwalifikacja dostępności i hierarchia reguł

W formularzu oraz na liście katalogowej użytkownik określa stronę umowy:
1. **Prywatnie, jako konsument** (`CONSUMER`)
2. **Na moją działalność / firmę** (`EMPLOYEE_B2B`)
3. **Na firmę udostępniającą program** (`EMPLOYER_COMPANY`)

### Hierarchia i reguły pierwszeństwa:
1. **Krok 1: Sprawdzenie `allowedContractParties` (Bezwzględny priorytet):**
   * Jeśli wybrana strona umowy (np. `CONSUMER`) **nie** znajduje się na liście `allowedContractParties` produktu finansowego lub zestawu matrycy najmu, produkt jest bezwzględnie oznaczany jako **`UNAVAILABLE`**. Rata nie jest kalkulowana, a użytkownik widzi informację o dostępności wyłącznie dla firm oraz przycisk kontaktu z doradcą.
2. **Krok 2: Kwalifikacja statusu B2C (`b2cStatus`):**
   * Jeśli strona `CONSUMER` znajduje się na liście `allowedContractParties`, o sposobie prezentacji decyduje flaga `b2cStatus`:
     * `AVAILABLE`: produkt w pełni potwierdzony dla konsumenta, standardowa kalkulacja i aktywny przycisk zgłoszenia.
     * `REQUIRES_CONFIRMATION` (Domyślny stan przy braku potwierdzenia): kalkulacja szacunkowa z wyraźnym ostrzeżeniem: *„Dostępność oferty dla osoby prywatnej wymaga potwierdzenia przez analityka.”* Status ten jest utrwalany w `EmployeeInquiry`.
     * `UNAVAILABLE`: ukrycie raty i przekierowanie do konsultanta.
3. **Krok 3: Strony B2B (`EMPLOYEE_B2B`, `EMPLOYER_COMPANY`):**
   * Dla stron B2B produkty leasingowe i najmu są domyślnie `AVAILABLE`, o ile dana opcja znajduje się w `allowedContractParties`.

### Semantyka nadpisań w `EmployeeProductOverride`:
* `allowedPeriods`: Jeśli tablica jest pusta (`[]`), oznacza to **pełne dziedziczenie** okresów finansowania z bazowej konfiguracji produktu w Motolii. Jeśli tablica zawiera wartości (np. `[24, 36, 48]`), stanowi to restrykcyjną listę dopuszczalnych okresów.
* `minDownPaymentPct` / `maxDownPaymentPct`: Ograniczają suwak wpłaty własnej. Wartości podlegają walidacji, aby nie przekraczały limitów nałożonych przez API danego finansującego.

---

## 5. Projekt modelu danych (Prisma Schema - Pełna specyfikacja zmian)

### 5.1. Relacje odwrotne dodawane do istniejących modeli w `backend/prisma/schema.prisma` (w etapie P2):

```prisma
// W modelu Listing:
model Listing {
  // ... istniejące pola ...
  employeeProgramOffers EmployeeProgramOffer[]
}

// W modelu RentalCompany:
model RentalCompany {
  // ... istniejące pola ...
  employeeMatrixSets EmployeeMatrixSet[]
}

// W modelu VehicleRentalAssignment:
model VehicleRentalAssignment {
  // ... istniejące pola ...
  employeeMatrixRows    EmployeeMatrixRow[]
  employeeProgramOffers EmployeeProgramOffer[]
}

// W modelu FinancingProduct:
model FinancingProduct {
  // ... istniejące pola ...
  employeeProductOverrides EmployeeProductOverride[]
}

// W modelu Lead:
model Lead {
  // ... istniejące pola ...
  employeeInquiry EmployeeInquiry?
}
```

### 5.2. Nowe modele programu pracowniczego:

```prisma
// ---------------------------------------------------------------------------
// Moduł Programu Pracowniczego (Employee Program)
// ---------------------------------------------------------------------------

enum EmployeeOfferSourceType {
  FINANCING // Nowe auto z tabeli Listing
  RENTAL    // Auto powiązane przez VehicleRentalAssignment
}

enum ContractPartyOption {
  CONSUMER          // Osoba fizyczna (konsument)
  EMPLOYEE_B2B      // Działalność gospodarcza pracownika
  EMPLOYER_COMPANY  // Firma pracodawcy (np. Action)
}

enum ProductAvailabilityStatus {
  AVAILABLE               // Potwierdzona dostępność
  REQUIRES_CONFIRMATION   // Wymaga potwierdzenia (domyślny przy braku weryfikacji)
  UNAVAILABLE             // Niedostępne dla danej formy umowy
}

enum MatrixPublishStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model EmployeeCompany {
  id                String                     @id @default(cuid())
  name              String                     @unique
  slug              String                     @unique
  nip               String?
  isActive          Boolean                    @default(true) @map("is_active")
  createdAt         DateTime                   @default(now()) @map("created_at")
  updatedAt         DateTime                   @updatedAt @map("updated_at")

  programs          EmployeeProgram[]
  registrationCodes EmployeeRegistrationCode[]
  memberships       EmployeeMembership[]
  inquiries         EmployeeInquiry[]

  @@map("employee_companies")
}

model EmployeeProgram {
  id                   String                     @id @default(cuid())
  companyId            String                     @map("company_id")
  name                 String
  slug                 String                     @unique
  description          String?
  isActive             Boolean                    @default(true) @map("is_active")
  createdAt            DateTime                   @default(now()) @map("created_at")
  updatedAt            DateTime                   @updatedAt @map("updated_at")

  defaultDiscountPct   Decimal?                   @map("default_discount_pct") @db.Decimal(5, 2)

  company              EmployeeCompany            @relation(fields: [companyId], references: [id], onDelete: Cascade)
  productOverrides     EmployeeProductOverride[]
  offers               EmployeeProgramOffer[]
  benefitPolicies      EmployeeBenefitPolicy[]
  memberships          EmployeeMembership[]
  inquiries            EmployeeInquiry[]
  registrationCodes    EmployeeRegistrationCode[]

  @@unique([companyId, id])
  @@map("employee_programs")
}

// Konfiguracja dopuszczonych produktów finansowych per program
model EmployeeProductOverride {
  id                      String                    @id @default(cuid())
  programId               String                    @map("program_id")
  financingProductId      String                    @map("financing_product_id")
  isEnabled               Boolean                   @default(true) @map("is_enabled")
  b2cStatus               ProductAvailabilityStatus @default(REQUIRES_CONFIRMATION) @map("b2c_status")
  allowedContractParties  ContractPartyOption[]     @default([EMPLOYEE_B2B, EMPLOYER_COMPANY]) @map("allowed_contract_parties")
  minDownPaymentPct       Decimal?                  @map("min_down_payment_pct") @db.Decimal(5, 2)
  maxDownPaymentPct       Decimal?                  @map("max_down_payment_pct") @db.Decimal(5, 2)
  allowedPeriods          Int[]                     @default([]) @map("allowed_periods") // Pusta tablica = dziedziczenie z Motolii
  createdAt               DateTime                  @default(now()) @map("created_at")
  updatedAt               DateTime                  @updatedAt @map("updated_at")

  program                 EmployeeProgram           @relation(fields: [programId], references: [id], onDelete: Cascade)
  financingProduct        FinancingProduct          @relation(fields: [financingProductId], references: [id], onDelete: Restrict)

  @@unique([programId, financingProductId])
  @@map("employee_product_overrides")
}

model EmployeeRegistrationCode {
  id          String          @id @default(cuid())
  companyId   String          @map("company_id")
  programId   String          @map("program_id")
  codeHash    String          @unique @map("code_hash")
  label       String?
  isActive    Boolean         @default(true) @map("is_active")
  expiresAt   DateTime?       @map("expires_at")
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")

  company     EmployeeCompany @relation(fields: [companyId], references: [id], onDelete: Cascade)
  program     EmployeeProgram @relation(fields: [companyId, programId], references: [companyId, id], onDelete: Cascade)

  @@index([companyId, isActive])
  @@map("employee_registration_codes")
}

model EmployeeAccount {
  id              String                    @id @default(cuid())
  email           String                    @unique
  passwordHash    String                    @map("password_hash")
  firstName       String?                   @map("first_name")
  lastName        String?                   @map("last_name")
  phone           String?
  isActive        Boolean                   @default(true) @map("is_active")
  lastLoginAt     DateTime?                 @map("last_login_at")
  createdAt       DateTime                  @default(now()) @map("created_at")
  updatedAt       DateTime                  @updatedAt @map("updated_at")

  membership      EmployeeMembership?       // MVP: dokładnie jedno aktywne członkostwo
  membershipAudit EmployeeMembershipAudit[]
  inquiries       EmployeeInquiry[]

  @@map("employee_accounts")
}

model EmployeeMembership {
  id         String          @id @default(cuid())
  accountId  String          @unique @map("account_id") // 1 konto = 1 aktywne członkostwo w MVP
  companyId  String          @map("company_id")
  programId  String          @map("program_id")
  isActive   Boolean         @default(true) @map("is_active")
  createdAt  DateTime        @default(now()) @map("created_at")
  revokedAt  DateTime?       @map("revoked_at")

  account    EmployeeAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  company    EmployeeCompany @relation(fields: [companyId], references: [id], onDelete: Restrict)
  program    EmployeeProgram @relation(fields: [companyId, programId], references: [companyId, id], onDelete: Restrict)

  @@map("employee_memberships")
}

model EmployeeMembershipAudit {
  id         String          @id @default(cuid())
  accountId  String          @map("account_id")
  companyId  String          @map("company_id")
  programId  String          @map("program_id")
  action     String          @map("action") // CREATED, ROTATED, REVOKED, REINSTATED
  reason     String?         @map("reason")
  createdAt  DateTime        @default(now()) @map("created_at")

  account    EmployeeAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId, createdAt])
  @@map("employee_membership_audits")
}

// Prywatne matryce najmu - powiązane z dostawcą floty RentalCompany
model EmployeeMatrixSet {
  id                     String                    @id @default(cuid())
  rentalCompanyId        String                    @map("rental_company_id")
  name                   String                    // np. "Ayvens Flota Zamknięta"
  description            String?
  allowedContractParties ContractPartyOption[]     @default([EMPLOYEE_B2B, EMPLOYER_COMPANY]) @map("allowed_contract_parties")
  b2cStatus              ProductAvailabilityStatus @default(REQUIRES_CONFIRMATION) @map("b2c_status")
  createdAt              DateTime                  @default(now()) @map("created_at")
  updatedAt              DateTime                  @updatedAt @map("updated_at")

  rentalCompany          RentalCompany             @relation(fields: [rentalCompanyId], references: [id], onDelete: Restrict)
  versions               EmployeeMatrixVersion[]

  @@map("employee_matrix_sets")
}

model EmployeeMatrixVersion {
  id            String                 @id @default(cuid())
  matrixSetId   String                 @map("matrix_set_id")
  versionNumber Int                    @map("version_number")
  label         String                 // np. "Zestaw 6% fee - Q3 2026"
  feePct        Decimal?               @map("fee_pct") @db.Decimal(5, 2)
  status        MatrixPublishStatus    @default(DRAFT)
  publishedAt   DateTime?              @map("published_at")
  effectiveFrom DateTime?              @map("effective_from")
  effectiveTo   DateTime?              @map("effective_to")
  createdAt     DateTime               @default(now()) @map("created_at")

  matrixSet     EmployeeMatrixSet      @relation(fields: [matrixSetId], references: [id], onDelete: Cascade)
  rows          EmployeeMatrixRow[]
  offers        EmployeeProgramOffer[]

  @@unique([matrixSetId, versionNumber])
  @@map("employee_matrix_versions")
}

model EmployeeMatrixRow {
  id                      String                  @id @default(cuid())
  versionId               String                  @map("version_id")
  assignmentId            String                  @map("assignment_id") // Powiązanie z pojazdem i dostawcą
  contractMonths          Int                     @map("contract_months")
  annualMileageKm         Int                     @map("annual_mileage_km")
  initialPaymentPct       Decimal                 @map("initial_payment_pct") @db.Decimal(5, 2)
  initialPaymentAmountNet Decimal                 @default(0) @map("initial_payment_amount_net") @db.Decimal(10, 2)
  monthlyRateNet          Decimal                 @map("monthly_rate_net") @db.Decimal(10, 2)
  monthlyRateGross        Decimal                 @map("monthly_rate_gross") @db.Decimal(10, 2)
  servicesIncluded        String[]                @default([]) @map("services_included")
  insuranceExcess500      Decimal?                @map("insurance_excess_500") @db.Decimal(10, 2)
  insuranceNoLimit        Decimal?                @map("insurance_no_limit") @db.Decimal(10, 2)
  tiresNoLimit            Decimal?                @map("tires_no_limit") @db.Decimal(10, 2)
  overMileageCost         Decimal?                @map("over_mileage_cost") @db.Decimal(6, 4)
  createdAt               DateTime                @default(now()) @map("created_at")

  version                 EmployeeMatrixVersion   @relation(fields: [versionId], references: [id], onDelete: Cascade)
  assignment              VehicleRentalAssignment @relation(fields: [assignmentId], references: [id], onDelete: Restrict)

  // Kompletny klucz unikalności wiersza kalkulacji:
  @@unique([versionId, assignmentId, contractMonths, annualMileageKm, initialPaymentPct, initialPaymentAmountNet])
  @@index([versionId, assignmentId])
  @@map("employee_matrix_rows")
}

// Oferty w programie: powiązane z Listing (finansowanie) lub VehicleRentalAssignment (najem)
model EmployeeProgramOffer {
  id              String                   @id @default(cuid())
  programId       String                   @map("program_id")
  sourceType      EmployeeOfferSourceType  @map("source_type")

  listingId       String?                  @map("listing_id")
  listing         Listing?                 @relation(fields: [listingId], references: [id], onDelete: Restrict)

  assignmentId    String?                  @map("assignment_id")
  assignment      VehicleRentalAssignment? @relation(fields: [assignmentId], references: [id], onDelete: Restrict)

  matrixVersionId String?                  @map("matrix_version_id")
  matrixVersion   EmployeeMatrixVersion?   @relation(fields: [matrixVersionId], references: [id], onDelete: Restrict)

  customPricePln  Int?                     @map("custom_price_pln")
  discountPct     Decimal?                 @map("discount_pct") @db.Decimal(5, 2)

  benefitPolicyId String?                  @map("benefit_policy_id")
  benefitPolicy   EmployeeBenefitPolicy?   @relation(fields: [programId, benefitPolicyId], references: [programId, id], onDelete: Restrict)

  isActive        Boolean                  @default(true) @map("is_active")
  createdAt       DateTime                 @default(now()) @map("created_at")
  updatedAt       DateTime                 @updatedAt @map("updated_at")

  program         EmployeeProgram          @relation(fields: [programId], references: [id], onDelete: Cascade)

  // Unikalności: dokładnie 1 oferta danego auta w finansowaniu i 1 oferta danego przypisania dostawcy w najmie:
  @@unique([programId, listingId])
  @@unique([programId, assignmentId])
  @@index([programId, isActive])
  @@map("employee_program_offers")
}

model EmployeeBenefitPolicy {
  id              String                 @id @default(cuid())
  programId       String                 @map("program_id")
  name            String                 // np. "Pakiet Start Moya 500"
  moyaCardAmount  Int?                   @map("moya_card_amount")
  fuelDiscount    String?                @map("fuel_discount")
  consultantCare  Boolean                @default(true) @map("consultant_care")
  termsText       String?                @map("terms_text")
  isActive        Boolean                @default(true) @map("is_active")
  createdAt       DateTime               @default(now()) @map("created_at")
  updatedAt       DateTime               @updatedAt @map("updated_at")

  program         EmployeeProgram        @relation(fields: [programId], references: [id], onDelete: Cascade)
  offers          EmployeeProgramOffer[]

  @@unique([programId, id])
  @@map("employee_benefit_policies")
}

model EmployeeInquiry {
  id                       String                    @id @default(cuid())
  accountId                String                    @map("account_id")
  companyId                String                    @map("company_id")
  programId                String                    @map("program_id")
  contractParty            ContractPartyOption       @map("contract_party")
  productAvailabilityStatus ProductAvailabilityStatus @default(REQUIRES_CONFIRMATION) @map("product_availability_status")

  contactName              String                    @map("contact_name")
  contactEmail             String                    @map("contact_email")
  contactPhone             String                    @map("contact_phone")
  nip                      String?
  notes                    String?

  calculationSnapshot      Json                      @map("calculation_snapshot")
  benefitSnapshot          Json?                     @map("benefit_snapshot")

  idempotencyKey           String                    @unique @map("idempotency_key")
  leadId                   String?                   @unique @map("lead_id")
  lead                     Lead?                     @relation(fields: [leadId], references: [id], onDelete: SetNull)

  status                   String                    @default("NEW")
  createdAt                DateTime                  @default(now()) @map("created_at")
  updatedAt                DateTime                  @updatedAt @map("updated_at")

  account                  EmployeeAccount           @relation(fields: [accountId], references: [id], onDelete: Restrict)
  company                  EmployeeCompany           @relation(fields: [companyId], references: [id], onDelete: Restrict)
  program                  EmployeeProgram           @relation(fields: [companyId, programId], references: [companyId, id], onDelete: Restrict)

  @@index([companyId, status])
  @@index([accountId])
  @@map("employee_inquiries")
}
```

### Ograniczenie integralności w migracji SQL (PostgreSQL Check Constraint):
```sql
ALTER TABLE "employee_program_offers"
ADD CONSTRAINT "check_offer_source_integrity"
CHECK (
  (source_type = 'FINANCING' AND listing_id IS NOT NULL AND assignment_id IS NULL AND matrix_version_id IS NULL)
  OR
  (source_type = 'RENTAL' AND assignment_id IS NOT NULL AND matrix_version_id IS NOT NULL AND listing_id IS NULL)
);
```

---

## 6. Bezpieczny Runtime Config w Dockerze

W kontenerze Nginx plik konfiguracji generowany jest jako czysty statyczny plik JSON `/usr/share/nginx/html/runtime-config.json` z walidacją wejścia:

```sh
#!/bin/sh
set -e

# Bezpieczna walidacja zmiennych URL:
# PORTAL_API_URL: dozwolone ścieżki względne (/api lub /api/*) lub bezwzględny zaufany HTTPS
case "$PORTAL_API_URL" in
  /api|/api/*|"") ;;
  https://*) ;;
  *) echo "Błąd: PORTAL_API_URL musi być ścieżką /api lub adresem https://"; exit 1 ;;
esac

# PORTAL_PUBLIC_URL: dozwolony wyłącznie protokół http/https
case "$PORTAL_PUBLIC_URL" in
  http://*|https://*|"") ;;
  *) echo "Błąd: PORTAL_PUBLIC_URL musi zaczynać się od http:// lub https://"; exit 1 ;;
esac

# Generowanie pliku runtime-config.json bez interpolacji w kodzie JS:
cat <<EOF > /usr/share/nginx/html/runtime-config.json
{
  "brandName": $(node -e 'console.log(JSON.stringify(process.env.PORTAL_BRAND_NAME || "Program Pracowniczy"))'),
  "brandLogoUrl": $(node -e 'console.log(JSON.stringify(process.env.PORTAL_LOGO_URL || "/logo.svg"))'),
  "portalUrl": $(node -e 'console.log(JSON.stringify(process.env.PORTAL_PUBLIC_URL || ""))'),
  "apiUrl": $(node -e 'console.log(JSON.stringify(process.env.PORTAL_API_URL || "/api"))')
}
EOF

exec nginx -g "daemon off;"
```

### Konfiguracja Nginx:
```nginx
location = /runtime-config.json {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

### Inicjalizacja we frontendzie (`apps/employee-portal/src/config/brand.ts`):
Aplikacja pobiera plik podczas startu:
```ts
export async function loadRuntimeConfig(): Promise<PortalConfig> {
  try {
    const res = await fetch('/runtime-config.json', { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Failed to load runtime-config.json, using fallback', e);
  }
  return fallbackConfig;
}
```
