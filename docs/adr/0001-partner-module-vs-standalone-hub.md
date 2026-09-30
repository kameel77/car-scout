# ADR-001 — Partner module inside Benefivo (A) vs. standalone partner-hub (B)

* Status: **Proposed (v2, po audycie) — czeka na akceptację Kamila**
* Date: 2026-09-30
* Decider: Kamil (owner), Hermes (proposal)
* Context: KAM-25 Phase 1, step 1 · PRD "Benefivo Partner" v2 §5
* Scope: gdzie żyje system partnerski (biura rachunkowe, kody poleceń, atrybucja, prowizje)
* Historia: v1 przeszedł niezależny audyt (Gemini 3.8 Flash, 2026-09-30). Wyłapał 4 błędne fakty i 3 pominięte ryzyka - wszystkie poprawione w v2, patrz §8.

---

## 1. Context — co zastałem (ustalone fakty, nie założenia)

### Benefivo

| Aspekt | Stan rzeczywisty (zweryfikowane 2026-09-30) |
| --- | --- |
| URL | `https://benefivo.pl` → HTTP 200, `server: cloudflare` |
| Co to jest | Nie osobny produkt. To **aplikacja `apps/employee-portal` w monorepo `kameel77/car-scout`** — marka Benefivo jest wycinkiem istniejącego programu pracowniczego (`EmployeeProgram`, `EmployeeCompany`). |
| Hosting | Coolify `coolify-motolia-prod`, aplikacja `employee-portal:main-kyvffupg0twmbgmceg4ulqok`, status `running:healthy`. Staging: `car-scout:staging-*` na tej samej instancji. |
| Repo | `github.com/kameel77/car-scout`. Backend `backend/`, Prisma `backend/prisma/schema.prisma` — **66 modeli + 26 enumów**. |
| Stack backend | Fastify 5 + Prisma 5 + PostgreSQL + Redis (ioredis) · Zod · Vitest · node-cron. |
| Stack portalu | `apps/employee-portal` to **osobna aplikacja Vite + React 18 SPA** serwowana przez dedykowany kontener Nginx. Zależności UI: `clsx`, `tailwind-merge`, `lucide-react`, `react-router-dom` — **bez Radix i bez shadcn/ui** (shadcn/Radix są w głównym frontendzie motolia, nie w portalu). routing po stronie klienta (`react-router-dom`), prerender stron publicznych. |
| Auth | **JWT własne** (`@fastify/jwt`, realm/aud/nonce) + bcrypt. **Brak** Google OAuth. **Brak** magic link. Są dwa niezależne loginy: `User` (panel admina) i `EmployeeAccount` (portal pracowniczy). |
| Rate limit | `@fastify/rate-limit` z `global: false` i backedem Redis - limity są **per-route**, nie globalne. dodatkowo Nginx portalu (`nginx.conf`, `nginx-rate-limit.conf`) limituje ruch HTML. |
| E-mail | nodemailer, SMTP konfigurowany z panelu (`AppSettings.smtpHost/Port`). Brak Brevo/transaktional API. |
| Joby | `node-cron` w procesie backendu (`services/csflow.service.ts`, `services/pewneauto.service.ts`, `services/financing-calc.service.ts`). **Brak** pg-boss, **brak** osobnego workera. |
| PDF | **Jest** - `puppeteer-core` + `@sparticuz/chromium` w backendzie, `backend/src/services/puppeteer.ts`, używane w `routes/onepager.ts` (`/api/onepager/pdf`) z cache w Redis. Do generowania raportów partnerskich nie trzeba nowej zależności. |
| Storage | Brak object storage (S3/Hetzner/MinIO). Pliki trzymane w bazie/kontenerze. |
| Redis | Jeden `REDIS_URL`, **bez namespace'ów per domena**. Istniejące prefiksy: `ep:session:*` (sesje employee), `blacklist:*`. `rate-limit` trzyma własne klucze. |
| CI/CD | `ci.yml` (lint, typecheck, test, build - **także `apps/employee-portal`**) + `docker.yml` (matryca GHCR: `backend`, `frontend-carsalon`, `frontend-motolia`). **Uwaga: `apps/employee-portal` nie jest w matrycy `docker.yml`** - portalu nie buduje GHCR, Coolify buduje go bezpośrednio z `apps/employee-portal/Dockerfile` (base directory `apps/employee-portal`), patrz `apps/employee-portal/DEPLOYMENT.md` §3. |
| DB in prod | Współdzielona z motolia.pl. Backend łączy się do jednej instancji Postgres w ramach compose'a. |

