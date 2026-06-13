# 🔧 Troubleshooting & Production Notes

Ten plik służy jako baza wiedzy do szybszego debugowania. Zacznij od niego gdy pojawią się problemy.

---

## 📌 Środowiska

| Środowisko | Frontend URL | Backend URL | Branch |
|---|---|---|---|
| Produkcja | https://carsalon.pl | https://carsalon.pl/api | `main` |
| Staging | https://staging.carsalon.pl | https://staging.carsalon.pl/api | `staging` |
| Dev | localhost:5173 | localhost:3000 | `dev` |

---

## 🏦 InBank — Konfiguracja Produkcyjna

### API Endpoints
| Środowisko | API | Partner Portal |
|---|---|---|
| **Test (demo)** | `https://demo-api.inbank.pl/partner/v2/` | `https://demo-partner.inbank.pl/` |
| **Produkcja** | `https://api.inbank.pl/partner/v2/` | `https://partner.inbank.pl/` |

### Dane produkcyjne (luty 2026)
- **Product Code**: `car_loan_pledge_f2f_partner_std_p6_merchant_data_in_app_sms_fir`
- **Shop UUID**: `784804bf-0196-42dc-9a28-bcae9e87cb17`
- **API Key**: `60c1c81817a7402034b861e4c6b9ee90`
- **Payment Day**: `15`
- **Response Level**: `simple`

