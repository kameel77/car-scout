# Brief dla agenta — portal pracowniczy: pakiet przed pilotażem

Data: 2026-09-17 · Repo: `car-scout` · Gałąź robocza: `dev` · Zatwierdza: Kamil

Skopiuj wszystko poniżej linii jako zadanie dla agenta. Zakresy wykonuj **w podanej kolejności**,
każdy jako osobny commit (bez push i bez deployu — to osobna dyspozycja).

---

## Cel

Domknąć to, bez czego pilotaż z pierwszą firmą partnerską jest ryzykowny: pracownik, który zapomni
hasła, musi odzyskać konto sam; operator musi móc odciąć dostęp osobie, która odeszła z firmy;
opiekun w Motolii musi się dowiedzieć o zgłoszeniu w ciągu minut, a nie przy przeglądaniu CRM.
Portal musi też być chroniony przez CI, zanim zaczniemy go zmieniać.

Miara sukcesu: na `pracownicy-dev.motolia.pl` da się przejść pełną ścieżkę
rejestracja → zapomniane hasło → mail → nowe hasło → stara sesja na drugim urządzeniu wylogowana →
zgłoszenie → mail do opiekuna i potwierdzenie do pracownika → operator cofa dostęp → pracownik
dostaje 403 przy następnym żądaniu. Wszystko zielone w CI.

## Decyzje podjęte — nie renegocjuj

1. **Unieważnianie sesji przez znacznik czasu na koncie, nie przez przeszukiwanie Redis.**
   Klucze sesji to `ep:session:${jti}` bez indeksu per konto — nie da się ich tanio usunąć dla
   jednego pracownika. Middleware `verifyEmployeeAuth` **i tak** czyta `EmployeeAccount` z bazy przy
   każdym żądaniu (krok 6), więc dodajemy pole `sessionsValidAfter DateTime?` i odrzucamy token,
   którego `iat` jest wcześniejszy. Zero dodatkowych zapytań, działa też dla cofnięcia dostępu.
   Nie dodawaj `SCAN`, zbiorów sesji per konto ani nowych kluczy Redis.
2. **Token resetu w osobnej tabeli** `EmployeePasswordResetToken` (nie kolumny na koncie jak w
   adminowym `routes/auth.ts`) — potrzebujemy wielu wystawień, jednokrotnego zużycia i audytu.
   W bazie wyłącznie SHA-256 tokenu.
3. **Link resetu budowany z `EMPLOYEE_PORTAL_URL`** (nowa zmienna backendu), nigdy z nagłówka
   `Host` ani z `FRONTEND_URL` (to adres Motolii, nie portalu). Brak zmiennej = endpoint loguje
   ostrzeżenie i nie wysyła maila, ale odpowiedź do klienta pozostaje identyczna.
4. **Mail po transakcji, nigdy w niej.** Awaria SMTP nie może cofnąć zgłoszenia ani zmiany hasła.
   Wysyłka fire-and-forget z logiem błędu (wzorzec `sendLeadEmail` w `services/email.ts`).
5. Stos i proces bez zmian: Prisma + `prisma db push` (NIE `migrate`), Fastify, Zod, Vitest,
   React w `apps/employee-portal`. Żadnych nowych zależności npm bez pytania.
6. **Poza zakresem** tego briefu: tryb podglądu organizacji (masquerade), nadpisania produktów
   (E2), optymalizacja stawek najmu w SQL/Redis, wdrożenie produkcyjne. Nie zaczynaj ich.

## Stan obecny — zweryfikowany w kodzie