### Czego Benefivo **nie ma** dziś

Konta klientów końcowych (JDG/firma) z logowaniem. EmployeeAccount to konto pracownika w programie pracowniczym, nie klient kupujący auto. Rejestracja klienta z kodem biura ( główny mechanizm PRD §3.3) **nie ma dziś gdzie się odbyć** — to jest Phase 2 i musi powstać.

---

## 2. Problem

Mechanizm programu jest atomowy: **klient rejestruje się na Benefivo z kodem biura → atrybucja zapisuje się w tej samej transakcji co rejestracja**. Jeśli partner-hub będzie osobnym serwisem, ta atomowość znika i pojawia się: drugi system auth, kontrakt API do utrzymania, eventual consistency i retry na krytycznym zapisie, oraz pytanie „co jeśli Benefivo padnie w trakcie rejestracji".

Druga strona medalu: repo `car-scout` obsługuje produkcję motolia.pl — ruch, SEO, wyceny, Pipeline CRM. Wpinanie do niego modułu, w którym liczymy pieniądze (prowizje, rozliczenia, KSeF) i trzymamy RODO, podnosi blast radius błędu.

---

## 3. Opcje

### Opcja A — moduł partner w repo `car-scout` (PRD default)

| | |
| --- | --- |
| **Zalety** | Jedno auth, jedna DB. Atrybucja w tej samej transakcji co rejestracja klienta. Zero kontraktu API do utrzymania. Istniejący CI/CD, rate limit, audit i deployment po stronie Benefivo. Reuse `EmployeeCompany`-owego wzorca CRM biur. |
| **Wady** | Sprzężenie cykli wydań z motolia.pl. Współdzielona baza: partner w tej samej bazie co wyceny i leads. Moduł partnerski musi żyć w cudzym repo, w cudzej domenie biznesowej. |

### Opcja B — osobny serwis `benefivo-partner` (Next.js/Postgres własny)

| | |
| --- | --- |
| **Zalety** | Pełna izolacja: osobne repo, osobna baza, osobny release, osobne działa administracyjne. Łatwo wykorzystać ponownie dla Motolia/IzzyLease (white-label). Zero ryzyka dla motolia.pl. |
| **Wady** | Dwa systemy auth i magic link vs Google OAuth do zbudowania od zera. Klient rejestrujący się na Benefivo potrzebuje sesji w dwóch systemach albo federacji. Atrybucja przestaje być atomowa. Kontrakt API (`/codes/{code}/validate`, `attribute()`) do zaprojektowania, wersjonowania i monitorowania. Do tego: nowy stack (Next.js, pg-boss, object storage, PDF, Brevo) nieobecny w org — 4 nowe zależności operacyjne. |

### Opcja A′ — moduł w backendzie car-scout + osobny panel partnerski jako nowa aplikacja w tym samym monorepo *(rekomendacja)*

Backend (modele, API, kody, CRM, atrybucja, prowizje) w `car-scout/backend/src/modules/partner/`, tabele z prefiksem `partner_*`. Panel partnerski i panel admina CRM jako nowa aplikacja `apps/partner-panel/` obok `apps/employee-portal` — własny kontener Nginx budowany przez Coolify z własnego `Dockerfile`, własna domena.

**Granica izolacji - uczciwie:** osobny kontener daje izolację **panelu** (błąd w UI nie wywraca motolia.pl). **Backend partner dzieli kontener `carscout-api` z produkcją motolia.pl** - to jest realny, wspólny blast radius i główny koszt tej opcji. Patrz §5a.

