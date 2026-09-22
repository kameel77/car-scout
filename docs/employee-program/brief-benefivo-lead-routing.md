# Brief dla agenta - wyodrebnienie leadow Benefivo w backoffice i routing do kolejki Thulium

Data: 2026-09-21 - Repo: `car-scout` - Galaz robocza: `dev` - Zatwierdza: Kamil

Zakresy wykonuj w podanej kolejnosci, kazdy jako osobny commit. Bez push i bez deployu - to osobna dyspozycja.

---

## Cel

Zapytanie z `benefivo.pl/dla-firm` ma byc rozpoznawalne jako zgloszenie B2B programu pracowniczego
w trzech miejscach: na liscie leadow w panelu Motolii, w Inboxie doradcy w Pipeline CRM oraz w Thulium,
gdzie ma trafiac do osobnej kolejki obslugiwanej przez inny zespol niz leady retailowe.

Miara sukcesu: lead wyslany z `/dla-firm` na dev tworzy ticket w kolejce `Benefivo B2B` w Thulium,
w panelu `/admin/leads` ma widoczna plakietke marki i karte firmy z NIP-em, w Inboxie Pipeline da sie
go odfiltrowac od leadow retailowych, a konsultant odbierajacy telefon od tej osoby widzi w karcie
klienta marke Benefivo i nazwe firmy.

## Decyzje podjete - nie renegocjuj

1. **Dane firmowe ida do `Lead.metadata Json?`, nie do parsowania z `message`.** Dzis formularz sklei
   `Firma: X (NIP: Y)` w tekst, a trzy miejsca (lista, modal, lookup Thulium) potrzebuja tych samych
   wartosci. Trzy parsery tego samego tekstu to blad - jedno pole JSON rozwiazuje wszystkie trzy.
   Pole nullable, `prisma db push`, zero migracji per atrybut. Dedykowane kolumny to osobna decyzja na pozniej.
2. **`message` zostaje bez zmian** (czytelny opis dla czlowieka i dla maila). `metadata` jest dodatkiem,
   nie zamiennikiem - stare leady nie maja tego pola i wszystko ma dzialac przy `metadata === null`.
3. **Routing w Thulium opiera sie na dedykowanym adresie odbiorcy, nie na tresci maila.** W Thulium konto
   pocztowe jest przypisane do kolejki - to mapowanie natywne i niezalezne od tresci. Prefiks `[Benefivo]`
   w temacie jest zapasem, nagłowki MIME sa dodatkiem bez gwarancji.
4. **Nie budujemy wychodzacego klienta API Thulium.** Integracja pozostaje: mail wychodzacy + webhook
   przychodzacy + lookup po telefonie. Przy obecnym wolumenie leadow B2B to wystarcza.
5. Stos i proces bez zmian: Prisma + `prisma db push` (NIE `migrate`), Fastify, Zod, Vitest, React.
   Zadnych nowych zaleznosci npm bez pytania.
6. **Poza zakresem**: dedykowane kolumny SQL dla danych firmowych, panel HR dla pracodawcy,
   automatyczne zakladanie ticketow przez API Thulium, zmiany w module employee-program.

## Stan obecny - zweryfikowany w kodzie

