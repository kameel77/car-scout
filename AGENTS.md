# AGENTS: Car Scout

Przewodnik i zasady dla agentów AI (Antigravity, Cursor itp.) pracujących nad tym repozytorium.

## 1. Ogólne zasady postępowania
1. **Analiza przed implementacją**: Zawsze dokładnie analizuj istniejący kod przed zaproponowaniem zmian.
2. **Standardy kodowania**: Trzymaj się stylu obecnego w projekcie (TypeScript, Fastify, React, Tailwind/Shadcn UI).
3. **Dokumentacja pomysłów**: Każdy techniczny dług, pomysł na nową funkcjonalność lub optymalizację musi zostać odnotowany w pliku [new_features.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/new_features.md).
4. **Dokumentacja funkcjonalności**: Każda nowa funkcjonalność lub zmiana zachowania istniejącej musi zostać opisana w pliku `features_desc.md`.
5. **Bezpieczeństwo**: Nigdy nie usuwaj istniejących mechanizmów autoryzacji ani walidacji bez wyraźnego polecenia.
6. **Weryfikacja**: Proponuj i przeprowadzaj weryfikację zmian (testy, przeglądarka).
7. **Formatowanie treści**: Kiedy tworzysz lub edytujesz treści tekstowe, używaj zwykłych myślników ( - ) zamiast podwójnych/długich ( — ).
8. **Treści SEO na motolia.pl**: Każda treść serwisu (artykuły CMS marek/modeli, filary finansowania, blog) musi być zgodna ze strategią linkowania i konwencjami z [docs/SEO_LINKING_STRATEGY_MOTOLIA.md](docs/SEO_LINKING_STRATEGY_MOTOLIA.md) (hierarchia marka - model - oferta, anchory z encją, zakaz linkowania wariantów finansowania i stron noindex, FAQ bez linków, nagłówki bez `?` poza FAQ).
9. **Obowiązkowy Audyt Subagenta (Pre-Delivery Code Audit)**: Za każdym razem przy tworzeniu lub modyfikacji kodu, przed oddaniem zadania użytkownikowi, bezwzględnie wywołaj niezależnego subagenta audytora (`code_audit_subagent`) i uzyskaj werdykt `[APPROVED]` (zgodnie z protokołem w `~/.gemini/GEMINI.md`).
10. **Prewencja Gitleaks i Statyczny Typecheck**: Zawsze przed commitem i audytem uruchamiaj `npx tsc --noEmit` we wszystkich zmodyfikowanych modułach (`backend/`, `apps/employee-portal/`, root) - pamiętaj, że `npm test` w Vitest transpiluje kod bez type-checkingu i nie wykrywa błędów TypeScript! W plikach testowych i mockach nie używaj ciągów przypominających klucze API / hashe (np. `rental-kuga123`); jeśli specyficzny format jest wymagany, dodaj `// gitleaks:allow` w tej samej linii.

## 2. Technologie i Architektura
- **Backend**: Fastify, Prisma, PostgreSQL.
- **Frontend**: React, Vite, TanStack Query, Shadcn UI.
- **I18n**: System obsługuje wiele języków (PL, DE, EN). Pamiętaj o synchronizacji (komponent `LanguageSync`) i dynamicznych tłumaczeniach.
- **Ceny**: Ceny są automatycznie przeliczane przy każdej zmianie ustawień globalnych (marże, kursy walut) w `backend/src/routes/settings.ts`.
- **Loga**: Loga (header/footer) są przechowywane w formacie Base64 w tabeli `AppSettings`.

### Wydajność Bazy Danych i Caching (KRYTYCZNE)
1. **Event Loop Blocking**: W Node.js, operacje CPU-heavy takie jak parsowanie map dla 10 000 wpisów (np. `[...new Set(data.map())]`) całkowicie blokują aplikację, prowadząc do błędów 504/521 gdy ruch jest wysoki (boty, np. YandexBot). 
2. **Agregacja w Postgresie**: Zawsze deleguj filtrowanie, unikalne wartości i sortowanie do bazy używając native tools (np. Prisma `distinct`, `groupBy`), aby odciążyć RAM instancji.
3. **Indeksy**: Jeśli zagnieżdżasz zapytania Prisma (np. `take: 1`, `orderBy` w joinach relacji), pamiętaj, że Postgres wykonuje operacje `LATERAL JOIN`. **Musisz** posiadać zaaplikowane indexy na sortowanych kolumnach!
4. **Redis Cache**: Głównie używany w aplikacji Fastify obiekt `fastify.redis.set`. Trasy publiczne o małej zmienności wyników winny obficie stosować Redis do buforowania odpowiedzi JSON-owych np. dla list rozwijanych (10-30 min TTL).