---

## 4. Decyzja

**Rekomendacja: Opcja A′.**

Uzasadnienie:

1. **Atomowość atrybucji to najważniejsza własność nowego kodu, nie zastana cecha Benefivo.** Rejestracja klienta z kodem (PRD §3.3) dziś **nie istnieje** i będzie pisana od zera w Phase 2. Wybierając miejsce tej transakcji, decydujemy czy atrybucja zapisze się atomowo z rejestracją, czy przez wywołanie HTTP do osobnej usługi - co daje okno „klient zarejestrowany bez biura". Przy first-touch i 24-miesięcznym lifetime (PRD A3) to źródło sporów o prowizję. A′ wygrywa tu zdecydowanie.
2. **Benefivo nie jest osobnym produktem - jest aplikacją w `car-scout`.** Opcja A nie jest „wrapaniem cudzego systemu", tylko modułem w monorepo, który już mamy. Wymuszanie osobnej bazy dla jednej funkcji to koszt bez odpowiadającej mu korzyści w skali ≤300 biur / ≤10k klientów (PRD A5).
3. **Izolacja, której naprawdę potrzebujemy, to izolacja frontendu i release'u frontendu, nie bazy i nie backendu.** Panel jest osobnym kontenerem z własnym cyklem wydań - to realne. Backend jest wspólny - koszt udokumentowany w §5a i w ryzykach audytu (§8).
4. **Zero nowych zależności operacyjnych.** Wszystko, czego wymaga Phase 1-4, da się zrobić istniejącym stackiem: JWT + bcrypt (magic link = token jednorazowy w tabeli), `node-cron` zamiast pg-boss (przy tej skali), istniejący SMTP, **i istniejący `puppeteer-core` + Chromium do PDF** - raporty partnerskie nie potrzebują nowej biblioteki.
5. **Realne ryzyko "za dużo w jednym repo" jest adresowalne.** Tabele `partner_*` nie dotykają istniejących modeli, brak `ON DELETE CASCADE` do tabel motolii, moduł ma własną warstwę dostępu do danych z wymuszonym scopingiem (`partner_id`), testy izolowane (wzorzec `*.isolated.test.ts` już w repo) i własną sekcję w `new_features.md` / `features_desc.md`.

### Kiedy rozważyć B

Uruchomiamy B, jeśli **cokolwiek** z tego się zdarzy:

* Benefivo zostaje przebudowane na inny stack albo wydzielone do osobnego repo (decyzja właścicielska, nie techniczna).
* Partner-hub musi obsłużyć więcej niż jedną markę (Motolia + Benefivo + IzzyLease) z osobnymi cyklami wydań.
* Wymogi compliance lub audyt księgowy każą fizycznie oddzielić dane prowizji od bazy motolia.pl.
* Repo `car-scout` staje się zbyt duże/wolne w CI tak, że cykl wydań przestaje być akceptowalny.
* **Wspólny kontener `carscout-api` przestaje być akceptowalnym blast radius dla pieniędzy** - patrz §5a. To jest realny trigger migracji do B i powinien być monitorowany od Phase 1.

Dla każdego z tych punktów architektura A′ zostawia wyjście: partner domain ma własne tabele i własną warstwę serwisową, więc wycięcie go do osobnej usługi to mechaniczna operacja (PRD §5 to przewiduje).

---

## 4a. Ryzyka wspólnej infrastruktury (obowiązują niezależnie od wyboru A/A′, oraz dla decyzji "kiedy B")

Te ryzyka wynikają z faktu, że backend partner **i** produkcja motolia.pl dzielą kontener, bazę i Redis. Każde z nich dostaje politykę, nie tylko świadomość.

### R1. Wspólna baza i pula połączeń

`backend` łączy się do jednej instancji Postgres współdzielonej z motolia.pl. Raporty partnerskie (CSV eksporty, przeliczenia miesięczne w Phase 3) mogą zjeść pulę połączeń albo trzymać długie transakcje, co degraduje publiczne wyszukiwanie na motolia.pl.

