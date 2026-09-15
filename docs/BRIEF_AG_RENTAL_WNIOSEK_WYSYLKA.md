# Brief dla agenta — złożenie i wysyłka wniosku najmu (Etap 2)

Data: 2026-09-05 · Repo: `car-scout` · Zatwierdził: Kamil

Etap 2 z czterech. Zakłada ukończony Etap 1 ([BRIEF_AG_RENTAL_STOK_I_WYCENA.md](BRIEF_AG_RENTAL_STOK_I_WYCENA.md)) —
stok w bazie, warianty cennika, endpoint wyceny zwracający ratę z rozbiciem.

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Cel

Zamienić ręczne sklejanie maila do partnera finansowego w jedno wywołanie API, które **przy okazji
zakłada sprawę w pipelinie**. Dziś operator przepisuje dane z trzech źródeł do wiadomości i często
zapomina odnotować sprawę — przez co lejek sprzedażowy nie wie o wnioskach, które wyszły.

Miara sukcesu: jedno wywołanie `POST` tworzy komplet — klient, sprawa, kandydat pojazdu, oferta ze
snapshotem wyceny, wniosek w stanie `PRECHECK_SUBMITTED` i wysłany mail — a wszystko to jest widoczne
w Thulium przez istniejący endpoint lookup bez żadnej zmiany po stronie Thulium.

## Dokąd to zmierza

Celem całości jest obsługa sprawy **od wniosku do wydania pojazdu i rozliczenia prowizji**.
Etap 2 zamyka pierwszy odcinek, ale wszystko, co tu zapiszesz, ma przetrwać do rozliczenia:

- **numer stokowy jest identyfikatorem uzgodnienia z partnerem** przez cały łańcuch — trafia do maila,
  do oferty i do zestawienia prowizyjnego. Musi być zapisany relacyjnie, nie tylko w treści maila.
- **rata i wariant cennika muszą być zamrożone** w chwili wysyłki. Cenniki są ważne 14 dni i będą
  reimportowane; za trzy miesiące nie odtworzysz z matrycy tego, co klientowi obiecano.

## Decyzje podjęte — nie renegocjuj

1. **Nie budujemy nowego cyklu życia wniosku.** Endpoint jest **kompozycją istniejących prymitywów**
   (`findOrCreateCustomer` → `createOpportunity` → `addVehicleCandidate` → `createOrUpdateOffer` →
   `createApplication` → `submitApplication`). Zero równoległych ścieżek stanu, zero własnych
   przejść fazy.
2. **PESEL trafia do bazy, zaszyfrowany.** Decyzja właściciela produktu: dane i tak przez nas
   przechodzą, więc lepiej nimi zarządzać niż rozsypywać po skrzynkach. Warunki w Zakresie 1 są
   częścią tej decyzji, nie opcją.
3. **Nie liczymy prowizji.** Wariant cennika jest etykietą wybraną przez operatora. Do maila idzie
   nazwa wariantu i rata z tego wariantu.
4. **Transakcja bazodanowa przed mailem, nigdy odwrotnie.** Awaria SMTP nie może skasować sprawy.
5. Stos i proces bez zmian: Prisma + `prisma db push`, Fastify, Vitest, gałąź `dev`.

## Stan obecny — zweryfikowany w kodzie

Prymitywy, które komponujesz. Przeczytaj je przed pisaniem — nie duplikuj ich logiki:

