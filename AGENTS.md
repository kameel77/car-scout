# AGENTS: Car Scout

Przewodnik i zasady dla agentów AI (Antigravity, Cursor itp.) pracujących nad tym repozytorium.

## 1. Ogólne zasady postępowania
1. **Analiza przed implementacją**: Zawsze dokładnie analizuj istniejący kod przed zaproponowaniem zmian.
2. **Standardy kodowania**: Trzymaj się stylu obecnego w projekcie (TypeScript, Fastify, React, Tailwind/Shadcn UI).
3. **Dokumentacja pomysłów**: Każdy techniczny dług, pomysł na nową funkcjonalność lub optymalizację musi zostać odnotowany w pliku [new_features.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/new_features.md).
4. **Dokumentacja funkcjonalności**: Każda nowa funkcjonalność lub zmiana zachowania istniejącej musi zostać opisana w pliku `features_desc.md`.
5. **Bezpieczeństwo**: Nigdy nie usuwaj istniejących mechanizmów autoryzacji ani walidacji bez wyraźnego polecenia.
6. **Weryfikacja**: Proponuj i przeprowadzaj weryfikację zmian (testy, przeglądarka).

## 2. Technologie i Architektura
- **Backend**: Fastify, Prisma, PostgreSQL.
- **Frontend**: React, Vite, TanStack Query, Shadcn UI.
- **I18n**: System obsługuje wiele języków (PL, DE, EN). Pamiętaj o synchronizacji (komponent `LanguageSync`) i dynamicznych tłumaczeniach.
- **Ceny**: Ceny są automatycznie przeliczane przy każdej zmianie ustawień globalnych (marże, kursy walut) w `backend/src/routes/settings.ts`.
- **Loga**: Loga (header/footer) są przechowywane w formacie Base64 w tabeli `AppSettings`.

## 3. Środowisko i Konfiguracja (Deployment / Coolify)
- **Separacja Środowisk**: Każde środowisko (np. staging, production) na Coolify jest w pełni izolowane.
- **Bazy danych**: Usługi **Postgres** oraz **Redis** są zainstalowane jako osobne serwisy w ramach danego środowiska na Coolify. Nie są częścią głównego `docker-compose`.
- **Wymagana zgoda**: Agent nie może wprowadzać zmian w konfiguracji `docker-compose`, backendzie ani API, które wpływałyby na separację środowisk lub wymagałyby zmian w zmiennych środowiskowych (ENV) bez wyraźnej zgody użytkownika.
- **Zmienne ENV**:
    - Frontend czyta `VITE_API_URL` (backend origin bez `/api`). W dev używa proxy z `vite.config.ts`.
    - Backend CORS whitelist: `FRONTEND_URL`, `VITE_FRONTEND_URL`, `CORS_ORIGINS`, `ALLOWED_ORIGINS`.
- **CORS**: Reguły w `backend/src/server.ts`. Nie hardkoduj domen produkcyjnych – używaj list w ENV.
- **Proxy**: Odwrócone proxy zawsze dostarcza ścieżkę `/api`. Klient zawsze woła `/api/...`.

## 4. Narzędzia i Bezpieczeństwo Danych
- Używaj `rg` (ripgrep) do przeszukiwania kodu.
- Unikaj destrukcyjnych komend git (`reset --hard`).
- Nie loguj sekretów ani tokenów.
- Nie dotykaj bezpośrednio bazy danych ani backupów (Coolify) bez wyraźnej potrzeby.

## 5. Development i Build
- **Backend dev**: `npm run dev` w katalogu `backend/`.
- **Frontend dev**: `npm run dev` w głównym katalogu repozytorium.
- Uruchamiaj testy (jeśli istnieją) przed zakończeniem zadania.