**Polityka:**
* Zapytania partnerskie są **zawsze** z indeksami i z `statement_timeout` ustawionym per-zapytanie (Prisma `$queryRaw` + `SET LOCAL statement_timeout` albo `maxWait`/`timeout` w poolu). Zero `findMany` bez `take`.
* Raporty Phase 3 liczą się **jobem nocnym z zapisem wyniku do tabeli** (`partner_*_snapshot`), nie na żądanie przy widoku w panelu. Panel czyta snapshot. To eliminuje ciężkie zapytanie z ścieżki interaktywnej.
* Eksport CSV ma twardy limit rzędów + strumieniowanie, nie `toArray()` w pamięci.
* Migracje: **zero `ALTER TABLE` na tabelach motolii.** Nowe tabele `partner_*` to z definicji bezpieczne (`CREATE TABLE` nie blokuje). Zmiana istniejącej tabeli partnerskiej po aktywacji = expand/contract (dodaj kolumnę nullable → wypełnij → dodaj constraint → usuń), z migracją rozłączną z deployem aplikacji.

### R2. Wspólna przestrzeń kluczy Redis

Jeden `REDIS_URL`, brak namespace'ów per domena. Istnieją prefiksy `ep:session:*`, `blacklist:*` i wewnętrzne klucze rate-limit. Magic linki partnerów i ich sesje **muszą** mieć własny prefiks, inaczej kolizja z sesjami pracowniczymi lub przypadkowy `FLUSHDB` ubije logowanie.

**Polityka:** wszystkie klucze modułu partner z prefiksem `partner:` (`partner:session:*`, `partner:magic:*`, `partner:ratelimit:*`, `partner:pdf:*`). Prefiks ustalony w stałej i używany wyłącznie przez warstwę dostępu do Redis modułu - test jednostkowy asertywny na prefiks.

### R3. Routing `/r/{code}` przez Nginx i Traefik

`benefivo.pl` jest obsługiwane przez dedykowany kontener Nginx (`apps/employee-portal/nginx.conf`), w którym `/api/` jest proxiowane do backendu. Dziś istnieją jawnie zdefiniowane location (`/dla-firm`, `/regulamin`, `/prywatnosc`, `/uploads/`, `/assets/`, `/static/`, brand book) i fallback `location /` na statyczny SPA.

**Problem:** `/r/{code}` nie może być obsłużone przez statyczny SPA ani przez ciężki backend - to ścieżka publiczna o największym wolumenie w programie (każde kliknięcie w kod QR klienta). Obsługa jej w backendzie oznaczałaby, że **cały ruch z linków partnerskich przechodzi przez współdzielony `carscout-api`**, czyli dokładnie ten blast radius, którego A′ ma unikać.

**Polityka:**
* `location /r/` w `nginx.conf` obsługuje **wyłącznie przekierowanie** (302 na docelową stronę rejestracji z kodem w parametrze) - zero logiki biznesowej, zero dostępu do bazy, zero renderowania po stronie backendu.
* Zapisanie kodu w pierwszo-party cookie i walidacja odbywają się **dopiero w przeglądarce klienta przy rejestracji**, a kod walidowany jest jednym zapytaniem do `GET /api/codes/{code}/validate` z rate limitem (PRD §6.5) - i to zapytanie jest tanie, indeksowane po unikalnym kodzie.
* Ścieżka `/r/` musi być wyłączona z rate-limitu HTML portalu lub dostać własny, wysoki limit - inaczej kampania jednego biura wygeneruje 429 dla klientów.
* Traefik: żadnych hardkodowanych labeli (standard Coolify z `AGENTS.md`), domena przez UI Coolify.
* Wymaga **zgody Kamila na zmianę `apps/employee-portal/nginx.conf`** - to zmiana w istniejącym deploycie, nie mogę jej zrobić sam w ramach Phase 1.

### R4. Sesje i CSRF na pętli przez dwie aplikacje