## 3. Środowisko i Konfiguracja (Deployment / Coolify)

> **OBOWIĄZKOWA LEKTURA**: Przed jakimikolwiek zmianami w Docker Compose, Nginx, sieci lub ENV przeczytaj [DEPLOYMENT_ARCHITECTURE.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/DEPLOYMENT_ARCHITECTURE.md).

- **Instancje Coolify**:
    - **coolify-motolia-prod** / **coolify-motolia**: `https://cool.motolia.pl/` (motolia.pl i staging.motolia.pl, wcześniej `http://89.167.100.82:8000/`)
    - **coolify-finarena**: `https://cool.finarena.pl/` (m.in. dev.motolia.pl, wcześniej `http://204.168.226.1:8000/`)
    - **coolify-staging**: lokalna instancja deweloperska
- **Separacja Środowisk**: Każde środowisko (prod, staging, dev) na Coolify jest w pełni izolowane. Rozróżnia je `COMPOSE_PROJECT_NAME` (`carscout-prod`, `carscout-staging`, `carscout-dev`).
- **Bazy danych**: Usługi **Postgres** oraz **Redis** są zainstalowane jako osobne serwisy w ramach danego środowiska na Coolify. Nie są częścią głównego `docker-compose`.
- **Wymagana zgoda**: Agent nie może wprowadzać zmian w konfiguracji `docker-compose`, backendzie ani API, które wpływałyby na separację środowisk lub wymagałyby zmian w zmiennych środowiskowych (ENV) bez wyraźnej zgody użytkownika.
- **Zmienne ENV**:
    - Frontend czyta `VITE_API_URL` (backend origin bez `/api`). W dev używa proxy z `vite.config.ts`.
    - Backend CORS whitelist: `FRONTEND_URL`, `VITE_FRONTEND_URL`, `CORS_ORIGINS`, `ALLOWED_ORIGINS`.
- **CORS**: Reguły w `backend/src/server.ts`. Nie hardkoduj domen produkcyjnych – używaj list w ENV.
- **Proxy**: Odwrócone proxy zawsze dostarcza ścieżkę `/api`. Klient zawsze woła `/api/...`.

### Sieć Docker i DNS (KRYTYCZNE)
- **Każde środowisko** ma izolowaną sieć `carscout-private` ORAZ dostęp do współdzielonej sieci `coolify`.
- **`BACKEND_URL=http://backend:3000`** — hostname `backend` jest bezpieczny tylko na sieci prywatnej. Na sieci `coolify` może wystąpić **kolizja DNS** z innymi aplikacjami.
- **Jeśli Nginx nie trafia do backendu** (404/504 mimo healthy backendu) → sprawdź `nslookup backend` z wnętrza kontenera frontend. Jeśli IP nie zgadza się z backendem → zmień `BACKEND_URL` na `http://${APP_UUID}-backend:3000`.
- **Nigdy nie usuwaj backendu z sieci `coolify`** — straci łączność z bazami danych.

### Traefik (coolify-proxy)
- **OBOWIĄZKOWY parametr**: `--providers.docker.network=coolify` w `/data/coolify/proxy/docker-compose.yml`. Bez niego Traefik losowo wybiera IP z wielu sieci Docker → 502/504. Jeśli Coolify zregeneruje compose proxy → dodaj ponownie!
- Traefik traci routing po wielokrotnych restartach/redeployach → `docker restart coolify-proxy`.
- **Po KAŻDYM restarcie/redeployu** sprawdź WSZYSTKIE środowiska (prod + staging + dev).
- W razie problemów z routingiem: patrz [troubleshooting.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/troubleshooting.md) — incydenty #3, #4 i #6.

### Debugowanie na serwerze (WAŻNE)
- **Nginx blokuje `curl/7` i `curl/8`** z `return 444` (silent drop). Testowe requesty curl z serwera mogą zwrócić **fałszywe 502**.
- Używaj `wget` lub dodaj `-H "User-Agent: Mozilla/5.0"` do curl.
- Pełny playbook diagnostyczny: [troubleshooting.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/troubleshooting.md) → sekcja "Playbook: Diagnostyka 504/502".

