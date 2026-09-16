# Brief — Prywatny katalog ofert w portalu pracowniczym

**Dla:** Antigravity (wykonawca)
**Od:** Opus 5 (architektura, odbiór)
**Branch bazowy:** `dev`
**Data:** 2026-09-15
**Realizuje:** [`next-steps.md`](next-steps.md) §2 „Prywatny katalog i warunki programu" — w zawężonym zakresie (bez matryc najmu i kalkulacji rat, patrz §2 poniżej). Poprzedni etap `P3a` (sesje, rejestracja, separacja tożsamości) jest domknięty i odebrany.

---

## 1. Kontekst — co już działa, a co nie

Zweryfikowane na `dev` (nie zakładaj nic ponad to):

**Działa end-to-end:**
- Superadmin tworzy firmę partnerską, program, kody rejestracyjne i **oferty specjalne** w panelu `/admin/employee-programs`.
- Pracownik rejestruje się kodem na `pracownicy-dev.motolia.pl`, loguje się, sesja trzyma się poprawnie.
- Rekordy `EmployeeProgramOffer` powstają w bazie prawidłowo (zweryfikowane: Toyota Yaris i VW Tayron z rabatem 8% dla programu Finarena).

**Nie istnieje:**
- **Żaden endpoint zwracający oferty zalogowanemu pracownikowi.** Moduł `employee-program` wystawia dokładnie 6 tras i wszystkie dotyczą auth: `csrf`, `validate-code`, `register`, `login`, `me`, `logout`. `verifyEmployeeAuth` chroni dziś wyłącznie `/api/employee/auth/me`.
- **Katalog w portalu.** [`apps/employee-portal/src/features/catalog/CatalogPage.tsx`](../../apps/employee-portal/src/features/catalog/CatalogPage.tsx) (199 linii) nie zawiera ani jednego `fetch`. Sekcja „Katalog pojazdów w przygotowaniu" w linii 187 to zahardkodowany placeholder.

**Zadanie P3 = domknięcie pętli zapis → odczyt.** Dane już są; brakuje drogi, którą trafią do pracownika.

---

## 2. Zakres

### W zakresie
1. Backend: `GET /api/employee/offers` — lista ofert programu zalogowanego pracownika.
2. Backend: `GET /api/employee/offers/:offerId` — szczegóły pojedynczej oferty.
3. Portal: klient API + realny katalog zamiast placeholdera (lista + stan pusty + stan błędu).
4. Testy backendu (izolacja tenantów obowiązkowo) i portalu.

### Poza zakresem — nie rób tego w tym etapie
- Kalkulator raty i ograniczenia produktu wg ADR-05, proces zamówienia, formularz zapytania (`EmployeeInquiry` istnieje w schemacie — to kolejny etap, [`next-steps.md`](next-steps.md) §3).
- Odzyskiwanie hasła ([`next-steps.md`](next-steps.md) §1) — osobny zakres, wymagany przed pilotażem, ale nie tutaj.
- Oferty `sourceType = 'RENTAL'` — dziś nie ma ścieżki, która je tworzy (patrz §6, pułapka 2). Endpoint ma je obsłużyć **strukturalnie**, ale nie buduj pod nie UI ani matrycy.
- Zmiany w panelu admina.
- Refaktory rzeczy, których brief nie wymienia.

---

## 3. Backend — kontrakt

Plik: **nowy** `backend/src/modules/employee-program/catalog/employee-catalog.routes.ts`
Rejestracja: dopisz `await app.register(employeeCatalogRoutes)` w [`backend/src/modules/employee-program/index.ts`](../../backend/src/modules/employee-program/index.ts).

### 3.1 `GET /api/employee/offers`

```
preHandler: [verifyEmployeeAuth]
config.rateLimit: { max: 60, timeWindow: '1 minute' }
```

Query (walidacja zod, **bez wyjątków** — patrz pułapka 4):
| pole | typ | domyślnie | zakres |
|---|---|---|---|
| `limit` | int | 24 | 1–50 |
| `cursor` | string (cuid) | — | opcjonalny, paginacja keyset po `createdAt desc, id desc` |
| `search` | string | — | max 100 znaków, po `make`/`model`/`version` |