| Element | Miejsce | Uwagi |
|---|---|---|
| Trasy auth pracownika | `backend/src/modules/employee-program/auth/employee-auth.routes.ts` | `csrf`, `validate-code`, `register`, `login`, `me`, `logout`. Rate limit per trasa przez `config.rateLimit` |
| Walidacja hasła | `auth/employee-auth.service.ts:22` `passwordSchema` | min 8 znaków, max 72 bajty (bcrypt). **Użyj tego samego schematu** |
| Sesja | `auth/employee-session.helpers.ts`, `auth/employee-auth.middleware.ts` | JWT w `__Host-ep-session` + allowlista Redis `ep:session:${jti}`; krok 6 middleware czyta konto i członkostwo z bazy |
| CSRF | `verifyEmployeeCsrf` | Wymagany dla każdego POST, także niezalogowanego (tak jak `login`) |
| Mail resetu (admin) | `backend/src/services/email.ts:292` `sendPasswordResetEmail` | Szablon „ważny 1 godzinę” — dla pracownika potrzebna osobna funkcja z TTL 30 min i marką portalu |
| Wzorzec resetu (admin) | `backend/src/routes/auth.ts:287-370` | Punkt odniesienia dla stałej odpowiedzi; **nie kopiuj** `FRONTEND_URL` |
| Zgłoszenia | `inquiries/employee-inquiries.routes.ts:128` | Transakcja tworzy `EmployeeInquiry` + `Lead` z numerem `PP-…` i `calculationSnapshot`. **Dziś nie wysyła żadnego maila** |
| Admin programów | `admin/employee-admin.routes.ts`, `src/pages/admin/EmployeeProgramsPage.tsx`, `src/services/employee-admin.service.ts` | Firmy, programy, kody, benefity, oferty, matryce. **Brak listy kont i cofania członkostwa** |
| Model członkostwa | `prisma/schema.prisma` `EmployeeMembership` (`isActive`, `revokedAt`), `EmployeeMembershipAudit` (`action`: CREATED/ROTATED/REVOKED/REINSTATED) | Pola są, endpointów nie ma |
| Trasy portalu | `apps/employee-portal/src/App.tsx` | `/logowanie`, `/rejestracja`, `/katalog`, `/najem`, `/zapytania` |
| Testy integracyjne | `backend/src/modules/employee-program/**/__tests__` | Wymagają `EMPLOYEE_INTEGRATION_RUNNER_MARKER` i izolowanej bazy — patrz `auth/__tests__/employee-test-helper.ts` |
| CI | `.github/workflows/ci.yml` | Joby `frontend`, `backend` (tylko `tsc`), `gitleaks`. **Portal nie jest sprawdzany** |

Uwaga: weryfikacja statusu `PUBLISHED` matryc najmu jest **już zrobiona**
(`rental/employee-rental-catalog.routes.ts:120,309`, `rental/employee-rental-pricing.utils.ts:130`,
`inquiries/employee-inquiries.routes.ts:206`). Nie przepisuj tego — w Zakresie 2 dodaj tylko test
regresyjny.

---

## Zakres 1 — CI dla portalu (najpierw, najmniejszy)

Dopisz job `employee-portal` w `.github/workflows/ci.yml`, wzorowany na jobie `frontend`:
`working-directory: apps/employee-portal`, `cache-dependency-path: apps/employee-portal/package-lock.json`,
kroki `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`.

Jeśli `lint` lub testy są dziś czerwone — napraw przyczynę w kodzie portalu, nie wyłączaj kroku.
Jeśli naprawa wykracza poza oczywiste poprawki, zatrzymaj się i zgłoś listę błędów.

**Brama:** wszystkie pięć komend przechodzi lokalnie z czystego `npm ci`.

## Zakres 2 — odzyskiwanie hasła

### Backend

1. **Schemat** (`prisma db push` na lokalnej/testowej bazie):
   - `EmployeeAccount.sessionsValidAfter DateTime? @map("sessions_valid_after")`
   - model `EmployeePasswordResetToken`: `id`, `accountId` (FK, `onDelete: Cascade`),
     `tokenHash String @unique`, `expiresAt`, `usedAt DateTime?`, `requestedIp String?`, `createdAt`;
     indeks `[accountId, createdAt]`; `@@map("employee_password_reset_tokens")`.
2. **Middleware** `verifyEmployeeAuth`, krok 6: po znalezieniu konta — jeśli
   `account.sessionsValidAfter` istnieje i `payload.iat * 1000 < sessionsValidAfter.getTime()`
   → 401 „Sesja wygasła lub została unieważniona”. Uwaga na równość w tej samej sekundzie:
   przy ustawianiu znacznika zaokrąglij go **w dół do pełnej sekundy**, żeby sesja utworzona
   zaraz po resecie nie była odrzucana.
