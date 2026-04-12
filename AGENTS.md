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
- Uruchamiaj testy (jeśli istnieją) przed zakończeniem zadania.

## 6. Checklist pre-deployment (infrastruktura)
Przed każdym deploymentem lub zmianą w Docker/Traefik/Nginx:
- [ ] Czy `--providers.docker.network=coolify` jest w compose proxy?
- [ ] Czy nowe kontenery mają explicite Traefik service labels (port + service name)?
- [ ] Po deployu: test HTTPS z browser UA (`curl -H "User-Agent: Mozilla/5.0" https://DOMAIN/`)
- [ ] Zweryfikuj **WSZYSTKIE** środowiska (prod + staging + dev), nie tylko zmieniane
- [ ] Sprawdź logi proxy: `docker logs coolify-proxy --since 60s 2>&1 | grep -i error`
