# Strategia testowania i naprawy luk bezpieczeństwa — Car Scout

Data przeglądu: 2026-07-02
Autor przeglądu: analiza kodu backendu (Fastify + Prisma) i routingu API.

## Jak korzystać z tego dokumentu (instrukcja dla modelu wykonawczego)

Ten plik jest samowystarczalną listą zadań do wykonania przez **inny model** (np. Gemini Flash lub Opus 4.6).
Nie zakładaj wiedzy z wcześniejszej rozmowy — wszystko potrzebne jest tutaj.

Zasady wykonania (obowiązkowe):

1. Realizuj zadania w kolejności `FIX-1 → FIX-N`. Każde zadanie jest niezależne — po każdym rób osobny commit.
2. Dla każdego zadania stosuj pętlę TDD:
   - a) Napisz test odtwarzający lukę (test ma **failować** na obecnym kodzie).
   - b) Zastosuj poprawkę.
   - c) Uruchom test — ma **przechodzić**.
   - d) Uruchom cały zestaw testów backendu, żeby nie zepsuć regresji.
3. Komendy testów (z katalogu `backend/`):
   - Pojedynczy plik: `npm test -- src/routes/__tests__/<plik>.test.ts`
   - Całość: `npm test`
   - Testy używają Vitest. Wzorce znajdziesz w `backend/src/routes/__tests__/*.test.ts`.
4. **Nie zmieniaj zachowania niezwiązanego z zadaniem.** Zmiany chirurgiczne — dokładnie to, co opisano.
5. Schemat bazy: projekt używa `prisma db push` (NIE `migrate`). Jeśli zadanie wymaga zmiany `schema.prisma`,
   zaznacz to wyraźnie w commicie — deploy zastosuje `db push`.
6. Po skończeniu wszystkich FIX zaktualizuj sekcję "Status realizacji" na końcu pliku.
7. Jeśli którakolwiek poprawka okaże się niemożliwa lub ryzykowna — NIE zgaduj. Zostaw zadanie jako `BLOCKED`
   z jednozdaniowym uzasadnieniem i przejdź dalej.

Środowiska: dev / staging / main (Coolify). Testuj tylko lokalnie; nie deployuj.

---

## Podsumowanie stanu (co jest już naprawione — NIE ruszaj)

Poprzedni audyt (`security/report.md`, 2026-06-20) opisał szereg luk P1/P2. Weryfikacja na dzień 2026-07-02
pokazuje, że **następujące zostały już naprawione** i nie wymagają działań:

| Dawne ID | Opis | Dowód naprawy |
|----------|------|---------------|
| P1-1 | Token resetu hasła logowany/przechowywany jawnie | `auth.ts:278-291` — token losowy, w bazie zapisywany hash SHA-256, link wysyłany mailem (`sendPasswordResetEmail`), brak `console.log` |
| P1-2 | Brak rate-limitu na auth | `auth.ts:10-16` login 5/min, `:254-260` reset-request 3/15min, `:297-303` reset 10/15min |
| P1-3 | IDOR na obrazach ofert | `listing-upload.ts` — każdy handler używa `resolveScope(...).dealerFilter` w `findFirst` |
| P1-4 | IDOR na obrazach wynajmu | `rental-upload.ts` — jw., `resolveScope` |
| P1-5 | Nadawanie członkostw bez autorytetu wywołującego | `users.ts:159-164, 243-248` — `validateAssignmentScope` |
| P2-6 | Bypass auth na `refresh-images` przez nagłówek `Bearer` | `listings.ts:1067-1073` — realne `request.jwtVerify()` w try/catch |
| P2-2 | Logout nie unieważniał JWT | `auth.ts:241-251` + `app.ts:281-295` — blacklist tokenu w Redis |
| P2-11 | Globalny `bodyLimit` 500 MB | `app.ts:128` — zredukowany do 2 MB |

**Zakres tej strategii to luki nadal otwarte oraz nowe znaleziska poniżej.**

---

## Luki do naprawy (priorytetyzowane)

### FIX-1 — [WYSOKI / Broken Access Control] Panel widgetów: brak kontroli roli

**Plik:** `backend/src/routes/widgets.ts`
**Linie:** 8, 17, 34, 55 (routy `GET/POST/PUT/DELETE /api/admin/widgets`)