3. `POST /api/employee/auth/forgot-password` — `preHandler: [verifyEmployeeCsrf]`,
   `rateLimit: { max: 5, timeWindow: '15 minutes' }` per IP.
   - Body: `{ email }` (Zod, trim, lowercase).
   - **Zawsze** `200 { message: 'Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.' }` —
     także dla konta nieaktywnego, bez członkostwa, przy przekroczonym limicie per konto i przy
     braku `EMPLOYEE_PORTAL_URL`. Czas odpowiedzi nie może zdradzać istnienia konta: wysyłkę
     maila odpal bez `await` na wyniku SMTP.
   - Limit per konto: maks. 3 tokeny w ciągu godziny (licz w tabeli). Nowy token **nie**
     unieważnia poprzednich — każdy wygasa sam.
   - Token: `crypto.randomBytes(32).toString('base64url')`, w bazie SHA-256, TTL 30 min.
   - Link: `${EMPLOYEE_PORTAL_URL}/reset-hasla?token=…`.
4. `POST /api/employee/auth/reset-password` — `preHandler: [verifyEmployeeCsrf]`,
   `rateLimit: { max: 10, timeWindow: '15 minutes' }`.
   - Body: `{ token, password }`, hasło przez `passwordSchema`.
   - **Atomowo** w jednej transakcji: `updateMany` tokenu `where { tokenHash, usedAt: null, expiresAt > now }`
     ustawiające `usedAt` — jeśli `count !== 1` → 400 „Link wygasł lub został już użyty”;
     potem hash hasła, `sessionsValidAfter = now` (zaokrąglone w dół), oznaczenie **wszystkich**
     pozostałych niezużytych tokenów konta jako zużyte.
   - Konto nieaktywne → ta sama odpowiedź 400 co nieważny token.
   - Po sukcesie: wyczyść ciasteczka sesji w odpowiedzi, **nie** loguj automatycznie. 200.
5. `services/email.ts`: nowa funkcja `sendEmployeePasswordResetEmail(fastify, email, link, brandName)`.
   Nazwa marki z env `PORTAL_BRAND_NAME` na backendzie lub stała „Program Samochodowy by Motolia”.
   Treść po polsku, informacja o 30 minutach i o tym, że wszystkie urządzenia zostaną wylogowane.
6. Nigdy nie loguj tokenu, linku ani adresu e-mail w logach (`fastify.log`).

### Portal

- `/zapomnialem-hasla` — formularz e-mail, po wysłaniu zawsze ten sam komunikat sukcesu.
- `/reset-hasla?token=…` — dwa pola hasła, walidacja długości zgodna z backendem, po sukcesie
  przekierowanie na `/logowanie` z komunikatem. Brak tokenu w URL → komunikat i link do
  `/zapomnialem-hasla`.
- Link „Nie pamiętasz hasła?” na `LoginPage`.
- Wzorzec wywołań i CSRF jak w `features/auth/auth-api.ts`; styl jak `LoginPage`.

### Testy (bramka)

Backend (runner integracyjny):
- odpowiedź i status identyczne dla: istniejącego konta, nieistniejącego, nieaktywnego;
- token jednorazowy: drugie użycie → 400; wygasły → 400;
- dwa równoległe `reset-password` z tym samym tokenem → dokładnie jeden sukces;
- po resecie: stara sesja → 401 na `/me`; nowe logowanie → 200 na `/me`;
- w bazie nie ma jawnego tokenu; limit 3/h per konto nie wysyła czwartego maila;
- `sendEmployeePasswordResetEmail` zamockowany (`vi.mock`) — **żadnych prawdziwych maili w testach**;
- regresja matryc: oferta najmu powiązana wyłącznie z wersją `DRAFT` nie pojawia się w
  `/api/employee/offers` i nie da się na nią złożyć zgłoszenia.

Portal: testy komponentów obu stron (sukces, błąd, brak tokenu).

## Zakres 3 — cofanie dostępu pracownika (operator)

Bez tego pilotaż nie ma procedury na odejście pracownika z firmy — dziś jedyną drogą jest ręczny SQL.