Panel partnerski to osobny origin niż `benefivo.pl`. Sesja partner-a żyje w JWT backendu i w localStorage SPA (wzorzec z `employee-portal`). Przy dwóch originach i proxy `/api/` po stronie Nginx pętla auth + CSRF (`X-Forwarded-*`, sprawdzenie `Host` w backendzie, `DEPLOYMENT.md` §2.1) musi być przetestowana dla panelu partner **i** dla publicznej ścieżki `/r/`.

**Polityka:** partner panel hostowany na subdomenie z własnym originem i własnym proxy `/api/`, cookies `HttpOnly`+`SameSite=Lax`+`Secure` zgodnie z `DEPLOYMENT.md` §2.5; test Playwright obejmuje: logowanie magic linkiem → sesja → wylogowanie → wygasły token.

---

## 5. Konsekwencje

### Pozytywne

* Atrybucja w jednej transakcji z rejestracją klienta (ta transakcja powstaje w Phase 2 - decydujemy tu, **gdzie** ma żyć).
* Jedno miejsce logowania dla użytkowników wewnętrznych (partner admin/advisor w ramach istniejącego JWT + rola).
* Release panelu partnerskiego niezależny od motolia.pl (osobny kontener, własny build z Coolify).
* Reuse istniejących mechanizmów: rate limit, sesje JWT, backup Postgres, CI, `puppeteer-core` do PDF, nodemailer do e-maili, Nginx z rate limitem.

### Negatywne / do zaakceptowania

* **Wspólny kontener backendu z produkcją motolia.pl.** To główny koszt A′. Regresja w module partner, ciężki raport albo migracja blokująca zapytanie trafiają w tę samą usługę, co motolia.pl. Mitygacje: R1 (timeouts, snapshoty nocne, expand/contract) i zero ciężkich zapytań na ścieżce interaktywnej. Jeśli okaże się, że to nie wystarcza, trigger migracji do B jest wypisany w §4.
* **Google OAuth allow-list dla użytkowników wewnętrznych nie istnieje w repo.** Trzeba go dodać (nowy provider + tabela allow-listy) albo tymczasowo zostawić logowanie hasłem dla 5 osób wewnętrznych (PRD A5 mówi ≤5). Rekomendacja: hasło w Phase 1, Google OAuth jako osobny follow-up.
* **Magic link dla partnerów** = token jednorazowy w tabeli z expiry + e-mail przez istniejący SMTP. Bez zewnętrznego dostawcy.
* **Tabela `partner_*` w tej samej bazie co wyceny.** Wymaga dyscypliny: brak `ON DELETE CASCADE` z tabel motolii, backup i restore testowane osobno dla schematu partner.
* **pg-boss i object storage nie są w stacku** - świadomie odrzucone w Phase 1 na rzecz `node-cron`; wracają w Phase 3 przy rozliczeniach i KSeF. **PDF jest dostępny** (`puppeteer-core` + Chromium, `services/puppeteer.ts`) - bez nowej zależności.
* **Wspólna przestrzeń kluczy Redis** - wymuszone prefiksy `partner:*` (R2), inaczej ryzyko kolizji z `ep:session:*`.
* **Ruch z `/r/{code}` musi omijać backend** (R3) - przekierowanie w Nginx, walidacja dopiero przy rejestracji. Wymaga zgody na zmianę `nginx.conf` portalu.
* **Rejestracja klienta z kodem (Phase 2) nie ma jeszcze gdzie istnieć.** To jest największa luka i ADR jej nie zamyka - Phase 2 musi dostać decyzję o modelu konta klienta (nowy `ClientAccount` obok `EmployeeAccount` czy unified identity). Zapisuję to jako **otwarte pytanie ADR-002**.

### Neutralne

* Nazwa domeny pod `…/r/{code}`: rekomendacja `benefivo.pl/r/{code}` - domena marki już istnieje i jest właścicielska. Decyzja Kamila (KAM-24).

---

## 6. Pytania otwarte przed startem Phase 1 (potrzebne od Kamila)

