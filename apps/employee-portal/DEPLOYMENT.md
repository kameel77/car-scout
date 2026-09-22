# Benefivo & Employee Portal Deployment Guide (Coolify)

Ten dokument opisuje architekturę wdrożenia i konfigurację produkcyjną dla platformy **Benefivo** (`benefivo.pl`) oraz portalu pracowniczego (`apps/employee-portal`).

## 1. Architektura Wdrożenia (Frontend-Only & Static Prerender)
- **Domena główna**: `benefivo.pl` (oraz `www.benefivo.pl` przekierowane na `benefivo.pl`, chronione przez Cloudflare Edge SSL).
- **Środowisko staging/dev**: `staging.benefivo.pl` lub `pracownicy-dev.motolia.pl`.
- **Rodzaj wdrożenia**: Zoptymalizowany kontener Nginx serwujący:
  1. Wstępnie wygenerowane podstrony statyczne HTML z unikalnymi meta tagami SEO/OpenGraph (`/`, `/dla-firm`, `/regulamin`, `/prywatnosc`).
  2. Dynamiczną konfigurację runtime (`/runtime-config.json`) wstrzykiwaną przy starcie kontenera.
  3. Dynamiczny plik `robots.txt` generowany na podstawie flagi `INDEXING_ENABLED`.
  4. Pełną aplikację React SPA dla tras aplikacji wewnętrznej (`/logowanie`, `/katalog`, `/najem`, `/zapytania`).
- **Połączenie z backendem**: Łączy się do istniejącego backendu Motolia na współdzielonej sieci Docker `coolify` (np. `http://motolia-prod-backend:3000` lub `http://carscout-prod-backend:3000`).
- **Zero duplikacji sesji**: Wspólne mechanizmy sesyjne, brak osobnej bazy danych - pełna integracja z API i CRM Motolia.

## 2. Kluczowe Zasady Bezpieczeństwa & Nginx
1. **CSRF & Header `Host`**: Nginx przekazuje nagłówek `$host` nienaruszony (`proxy_set_header Host $host;`) do upstreamu, co umożliwia poprawną weryfikację rygorystycznych reguł CSRF i Origin.
2. **Same-Origin API Prefix**: Klient SPA odpytuje wyłącznie `/api/...` na własnym originie (`PORTAL_API_URL=/api`), a Nginx przekazuje ruch do backendu.
3. **Cloudflare Turnstile**: Formularz leada B2B na `/dla-firm` chroniony jest przez Cloudflare Turnstile. Przy włączonym indeksowaniu (`INDEXING_ENABLED=true`), skrypt startowy kontenera weryfikuje obecność produkcyjnego klucza witryny (fail-safe przed startem z kluczem testowym).
4. **Rate Limiting w Nginx**:
   - Limit zapytań dla stron HTML: `rate=60r/s`, `burst=150 nodelay`.
   - Ścieżki `/assets/` (haszowane chunki Vite z 1 rokiem cache immutable) i `/static/` (fonty WOFF2, loga, obrazy z rewalidacją cache) są zwolnione z limitowania rate-limit dla zapewnienia szybkiego LCP.
   - Brand book i pliki PDF chronione są nagłówkiem `X-Robots-Tag: noindex`.
5. **Secure Cookies & TLS**: Ciasteczka sesyjne przesyłane są w relacji same-origin z atrybutami `HttpOnly`, `SameSite=Lax` i `Secure` na brzegu Cloudflare.
6. **Brak sekretów**: Frontend jest w 100% statyczny z runtime configiem - klucze prywatne (np. `TURNSTILE_SECRET_KEY`) znajdują się wyłącznie w ENV backendu.

## 3. Konfiguracja w Coolify

### Konfiguracja zasobu dla `benefivo.pl`:
- **Nazwa projektu / zasobu**: `benefivo-frontend`
- **Typ aplikacji**: Dockerfile (lub Docker Compose `apps/employee-portal/docker-compose.portal.yml`)
- **Docker Compose / Dockerfile Location**: `apps/employee-portal/Dockerfile`
- **Base Directory**: `apps/employee-portal`
- **Exposed Port**: `80`
- **Domena**: `https://benefivo.pl, https://www.benefivo.pl`