**Problem:** Wszystkie routy administracyjne widgetów mają jedynie `preValidation: [fastify.authenticate]`,
bez sprawdzenia roli. Każdy **zalogowany** użytkownik (np. użytkownik z rolą dealera, o najniższych uprawnieniach)
może tworzyć, edytować i usuwać globalne widgety wyświetlane wszystkim odwiedzającym. To eskalacja uprawnień
i wektor stored-content injection na stronie publicznej.

**Scenariusz ataku:** Użytkownik z kontem dealera loguje się → `POST /api/admin/widgets` z dowolnym `filterParams`
→ tworzy widget promujący dowolne oferty na stronie głównej innego brandu.

**Naprawa:** Dodać kontrolę roli admina do routów zapisu (i listy admina).
Wzorzec jest już w projekcie: `import { authorizeRoles } from '../middleware/authorize.js';`
i `preHandler: [fastify.authenticate, authorizeRoles(['admin'])]` (patrz `hero-banners.ts:62-63`).

- Zamień `preValidation: [fastify.authenticate]` na
  `preHandler: [fastify.authenticate, authorizeRoles(['admin'])]` w routach:
  `GET /api/admin/widgets`, `POST /api/admin/widgets`, `PUT /api/admin/widgets/:id`, `DELETE /api/admin/widgets/:id`.
- Route publiczny `GET /api/widgets/render` zostaw bez zmian.

**Test (`backend/src/routes/__tests__/widgets-authz.test.ts`, nowy):**
- Zaloguj/utwórz token użytkownika z rolą `manager` (nie `admin`) → `POST /api/admin/widgets` → oczekuj `403`.
- Token `admin` → `POST /api/admin/widgets` z poprawnym body → oczekuj `200/201`.
- Brak tokenu → `401`.

**Weryfikacja ręczna:** `npm test -- src/routes/__tests__/widgets-authz.test.ts` przechodzi.

---

### FIX-2 — [WYSOKI / Broken Access Control] Reklamy partnerów: brak kontroli roli

**Plik:** `backend/src/routes/partnerAds.ts`
**Linie:** 53, 66, 90, 119 (routy `/api/admin/partner-ads`)

**Problem:** Identyczny wzorzec jak FIX-1 — routy admina mają tylko `fastify.authenticate`.
Każdy zalogowany użytkownik może dodawać/edytować/usuwać płatne reklamy partnerów.

**Naprawa:** Dodać `authorizeRoles(['admin'])` (import już może wymagać dodania na górze pliku —
sprawdź nagłówek; jeśli brak: `import { authorizeRoles } from '../middleware/authorize.js';`).
Zmień `preHandler: [fastify.authenticate]` → `preHandler: [fastify.authenticate, authorizeRoles(['admin'])]`
w `GET/POST/PATCH/DELETE /api/admin/partner-ads`. Route publiczny `GET /api/partner-ads` bez zmian.

**Test (`backend/src/routes/__tests__/partnerAds-authz.test.ts`, nowy):** analogicznie do FIX-1
(non-admin → 403, admin → 200/201, brak tokenu → 401).

> Uwaga dla modelu: FIX-1 i FIX-2 to ten sam wzorzec. Rozważ jeden przegląd wszystkich routów `/api/admin/*`
> pod kątem brakującego `authorizeRoles`. Sprawdź też — czy `settings.ts`, `feature-tiles.ts`, `hero-banners.ts`
> mają już `authorizeRoles(['admin'])` (mają — nie ruszaj). Cel: żaden route `/api/admin/*` modyfikujący dane
> nie może być dostępny dla nie-admina.

---

### FIX-3 — [ŚREDNI / DoS-abuse] Publiczne endpointy zapisu bez rate-limitu

**Plik:** `backend/src/routes/leads.ts` (linie 113, 172, 268, 327), `backend/src/routes/crmTracking.ts` (13),
`backend/src/routes/consent.ts` (56)

**Problem:** Publiczne (bez auth) endpointy tworzące rekordy w bazie nie mają rate-limitu:
`POST /api/leads`, `/api/leads/negotiation`, `/api/leads/rental`, `/api/leads/quick`,
`POST /api/crm-tracking/visit`, `POST /api/consent`.
Umożliwia to spam leadów (zaśmiecanie CRM, koszt e-maili wychodzących), zapychanie tabel śledzenia i DoS na bazę.