| Element | Miejsce | Uwagi |
|---|---|---|
| Formularz B2B | `apps/employee-portal/src/features/landing/pages/EmployerB2bPage.tsx:66-85` | Wszystko sklejane w `message`; `name` ustawiane jako `"Firma - Osoba"` |
| Tworzenie leada | `backend/src/routes/leads.ts:133` | `leadType: 'employer_b2b'`, `trafficSource: 'benefivo_b2b'`; Turnstile wymagany |
| Numer referencyjny | `backend/src/utils/reference-generator.ts` | `generateReference(prefix = 'AF')` - przyjmuje prefiks, dzis nikt go nie podaje |
| Mail o leadzie | `backend/src/services/email.ts` `sendLeadEmail` | Ma juz `isEmployerB2B`, marke Benefivo i link do CRM; odbiorce ustala `resolveLeadRecipient` |
| Lista leadow (API) | `backend/src/routes/leads.ts:509` | Obsluguje `?leadType=`; zwraca **surowe obiekty Prisma w camelCase** |
| Lista leadow (UI) | `src/components/admin/LeadList.tsx:126-165` | Ma wlasny mapper camelCase -> snake_case. **Nowe pola trzeba dodac TAM**, samo rozszerzenie interfejsu `Lead` w `src/data/mockData.ts:104` da `undefined` |
| Inbox doradcy | `backend/src/modules/pipeline/services/inbox.service.ts:42` | `where` filtruje tylko po braku sprawy i dacie - **bez rozroznienia `leadType`** |
| Kanal zrodla w Pipeline | `prisma/schema.prisma` `enum LeadSourceChannel` | Jest wartosc `PARTNER` - uzyj jej, nie dodawaj nowej |
| Lookup dla Thulium | `backend/src/modules/pipeline/services/thulium-crm-lookup.service.ts` | Zwraca `custom_fields: Record<string,string>` - miejsce na kontekst Benefivo |
| Webhook Thulium | `backend/src/modules/pipeline/services/thulium-webhook.service.ts` | Ruch **przychodzacy**. Wychodzacego klienta API Thulium w repo NIE MA |

---

## Zakres 1 - ustrukturyzowane dane firmowe (fundament pozostalych zakresow)

### Backend
1. Schemat: `Lead.metadata Json? @map("metadata")`. Bez innych zmian w modelu.
2. `POST /api/leads`: rozszerz walidacje o opcjonalne `metadata` - Zod, ograniczone do znanych kluczy:
   `companyName` (string, max 200), `companyNip` (string, max 15, tylko cyfry i myslniki),
   `teamSize` (string, max 60), `benefitModel` (string, max 120). Nieznane klucze odrzucamy (`.strict()`).
   Zapis tylko gdy `leadType === 'employer_b2b'`; dla pozostalych typow `metadata` pozostaje `null`.
3. `GET /api/leads` zwraca `metadata` (wynika z surowego zwrotu Prisma - tylko potwierdz w tescie).

### Portal
- `EmployerB2bPage.tsx`: wysylaj `metadata` z tymi czterema polami **obok** dotychczasowego `message`
  (tresc `message` zostaje bez zmian).
- Popraw `name`: ma zawierac wylacznie osobe kontaktowa. Nazwa firmy jest juz w `metadata` i w `message`.

### Bramka
- Lead z pelnym formularzem ma `metadata` z czterema kluczami i `name` bez nazwy firmy.
- Lead retailowy (`sale`, `rental`, `quick_contact`) ma `metadata === null` - test regresyjny.
- Payload z nieznanym kluczem w `metadata` -> 400.

## Zakres 2 - routing do kolejki Thulium (mail)

1. **Dedykowany odbiorca**: nowa zmienna `BENEFIVO_LEAD_RECIPIENT_EMAIL` na backendzie. Gdy ustawiona
   i `leadType === 'employer_b2b'` - mail leci na ten adres zamiast na wynik `resolveLeadRecipient`.
   Gdy pusta - zachowanie dokladnie jak dzis (log na poziomie `info`, bez ostrzezen).
   Wydziel ustalanie odbiorcy do jednej funkcji, nie duplikuj warunku w kilku miejscach.
2. **Prefiks tematu**: temat maila B2B zaczyna sie od `[Benefivo]`. Nie zmieniaj tematow pozostalych typow.
3. **Naglowki MIME** (dodatek, nie mechanizm routingu):
   `X-Lead-Brand: Benefivo`, `X-Lead-Type: employer_b2b`, `X-Lead-Traffic-Source: benefivo_b2b`.
   Nie deklaruj w dokumentacji, ze Thulium kieruje po naglowkach - to niepotwierdzone.
4. **Numer referencyjny**: dla `employer_b2b` wywolaj `generateReference('BNF')`. Funkcja juz przyjmuje
   prefiks. Nie zmieniaj prefiksu pozostalych typow leadow.
