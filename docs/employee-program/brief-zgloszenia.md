# Brief — Zgłoszenia pracownika (zapytanie o ofertę)

**Dla:** Antigravity (wykonawca)
**Od:** Opus 5 (architektura, odbiór)
**Branch bazowy:** `dev`
**Data:** 2026-09-16
**Realizuje:** [`next-steps.md`](next-steps.md) §3 „Zgłoszenia i obsługa konsultanta"
**Poprzedni etap:** katalog ofert — zacommitowany (`0cdaa4e`), czeka na redeploy na dev.

---

## 1. Po co to

Po poprzednim etapie pracownik widzi dedykowane auta z ceną pracowniczą, ale **nie może nic z tym zrobić** — nie ma żadnej ścieżki kontaktu. Pilotaż z Finareną w tym stanie nie wygeneruje ani jednego zapytania. Ten etap dokłada przycisk „Zapytaj o tę ofertę" i całą obsługę zgłoszenia po stronie backendu.

Model `EmployeeInquiry` **już istnieje** w `schema.prisma` i jest dobrze zaprojektowany — masz `idempotencyKey` z unikalnością, `calculationSnapshot`/`benefitSnapshot` jako Json i opcjonalne `leadId` do CRM. Nie projektuj tego od nowa, użyj tego, co jest.

---

## 2. Zakres

### W zakresie
1. `POST /api/employee/inquiries` — złożenie zgłoszenia, idempotentne.
2. `GET /api/employee/inquiries` — historia zgłoszeń zalogowanego pracownika.
3. Powiązanie z istniejącym `Lead` (CRM), **bez** uruchamiania formalnego wniosku u finansującego.
4. Formularz w portalu przy karcie oferty + widok „Moje zapytania".
5. Testy integracyjne na realnej bazie.