Odpowiedź `200`:
```jsonc
{
  "offers": [
    {
      "id": "clx...",
      "sourceType": "FINANCING",
      "vehicle": {
        "make": "Toyota", "model": "Yaris", "version": "Yaris Hybrid 1.5 Comfort",
        "productionYear": 2026, "fuelType": "HYBRID", "transmission": "AUTOMATIC",
        "bodyType": "HATCHBACK", "primaryImageUrl": "https://...", "imageUrls": ["..."]
      },
      "pricing": {
        "listPricePln": 71900,        // Listing.pricePln — cena katalogowa
        "employeePricePln": 66148,    // cena dla pracownika (§4)
        "savingsPln": 5752,           // listPrice - employeePrice, min. 0
        "discountPct": 8.0            // faktyczny rabat, zaokrąglony do 1 miejsca
      },
      "benefit": {                     // null gdy oferta nie ma pakietu
        "name": "Pakiet Powitalny Moya",
        "moyaCardAmount": 500,
        "fuelDiscount": "15 gr/l",
        "consultantCare": true,
        "termsText": "..."
      }
    }
  ],
  "nextCursor": "clx..." // null gdy koniec
}
```

**Filtrowanie — wszystkie warunki łącznie:**
- `programId` = **`request.employee.programId`** (z sesji, nigdy z query/body)
- `isActive: true` na ofercie
- dla `FINANCING`: `listing.isArchived = false` (nie pokazuj wycofanych aut)

`imageUrls` przytnij do maks. 5 pozycji — w [`backend/src/routes/listings.ts`](../../backend/src/routes/listings.ts) jest już taka optymalizacja (commit `c4bfa32`), zachowaj spójność.

### 3.2 `GET /api/employee/offers/:offerId`

Ten sam kształt obiektu oferty, bez opakowania w tablicę. **`404` gdy oferta nie należy do programu z sesji** — nigdy `403`, żeby nie potwierdzać istnienia cudzych ofert.

### 3.3 Obsługa błędów — wymagana

Moduł **nie ma** globalnego `setErrorHandler` (`app.ts` też nie). `ZodError` poleci dziś jako 500 z surową treścią. W nowym pliku zarejestruj `fastify.setErrorHandler` wzorowany na [`employee-auth.routes.ts`](../../backend/src/modules/employee-program/auth/employee-auth.routes.ts): `ZodError` → `400` z czytelnym komunikatem po polsku, `err.statusCode` → przekaż, reszta → `500` z generycznym tekstem i `log.error`. **Żaden komunikat Prisma/Zod nie może wyciec do klienta** — to endpoint publiczny dla pracownika, nie admin-only.

---

## 4. Konwencja ceny i rabatu — czytaj uważnie

`EmployeeProgramOffer` ma **dwa niezależne pola**: `customPricePln: Int?` i `discountPct: Decimal(5,2)?`. Panel admina pozwala ustawić jedno, drugie albo oba, i liczy je wzajemnie ([`SpecialOffersTab.tsx:86-110`](../../src/components/admin/employee-programs/SpecialOffersTab.tsx)). Backend musi mieć **jedną, deterministyczną regułę** rozstrzygania:

```
1. customPricePln != null           → employeePrice = customPricePln
2. discountPct != null              → employeePrice = round(listPrice * (1 - discountPct/100))
3. program.defaultDiscountPct != null → employeePrice = round(listPrice * (1 - defaultDiscountPct/100))
4. w przeciwnym razie               → employeePrice = listPrice, discountPct = 0
```

`customPricePln` zawsze wygrywa — to cena wynegocjowana ręcznie. `discountPct` w odpowiedzi to **zawsze rabat faktyczny**, przeliczony z finalnej ceny (`(list - employee) / list * 100`), a nie surowa wartość z bazy — inaczej przy ustawionym `customPricePln` pokażesz pracownikowi rabat niezgodny z ceną.