5. `apps/employee-portal/DEPLOYMENT.md` i dokumentacja ENV: dopisz `BENEFIVO_LEAD_RECIPIENT_EMAIL`.

### Bramka
- Lead B2B: odbiorca = wartosc ENV, temat zaczyna sie od `[Benefivo]`, numer zaczyna sie od `BNF-`,
  naglowki obecne w wywolaniu transportu (mock nodemailera - zadnych prawdziwych maili w testach).
- Brak ENV -> odbiorca identyczny jak przed zmiana.
- Lead retailowy: odbiorca, temat i prefiks `AF-` bez zmian - test regresyjny.

## Zakres 3 - wyodrebnienie w panelu leadow

1. **Mapper w `LeadList.tsx:126`**: dodaj `lead_type`, `traffic_source`, `reference_number`, `metadata`.
   Rownolegle rozszerz interfejs `Lead` w `src/data/mockData.ts`. Bez tego mappera pola beda `undefined`.
2. **Plakietka**: gdy `lead_type === 'employer_b2b'` - plakietka `Benefivo B2B` w kolorystyce marki
   (tlo `#0f2d1e`, tekst jasny). Bez emoji - reszta panelu ich nie uzywa.
3. **Kolumna pojazdu**: dla leada B2B zamiast `---` pokaz `Program pracowniczy (B2B)` i nazwe firmy
   z `metadata.companyName`.
4. **Modal szczegolow**: dla leada B2B zamiast sekcji oferty i dealera wyswietl karte firmy:
   nazwa, NIP (z kopiowaniem), osoba kontaktowa, wielkosc zespolu, model programu, zrodlo `benefivo.pl/dla-firm`,
   numer referencyjny, tresc zapytania. Wszystko z `metadata`, z sensownym zachowaniem gdy `metadata === null`
   (starsze leady) - wtedy pokaz sam `message`.
5. **Filtr zrodla**: pasek nad tabela przelaczajacy `leadType`. Filtrowanie **przez API**
   (`GET /api/leads?leadType=`), nie po stronie klienta - inaczej liczniki beda dotyczyc jednej strony wynikow.

### Bramka
- Lead B2B: plakietka, karta firmy z NIP-em, poprawny numer `BNF-`.
- Lead B2B sprzed wdrozenia (`metadata === null`): modal renderuje sie bez bledu.
- Lead retailowy i wynajmu: wyglad bez zmian - test regresyjny na istniejacych przypadkach.
- Filtr wysyla zapytanie do API z wlasciwym `leadType`.

## Zakres 4 - rozroznienie w Inboxie Pipeline CRM

1. `listInboxLeads` (`inbox.service.ts:34`): dodaj opcjonalny parametr `leadType` do `ListInboxParams`
   i przenies go do `where`. Domyslne zachowanie bez parametru pozostaje bez zmian.
2. Endpoint Inboxa (`routes/inbox.routes.ts`): przyjmij `?leadType=` z walidacja Zod.
3. Lista Inboxa zwraca `leadType` i `metadata`, zeby UI mogl oznaczyc pozycje.
4. Przy kwalifikacji leada `employer_b2b` domyslnym `leadSource` jest `PARTNER`
   (istniejaca wartosc `LeadSourceChannel`), `leadSourceDetail`: `benefivo_b2b`. Nie dodawaj nowej wartosci enuma.
5. UI Inboxa: plakietka `Benefivo B2B` spojna z zakresem 3 i filtr po tym typie.

### Bramka
- Inbox bez parametru zwraca wszystkie leady tak jak dzis.
- Inbox z `leadType=employer_b2b` zwraca wylacznie leady B2B.
- Kwalifikacja leada B2B tworzy sprawe z `leadSource = PARTNER` i `leadSourceDetail = 'benefivo_b2b'`.

## Zakres 5 - kontekst Benefivo w karcie klienta Thulium

