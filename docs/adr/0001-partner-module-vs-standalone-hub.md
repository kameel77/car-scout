# ADR-001 — Partner module inside Benefivo (A) vs. standalone partner-hub (B)

* Status: **Proposed — czeka na akceptację Kamila**
* Date: 2026-09-30
* Decider: Kamil (owner), Hermes (proposal)
* Context: KAM-25 Phase 1, step 1 · PRD "Benefivo Partner" v2 §5
* Scope: gdzie żyje system partnerski (biura rachunkowe, kody poleceń, atrybucja, prowizje)

---

## 1. Context — co zastałem (ustalone fakty, nie założenia)

### Benefivo

| Aspekt | Stan rzeczywisty (zweryfikowane 2026-09-30) |
| --- | --- |
| URL | `https://benefivo.pl` → HTTP 200, `server: cloudflare` |
| Co to jest | Nie osobny produkt. To **aplikacja `apps/employee-portal` w monorepo `kameel77/car-scout`** — marka Benefivo jest wycinkiem istniejącego programu pracowniczego (`EmployeeProgram`, `EmployeeCompany`). |
| Hosting | Coolify `coolify-motolia-prod`, aplikacja `employee-portal:main-kyvffupg0twmbgmceg4ulqok`, status `running:healthy`. Staging: `car-scout:staging-*` na tej samej instancji. |
| Repo | `github.com/kameel77/car-scout` (prywatne? — public, ale dostęp mamy). Backend `backend/`, Prisma `backend/prisma/schema.prisma`, ~90 modeli. |
| Stack | Fastify 5 + Prisma 5 + PostgreSQL + Redis (ioredis) · React 18 + Vite 6 + Tailwind + shadcn/ui · Zod · Vitest · node-cron. |
| Auth | **JWT własne** (`@fastify/jwt`, realm/aud/nonce) + bcrypt. **Brak** Google OAuth. **Brak** magic link. Są dwa niezależne loginy: `User` (panel admina) i `EmployeeAccount` (portal pracowniczy). |
| Rate limit | `@fastify/rate-limit` z globalną konfiguracją + per-route (np. `AUTH_RATE_LIMIT_MAX`). |
| E-mail | nodemailer, SMTP konfigurowany z panelu (`AppSettings.smtpHost/Port`). Brak Brevo/transaktional API. |
| Joby | `node-cron` w procesie backendu. **Brak** pg-boss, **brak** osobnego workera. |
| Storage | Brak object storage (S3/Hetzner/MinIO). Pliki trzymane w bazie/kontenerze. |
| PDF | Brak biblioteki PDF w backendzie. |
| CI/CD | `.github/workflows/ci.yml` (lint, typecheck, test, build) + `docker.yml` (GHCR → Coolify, staging auto, prod z tagu). |
| DB in prod | Współdzielona z motolia.pl w ramach tego samego compose'a. |

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

Backend (modele, API, kody, CRM, atrybucja, prowizje) w `car-scout/backend/src/modules/partner/`, tabele z prefiksem `partner_*`. Panel partnerski i panel admina CRM jako nowa aplikacja `apps/partner-panel/` obok `apps/employee-portal` — własny build, własny kontener, własny domena, **ale to samo repo i ta sama baza**.

---

## 4. Decyzja

**Rekomendacja: Opcja A′.**

Uzasadnienie:

1. **Atomowość atrybucji to najważniejsza własność, nie preferencja.** Kod weryfikuje się po stronie Benefivo, zapis atrybucji idzie tą samą transakcją co rejestracja klienta. Opcja B zamienia to w distributed transaction i daje okno, w którym klient jest zarejestrowany bez biura. Przy modelu first-touch i 24-miesięcznym lifetime to źródło sporów o prowizję.
2. **Benefivo nie jest osobnym produktem — jest modułem w `car-scout`.** Opcja A nie jest „wrapaniem cudzego systemu", tylko modułem w monorepo, który już ma. Wymuszanie osobnej bazy danych dla jednej funkcji to koszt bez odpowiadającej mu korzyści w skali ≤300 biur / ≤10k klientów (PRD A5).
3. **Izolacja, której naprawdę potrzebujemy, to izolacja release'u i blast radius, a nie izolacja bazy.** Opcja A' daje ją przez osobną aplikację webową i osobny kontener: błąd w panelu partnerskim nie wywraca motolia.pl. Deploy panelu jest niezależny od deployu reszty.
4. **Ryzyko „za dużo w jednym repo" jest realne, ale adresowalne.** Tabele `partner_*` nie dotykają istniejących modeli, moduł ma własną warstwę dostępu do danych z wymuszonym scopingiem (partner_id), własne testy izolowane (wzorzec `*.isolated.test.ts` już w repo) i własną sekcję w `new_features.md` / `features_desc.md`.
5. **Zero nowych zależności operacyjnych.** Wszystko, czego wymaga Phase 1–4, da się zrobić istniejącym stackiem: JWT + bcrypt (magic link = token jednorazowy w tabeli, bez zewnętrznego dostawcy), `node-cron` zamiast pg-boss (przy tej skali), istniejący SMTP, `sharp`/SQLite-free generowanie PDF można dołożyć w Phase 3. Obiektowe storage i Brevo wchodzą dopiero wtedy, kiedy realnie są potrzebne (rozliczenia), nie w Phase 1.