Zabezpiecz: `employeePrice` nigdy > `listPrice` i nigdy < 0; `savingsPln` = `max(0, list - employee)`. `Decimal` z Prismy konwertuj przez `.toNumber()`, nie przez `Number(String(...))`.

---

## 5. Portal — frontend

### 5.1 Klient API
Nowy `apps/employee-portal/src/features/catalog/catalog-api.ts`. **Skopiuj konwencję z [`auth-api.ts`](../../apps/employee-portal/src/features/auth/auth-api.ts)**, nie wymyślaj własnej:
- funkcja przyjmuje `apiUrl: string` jako pierwszy argument (nie importuje configu),
- `credentials: 'same-origin'` — **obowiązkowo**, patrz pułapka 1,
- `normalizeBaseUrl` + `handleResponseJson` — wydziel do współdzielonego modułu albo powiel; nie zmieniaj istniejących sygnatur w `auth-api.ts`.

Metody `GET` nie wymagają tokenu CSRF (middleware zwalnia `GET`/`HEAD`/`OPTIONS`) — nie dokładaj go.

### 5.2 CatalogPage
Zachowaj istniejący header, sekcję benefitów programu i obsługę wylogowania — zmieniasz **wyłącznie** sekcję placeholdera (okolice linii 187). Nowa sekcja ma cztery stany:
- **loading** — skeleton kafli, nie spinner na całą stronę,
- **lista** — siatka kafli: zdjęcie, marka + model, wersja, cena katalogowa przekreślona, cena pracownicza wyróżniona, badge rabatu, plakietka pakietu benefitów gdy `benefit != null`,
- **pusto** — „Brak ofert przypisanych do Twojego programu" + informacja, żeby skontaktować się z doradcą; **nie** powtarzaj „w przygotowaniu",
- **błąd** — czytelny komunikat + przycisk ponowienia. Nie renderuj pustego stanu przy błędzie, to był konkretny zarzut z audytu panelu admina.

Formatowanie kwot: `toLocaleString('pl-PL')` + `" zł"`, spójnie z panelem admina.

Stan pobieraj przez `useEffect` + `useState` — **w portalu nie ma React Query** (sprawdź `package.json` przed dodaniem czegokolwiek; nie dodawaj nowej zależności bez uzgodnienia). Pamiętaj o anulowaniu żądania przy odmontowaniu (`AbortController`).

---

## 6. Pułapki tego repozytorium — realne, nie teoretyczne

1. **Ciasteczko sesji to `__Host-ep-session`, `SameSite=Lax`, host-only.** Portal działa tylko dlatego, że nginx proxuje `/api/` do backendu na tym samym hoście ([`apps/employee-portal/nginx.conf:79`](../../apps/employee-portal/nginx.conf)), a `apiUrl` to domyślnie `/api`. Jeżeli użyjesz absolutnego URL-a do API albo `credentials: 'include'` z innym originem, **ciasteczko nie poleci i dostaniesz 401 mimo poprawnego logowania**. Trzymaj się ścieżek względnych.

2. **Nie licz na CHECK constraint w bazie.** `check_offer_source_integrity` istnieje tylko w `prisma/migrations/.../migration.sql` i nie ma go w `schema.prisma`. Deploy tego projektu robi `prisma db push`, który plików migracji nie wykonuje — na środowiskach stawianych `db push`-em constraintu nie ma. Traktuj dane jako potencjalnie niespójne: oferta `FINANCING` może mieć `listingId = null`. **Pomiń takie rekordy w odpowiedzi zamiast rzucać wyjątkiem** i zaloguj `warn`.

3. **Deploy kontenerowy nie ma `src/` ani `tsx`.** Skrypty uruchamiasz lokalnie przez `npx tsx src/scripts/x.ts`, w kontenerze przez `node dist/scripts/x.js`.

4. **Nie omijaj zod przy parsowaniu query.** W panelu admina jest już przypadek `parseInt` bez walidacji, który daje `take: NaN` i 500 z Prismy ([`employee-admin.routes.ts:581`](../../backend/src/modules/employee-program/admin/employee-admin.routes.ts)). Nie powielaj tego wzorca.

