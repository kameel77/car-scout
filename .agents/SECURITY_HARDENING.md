# Security Hardening — Wytyczne MVP

Bazowe zasady zabezpieczenia infrastruktury Car Scout. Każda nowa instancja (prod, staging, dev) **musi** spełniać te wymagania.

---

## 1. Nginx — Blokowanie na Edge

### 1.1 User-Agent Blocking

W `nginx.conf` blokuj znane narzędzia do skanowania (zwracaj `444` — ciche zerwanie połączenia):

```nginx
if ($http_user_agent ~* (sqlmap|nikto|dirbuster|nessus|w3af|acunetix|masscan|zgrab|httpx|nuclei)) {
    return 444;
}
```

> [!IMPORTANT]
> **Artemis (CERT PL)** — NIE blokować. To legitymy skaner bezpieczeństwa. Zamiast tego ograniczamy go rate limitem (sekcja 1.4).

### 1.2 Blokowanie ścieżek VCS / probe / CMS

Zapobiegaj fallbackowi SPA (`try_files → /index.html`) dla ścieżek, które **nigdy** nie powinny zwracać HTML:

```nginx
# VCS directories — 404
location ~* ^/\.(git|svn|hg)(/|$) { return 404; }

# Config files — 444
location ~* (\.(env|htaccess|htpasswd|bak|sql|log)$|sftp-config\.json$|\.vscode/) { return 444; }

# WordPress/CMS probes — 444
location ~* ^/(xmlrpc\.php|wp-login\.php|wp-admin|wp-content|wp-includes) { return 444; }
location ~* ^/(wordpress|backup|wp|old|new)(/|$) { return 444; }

# Webhook/upload scanning — 444
location ~* ^/(webhook|form|upload|fileupload|file-upload|uploadfile|import|v1/upload|v2/upload)(/|$) { return 444; }

# Legacy storage paths — 404
location /storage/ { return 404; }
```

### 1.3 SQL Injection / Path Traversal w URL

Skanery bezpieczeństwa (Artemis) wysyłają **setki unikalnych URL** z zakodowanymi payloadami SQL. SPA fallback zwraca `index.html` (200) dla każdego — obciąża serwer bez powodu.

```nginx
# Regex łapiący zakodowane SQL payloads (ORDER BY, UNION SELECT, AND x=x, itp.)
location ~* ((%27|%22|%2527|%2522).*(%4F%52%44%45%52|%53%45%4C%45%43%54|%41%4E%44|%254F%2552|%2553%2545|%2541%254E)|(%27|')\s*(OR|AND|ORDER|UNION|SELECT)\s|(%2F%2F|%5C%5C|\.\./)) {
    return 404;
}
```

### 1.4 Rate Limiting

Trzy strefy w `nginx-rate-limit.conf`:

| Strefa | Rate | Burst | Gdzie | Cel |
|--------|------|-------|-------|-----|
| `general` | 10r/s | 20 | SPA routes (`/`) | Normalny ruch użytkowników |
| `api` | 30r/s | 50 | `/api/` | Zapytania API |
| `scanner` | 2r/s | 5 | SPA routes (`/`) | Ogranicza skanery (Artemis ~4-5r/s → max 2r/s) |

```nginx
limit_req_zone $rate_limit_key zone=general:10m rate=10r/s;
limit_req_zone $rate_limit_key zone=api:10m rate=30r/s;
limit_req_zone $rate_limit_key zone=scanner:10m rate=2r/s;
```

> [!WARNING]
> `$rate_limit_key` musi używać `CF-Connecting-IP` (prawdziwe IP klienta za Cloudflare), NIE `$remote_addr` (IP Cloudflare edge).

### 1.5 Autoindex

Zawsze **wyłączony** dla statycznych assetów:

```nginx
location /assets/ {
    autoindex off;
    expires 1y;
}
```

---

## 2. `robots.txt` — Kontrola botów

Plik `public/robots.txt` musi zawierać:

```
User-agent: *
Disallow: /login
Disallow: /api/
Disallow: /storage/

User-agent: YandexBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10

Sitemap: https://carsalon.pl/sitemap.xml
```