### Zmienne środowiskowe kontenera portalu (Coolify UI - Frontend):
| Zmienna | Przykładowa wartość | Opis |
|---|---|---|
| `BACKEND_URL` | `http://carscout-prod-backend:3000` | Adres wewnętrzny backendu na sieci `coolify` |
| `PORTAL_ORIGIN` | `https://benefivo.pl` | Kanoniczny origin portalu podstawiany do sitemap.xml i tagów canonical |
| `INDEXING_ENABLED` | `true` | Gdy `true`, generuje `Allow: /` w `robots.txt` oraz wymaga produkcyjnego klucza Turnstile |
| `TURNSTILE_SITE_KEY` | `0x4AAAAAAA...` | Klucz publiczny widgetu Cloudflare Turnstile dla domeny `benefivo.pl` |
| `ANALYTICS_ENABLED` | `true` | Aktywuje cookieless telemetry do `/api/analytics/event` |
| `PORTAL_BRAND_NAME` | `Benefivo` | Nazwa programu benefitowego |
| `PORTAL_BRAND_LOGO_URL`| `/static/logo-dark.svg` | Ścieżka do logo |
| `PORTAL_URL` | `https://benefivo.pl` | Adres bazowy aplikacji |
| `PORTAL_API_URL` | `/api` | Relatywna ścieżka do API (same-origin) |

### Zmienne środowiskowe backendu (Coolify UI - Backend API):
| Zmienna | Wartość produkcyjna | Opis |
|---|---|---|
| `EMPLOYEE_PORTAL_URL` | `https://benefivo.pl` | Bazowy URL portalu pracowniczego, używany do generowania linków resetu hasła (`/reset-hasla?token=...`) |
| `FRONTEND_URL` | `https://motolia.pl` | Główny adres panelu CRM backoffice, używany w powiadomieniach o leadach B2B do odnośników `/admin/leads/:id` |
| `TURNSTILE_SECRET_KEY` | `0x4AAAAAAA...` | Prywatny klucz Cloudflare do weryfikacji zgłoszeń formularza B2B |
| `CORS_ORIGINS` | `https://benefivo.pl,https://www.benefivo.pl,https://motolia.pl` | Whitelist dozwolonych domen dla zapytań CORS z przeglądarki |
| `BENEFIVO_LEAD_RECIPIENT_EMAIL` | `b2b@benefivo.pl` (lub adres skrzynki kolejki w Thulium) | Dedykowany adres e-mail dla zgłoszeń B2B programu pracowniczego (`employer_b2b`). Gdy ustawiony, powiadomienia trafiają prosto na tę skrzynkę (np. powiązaną z kolejką Benefivo B2B w Thulium) zamiast do domyślnego odbiorcy z AppSettings. |

## 4. Weryfikacja lokalna i testy kontenera

1. Budowa lokalna aplikacji:
   ```bash
   cd apps/employee-portal
   npm run build
   ```
   *Skrypt wygeneruje statyczne podstrony: `index.html`, `dla-firm.html`, `regulamin.html`, `prywatnosc.html`.*

2. Testy jednostkowe i integracyjne:
   ```bash
   npm test
   npx tsc --noEmit
   ```

3. Budowa obrazu Docker:
   ```bash
   docker build -t benefivo-portal:latest .
   ```

4. Uruchomienie testowe z symulacją produkcji:
   ```bash
   docker run -d --name benefivo-test -p 8080:80 \
     -e BACKEND_URL=http://host.docker.internal:3000 \
     -e PORTAL_ORIGIN=https://benefivo.pl \
     -e INDEXING_ENABLED=true \
     -e TURNSTILE_SITE_KEY=1x00000000000000000000AA \
     -e PORTAL_BRAND_NAME="Benefivo" \
     benefivo-portal:latest
   ```

5. Testy kluczowych odpowiedzi HTTP:
   - `curl -i http://localhost:8080/health` -> `200 OK`
   - `curl -i http://localhost:8080/robots.txt` -> `User-agent: *\nAllow: /\nSitemap: https://benefivo.pl/sitemap.xml`
   - `curl -i http://localhost:8080/dla-firm` -> `200 OK` (zawiera pre-renderowane tagi canonical i OpenGraph dla B2B)
   - `curl -i http://localhost:8080/regulamin` -> `200 OK`
   - `curl -i http://localhost:8080/prywatnosc` -> `200 OK`
   - `curl -i http://localhost:8080/dla-firm/` -> `301 Moved Permanently` (Location: `/dla-firm`)