### Ustawienia produktu InBank (admin panel)
- **Kategoria**: CREDIT
- **Nazwa**: Inbank - Kredyt samochodowy 8%
- **Waluta**: PLN
- **Zakres kwoty**: 200 – 150 000 PLN
- **Max 1. wpłata (%)**: 50 ⚠️ (było 0 — patrz Znane Błędy #1)
- **Max ost. wpłata (%)**: 50 ⚠️ (było 0 — patrz Znane Błędy #1)
- **Min. ilość rat**: 12
- **Max. ilość rat**: 84
- **Obsługa raty balonowej**: ❌ wyłączona
- **Produkt domyślny**: ✅ tak
- **Stawka ref. (%)**: 0
- **Marża (%)**: 0
- **Prowizja (%)**: 0

---

## 🐛 Znane Błędy i Rozwiązania

### #1: Pętla requestów 502 — Kalkulator finansowania (2026-02-23)

**Objawy**: 
- Strona oferty generuje dziesiątki/setki POST requestów do `/api/financing/calculate` w milisekundach
- Wszystkie zwracają 502 (Bad Gateway)
- Strona się "odświeża" / zamraża

**Przyczyny** (zidentyfikowano dwie):

1. **Ustawienia produktu — Max wpłata = 0%**
   - Gdy `maxInitialPayment = 0`, suwak wpłaty własnej ustawia się na 0%
   - `amountToFinance = price` (pełna cena pojazdu)
   - Jeśli cena samochodu > `maxAmount` produktu (np. 166 650 > 150 000), produkt jest filtrowany jako niespełniający zakresu
   - Kalkulator wybiera kolejny produkt → ten też failuje → kaskada retry
   - **FIX**: Ustawić `Max 1. wpłata` i `Max ost. wpłata` na sensowne wartości (np. 50%)

2. **Brak debounce i limitu retry w frontendzie**
   - `useEffect` wywoływał API natychmiast przy każdej zmianie `selectedProduct`
   - Każdy failed product powodował natychmiastowy fallback → nowy `selectedProduct` → nowe wywołanie
   - **FIX**: Dodano debounce 500ms + max 3 próby fallback (`FinancingCalculator.tsx`)

3. **Przejście demo → produkcja InBank API**
   - Testowe dane (apiKey, shopUuid, productCode) nie działają na produkcyjnym API
   - Backend dostaje non-OK response z InBank → zwraca 502
   - **FIX**: Zaktualizować connection + product config w admin panelu na produkcyjne dane

**Pliki dotknięte**:
- `src/components/FinancingCalculator.tsx` — debounce + retry limit
- `backend/src/routes/financing.ts` — logi debugowe + response_level w payload

### #2: Logika budowania URL InBank

Backend w `financing.ts` buduje URL tak:
```
rawBaseUrl = connection.apiBaseUrl (np. "https://api.inbank.pl/partner/v2/")
→ obcina trailing "/" → "https://api.inbank.pl/partner/v2"  
→ obcina "/partner/v2" → "https://api.inbank.pl"
→ dodaje "/partner/v2/shops/{shopUuid}/calculations"
→ wynik: "https://api.inbank.pl/partner/v2/shops/{shopUuid}/calculations"
```
Jeśli URL w admin nie zawiera `/partner/v2`, wynikowy URL może być niepoprawny.

---

## 🔍 Checklist debugowania kalkulatora finansowania

Gdy kalkulator nie działa na produkcji:

1. **Sprawdź logi backendu** — po ostatniej zmianie backend loguje:
   - `--- INBANK CALCULATE REQUEST ---` — URL, payload, apiKey, shopUuid
   - `--- INBANK CALCULATE RESPONSE ---` — status HTTP i body odpowiedzi InBank
   
2. **Sprawdź ustawienia produktu w admin panelu**:
   - [ ] `Max 1. wpłata (%)` > 0? (inaczej amountToFinance = pełna cena)
   - [ ] `maxAmount` >= typowa cena po wpłacie? 
   - [ ] `productCode` poprawny dla środowiska (demo vs prod)?
   - [ ] `paymentDay` ustawiony?

3. **Sprawdź connection w admin panelu**:
   - [ ] `apiBaseUrl` odpowiedni dla środowiska?
   - [ ] `apiKey` odpowiedni dla środowiska?
   - [ ] `shopUuid` odpowiedni dla środowiska?
   - [ ] Connection aktywna?

4. **Sprawdź w przeglądarce**:
   - [ ] DevTools → Network → filtr `calculate` — jaki status i body response?
   - [ ] Czy nie ma kaskady requestów? (powinno być max 3-4 po fixie)

### #3: DNS Collision — 504 Gateway Timeout (2026-03-18)

**Objawy**:
- Cała strona daje 504 Gateway Timeout
- Po restarcie: API (`/api/*`) zwraca 404, natomiast `/health` odpowiada poprawnie
- Backend raportuje `healthy` w Coolify, ale nie otrzymuje żadnych requestów API

**Przyczyna**: Kolizja DNS na współdzielonej sieci Docker `coolify`:
- Nginx w frontendzie proxuje `/api` do `http://backend:3000`
- Docker DNS rozwiązywał `backend` do **innego kontenera** na sieci `coolify` (IP `10.0.1.28` zamiast `10.0.11.2`)
- Inne aplikacje na tym samym serwerze Coolify też używały aliasu `backend`

**FIX**:
1. Zmieniono `BACKEND_URL` na unikalny alias: `http://<APP_UUID>-backend:3000`
2. `docker restart coolify-proxy` — Traefik stracił routing po wielokrotnych restartach

**Diagnostyka (uruchom na serwerze)**:
```bash
# Sprawdź do jakiego IP resolwuje 'backend' z wnętrza kontenera
docker exec <frontend_container> nslookup backend 127.0.0.11

# Sprawdź aliasy sieciowe kontenera
docker inspect <container> --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool | grep -B1 -A5 "Aliases"

# Test API z pominięciem DNS (bezpośrednio po IP)
docker exec <frontend_container> wget -qO- http://<backend_ip>:3000/api/settings 2>&1 | head -1
```

**Pliki dotknięte**: Brak zmian w kodzie — tylko zmiana ENV `BACKEND_URL` w Coolify UI.

> [!IMPORTANT]
> Patrz [DEPLOYMENT_ARCHITECTURE.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/DEPLOYMENT_ARCHITECTURE.md) Sekcja 10 po pełną analizę.

### #4: Traefik traci routing po wielu restartach (2026-03-18)

**Objawy**: Wiele środowisk jednocześnie daje 504 po wykonaniu restartów/redeployów.

**Przyczyna**: Coolify proxy (Traefik) gubi routing po wielokrotnym tworzeniu/usuwaniu kontenerów.

**FIX**: `docker restart coolify-proxy` na serwerze.

> [!CAUTION]
> **Zawsze po restarcie/redeployu** sprawdź WSZYSTKIE środowiska (prod, staging, dev), nie tylko to które modyfikowałeś!

---

## ⚙️ Deployment

- **Build**: Coolify buduje z Dockerfile (nie Nixpacks!)
- Backend Dockerfile: `backend/Dockerfile` — buduje TS → dist, uruchamia `node dist/server.js`
- Frontend Dockerfile: `Dockerfile` (root) — Vite build → Nginx
- Docker Compose: `docker-compose.prod.yml`
- `INBANK_BASE_URL` — env var opcjonalna, jeśli nie ustawiona używa `connection.apiBaseUrl` z bazy danych

---

### #5: Cykliczne DOWN/UP co ~1-2h (2026-03-23/24)

**Objawy**:
- Serwis przestaje odpowiadać (DOWN) i wraca po ~1h
- Wzorzec: DOWN 23:01 → UP 00:00, DOWN 01:01 → UP 02:01
- Healthcheck (Izzy) co 5 min potwierdza cykl

**Pełna diagnostyka (2026-03-24)**:

| Element | Status | Wynik |
|---------|--------|-------|
| Backend healthcheck | ✅ | `/health` odpowiada 200 cały czas (~1-2ms), zero requestów API od zewnątrz |
| Kontenery | ✅ | Żaden nie restartował się w czasie outage |
| CPU/RAM | ✅ | Frontend ~5MB, Backend ~50MB z 7.5GB — zero pressure |
| Cron jobs | ✅ | Brak |
| iptables/firewall | ✅ | INPUT ACCEPT, bez zmian |
| OOM/dmesg | ✅ | Brak wpisów |
| journalctl warnings | ✅ | "No entries" |
| Coolify scheduled jobs | ✅ | Normalne, zero deploymentów |
| Traefik logi | ⚠️ | **Puste** w czasie outage — requesty nie docierały do Traefik |
| SSL cert | ✅ | Ważny do 2026-06-09 |
| Bezpośredni curl | ✅ | `curl -I -H "Host: carsalon.pl" http://localhost` → 307 (Traefik działa) |

**Diagnoza z Cloudflare GraphQL API (2026-03-24)**:

| Godzina (UTC) | Total | 200 | 499 | 504 | 503 | 521 | Opis |
|---|---|---|---|---|---|---|---|
| 22:00 | 108 | 89 | - | - | 7 | - | ✅ Normal |
| **23:00** | **86** | **5** | **73** | **5** | - | - | 🔴 DOWN #1 — origin nie odpowiada |
| 00:00 | 74 | 68 | - | - | 1 | - | ✅ Recovery |
| **01:00** | **119** | **7** | **103** | **6** | - | - | 🔴 DOWN #2 — origin nie odpowiada |
| 02:00 | 83 | 73 | - | - | 1 | - | ✅ Recovery |
| 03:00 | 108 | 100 | - | - | 1 | - | ✅ Normal |
| **04:00** | **1063** | 310 | 1 | - | 122 | **271** | 🔴 DOWN #3 — serwer odmawia połączeń |
| **05:00** | **398** | 79 | - | - | - | **301** | 🔴 DOWN #4 — serwer odmawia połączeń |

**Kluczowe kody błędów**:
- **499** = Cloudflare połączył się z origin, ale origin **nie odpowiedział** → klient timeout
- **504** = Gateway Timeout — origin nie zwrócił odpowiedzi w czasie
- **521** = Web Server Is Down — origin **odmawia połączeń** (Traefik/Docker down)

**Root cause (DOWN #1 i #2)**: Analiza per-request pokazuje, że **YandexBot** crawluje agresywnie deep paths (3-5 requestów co ~5 sekund na ten sam URL z różnych IP). W trakcie tego origin przestaje odpowiadać → **499 dla wszystkich klientów** w tym Izzy (`service-monitor/1.0`, IP `2a01:4f9:c012:82f::1`).

**Root cause (DOWN #3 i #4, 04:00-05:00)**: `521 Web Server Is Down` = Traefik/Docker **kompletnie niedostępny**. To może być restart/redeploy serwisów lub problem sieciowy na Hetzner.

**Usunięto** osierocony kontener `frontend-bgsk44088o808oscs8k0sgog` (z 17.03, 6 dni UP, bez labelek Traefik).

**Wdrożone środki zaradcze** (2026-03-24):
1. **nginx.conf**: Blokowanie Artemis scanner, `/storage/` → 404, CMS probe paths → 444
2. **robots.txt**: `Disallow` wrażliwych ścieżek; `Crawl-delay: 10` dla YandexBot/SemrushBot
3. Usunięto osierocony kontener frontend

> [!IMPORTANT]
> **Krytyczne następne kroki**:
> 1. **Zablokuj YandexBot** na poziomie Cloudflare WAF (reguła Security Rule) — to główna przyczyna DOWN #1/#2
> 2. **Zbadaj przyczynę 521** o 04:00-05:00 UTC — `docker ps -a` pokaże czy kontenery się restartowały
> 3. Zmień SSL mode z Full na **Full (Strict)** — masz ważny cert LE

---

## 📝 Historia zmian (chronologicznie)

| Data | Problem | Rozwiązanie | Branch |
|---|---|---|---|
| 2026-02-23 | Pętla 502 requestów kalkulatora | Debounce 500ms + max 3 retry + logi InBank | staging |
| 2026-02-23 | Max wpłata = 0% powoduje złe filtrowanie | Zmieniono na 50% w admin panelu | n/a (DB) |
| 2026-03-18 | 504 Gateway Timeout - DNS collision | Zmieniono `BACKEND_URL` na `${APP_UUID}-backend:3000` | n/a (Coolify ENV) |
| 2026-03-18 | Traefik stracił routing po restartach | `docker restart coolify-proxy` | n/a (serwer) |
| 2026-03-24 | Cykliczne DOWN/UP + agresywne boty | Hardening nginx + robots.txt | dev |
| 2026-04-11 | 504/502 - Traefik Docker provider wrong network | Dodano `--providers.docker.network=coolify` do compose proxy + stop privacy4cars container | n/a (serwer) |
| 2026-06-13 | Biały screen na motolia.pl - DNS collision | Dodano unikalny alias frontendu na sieci coolify i zaktualizowano INTERNAL_FRONTEND_URL | dev |

---

### #6: Traefik Docker Provider — Wrong Network IP (2026-04-11)

**Objawy**:
- `carsalon.pl`, `staging.carsalon.pl`, `askauto.de` → 504 (via Cloudflare) / 502 (direct)
- `crm.carsalon.pl`, `admin.izzylease.com`, `uploader.izzylease.com` → działają normalnie
- Backend i frontend healthcheck OK, kontenery healthy

**Przyczyna**: Traefik Docker provider bez `--providers.docker.network` losowo wybierał IP z jednej z wielu sieci Docker. Frontendowe kontenery są na 3 sieciach (`compose-default`, `carscout-private`, `coolify`). Traefik ma dostęp tylko do `coolify` → gdy wybrał IP z `carscout-private` → timeout → 502/504.

Dodatkowy czynnik: kontener `privacy4cars` z niezresolwanymi labelkami Traefik (`${SERVICE_FQDN_WEB}`) zatruwał logi ACME.

**Dlaczego CRM działał**: CRM miał explicite service labels (`traefik.http.services.*.loadbalancer.server.port`), frontendowe kontenery polegały na auto-detection.

**FIX**:
1. Dodano `--providers.docker.network=coolify` do `/data/coolify/proxy/docker-compose.yml`
2. `cd /data/coolify/proxy && docker compose up -d --force-recreate`
3. `docker stop web-eko0go8oo8gg0cks8gsc4koc-185112351318` (privacy4cars)

**Pułapka debugowania**: Nginx blokuje `curl/7` i `curl/8` UA z `return 444` (silent drop). Wszystkie testowe `curl` z serwera zwracały fałszywe 502, choć strona działała dla przeglądarek. **Zawsze używaj `wget` lub dodaj `-H "User-Agent: Mozilla/5.0"` do curl.**

> [!CAUTION]
> **`--providers.docker.network=coolify` jest OBOWIĄZKOWY** w każdym środowisku Coolify z kontenerami na wielu sieciach Docker. Jeśli Coolify zregeneruje `docker-compose.yml` proxy → trzeba go ponownie dodać!

**Pliki dotknięte**: Brak zmian w kodzie — tylko konfiguracja Traefik proxy na serwerze.

> [!IMPORTANT]
> Patrz [DEPLOYMENT_ARCHITECTURE.md](file:///Users/kamiltonkowicz/Documents/Coding/github/car-scout/.agents/DEPLOYMENT_ARCHITECTURE.md) Sekcja 11 po pełną analizę.

---

## 🚨 Playbook: Diagnostyka 504/502

Uniwersalny szablon do uruchomienia **w tej kolejności** przy każdym incydencie 504/502:

```bash
# 1. Skąd problem? Cloudflare czy origin?
# Użyj cfapi lub sprawdź analytics z Cloudflare Dashboard
# 504 = origin timeout, 521 = origin down, 503 = Traefik catchall

# 2. Czy Traefik widzi serwisy i na jakim IP?
ssh izzy-apps 'docker exec coolify-proxy wget -qO- http://localhost:80/api/http/services 2>/dev/null' | \
  python3 -c "import sys,json; [print(f'{s[\"name\"]}: {s.get(\"loadBalancer\",{}).get(\"servers\",[{}])[0].get(\"url\",\"?\")} ({s.get(\"serverStatus\",{})})') for s in json.load(sys.stdin) if s.get('provider')=='docker']"
# → Wszystkie powinny być na 10.0.1.x (coolify). Jeśli na 10.0.7.x/10.0.11.x → wrong network!

# 3. Bezpośredni test z serwera (UWAGA: curl jest blokowany!)
ssh izzy-apps 'wget -qO- --timeout=5 http://10.0.1.X:80/ | head -1'
# LUB z browser UA:
ssh izzy-apps 'curl -sk --resolve "carsalon.pl:443:127.0.0.1" -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Mozilla/5.0" https://carsalon.pl/'

# 4. Sprawdź sieci kontenerów
ssh izzy-apps 'docker inspect <container> --format "{{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}: {{\$v.IPAddress}}{{\"\\n\"}}{{end}}"'

# 5. Czy --providers.docker.network jest ustawiony?
ssh izzy-apps 'docker inspect coolify-proxy --format "{{.Args}}" | grep -o "providers.docker.network=[^ ]*"'
# Jeśli brak → dodaj i recreate proxy!

# 6. Logi Traefik (szukaj error/502/EOF)
ssh izzy-apps 'docker logs coolify-proxy --since 60s 2>&1 | grep -i "error\|502\|eof\|dial\|refused" | tail -10'

# 7. Po naprawie: zweryfikuj WSZYSTKIE środowiska
for domain in carsalon.pl staging.carsalon.pl askauto.de staging.askauto.de crm.carsalon.pl motolia.pl; do
  echo -n "$domain: "
  curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: Mozilla/5.0" "https://$domain/"
  echo
done
```

---

### #8: DNS Collision on Shared Network - frontend Template Mismatch (2026-06-13)

**Objawy**:
- Biały screen na stronie głównej `motolia.pl` (lub innych podstronach).
- HTML ładuje się poprawnie (status 200), ale zwraca stare/nieistniejące nazwy plików JS/CSS (np. `/assets/index-BEPF2Ruj.js` zwracający 404).
- Nowo zbudowany i uruchomiony kontener frontend ma w rzeczywistości inne nazwy plików w `/usr/share/nginx/html/assets/` (np. `index-DwB2pNyS.js`).

**Przyczyna**:
1. Backend w `render.ts` pobiera `index.html` z kontenera frontend przy użyciu zmiennej `INTERNAL_FRONTEND_URL` (domyślnie `http://frontend:80`).
2. Ponieważ kontener backendu jest podłączony zarówno do prywatnej sieci, jak i do współdzielonej sieci `coolify`, Docker DNS rozwiązuje nazwę hosta `frontend` niejednoznacznie.
3. Obie instancje (staging i production) rejestrują nazwę usługi `frontend` jako alias na sieci `coolify`.
4. W efekcie backend produkcyjny pobrał i zapisał w pamięci cache szablon `index.html` z kontenera stagingowego (który odwoływał się do starych plików JS/CSS). Klient pobierając stronę dostawał stary HTML, ale jego zapytania o pliki statyczne trafiały do produkcyjnego Nginxa, który ich nie posiadał (stąd błąd 404 i biały ekran).

**FIX**:
1. W `docker-compose.coolify.yml` dodano unikalny alias dla frontendu na sieci `coolify`:
   ```yaml
         coolify:
           aliases:
             - "${COMPOSE_PROJECT_NAME}-frontend"
   ```
2. Zaktualizowano domyślną wartość `INTERNAL_FRONTEND_URL` w `docker-compose.coolify.yml` na `http://${COMPOSE_PROJECT_NAME}-frontend:80`.
3. Na serwerze `hetzner-motolia` zaktualizowano plik compose i `.env` w `/data/coolify/applications/b78hl34lxvjq5m2fqhm3amy0/`, ustawiając `INTERNAL_FRONTEND_URL=http://b78hl34lxvjq5m2fqhm3amy0-frontend:80` oraz dodając alias sieciowy.
4. Wykonano `docker compose up -d --force-recreate` w katalogu aplikacji produkcyjnej.