### Kiedy rozważyć B

Uruchomiamy B, jeśli **cokolwiek** z tego się zdarzy:

* Benefivo zostaje przebudowane na inny stack albo wydzielone do osobnego repo (decyzja właścicielska, nie techniczna).
* Partner-hub musi obsłużyć więcej niż jedną markę (Motolia + Benefivo + IzzyLease) z osobnymi cyklami wydań.
* Wymogi compliance lub audyt księgowy każą fizycznie oddzielić dane prowizji od bazy motolia.pl.
* Repo `car-scout` staje się zbyt duże/wolne w CI tak, że cykl wydań przestaje być akceptowalny.

Dla każdego z tych punktów architektura A' zostawia wyjście: partner domain ma własne tabele i własną warstwę serwisową, więc wycięcie go do osobnej usługi to mechaniczna operacja (PRD §5 to przewiduje).

---

## 5. Konsekwencje

### Pozytywne

* Atrybucja w jednej transakcji z rejestracją klienta.
* Jedno miejsce logowania dla użytkowników wewnętrznych (partner admin/advisor w ramach istniejącego JWT + rola).
* Deploy panelu partnerskiego niezależny od motolia.pl.
* Reuse istniejących mechanizmów: rate limit, audit, backup Postgres, CI, Traefik routing przez Coolify UI.

### Negatywne / do zaakceptowania

* **Google OAuth allow-list dla użytkowników wewnętrznych nie istnieje w repo.** Trzeba go dodać (nowy provider + tabela allow-listy) albo tymczasowo zostawić logowanie hasłem dla 5 osób wewnętrznych (PRD A5 mówi ≤5). Rekomendacja: hasło w Phase 1, Google OAuth jako osobny follow-up.
* **Magic link dla partnerów** = token jednorazowy w tabeli z expiry + e-mail przez istniejący SMTP. Bez zewnętrznego dostawcy.
* **Tabela `partner_*` w tej samej bazie co wyceny.** Wymaga dyscypliny: brak `ON DELETE CASCADE` z tabel motolii, backup i restore testowane osobno dla schematu partner.
* **pg-boss / object storage / PDF nie są w stacku.** Świadomie odrzucone w Phase 1 na rzecz `node-cron` + prostego podejścia; wracają w Phase 3, kiedy pojawi się realna potrzeba (rozliczenia, KSeF).
* **Rejestracja klienta z kodem (Phase 2) nie ma jeszcze gdzie istnieć.** To jest największa luka i ADR jej nie zamyka — Phase 2 musi dostać decyzję o modelu konta klienta (nowy `ClientAccount` obok `EmployeeAccount` czy unified identity). Zapisuję to jako **otwarte pytanie ADR-002**.

### Neutralne

* Nazwa domeny pod `…/r/{code}`: rekomendacja `benefivo.pl/r/{code}` — domena marki już istnieje i jest właścicielska. Decyzja Kamila (KAM-24).

---

## 6. Pytania otwarte przed startem Phase 1 (potrzebne od Kamila)

1. **Akceptacja Opcji A′.** (blokada startu Phase 1 kroku 2)
2. **KAM-24 nie ma jeszcze odpowiedzi** — brakuje: podmiotu operacyjnego i marki programu, domeny pod `/r/{code}`, dostawcy e-mail, 3 biur pilotażowych, umowy i DPA, oraz potwierdzenia A6 (biuro tylko poleca, nie pośredniczy). Część tego nie blokuje skryptu, ale **prowizje i rozliczenia w Phase 3 są bez tego niemożliwe** i potwierdzenie prawne A6/A7 jest warunkiem prowadzenia pilotażu w Phase 4.
3. **ADR-002 (do decyzji w Phase 2): model konta klienta** — nowy typ konta czy unified identity.
4. **Google OAuth dla ≤5 użytkowników wewnętrznych** — wdrożyć teraz czy zostawić logowanie hasłem do Phase 1.

---

## 7. Źródła (zweryfikowane)

* `https://benefivo.pl` → 200, Cloudflare
* `~/Documents/Coding/github/car-scout` — `apps/employee-portal/`, `backend/`, `backend/prisma/schema.prisma`, `backend/src/modules/employee-program/`, `AGENTS.md`, `.github/workflows/`
* Coolify `coolify-motolia-prod` → `employee-portal:main-kyvffupg0twmbgmceg4ulqok` = `https://benefivo.pl`, `running:healthy`
* PRD "Benefivo Partner" v2 (Linear document `3642d78487d0`), §2, §5, §6
* KAM-24 (Phase 0, decyzje właścicielskie — bez odpowiedzi na moment pisania)