W `thulium-crm-lookup.service.ts`: gdy dla wyszukiwanego numeru telefonu istnieje lead
`leadType === 'employer_b2b'` (najswiezszy), dopisz do `custom_fields`:
`Marka: Benefivo`, `Typ klienta: Pracodawca B2B (program pracowniczy)`, `Firma: <metadata.companyName>`,
`NIP: <metadata.companyNip>`, `Wielkosc zespolu: <metadata.teamSize>`.
Pomijaj klucze, dla ktorych brak wartosci - nie wstawiaj pustych stringow ani `null`.
Nie zmieniaj dotychczasowej logiki lookupu dla klientow retailowych.

### Bramka
- Numer z leadem B2B: `custom_fields` zawiera komplet dostepnych pol.
- Numer z leadem retailowym: odpowiedz identyczna jak przed zmiana - test regresyjny.
- Lead B2B bez `metadata`: brak wyjatku, zwracane tylko `Marka` i `Typ klienta`.

---

## Kryteria odbioru calosci

- [ ] `backend`: `npx tsc --noEmit` zielone, testy leadow, inboxu i lookupu Thulium zielone
- [ ] `apps/employee-portal` i katalog glowny: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` zielone
- [ ] Zmiana schematu wylacznie addytywna (`Lead.metadata Json?`) - bezpieczna dla `db push`
- [ ] Zachowanie leadow retailowych (mail, temat, prefiks, panel, Inbox, lookup) niezmienione - testy regresyjne
- [ ] `BENEFIVO_LEAD_RECIPIENT_EMAIL` opisana w `DEPLOYMENT.md`
- [ ] Wpis w `features_desc.md` (kolejna sekcja) i aktualizacja pozycji dlugu w `new_features.md`
- [ ] Osobny commit per zakres, bez push

## Brama manualna - obowiazkowa przed zgloszeniem gotowosci

Sam zielony zestaw testow nie jest odbiorem. Wymagane na dev:
1. Wyslanie prawdziwego zgloszenia z `/dla-firm` -> potwierdzenie, na jaki adres poszedl mail,
   jaki ma temat, numer referencyjny i naglowki.
2. Potwierdzenie w panelu Thulium, ze ticket wpadl do kolejki `Benefivo B2B`.
3. Otwarcie `/admin/leads`: plakietka, karta firmy, dzialajacy filtr; oraz sprawdzenie,
   ze lead retailowy wyglada tak jak wczesniej.
4. Otwarcie Inboxa Pipeline z filtrem i bez.

## Zasada dowodzenia

Kazde stwierdzenie o zachowaniu zewnetrznego systemu lub biblioteki (Thulium, nodemailer, Prisma)
popieraj cytatem z kodu repozytorium albo z dokumentacji zaleznosci. Zalozenie bez dowodu zglos jako
pytanie, nie jako fakt w raporcie.

## Raport koncowy

Lista commitow, diff schematu Prisma, lista zmienionych endpointow z kodami odpowiedzi, wynik kazdej
komendy z bram, wynik bramy manualnej oraz kazde odstepstwo od briefu z uzasadnieniem.

---

## Zadanie dla Kamila (konfiguracja Thulium - poza zakresem agenta)

1. Zaloz skrzynke `b2b@benefivo.pl` (albo `benefivo@motolia.pl`) i podepnij ja w Thulium jako konto
   pocztowe przypisane do nowej kolejki `Benefivo B2B`. To jest wlasciwy mechanizm routingu.
2. Przypisz do kolejki agentow obslugujacych klienta biznesowego, ustaw SLA i szablony odpowiedzi.
3. Dodaj regule zapasowa: `Temat zawiera [Benefivo]` -> `Kolejka: Benefivo B2B`, tag `Benefivo`.
4. Sprawdz w panelu, czy reguly wiadomosci potrafia dopasowywac naglowki MIME. Jesli tak - dodaj warunek
   na `X-Lead-Brand: Benefivo` jako trzecie zabezpieczenie. Jesli nie - naglowki zostaja bez roli routingowej.
5. Adres skrzynki wpisz do `BENEFIVO_LEAD_RECIPIENT_EMAIL` w Coolify (backend) i rozwaz podanie go
   jako kontaktu na `/dla-firm`, zeby zapytania wysylane recznie trafialy do tej samej kolejki.