Backend (`admin/employee-admin.routes.ts`, `preHandler: adminAuth`):
- `GET /api/admin/employee-programs/companies/:companyId/accounts` — lista: e-mail, imię,
  nazwisko, program, `isActive` członkostwa, `revokedAt`, `lastLoginAt`, `createdAt`.
  Paginacja `?page&limit` (max 100), wyszukiwanie po e-mailu.
- `POST /api/admin/employee-programs/memberships/:membershipId/revoke` — body `{ reason }`
  (wymagany, 3–500 znaków). W transakcji: `isActive=false`, `revokedAt=now`, wpis
  `EmployeeMembershipAudit` `REVOKED` z powodem, `sessionsValidAfter=now` na koncie. Idempotentne.
- `POST /api/admin/employee-programs/memberships/:membershipId/reinstate` — odwrotność,
  audyt `REINSTATED`. Nie zmienia `sessionsValidAfter`.

Panel: zakładka/sekcja „Pracownicy” w widoku firmy w `EmployeeProgramsPage` — tabela, wyszukiwarka,
przycisk „Cofnij dostęp” z modalem wymagającym powodu, „Przywróć”. Serwis w
`src/services/employee-admin.service.ts`.

**Bramka:** test integracyjny — pracownik zalogowany, operator cofa dostęp, następne żądanie
pracownika → 403; przywrócenie + nowe logowanie → 200; dwa wpisy audytu.

## Zakres 4 — powiadomienia o zgłoszeniach

1. Schemat: `EmployeeCompany.accountManagerEmail String? @map("account_manager_email")`
   + edycja w panelu (istniejący `PATCH /companies/:companyId`).
2. Po **zatwierdzonej** transakcji w `POST /api/employee/inquiries` (i tylko przy nowym
   zgłoszeniu — nie przy odpowiedzi idempotentnej ani przy wyścigu `raceInquiry`):
   - mail do opiekuna: `accountManagerEmail` firmy, a gdy puste — ten sam odbiorca co w
     `sendLeadEmail` (`AppSettings.leadRecipientUserId` → e-mail użytkownika, w przeciwnym razie
     `smtpRecipientEmail`). Wydziel ustalanie odbiorcy do wspólnej funkcji, nie kopiuj. Treść: numer `PP-…`, firma, program, pojazd,
     cena/rata i parametry ze snapshotu, benefit, strona umowy, dane kontaktowe, uwagi.
   - potwierdzenie do pracownika na `contactEmail`: numer `PP-…`, pojazd, kwota, informacja,
     że opiekun się odezwie. **Bez** NIP-u, uwag i danych wewnętrznych (fee, dostawca najmu —
     obowiązuje anonimizacja dostawcy).
3. Dwie nowe funkcje w `services/email.ts`, wszystkie wartości escapowane w HTML.

**Bramka:** test — nowe zgłoszenie wywołuje oba maile raz; powtórzone żądanie z tym samym
kluczem idempotencji nie wywołuje ich ponownie; awaria mocka SMTP nie zmienia statusu 201
ani nie usuwa rekordu; treść maila do pracownika nie zawiera nazwy dostawcy najmu.

---

## Kryteria odbioru całości

- [ ] `apps/employee-portal`: `npm ci && npm run typecheck && npm run lint && npm test && npm run build` zielone
- [ ] `backend`: `npx tsc --noEmit` zielone, testy integracyjne employee-program zielone
- [ ] Zmiany schematu wyłącznie addytywne (nowe nullable pola, nowa tabela) — bezpieczne dla `db push`
- [ ] Nowe zmienne env wypisane w `apps/employee-portal/DEPLOYMENT.md` (sekcja backendu):
      `EMPLOYEE_PORTAL_URL`, opcjonalnie `PORTAL_BRAND_NAME`
- [ ] Wpis w `features_desc.md` (kolejna sekcja) opisujący zakresy 1–4
- [ ] Brak jawnych tokenów, linków resetu i e-maili w logach
- [ ] Osobny commit per zakres, bez push

## Raport końcowy

Zwróć: listę commitów, diff schematu Prisma, listę nowych endpointów z kodami odpowiedzi,
wynik wszystkich komend z bram, oraz **każde odstępstwo od briefu z uzasadnieniem**.
Diff przekaż do audytu (`run_architect.py review`) przed zgłoszeniem gotowości.
