# Employee Portal Deployment Guide (Coolify)

Ten dokument opisuje architekturę wdrożenia i konfigurację produkcyjną/stagingową dla **Employee Portal** (`apps/employee-portal`).

## 1. Architektura Wdrożenia (Frontend-Only)
- **Domena docelowa dev**: `pracownicy-dev.motolia.pl` (zabezpieczona przez Cloudflare Edge SSL).
- **Rodzaj wdrożenia**: Dedykowany frontend Nginx serwujący aplikację React SPA + dynamiczną konfigurację runtime (`/runtime-config.json`).
- **Połączenie z backendem**: Łączy się do istniejącego backendu na współdzielonej sieci Docker `coolify` (np. `http://motolia-dev-backend:3000` lub `http://carscout-dev-backend:3000`).
- **Zero duplikacji**: Brak osobnej bazy danych i brak procesów backendowych – pełna izolacja i wykorzystanie istniejącego dev backendu.

## 2. Kluczowe Zasady Bezpieczeństwa & Nginx
1. **CSRF & Header `Host`**: Nginx przekazuje nagłówek `$host` nienaruszony (`proxy_set_header Host $host;`) do upstreamu, co umożliwia poprawną weryfikację rygorystycznych reguł CSRF i Origin.
2. **Same-Origin API Prefix**: Klient SPA odpytuje wyłącznie `/api/...` na własnym originie (`PORTAL_API_URL=/api`), a Nginx przekazuje ruch do backendu.
3. **Secure Cookies & TLS**: Ciasteczka sesyjne przesyłane są w relacji same-origin z atrybutami `HttpOnly`, `SameSite=Lax/Strict` i `Secure` na brzegu Cloudflare.
4. **Brak sekretów**: Frontend jest w 100% statyczny z runtime configiem – żadne klucze ani sekrety nie są wstrzykiwane ani kompilowane do bundla.

## 3. Konfiguracja w Coolify
Przy tworzeniu nowego zasobu w Coolify dla `pracownicy-dev.motolia.pl`:

- **Nazwa projektu / zasobu**: `motolia-employee-portal-dev`
- **Typ aplikacji**: Dockerfile (lub Docker Compose wskazanym na `apps/employee-portal/docker-compose.portal.yml`)
- **Docker Compose / Dockerfile Location**: `apps/employee-portal/Dockerfile` (lub compose `apps/employee-portal/docker-compose.portal.yml`)
- **Base Directory**: `apps/employee-portal`
- **Exposed Port**: `80`
- **Domena**: `https://pracownicy-dev.motolia.pl`

### Zmienne środowiskowe kontenera portalu (Coolify UI - Frontend):
| Zmienna | Przykładowa wartość | Opis |
|---|---|---|
| `BACKEND_URL` | `http://motolia-dev-backend:3000` | Adres istniejącego kontenera backendu na sieci `coolify` |
| `PORTAL_BRAND_NAME` | `Program Samochodowy by Motolia` | Dynamiczna nazwa marki |
| `PORTAL_BRAND_LOGO_URL`| `/logo.svg` | URL do logo |
| `PORTAL_URL` | `https://pracownicy-dev.motolia.pl` | Główny URL portalu |
| `PORTAL_API_URL` | `/api` | Relatywna ścieżka do API (same-origin) |
| `COMPOSE_PROJECT_NAME` | `motolia-employee-portal-dev` | Nazwa instancji / kontenera |

### Zmienne środowiskowe backendu (Coolify UI - Backend API):
| Zmienna | Przykładowa wartość | Opis |
|---|---|---|
| `EMPLOYEE_PORTAL_URL` | `https://pracownicy-dev.motolia.pl` | Bazowy URL portalu pracowniczego, używany m.in. do linków resetu hasła pracownika (`/reset-hasla?token=...`) |
| `PORTAL_BRAND_NAME` | `Program Samochodowy by Motolia` | Opcjonalna nazwa programu/marki wykorzystywana w szablonach powiadomień e-mail (reset hasła, potwierdzenia zapytań) |

## 4. Weryfikacja lokalna (Smoke Test)
1. Budowa obrazu:
   ```bash
   cd apps/employee-portal
   docker build -t employee-portal:dev .
   ```
2. Uruchomienie testowe:
   ```bash
   docker run -d --name employee-portal-test -p 8080:80 \
     -e BACKEND_URL=http://motolia-dev-backend:3000 \
     -e PORTAL_BRAND_NAME="Motolia Pracownicy" \
     employee-portal:dev
   ```
3. Testy endpointów:
   - `curl -i http://localhost:8080/health` -> `200 OK`
   - `curl -i http://localhost:8080/runtime-config.json` -> `200 OK` (JSON z `brandName` i `apiUrl: "/api"`)
   - `curl -i http://localhost:8080/logowanie` -> `200 OK` (SPA fallback `index.html`)