> [!NOTE]
> `robots.txt` to tylko **sugestia** — boty mogą go ignorować. Dlatego kluczowe jest połączenie z blokowaniem na poziomie Cloudflare WAF i nginx.

---

## 3. Cloudflare — WAF / Security Rules

### 3.1 Blokowanie botów (Security Rules)

| Reguła | Wyrażenie | Akcja |
|--------|-----------|-------|
| Block YandexBot | User Agent contains `YandexBot` | **Block** |

### 3.2 SSL/TLS

- Mode: **Full (Strict)** — serwer ma ważny cert Let's Encrypt
- Minimum TLS version: **1.2**

### 3.3 Managed Rules

- **Bot Fight Mode** — włączony (blokuje znane boty, np. `Claude-SearchBot`)
- **Cloudflare Managed Ruleset** — aktywny (free tier)

### 3.4 Monitorowanie (API)

Sprawdzanie statusu przez Cloudflare GraphQL API:

```bash
# Podsumowanie godzinowe — statusy HTTP
cfapi "/graphql" -X POST -d '{
  "query": "{ viewer { zones(filter: {zoneTag: \"ZONE_ID\"}) {
    httpRequests1hGroups(filter: {datetime_geq: \"START\", datetime_lt: \"END\"}, limit: 24, orderBy: [datetime_ASC]) {
      dimensions { datetime }
      sum { requests responseStatusMap { edgeResponseStatus requests } }
    }
  } } }"
}'

# Szczegóły per-request dla błędów
cfapi "/graphql" -X POST -d '{
  "query": "{ viewer { zones(filter: {zoneTag: \"ZONE_ID\"}) {
    httpRequestsAdaptiveGroups(filter: {datetime_geq: \"START\", datetime_lt: \"END\", edgeResponseStatus_in: [499, 503, 504, 521]}, limit: 50, orderBy: [datetime_ASC]) {
      dimensions { datetime edgeResponseStatus originResponseStatus userAgent clientRequestPath clientIP }
      count
    }
  } } }"
}'
```

Zone IDs: `c80cb7ceaaee3c327bcbd878f7636e2f` (carsalon.pl)

---

## 4. Docker / Traefik — Izolacja sieciowa

> Szczegóły w [DEPLOYMENT_ARCHITECTURE.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/DEPLOYMENT_ARCHITECTURE.md)

### 4.1 Kontenery — cleanup

- Po każdym deploymencie sprawdź `docker ps -a` pod kątem **osieroconych kontenerów** (bez labelek Traefik, stare wersje)
- Usuń je: `docker rm -f <name>`

### 4.2 Kody błędów Cloudflare → diagnoza

| Kod | Znaczenie | Gdzie szukać |
|-----|-----------|-------------|
| **499** | Origin nie odpowiedział, klient zamknął | nginx/SPA overload — sprawdź rate limity |
| **502** | Bad Gateway | Backend crash — sprawdź `docker logs backend` |
| **503** | Service Unavailable | Rate limit (429→503) lub backend overload |
| **504** | Gateway Timeout | Backend za wolny — sprawdź logi Prisma/Redis |
| **521** | Web Server Is Down | Traefik/nginx down — sprawdź `docker ps`, `docker restart coolify-proxy` |
| **522** | Connection Timed Out | Firewall blokuje port 443/80 — sprawdź `iptables` |
| **524** | A Timeout Occurred | Request >100s — sprawdź długie zapytania API |

---

## 5. Checklist przy nowym deploymencie

- [ ] `nginx.conf` — blokowanie UA, ścieżek VCS/CMS, SQL injection patterns
- [ ] `nginx-rate-limit.conf` — trzy strefy (general, api, scanner)
- [ ] `robots.txt` — Disallow wrażliwych ścieżek, Crawl-delay dla agresywnych botów
- [ ] Cloudflare WAF — YandexBot blocked, SSL Full (Strict)
- [ ] `docker ps -a` — brak osieroconych kontenerów
- [ ] Healthcheck — bezpośrednio na IP serwera (bypass CF) + przez Cloudflare