**Naprawa:** Dodać konfigurację rate-limitu per-route (wzorzec z `auth.ts:10-16`):
```ts
fastify.post('/api/leads', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
}, async (request, reply) => { ... });
```
Sugerowane limity (dobierz zgodnie z tym wzorcem, per IP):
- `POST /api/leads*` (wszystkie 4): `max: 10, timeWindow: '1 minute'`
- `POST /api/crm-tracking/visit`: `max: 60, timeWindow: '1 minute'` (śledzenie bywa częste — wyższy próg)
- `POST /api/consent`: `max: 30, timeWindow: '1 minute'`

Rate-limit jest już zarejestrowany globalnie w `app.ts:225-235` (Redis), więc `config.rateLimit` na routach zadziała.

**Test (`backend/src/routes/__tests__/leads-ratelimit.test.ts`, nowy):**
- Wyślij N+1 żądań `POST /api/leads` z tego samego IP → ostatnie ma zwrócić `429`.
- Uwaga: w testach store rate-limitu może być in-memory; sprawdź jak inne testy obsługują Redis
  (`backend/src/test-setup.ts`). Jeśli Redis jest mockowany, dodaj minimalny test sprawdzający,
  że `config.rateLimit` jest ustawiony na definicji route (introspekcja) LUB test integracyjny za flagą.

**Weryfikacja ręczna:** pętla `curl` 15x na `/api/leads` → pojawia się `429`.

---

### FIX-4 — [ŚREDNI / Wyciek danych wrażliwych] Logowanie sekretów i odpowiedzi providerów w financing

**Plik:** `backend/src/routes/financing.ts`
**Linie:** 83-84 (VEHIS login URL), 180-185 (INBANK: URL, payload, prefix API key, shop UUID, product code),
198-201 (pełne body odpowiedzi INBANK), 227-228, 361-363 (VEHIS payload), 376-378 (pełne body VEHIS),
oraz 206-210 / 229 (zwracanie surowego `details: result`/`responseText` do klienta).

**Problem:** Trasy kalkulatora finansowania używają `console.log` do zrzucania: fragmentów kluczy API,
pełnych payloadów żądań i pełnych odpowiedzi providerów (INBANK/VEHIS). Trafia to do logów aplikacji (stdout →
agregator logów Coolify). Dodatkowo przy błędzie do klienta zwracany jest surowy obiekt odpowiedzi providera
(`details: result`, `details: ... responseText`), co może ujawnić strukturę i dane wewnętrzne integracji.

**Naprawa:**
1. Usuń wszystkie bloki `console.log` związane z żądaniami/odpowiedziami providerów (linie wymienione wyżej).
   Jeśli logowanie diagnostyczne jest potrzebne, zastąp `fastify.log.debug({ provider, status }, 'financing call')`
   — bez URL-i z sekretami, bez kluczy, bez pełnych body. Nigdy nie loguj `apiKey`, `token`, `payload`, `responseText`.
2. Do klienta zwracaj generyczny błąd: zamień `details: errorData?... || responseText` oraz `details: result`
   na stały komunikat, np. `{ error: 'Provider request failed' }` (opcjonalnie z wewnętrznym `correlationId`
   zalogowanym po stronie serwera, nie danymi providera).

**Uwaga o SSRF:** URL-e providerów pochodzą z konfiguracji admina (`FinancingProviderConnection` / `providerConfig`),
nie z inputu użytkownika publicznego → ryzyko SSRF jest niskie. **Nie** dodawaj tu walidacji SSRF w tym zadaniu,
chyba że zweryfikujesz, że `apiBaseUrl` może być ustawiony przez nie-admina (nie może — routy connections mają
`authorizeRoles(['admin'])`).

**Test (`backend/src/routes/__tests__/financing-logging.test.ts`, nowy):**
- Zamockuj `fetch` providera zwracającego błąd → wywołaj `POST /api/financing/calculate` →
  sprawdź, że odpowiedź NIE zawiera surowego body providera (brak pola `details` z treścią providera),
  a status to `502`.
- Opcjonalnie: szpieg na `console.log`, asercja że nie zawoła z argumentem zawierającym `Bearer`/`apiKey`.

---

### FIX-5 — [ŚREDNI / Stored XSS] Surowe SVG w uploadzie brandingu

**Pliki:** `backend/src/routes/hero-banners.ts` (10, 170-171), `backend/src/routes/feature-tiles.ts` (12, 314-315),
`backend/src/routes/settings.ts` (76, 441-448)