1. **Akceptacja Opcji A′.** (blokada startu Phase 1 kroku 2)
2. **KAM-24 nie ma jeszcze odpowiedzi** - brakuje: podmiotu operacyjnego i marki programu, domeny pod `/r/{code}`, dostawcy e-mail, 3 biur pilotażowych, umowy i DPA, oraz potwierdzenia A6 (biuro tylko poleca, nie pośredniczy). Część tego nie blokuje skryptu, ale **prowizje i rozliczenia w Phase 3 są bez tego niemożliwe** i potwierdzenie prawne A6/A7 jest warunkiem prowadzenia pilotażu w Phase 4.
3. **ADR-002 (do decyzji w Phase 2): model konta klienta** - nowy typ konta czy unified identity.
4. **Google OAuth dla ≤5 użytkowników wewnętrznych** - wdrożyć teraz czy zostawić logowanie hasłem do Phase 1.
5. **Zgoda na zmianę `apps/employee-portal/nginx.conf`** (dodanie `location /r/` jako przekierowania). To zmiana w produkcyjnym deploycie Benefivo - bez Twojej zgody jej nie robię.

---

## 7. Źródła (zweryfikowane)

* `https://benefivo.pl` → 200, Cloudflare
* `~/Documents/Coding/github/car-scout` — `apps/employee-portal/` (`package.json`, `nginx.conf`, `DEPLOYMENT.md`, `Dockerfile`), `backend/` (`package.json`, `src/app.ts`, `src/services/puppeteer.ts`, `src/routes/onepager.ts`, `src/modules/employee-program/`, `prisma/schema.prisma`), `AGENTS.md`, `.github/workflows/ci.yml`, `.github/workflows/docker.yml`
* Coolify `coolify-motolia-prod` → `employee-portal:main-kyvffupg0twmbgmceg4ulqok` = `https://benefivo.pl`, `running:healthy`
* PRD "Benefivo Partner" v2 (Linear document `3642d78487d0`), §2, §5, §6
* KAM-24 (Phase 0, decyzje właścicielskie - bez odpowiedzi na moment pisania)

---

## 8. Wynik audytu (v1 → v2)

Niezależny audyt (subagent, Gemini 3.8 Flash, 2026-09-30) wyłapał 9 zastrzeżeń. **Wszystkie 9 zweryfikowałem własnymi odczytami kodu i wszystkie okazały się trafne.** Poprawki:

| # | Zastrzeżenie audytu | Rozwiązanie w v2 |
| --- | --- | --- |
| 1 | "Brak biblioteki PDF" - fałsz, jest `puppeteer-core` + Chromium | §1 (wiersz PDF), §4 pkt 4, §5 |
| 2 | `employee-portal` nie ma shadcn/Radix (to główny frontend motolii) | §1 - osobny wiersz "Stack portalu" |
| 3 | "~90 modeli" - w rzeczywistości 66 modeli + 26 enumów | §1 (wiersz Repo) |
| 4 | `docker.yml` **nie buduje** `employee-portal` - portalu nie ma w matrycy GHCR, buduje go Coolify z własnego Dockerfile | §1 (wiersz CI/CD) |
| 5 | Blast radius: backend partner dzieli `carscout-api` z produkcją - twierdzenie o niezależnym deploycie było zbyt mocne | §3 (granica izolacji), §4 pkt 3, §5, §4a R1 |
| 6 | Atomowość atrybucji opisana jako zastana cecha, a jest net-new w Phase 2 | §4 pkt 1 - sformułowane jako decyzja **gdzie** powstaje transakcja |
| 7 | Brak polityki migracji i puli połączeń na wspólnej bazie | §4a R1 |
| 8 | Brak analizy routingu `/r/{code}` przez Nginx/Traefik | §4a R3 + pytanie 5 do Kamila |
| 9 | Wspólna przestrzeń kluczy Redis bez prefiksów | §4a R2 |

Wniosek audytu: **wniosek (A′) się broni**, ale reprezentacja kosztów była zbyt optymistyczna. v2 mówi wprost, czym płacimy.