### Poza zakresem
- Kalkulator raty i ograniczenia produktu wg ADR-05 — `calculationSnapshot` wypełniasz **tym, co dziś zwraca katalog** (cena katalogowa, pracownicza, oszczędność, rabat, benefit). Nie dobudowuj rat.
- **Powiadomienia e-mail — całkowicie poza zakresem** (poprawka wcześniejszego, błędnego odsyłacza do „§4 pkt 6"; taki punkt nie dotyczy maili). Ani do pracownika, ani do konsultanta. Konsultant widzi zgłoszenie w inboxie CRM i to wystarczy na tym etapie. Nie podpinaj `services/email.ts`.
- Panel obsługi zgłoszeń dla admina (kolejny etap).
- Oferty `RENTAL` — nadal brak ścieżki ich tworzenia.

---

## 3. Backend — kontrakt

Nowy katalog: `backend/src/modules/employee-program/inquiries/employee-inquiries.routes.ts`, rejestracja w `modules/employee-program/index.ts` obok katalogu.

### 3.1 `POST /api/employee/inquiries`

```
preHandler: [verifyEmployeeAuth, verifyEmployeeCsrf]
config.rateLimit: { max: 10, timeWindow: '1 minute' }
```

> **To pierwszy mutujący endpoint portalu.** W przeciwieństwie do katalogu (same `GET`) przechodzi przez `verifyEmployeeCsrf`, który wymaga nagłówka `x-csrf-token` zgodnego z ciasteczkiem **oraz** nagłówka `Origin`/`Referer` równego `https://<host>`. Klient w portalu musi najpierw pobrać token z `/api/employee/auth/csrf` — wzorzec jest już zaimplementowany w [`auth-api.ts`](../../apps/employee-portal/src/features/auth/auth-api.ts) w `loginEmployee`. Skopiuj go, nie wymyślaj.

Body (zod):
| pole | typ | wymagane | uwagi |
|---|---|---|---|
| `offerId` | cuid | tak | oferta z programu pracownika |
| `idempotencyKey` | uuid v4 | tak | generowany przez klienta przy otwarciu formularza |
| `contractParty` | enum `ContractPartyOption` | tak | `CONSUMER` \| `EMPLOYEE_B2B` \| `EMPLOYER_COMPANY` |
| `contactName` | string 1–150 | tak | prefill z sesji, edytowalne |
| `contactEmail` | email, max 254 | tak | prefill z sesji |
| `contactPhone` | string 1–30 | tak | |
| `nip` | string 10–15 | tylko dla `EMPLOYEE_B2B` / `EMPLOYER_COMPANY` | walidacja warunkowa przez `superRefine` |
| `notes` | string max 2000 | nie | |
| `consentPrivacy` | boolean | tak | musi być `true`, inaczej `400` — patrz niżej |

### 3.1a Zgoda na przetwarzanie danych — obowiązkowa

`Lead.consentPrivacyAt` to **dowód udzielonej zgody**, nie pole techniczne. W całym repozytorium jest ustawiane wyłącznie warunkowo — [`leads.ts:177`](../../backend/src/routes/leads.ts:177): `consentPrivacyAt: data.consentPrivacy ? new Date() : null`. Nigdzie nie jest wpisywane z automatu.

**Nie wolno ustawiać `consentPrivacyAt: new Date()` bezwarunkowo.** To zapis zgody, której użytkownik nie udzielił — problem prawny (RODO) i zafałszowanie danych, a przy okazji niespójność z resztą kodu. Rejestracja pracownika też nie zbiera dziś żadnej zgody, więc nie ma się na co powołać wstecz.

Zamiast tego: formularz zgłoszenia musi mieć **jawny, wymagany checkbox zgody** z odnośnikiem do polityki prywatności. Backend przyjmuje `consentPrivacy: true` i dopiero wtedy zapisuje `consentPrivacyAt: new Date()`. Wartość `false` lub brak pola → `400`. Zgody marketingowej nie zbieramy — `consentMarketingAt` zostaje `null`.

**Tożsamość zawsze z sesji.** `accountId`, `companyId`, `programId` biorą się wyłącznie z `request.employee` — nigdy z body. Jeśli body zawiera którekolwiek z tych pól, zignoruj je (zod `.strip()`), nie zwracaj błędu.

Odpowiedź `201`:
```jsonc
{
  "inquiry": {
    "id": "clx...",
    "status": "NEW",
    "referenceNumber": "AF-12345678",   // z powiązanego Lead, do podania konsultantowi
    "createdAt": "2026-09-16T...",
    "vehicle": { "make": "Toyota", "model": "Yaris", "version": "..." },
    "pricing": { "listPricePln": 71900, "employeePricePln": 66148, "savingsPln": 5752, "discountPct": 8 }
  }
}
```

### 3.2 Idempotencja — najważniejsza część

`EmployeeInquiry.idempotencyKey` ma `@unique` **globalnie**, nie w obrębie konta. Konsekwencje, które musisz obsłużyć:

1. Powtórzone żądanie z tym samym `idempotencyKey` **tego samego pracownika** → zwróć istniejące zgłoszenie ze statusem **`200`** (nie `201`, nie `409`). Nie twórz drugiego `Lead`.
2. Ten sam `idempotencyKey` użyty przez **innego pracownika** → `409`. To nie jest normalny scenariusz, ale klucz jest globalny, więc kolizja jest możliwa i nie wolno ujawnić cudzego zgłoszenia.
3. Wyścig dwóch równoległych żądań z tym samym kluczem → złap `P2002` i zwróć istniejące zgłoszenie zamiast 500. Wzorzec obsługi `P2002` jest w [`employee-auth.service.ts`](../../backend/src/modules/employee-program/auth/employee-auth.service.ts) przy rejestracji — zastosuj ten sam.

Utworzenie `EmployeeInquiry` **i** `Lead` musi być w jednej `prisma.$transaction`. Inaczej po częściowej awarii zostanie zgłoszenie bez leada albo lead-sierota.

### 3.3 Snapshot — liczony po stronie serwera, nigdy z klienta

`calculationSnapshot` wypełniasz **wyłącznie** wartościami przeliczonymi na serwerze z aktualnego stanu oferty, tą samą funkcją `calculateOfferPricing` co katalog (wydziel ją do wspólnego modułu, jeśli trzeba — ale **nie zmieniaj jej zachowania**). Klient nie przysyła żadnej ceny. Gdyby przysyłał, pracownik mógłby złożyć zgłoszenie na wymyśloną kwotę, a snapshot ma być dowodem, co mu pokazano.

Snapshot jest **niezmienny**. Po zapisie żadna późniejsza zmiana rabatu, ceny czy matrycy nie może go ruszyć. To jest wprost brama testowa z `next-steps.md` §3.

`benefitSnapshot` analogicznie — kopia pakietu benefitów w momencie zgłoszenia (`name`, `moyaCardAmount`, `fuelDiscount`, `consultantCare`, `termsText`), albo `null`.

### 3.4 Ponowna weryfikacja przed przyjęciem

Przed zapisem sprawdź ponownie, w transakcji, że:
- oferta istnieje, `isActive: true` i należy do `programId` z sesji → inaczej **`404`**,
- dla `FINANCING`: `listing` istnieje i nie jest zarchiwizowany → inaczej `409` z komunikatem „Ta oferta nie jest już dostępna",
- wybrany `contractParty` jest dozwolony dla programu → inaczej `400`. Sprawdzasz `EmployeeProductOverride.allowedContractParties`, ale **uwaga na semantykę**: nadpisań jest wiele, po jednym na produkt finansowy, i każde ma własną listę dozwolonych stron umowy. Obowiązuje **suma (ANY)**: strona umowy jest dozwolona, jeśli pozwala na nią **co najmniej jedno** nadpisanie z `isEnabled: true`. Uzasadnienie: wystarczy jeden produkt, którym da się sfinansować auto w tej formie. Gdy program nie ma żadnych nadpisań, dopuść wszystkie trzy wartości. Nie implementuj tego jako część wspólną (ALL) — przy kilku produktach odcięłoby to prawie wszystko.

`productAvailabilityStatus` ustaw na `REQUIRES_CONFIRMATION` (wartość domyślna modelu). Nie udawaj, że dostępność jest potwierdzona.

### 3.5 Powiązanie z Lead

Utwórz `Lead` w tej samej transakcji i podepnij przez `EmployeeInquiry.leadId`. Wymagane pola `Lead`: `name`, `message`, `referenceNumber` (unikalny).

**Generator `referenceNumber` już istnieje** — [`leads.ts:119`](../../backend/src/routes/leads.ts:119) `generateReference()`. Wydziel go do modułu współdzielonego i użyj w obu miejscach; **nie kopiuj implementacji**, bo dwa niezależne generatory to przyszłe kolizje na unikalnym indeksie.

**Ale zwróć uwagę, co on robi**: `AF-${Date.now().toString().slice(-8)}` — osiem ostatnich cyfr znacznika czasu w milisekundach. Dwa leady utworzone w tej samej milisekundzie dostają **identyczny** numer, a `referenceNumber` ma `@unique`. Jeśli planujesz ponowienie po `P2002` na tym polu, samo wywołanie generatora jeszcze raz w tej samej milisekundzie zwróci **tę samą wartość** i wszystkie próby spalą się tak samo. Ponowienie musi wprowadzać zmienność — losowy sufiks albo odczekanie do następnej milisekundy. Nie „naprawiaj" przy okazji generatora dla całego serwisu; ogranicz się do bezpiecznego ponowienia w swojej ścieżce i zgłoś słabość jako osobną pozycję w `new_features.md`.

Ustaw `leadType: 'employee'`, żeby odróżnić zgłoszenia pracownicze od zwykłych. Uwaga: w [`leads.ts:124`](../../backend/src/routes/leads.ts:124) jest whitelist `ALLOWED_LEAD_TYPES` (`sale`, `price_negotiation`, `rental`, `waitlist`, …) i wartość spoza niej jest **po cichu zamieniana na `'sale'`**. Tworząc leada bezpośrednio przez Prismę ominiesz tę walidację, ale zostawisz niespójność. Dopisz `'employee'` do zbioru — to jedna linia i jedyna dopuszczalna zmiana poza modułem pracowniczym w tym etapie.

Sprawdź też, czy nowa wartość nie zawęża widoku w inboxie CRM (`modules/pipeline`) — jeśli inbox filtruje po `leadType`, zgłoszenia pracownicze mogą być niewidoczne dla konsultanta, co czyni całą funkcję bezużyteczną. **Jeśli tak jest, zatrzymaj się i zgłoś zamiast obchodzić filtr.**

**Nie uruchamiaj formalnego wniosku u finansującego.** Zgłoszenie kończy się leadem do kontaktu, nic więcej.

### 3.6 `GET /api/employee/inquiries`

`preHandler: [verifyEmployeeAuth]`, lista zgłoszeń **wyłącznie** dla `accountId` z sesji, sortowanie `createdAt desc`, ten sam wzorzec paginacji keyset co katalog. Zwracaj snapshot, nie aktualne ceny — pracownik ma widzieć, na co się zgłaszał.

### 3.7 Obsługa błędów

Zarejestruj scoped `setErrorHandler` jak w katalogu: `ZodError` → `400`, `err.statusCode` → przekaż, reszta → `500` bez szczegółów Prisma.

---

## 4. Portal

1. Przycisk „Zapytaj o tę ofertę" na karcie w `CatalogPage`.
2. Formularz w modalu: `contractParty` (radio z czytelnymi opisami, nie surowe nazwy enuma), dane kontaktowe prefillowane z `useAuth().user`, warunkowy `nip`, `notes`.
3. `idempotencyKey` generowany **raz przy otwarciu formularza** (`crypto.randomUUID()`) i przechowywany w stanie — nie generuj go przy każdym submicie, bo zniweczysz idempotencję.
4. Blokada podwójnego submitu + stan błędu z możliwością ponowienia **tym samym kluczem**.
5. Ekran potwierdzenia z numerem referencyjnym.
6. Widok „Moje zapytania" — nowa trasa za `ProtectedRoute`, wzorzec z `App.tsx`.

Bez nowych bibliotek. `useState` + `AbortController`, jak w katalogu.

---

## 5. Pułapki

1. **CSRF na POST** — patrz §3.1. Najczęstszy błąd: wysłanie POST bez `x-csrf-token` i debugowanie 403 jako problemu z sesją.
2. **`idempotencyKey` jest unikalny globalnie, nie per konto** — obsłuż kolizję międzykontową jako `409`, patrz §3.2.
3. **Brak CHECK constraintu na środowiskach `db push`** — jak w poprzednim etapie, dane mogą być niespójne. Oferta `FINANCING` bez `listingId` musi dać `404`, nie 500.
4. **`apps/employee-portal` jest poza CI**, a backend job w CI nie uruchamia testów. Bramki odpalasz lokalnie sam.
5. **Pełna suita backendu ma 2 czerwone testy w `modules/pipeline`** (zanieczyszczona baza dev). Nie Twoja sprawa, nie naprawiaj, ale nie raportuj „wszystko zielone".
6. **Nie dodawaj nowych zmiennych środowiskowych.** Moduł pracowniczy używa dziś tylko `JWT_SECRET` i `REDIS_URL`, obu już udokumentowanych. Nowa zmienna oznacza zmianę w Coolify na trzech środowiskach — jeśli uznasz, że jest niezbędna, **zatrzymaj się i zapytaj**.

---

## 6. Testy — warunek odbioru

Test integracyjny na realnej bazie (`node scripts/test-employee-integration.mjs`), wzorem `employee-catalog.test.ts`:

1. **Idempotencja**: dwa żądania z tym samym kluczem → jedno zgłoszenie, **jeden** `Lead`, drugie żądanie `200`. To brama wprost z `next-steps.md` §3.
2. **Niezmienność snapshotu**: po zapisie zmień `discountPct` oferty, pobierz zgłoszenie → snapshot bez zmian.
3. **Izolacja tenantów**: zgłoszenie na `offerId` z obcego programu → `404`; `GET /inquiries` nie pokazuje cudzych zgłoszeń.
4. **Snapshot liczony serwerowo**: żądanie z podrzuconą ceną w body → zapisany snapshot ma wartość z bazy, nie z body.
5. **Brak CSRF** → `403`.
6. **Oferta nieaktywna / auto zarchiwizowane** w momencie zgłoszenia → `409`.
7. **`contractParty` niedozwolony dla programu** → `400`. Dołóż przypadek z **dwoma** nadpisaniami, gdzie tylko jedno dopuszcza daną stronę umowy — zgłoszenie ma przejść (semantyka ANY z §3.4).
8. **Transakcyjność**: wymuszony błąd przy tworzeniu `Lead` nie zostawia osieroconego `EmployeeInquiry`.
9. **Zgoda**: `consentPrivacy: false` lub brak pola → `400`, żaden `Lead` nie powstaje. Przy `true` → `Lead.consentPrivacyAt` niepuste, `consentMarketingAt` puste.

Testy jednostkowe (`*.isolated.test.ts`): walidacja zod, warunkowy `nip`, budowa snapshotu.

Bramki:
```bash
cd backend && npx tsc --noEmit && npx vitest run --config vitest.employee.config.ts
node backend/scripts/test-employee-integration.mjs
cd apps/employee-portal && npx tsc --noEmit && npx eslint . && npx vitest run
```
Po zmianach: `graphify update .`

---

## 7. Definition of done

- [ ] Pracownik Finareny wysyła zapytanie o Yarisa i dostaje numer referencyjny.
- [ ] Zgłoszenie widoczne jako `Lead` w CRM, bez uruchomionego wniosku u finansującego.
- [ ] Dwukrotne kliknięcie „Wyślij" tworzy **jedno** zgłoszenie i **jeden** lead.
- [ ] Wszystkie bramki z §6 zielone, w tym test na realnej bazie.
- [ ] Commit wyłącznie w zakresie tego etapu — bez zmian „przy okazji" w module katalogu, auth czy CRM.

---

## 8. Czego nie ruszać

Warstwa auth (`employee-auth.middleware.ts`, `.service.ts`, `employee-session.helpers.ts`, `platform-jwt.ts`) i moduł katalogu (`catalog/employee-catalog.routes.ts`) — poza wydzieleniem `calculateOfferPricing` do współdzielonego modułu **bez zmiany zachowania**. Funkcja jest pokryta testami rozstrzygania cen; po refaktorze muszą przechodzić bez modyfikacji asercji. Jeśli trzeba je zmienić, to znaczy, że zmieniłeś zachowanie — cofnij.