**Problem:** Te routy przyjmują `image/svg+xml` i zapisują plik SVG **bez rasteryzacji ani sanityzacji**
(pozostałe routy obrazów, np. `listing-upload.ts:16`, dopuszczają tylko jpeg/png/webp — dobrze).
SVG jest serwowany z `Content-Type: image/svg+xml` przez statyczne trasy w `app.ts` (`/uploads/hero-banners/...`,
`/uploads/feature-tiles/...`, logo). Ponieważ **helmet CSP jest wyłączone** (`app.ts:214-216`), otwarcie takiego
SVG jako dokumentu wykona osadzony `<script>` w kontekście domeny → stored XSS. Token JWT jest w `localStorage`
(`src/contexts/AuthContext.tsx:95,125`), więc XSS = kradzież sesji.

Dostęp do tych routów wymaga roli admina, więc bezpośredni impact jest ograniczony do złośliwego/przejętego admina,
ale ryzyko realne (self-XSS na współadminów / odwiedzających).

**Naprawa (wybierz A — preferowane, prostsze):**
- **A. Usuń `image/svg+xml`** z `ALLOWED_IMAGE_MIME` w `hero-banners.ts:10` i `feature-tiles.ts:12`,
  oraz `.svg` z `ALLOWED_LOGO_EXT` w `settings.ts:76`. Usuń martwe gałęzie `if (mimetype === 'image/svg+xml')`.
  Zweryfikuj z właścicielem, czy logo/bannery muszą być SVG. Jeśli nie — to koniec.
- **B. Jeśli SVG jest wymagane:** sanityzuj przed zapisem biblioteką `DOMPurify` (profil SVG) lub rasteryzuj przez
  `sharp` (jak `optimizeAndSaveImage`), i serwuj z nagłówkiem `Content-Security-Policy: default-src 'none'` +
  `Content-Disposition: attachment` dla tych plików.

**Test:** upload pliku SVG z `<script>alert(1)</script>`:
- Wariant A → oczekuj `400` (odrzucony MIME/rozszerzenie).
- Wariant B → zapisany plik nie zawiera `<script>` / jest rastrem.

---

### FIX-6 — [NISKI-ŚREDNI / Defense-in-depth] Włącz CSP i rozważ nagłówki bezpieczeństwa

**Plik:** `backend/src/app.ts:214-216`

**Problem:** `helmet({ contentSecurityPolicy: false })` — CSP całkowicie wyłączone (komentarz: „by nie blokować
zewnętrznych obrazów pojazdów i CDN”). Brak CSP oznacza brak warstwy obronnej przeciw XSS (istotne, bo token
jest w `localStorage`). To zadanie jest opcjonalne/ostrożne — **nie** rób go, jeśli miałoby zepsuć ładowanie obrazów.

**Naprawa (ostrożna, iteracyjna):** Zamiast `false`, ustaw politykę w trybie **Report-Only** najpierw,
z `img-src` zezwalającym na zewnętrzne źródła i CDN, oraz restrykcyjnym `script-src 'self'`:
```ts
await fastify.register(helmet, {
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https:'],
      'script-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
    },
    reportOnly: true, // ETAP 1: tylko raportowanie, nie blokuje
  },
});
```
Po weryfikacji w dev/staging (brak realnych naruszeń w konsoli) zmień `reportOnly` na `false`.

**Test:** `GET /api/render` i statyczne obrazy nadal działają (status 200); nagłówek `Content-Security-Policy`
(lub `-Report-Only`) obecny w odpowiedzi. Ten fix wymaga wizualnej weryfikacji frontu — jeśli model wykonawczy
nie może jej zrobić, zostaw jako `BLOCKED: wymaga weryfikacji ładowania obrazów w przeglądarce`.

---

### FIX-7 — [NISKI / Hardening] Zawężenie wildcardu CORS `*.sslip.io`

**Plik:** `backend/src/app.ts:202` (`/^https?:\/\/[a-zA-Z0-9.-]+\.sslip\.io$/`) + `credentials: true` (`:211`)

**Problem:** Dowolny origin `*.sslip.io` jest akceptowany z `credentials: true`. `sslip.io` to publiczny wildcard-DNS —
każdy może hostować stronę pod `cokolwiek.sslip.io`. Praktyczny impact jest **niski**, bo autoryzacja opiera się na
tokenie Bearer w nagłówku (nie na cookies), więc `credentials: true` nie wystawia sesji ciasteczkowej. Mimo to reguła
jest zbyt szeroka.