| Prymityw | Plik | Uwagi |
|---|---|---|
| `findOrCreateCustomer` | `services/customer.service.ts:156` | Zwraca `{ customer, isNew, isAmbiguous }`. Dopasowuje po telefonie / e-mailu / NIP-ie |
| `createOpportunity` | `services/opportunity.service.ts:49` | `leadSource` jest **wymagane** — atrybucja jest z założenia obowiązkowa także dla spraw zakładanych ręcznie |
| `addVehicleCandidate` | `services/vehicle.service.ts:16` | Ma już `rentalVehicleId` i `selectionStatus: 'SELECTED'` |
| `createOrUpdateOffer` | `services/offer.service.ts:49` | Gdy podasz `monthlyRateGrosze`, nie liczy raty samodzielnie |
| `createApplication` / `submitApplication` | `services/application.service.ts:32,111` | `submitApplication` z `stage: 'PRECHECK'` ustawia `PRECHECK_SUBMITTED`, `submittedFirstAt` i zapisuje zdarzenie `APPLICATION_SUBMITTED`. **Nie ma tam bramki fazowej** — kompozycja jednym strzałem przejdzie |
| Wysyłka SMTP | `services/email.ts` | `nodemailer` + konfiguracja z `AppSettings` (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`, `smtpFromEmail`) |
| Widoczność w Thulium | `services/thulium-crm-lookup.service.ts` | **Działa i nie wymaga zmian w tym etapie.** Po utworzeniu sprawy Thulium samo pokaże `Sprawa`, `Status wniosku`, `Pojazd`, `Rata` |
| Log zdarzeń | `events/event-types.ts`, `events/record-event.ts` | `PipelineEventPayloadMap` jest typowana — nowy typ zdarzenia wymaga rozszerzenia mapy |

## Zakres 1 — PESEL

### Schemat

```prisma
// PipelineCustomer
/// Szyfrowany AES-256-GCM. Format: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
/// NIGDY nie trafia do pipeline_events, pipeline_thulium_dead_letters ani do logów.
peselEnc    String? @map("pesel_enc")
/// Do rozpoznania klienta bez deszyfrowania: 7 gwiazdek + 4 ostatnie cyfry.
peselMasked String? @map("pesel_masked")
```

**Popraw komentarz nad modelem `PipelineCustomer`.** Stoi tam dziś
*„NO PESEL, no ID document numbers, no scans"* — to była świadoma decyzja, którą właśnie zmieniamy.
Zostawienie sprzeczności między komentarzem a kodem to mina dla następnej osoby. Nowy komentarz ma
mówić, że PESEL jest przechowywany zaszyfrowany, po co, i że skany dokumentów nadal nie wchodzą.

### Serwis szyfrujący

`backend/src/services/pesel-crypto.ts` — czysty moduł, bez Prismy:

- `encryptPesel(plain: string): string`, `decryptPesel(stored: string): string`
- AES-256-GCM, klucz z `PESEL_ENCRYPTION_KEY` (32 bajty, base64), losowy IV na każde szyfrowanie
- **fail closed**: brak lub zły klucz przy próbie zapisu PESEL-u → wyjątek, który trasa mapuje na
  `503`. Nigdy nie zapisuj wartości jawnym tekstem jako „awaryjnie"
- `validatePeselChecksum(plain: string): boolean` — suma kontrolna PESEL. Błędny numer odrzucamy
  `422` **zanim** cokolwiek pójdzie do partnera; literówka w PESEL-u to dziś jedna z częstszych
  przyczyn odrzucenia wniosku
- dopisz `PESEL_ENCRYPTION_KEY` do `.env.example` z komentarzem, jak wygenerować

### Zasady dostępu

- nowe uprawnienie `pipeline:pii:read` (obok istniejących `pipeline:read` / `pipeline:write`),
  przyznane wyłącznie rolom, które dziś mają pełny dostęp do pipeline'u
- **domyślnie każda odpowiedź API zwraca `peselMasked`.** Pełna wartość tylko z tego uprawnienia
  i tylko z dedykowanego endpointu, nigdy „przy okazji" w liście spraw
- deszyfrowanie do maila odbywa się w serwisie wysyłki, wartość nie wraca w odpowiedzi HTTP

### Zakazy — sprawdź je świadomie przed oddaniem

`pipeline_events` ma trigger blokujący `UPDATE`/`DELETE`, a `pipeline_thulium_dead_letters` trzyma
surowe payloady. Wpadka w którymkolwiek z nich jest **nieodwracalna**. PESEL nie może się znaleźć w:
payloadzie żadnego zdarzenia, dead letterze, logu Fastify (`request.body` bywa logowane), komunikacie
błędu walidacji ani w query stringu.

## Zakres 2 — snapshot wyceny

Pojazd wiąże się z kandydatem, warunki handlowe z ofertą:

```prisma
// PipelineVehicleCandidate
rentalStockUnitId String? @map("rental_stock_unit_id")   // FK → RentalStockUnit, onDelete: SetNull
```

```prisma
// PipelineOffer — zamrożone warunki wariantu najmu
rentalPriceVariant     String?  @map("rental_price_variant")      // "base" | "6" | "8" | etykieta partnera
rentalInsuranceVariant Int?     @map("rental_insurance_variant")  // 1000 | 500 | 0
rentalTiresIncluded    Boolean  @default(false) @map("rental_tires_included")
```

Rata, okres i przebieg roczny mają już swoje pola (`monthlyRateGrosze`, `periodMonths`,
`annualMileageKm`) — użyj ich, nie dubluj.

**`priceGrosze` przy najmie:** pole jest w bazie wymagane, a `createOrUpdateOffer` liczy z niego ratę
tylko wtedy, gdy `monthlyRateGrosze` nie podano — my podajemy, więc kalkulacja jest omijana. Wstaw
`catalogPrice` powiązanego `RentalVehicle` przeliczoną na grosze, a gdy go brak — `0`. Nie wymyślaj
wartości zastępczej z raty razy okres; w raportach wyglądałaby jak cena pojazdu.

Indeks `@@index([rentalStockUnitId])` na kandydacie — po nim pójdzie uzgodnienie prowizji.

## Zakres 3 — partner finansowy i adresaci

```prisma
// PipelineFinancier
applicationEmailTo String[] @map("application_email_to")
applicationEmailCc String[] @map("application_email_cc")
```

Adresaci zmieniają się i różnią per partner — nie zaszywaj ich w kodzie.

Dorób seed dykcjonarza (`backend/src/scripts/seed-pipeline-financiers.ts`) zakładający wpis Ayvens:
`code: "AYVENS"`, `supportedFinancing: [RENTAL]`, `supportedClientTypes: [B2C, B2B]`,
`applicationEmailTo: ["wnioski@leaseplan.com"]`, `applicationEmailCc` z `.env` albo pusty.
Skrypt idempotentny (upsert po `[scopeType, scopeId, code]`), **bez guardu na localhost** — ten
wpis jest potrzebny również na produkcji.

## Zakres 4 — endpoint orkiestrujący

```
POST /api/pipeline/rental-applications
uprawnienie: pipeline:write
```

Body:

```jsonc
{
  "opportunityId": null,          // podane → dokładamy wniosek do istniejącej sprawy
  "customer": {                    // wymagane, gdy opportunityId == null
    "fullName": "Wojciech Sroczyński",
    "phone": "+48...", "email": "...",
    "clientType": "B2C",
    "companyName": null, "companyNip": null,
    "pesel": "61031008032"         // tranzyt; szyfrowany przy zapisie, nigdy nie wraca w odpowiedzi
  },
  "leadSource": "OTHER",           // wymagane przy zakładaniu sprawy — atrybucja jest obowiązkowa
  "leadSourceDetail": "Thulium",
  "financierCode": "AYVENS",
  "stockUnitId": "…",
  "months": 36, "annualKm": 10000,
  "insurance": 1000, "tires": false, "variant": "base",
  "thuliumTicketId": 12345         // opcjonalnie
}
```

Przebieg — **wszystko poniżej w jednej transakcji**:

1. `findOrCreateCustomer`; zapisz `peselEnc` i `peselMasked`, gdy PESEL podano. Przy
   `isAmbiguous: true` **przerwij z `409`** i listą kandydatów — operator ma wskazać klienta, a nie
   dostać wniosek podpięty pod przypadkową sprawę.
2. `createOpportunity` z `financingType: RENTAL` (pomiń, gdy podano `opportunityId`).
3. **Przelicz wycenę serwisem z Etapu 1** dla `(stockUnitId, months, annualKm, insurance, tires,
   variant)`. Nie ufaj racie z body — klient HTTP nie jest źródłem prawdy o cenie. Błędy wyceny
   (404/409/422) propaguj bez zmiany znaczenia.
4. `addVehicleCandidate` z `rentalVehicleId` pojazdu spod specyfikacji, `rentalStockUnitId`
   i `selectionStatus: 'SELECTED'`.
5. `createOrUpdateOffer` z ratą i wariantem ze snapshotu.
6. `createApplication` (financier po `code`) → `submitApplication` ze `stage: 'PRECHECK'`.

**Poza transakcją**, dopiero po jej zatwierdzeniu: wysyłka maila, a po niej drugie zdarzenie z
wynikiem. Rozszerz `PipelineEventPayloadMap` o:

```ts
RENTAL_APPLICATION_EMAILED: {
  financierCode: string;
  stockNo: string;
  variant: string;
  monthlyRateNet: number;
  recipients: string[];
  status: 'SENT' | 'FAILED';
  error?: string;        // komunikat błędu SMTP, nigdy treść maila
}
```

Odpowiedź `201` zwraca `opportunityId`, `opportunityNumber`, `applicationId`, `offerId`, `stockNo`,
`monthlyRateNet`, `emailStatus` oraz `caseUrl` (`/admin/pipeline?opp=<id>`) — ten link pójdzie
w Etapie 3 prosto do operatora w Thulium.

**Gdy mail nie wyjdzie: zwróć `201`, nie `500`.** Sprawa istnieje i jest poprawna; brakuje tylko
wysyłki. `emailStatus: "FAILED"` plus zdarzenie w logu wystarczą, żeby operator wiedział, co zrobić.

## Zakres 5 — treść wiadomości

`backend/src/services/rental-application-email.ts`.

- **Do / DW:** z `applicationEmailTo` / `applicationEmailCc` partnera, plus adres operatora składającego
  wniosek w DW
- **Temat:** `FW: {imię} {nazwisko} Pesel {pesel}`, a dla firm `… NIP {nip}`. Prefiks `FW:` wygląda
  na artefakt przekazywania wiadomości, ale tego formatu spodziewa się skrzynka partnera — zostaw
- **Treść:** tabela HTML w kolejności wierszy zgodnej z dzisiejszą wiadomością: Okres, Przebieg roczny,
  Ubezpieczenie (1000/500/0), Opony (tak/nie), Rata całkowita, numer stokowy, NIP\*, PESEL\*,
  Adres mailowy, Prowizja. Dołóż wiersz **Termin dostawy pojazdu** z `vehicleDeliveryDate` — dziś go
  nie ma, a to on rodzi późniejsze spory „klient myślał, że dostanie wcześniej"
- W wierszu prowizji wpisz etykietę faktycznie użytego wariantu. Uwaga: historyczna etykieta
  „Prowizja (Standard/5/7)" nie zgadza się z plikami cennika, które są w wariantach 6% i 8% —
  wypisuj wariant, którego użyto, nie starą etykietę
- Kwoty netto, zgodnie z cennikiem partnera. Zaznacz to w stopce tabeli

## Zakres 6 — ponowna wysyłka

```
POST /api/pipeline/applications/:id/resend-email    // uprawnienie: pipeline:write
```

Odtwarza wiadomość ze snapshotu oferty (nie z aktualnej matrycy) i wysyła ponownie, zapisując kolejne
zdarzenie `RENTAL_APPLICATION_EMAILED`. Bez tego każda awaria SMTP kończy się ręcznym mailem obok
systemu — czyli dokładnie tym, co ten etap likwiduje.

## Kryteria odbioru

Testy w Vitest, fixtures tworzone w `beforeAll` i sprzątane po sobie — żaden test nie zależy od stanu
bazy ani od seeda.

1. **Ścieżka pełna.** Jedno wywołanie na czystej bazie tworzy: klienta, sprawę z `financingType:
   RENTAL`, kandydata z `rentalStockUnitId`, ofertę i wniosek w `PRECHECK_SUBMITTED`. Zdarzenia
   `APPLICATION_CREATED`, `APPLICATION_SUBMITTED` i `RENTAL_APPLICATION_EMAILED` obecne.
2. **Snapshot przeżywa reimport cennika.** Po złożeniu wniosku podmień stawkę w matrycy i sprawdź,
   że `PipelineOffer.monthlyRateGrosze` się nie zmienił.
3. **Rata z serwera, nie z body.** Żądanie z podrobioną ratą w body daje ofertę z ratą policzoną
   przez serwer.
4. **PESEL.** Zapisany jako `peselEnc` w formacie `v1:…`, w bazie nie ma jawnego numeru; `peselMasked`
   ma postać `*******8032`; odpowiedź `201` nie zawiera PESEL-u w żadnej formie; brak
   `PESEL_ENCRYPTION_KEY` przy podanym PESEL-u → `503` i **brak zapisu klienta**.
5. **Suma kontrolna.** PESEL `61031008031` (zła cyfra kontrolna) → `422`, nic nie powstaje, mail nie
   wychodzi.
6. **Czystość logu zdarzeń.** Po pełnym przebiegu żaden wiersz `pipeline_events` nie zawiera ciągu
   PESEL-u — asercja po `JSON.stringify(payload)` wszystkich zdarzeń sprawy.
7. **Awaria SMTP.** Przy zamockowanym błędzie wysyłki: odpowiedź `201`, `emailStatus: "FAILED"`,
   sprawa i wniosek istnieją, zdarzenie ma `status: 'FAILED'`.
8. **Niejednoznaczny klient.** Dwóch klientów pasujących do danych → `409`, nic nie powstaje.
9. **Treść maila.** Snapshot wygenerowanego HTML dla Polo `3460697` / 36 msc / 10 000 km / udział 1000
   / bez opon / wariant base: temat `FW: … Pesel …`, rata `949`, numer stokowy `3460697`, termin
   dostawy `2027-02-01`, adresaci z konfiguracji partnera.
10. **Ponowna wysyłka** po podmianie stawki w matrycy wysyła **starą** ratę ze snapshotu.

## Czego nie robić w tym etapie

- Żadnego UI ani iframe'u w Thulium — to Etap 3.
- Nie ruszaj `thulium-crm-lookup.service.ts`. Status pojawi się tam sam, bo czyta ze spraw.
  Rozszerzenie o numer stokowy to Etap 4.
- Nie buduj wychodzącego klienta API Thulium — czeka na klucze po stronie Thulium.
- Nie twórz mechanizmu szablonów maili per partner. Jeden partner, szablon w kodzie; drugi partner
  będzie okazją, żeby wyciągnąć go do konfiguracji z prawdziwymi wymaganiami.
- Nie licz prowizji i nie wypełniaj `PipelineOffer.expectedCommissionGrosze` — raporty lejka
  pokazywałyby liczby, których nikt nie potwierdził. Faktyczna prowizja ma swoje miejsce w
  `PipelineCommission`, w kolejnym etapie.
- Nie dodawaj kasowania PESEL-u po czasie. Retencja jest potrzebna, ale wymaga decyzji o okresie —
  zgłoś to jako otwarty punkt, nie zgaduj.

## Uruchamianie i wdrożenie

- Skrypty lokalnie: `npx tsx src/scripts/<nazwa>.ts` z katalogu `backend/`
- W kontenerze Coolify: `node dist/scripts/<nazwa>.js` (obraz nie zawiera `src/` ani `tsx`)
- Schemat: `prisma db push`, nigdy `migrate dev`
- Nowa zmienna środowiskowa `PESEL_ENCRYPTION_KEY` musi trafić do Coolify **przed** wdrożeniem tej
  zmiany na dev — bez niej trasa oddaje `503` przy każdym wniosku z PESEL-em
- Gałąź: `dev`