5. **`apps/employee-portal` jest poza CI.** `.github/workflows/ci.yml` nie zna tej aplikacji, a backend job robi tylko `tsc --noEmit` bez `npm test`. **Nic nie złapie Twojej regresji automatycznie** — uruchom bramki lokalnie sam (§7).

6. **Pełna suita backendu jest dziś czerwona** (2 faile w `modules/pipeline`: `inbox.test.ts:55`, `opportunity-lifecycle.test.ts:323`). To zanieczyszczenie współdzielonej bazy dev, **nie Twoja sprawa** — nie naprawiaj tego przy okazji, ale też nie raportuj jako „testy przechodzą".

---

## 7. Testy i bramki — warunek odbioru

### Testy backendu (`vitest.employee.config.ts`)
Obowiązkowo, w kolejności ważności:
1. **Izolacja tenantów** — pracownik firmy A odpytujący `/api/employee/offers` **nie widzi ani jednej oferty programu B**. To jest test krytyczny; bez niego nie odbieram zadania.
2. `GET /offers/:id` na ofertę cudzego programu → `404` (nie 403).
3. Brak ciasteczka sesji → `401`.
4. Rozstrzyganie ceny: cztery przypadki z §4 (sam `customPricePln`, sam `discountPct`, oba naraz, żadnego + `defaultDiscountPct` z programu).
5. Oferta z `isActive: false` i oferta wskazująca na `listing.isArchived = true` → nieobecne w odpowiedzi.
6. `limit=abc` → `400`, nie `500`.
7. Oferta `FINANCING` z `listingId = null` (patrz pułapka 2) → pominięta, endpoint zwraca `200`.
8. **Brak mutacji danych Motolii** — po serii odczytów katalogu rekordy `Listing` są nietknięte (`updatedAt` bez zmian). Endpoint jest wyłącznie odczytowy; cena pracownicza powstaje w odpowiedzi, **nigdy** przez zapis do `Listing.pricePln`. To wymóg z [`next-steps.md`](next-steps.md) §2.

### Testy portalu
Render katalogu z zamockowanym fetchem: lista, stan pusty, stan błędu. Wzoruj się na `RegisterCodePage.test.tsx`.

### Bramki lokalne — wszystkie muszą być zielone
```bash
cd backend && npx tsc --noEmit && npx vitest run --config vitest.employee.config.ts
cd apps/employee-portal && npx tsc --noEmit && npx eslint . && npx vitest run
```

Po zmianie kodu: `graphify update .`

---

## 8. Definition of done

- [ ] Pracownik Finareny po zalogowaniu na `pracownicy-dev.motolia.pl` widzi Toyotę Yaris i VW Tayron z ceną pracowniczą i rabatem 8%.
- [ ] Ceny w portalu zgadzają się co do złotówki z tym, co pokazuje panel admina (66 148 zł i 159 988 zł).
- [ ] Test izolacji tenantów przechodzi i faktycznie failuje, gdy tymczasowo podmienisz `programId` z sesji na wartość z query (sprawdź to — test, który nie umie zafailować, niczego nie dowodzi).
- [ ] Wszystkie bramki z §7 zielone.
- [ ] Commit **tylko** z plikami tego zakresu. Poprzedni commit programu pracowniczego (`eb2d455`) wciągnął przy okazji zmiany w `stock-sync-engine.service.ts` i `dealers-admin.ts`, przez co nie da się go czysto cofnąć — nie powtarzaj tego.

---

## 9. Czego nie ruszać

`employee-auth.middleware.ts`, `employee-auth.service.ts`, `employee-session.helpers.ts`, `platform-jwt.ts`. Warstwa auth przeszła audyt bez zastrzeżeń: izolacja realmów, Redis-allowlist fail-closed, re-weryfikacja w bazie przy każdym żądaniu, CSRF z porównaniem w stałym czasie. Potrzebujesz z niej dokładnie dwóch rzeczy — `verifyEmployeeAuth` jako `preHandler` i `request.employee.programId` w handlerze. Jeżeli wygląda na to, że trzeba tam coś zmienić, **zatrzymaj się i zapytaj** zamiast modyfikować.