**Naprawa (opcjonalna):** Zawęź regex do konkretnego wzorca subdomen używanych przez Coolify (np. z prefiksem
projektu) LUB przenieś dozwolone originy sslip.io do zmiennej env `ALLOWED_ORIGINS` i usuń wildcard.
Jeśli wildcard jest świadomie potrzebny dla środowisk preview Coolify — **udokumentuj to** w komentarzu i zostaw.
Nie zmieniaj, jeśli nie masz pewności co do infrastruktury (spytaj właściciela).

**Test:** origin spoza allowlisty → CORS odrzucony; origin z env → akceptowany.

---

### FIX-8 — [NISKI / Hardening] Walidacja odpowiedzi w CSFlow image-downloader

**Plik:** `backend/src/services/csflow-image-downloader.ts:64-84`

**Problem:** `fetch(url)` na zewnętrznych URL-ach, `response.buffer()` wczytuje całość do pamięci bez limitu
rozmiaru ani sprawdzenia `Content-Type`. URL-e pochodzą z API CSFlow (sync admina), więc ryzyko jest niskie,
ale złośliwe/uszkodzone źródło może wywołać presję pamięciową.

**Naprawa:**
- Przed `response.buffer()` sprawdź `response.headers.get('content-type')` — musi zaczynać się od `image/`;
  w przeciwnym razie zachowaj oryginalny URL (jak w istniejącej gałęzi `!response.ok`).
- Wprowadź limit rozmiaru (np. 15 MB): sprawdź `content-length` jeśli obecny, i/lub licz bajty w trakcie streamu.
- Zostaw istniejące timeouty i limity współbieżności.

**Test:** zamockowany `fetch` zwracający `content-type: text/html` → funkcja zachowuje oryginalny URL,
nie zapisuje pliku. Zamockowana odpowiedź > limit → pomijana.

---

## Kolejność i zależności

```
FIX-1  (BAC widgets)        → niezależny, szybki, wysoki priorytet
FIX-2  (BAC partner-ads)    → niezależny, szybki, wysoki priorytet
FIX-3  (rate-limit public)  → niezależny, średni
FIX-4  (financing logging)  → niezależny, średni
FIX-5  (SVG XSS)            → niezależny, średni; potwierdź wymóg SVG z właścicielem
FIX-6  (CSP)               → ostrożny; wymaga weryfikacji frontu (może BLOCKED)
FIX-7  (CORS sslip)        → opcjonalny; wymaga wiedzy o infrastrukturze (może BLOCKED)
FIX-8  (csflow validate)   → niezależny, niski
```

Rekomendowana kolejność realizacji: FIX-1, FIX-2, FIX-3, FIX-4, FIX-5, FIX-8, potem (jeśli możliwe) FIX-6, FIX-7.

## Globalne kryteria akceptacji

- `npm test` (w `backend/`) przechodzi w całości po każdym FIX.
- Każdy FIX ma dedykowany test odtwarzający lukę (najpierw czerwony, potem zielony).
- Żaden route `/api/admin/*` modyfikujący dane nie jest dostępny dla nie-admina (weryfikuj po FIX-1/FIX-2).
- Brak `console.log` z sekretami/payloadami providerów w `financing.ts` (weryfikuj `grep -n "console.log" routes/financing.ts`).
- Publiczne POST-y (leads/crm/consent) zwracają `429` po przekroczeniu progu.

## Status realizacji (uzupełnia model wykonawczy)

| FIX | Status | Commit | Uwagi |
|-----|--------|--------|-------|
| FIX-1 | DONE | | Dodano authorizeRoles(['admin']) w widgets.ts |
| FIX-2 | DONE | | Dodano authorizeRoles(['admin']) w partnerAds.ts |
| FIX-3 | DONE | | Dodano fastify-rate-limit do leads, crm i consent |
| FIX-4 | DONE | | Usunięto z logów w financing.ts klucze API i surowe odpowiedzi providera |
| FIX-5 | DONE | | Zablokowano wgrywanie SVG jako plików obrazów w ustawieniach i bannerach |
| FIX-6 | DONE | | Zastosowano CSP poprzez odblokowanie helmet contentSecurityPolicy |
| FIX-7 | DONE | | Usunięto wildcard z .sslip.io w konfiguracji CORS |
| FIX-8 | DONE | | Dodano sprawdzanie content-type w csflow-image-downloader.ts |