## 4. Narzędzia i Bezpieczeństwo Danych
- Używaj `rg` (ripgrep) do przeszukiwania kodu.
- Unikaj destrukcyjnych komend git (`reset --hard`).
- Nie loguj sekretów ani tokenów.
- Nie dotykaj bezpośrednio bazy danych ani backupów (Coolify) bez wyraźnej potrzeby.

## 5. Development i Build
- **Backend dev**: `npm run dev` w katalogu `backend/`.
- **Frontend dev**: `npm run dev` w głównym katalogu repozytorium.
- Uruchamiaj testy oraz pełny typecheck (`npx tsc --noEmit` w `backend/` oraz `apps/employee-portal/`) przed zakończeniem zadania.

## 6. Checklist pre-deployment (infrastruktura)
Przed każdym deploymentem lub zmianą w Docker/Traefik/Nginx:
- [ ] Czy `--providers.docker.network=coolify` jest w compose proxy?
- [ ] Czy nowe kontenery mają explicite Traefik service labels (port + service name)?
- [ ] Po deployu: test HTTPS z browser UA (`curl -H "User-Agent: Mozilla/5.0" https://DOMAIN/`)
- [ ] Zweryfikuj **WSZYSTKIE** środowiska (prod + staging + dev), nie tylko zmieniane
- [ ] Sprawdź logi proxy: `docker logs coolify-proxy --since 60s 2>&1 | grep -i error`

## 7. Security Audit Handoff

- Gdy agent ma wprowadzać poprawki z audytu bezpieczeństwa, **pierwszy dokument to `security/fixes.md`** — tam jest uporządkowana lista zmian po priorytetach.
- Do zrozumienia kontekstu używa **`security/report.md`** — tam są uzasadnienia severity i odniesienia do kodu.
- Zmiany w backendzie wykonuj tylko w zakresie wskazanym w `security/fixes.md`.
- Każda zmiana behavior, która modyfikuje autoryzację, widoczność lub format odpowiedzi, powinna być odnotowana w `features_desc.md`.
- Nie zmieniaj deploymentu, Coolify, Nginx ani ENV w ramach passu poprawkującego bez osobnej, wyraźnej zgody.
- Nie loguj sekretów ani tokenów.
- Po zmianach uruchom testy backendu z `backend/` i sprawdź, czy istotne trasy nadal działają.

## 8. Procedury Eksportu Danych

1. **Eksport do CSV**: Jeśli użytkownik prosi o wyciągnięcie danych (np. pojazdów) w formacie CSV, używaj skryptu Node.js z wykorzystaniem Prisma.
2. **Gotowy skrypt**: W katalogu `docs_other/` znajduje się wzorcowy skrypt [export_listings_csv.cjs](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/docs_other/export_listings_csv.cjs). Należy go uruchamiać z katalogu `backend/` (np. `node ../docs_other/export_listings_csv.cjs`).
3. **Konfiguracja**: Skrypt automatycznie ładuje ENV z `backend/.env`. Upewnij się, że Prisma Client jest wygenerowany w `backend/` (`npx prisma generate`).
4. **Miejsce zapisu**: Wygenerowane pliki CSV powinny trafiać do `docs_other/`, chyba że użytkownik wskaże inaczej.

## 9. Generowanie Grafu Architektury (Graphify)

1. **Uprawnienia i Sandbox**: Komendy `graphify` uruchamiaj zawsze z `BypassSandbox: true`, aby zapobiec blokadom tworzenia plików w `graphify-out/` oraz wykonywania lokalnego interpretera Pythona.
2. **Rozszerzenia AST (SQL)**: Przed uruchomieniem weryfikuj obecność paczki `graphifyy[sql]` (`pip install "graphifyy[sql]"`), aby zapobiec pomijaniu parsowania skryptów SQL/migracji w grafie.
3. **Ekstrakcja Dokumentacji w Pythonie**: Dla plików `.md` i `.txt` bez ustawionego `GEMINI_API_KEY`, funkcja `extract_markdown(path)` bezpośrednio wyciąga nagłówki i relacje (sygnatura pobiera wyłącznie `path: Path` bez `cache_root`).
4. **Parametryzacja Eksportu HTML**: Przekazując etykiety społeczności w `to_html(G, communities, output_path, community_labels=labels)`, należy stosować poprawną nazwę argumentu `community_labels`.
5. **Skalowanie dla Dużych Repozytoriów**: W przypadku ponad 500 plików zaleca się podzielenie zapytań na dedykowane moduły (`src/`, `backend/`) lub uruchamianie dedykowanego potoku zbiorczego.
