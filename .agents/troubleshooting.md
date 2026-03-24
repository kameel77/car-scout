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
- Healthcheck co 5 min potwierdza cykl

**Podejrzane przyczyny** (do dalszej diagnozy):
- Agresywny crawl botów (YandexBot co 2-5 min, Artemis CERT PL ~100+ req/s z SQL injection payloads)
- `/storage/media/` paths serwowane jako SPA (562B index.html) zamiast 404 — boty crawlują nieistniejące zasoby
- Brak `Crawl-delay` w robots.txt — boty nie są ograniczane

**Wdrożone środki zaradcze** (2026-03-24):
1. **nginx.conf**: Dodano blokowanie Artemis scanner (UA), `/storage/` → 404, `/wordpress/`+`/backup/`+`/wp/`+`/old/`+`/new/` → 444, `autoindex off` dla `/assets/`
2. **robots.txt**: Dodano `Disallow` dla `/login`, `/api/`, `/nowy/podglad/`, `/storage/`; `Crawl-delay: 10` dla YandexBot i SemrushBot
3. Dodano `Sitemap: https://carsalon.pl/sitemap.xml`

**Pliki dotknięte**: `nginx.conf`, `public/robots.txt`

> [!WARNING]
> Jeśli cykliczne DOWN/UP się powtórzy po wdrożeniu, sprawdź logi backendu pod kątem memory leak lub connection pool exhaustion (Prisma/Redis).

---

## 📝 Historia zmian (chronologicznie)

| Data | Problem | Rozwiązanie | Branch |
|---|---|---|---|
| 2026-02-23 | Pętla 502 requestów kalkulatora | Debounce 500ms + max 3 retry + logi InBank | staging |
| 2026-02-23 | Max wpłata = 0% powoduje złe filtrowanie | Zmieniono na 50% w admin panelu | n/a (DB) |
| 2026-03-18 | 504 Gateway Timeout — DNS collision | Zmieniono `BACKEND_URL` na `${APP_UUID}-backend:3000` | n/a (Coolify ENV) |
| 2026-03-18 | Traefik stracił routing po restartach | `docker restart coolify-proxy` | n/a (serwer) |
| 2026-03-24 | Cykliczne DOWN/UP + agresywne boty | Hardening nginx + robots.txt | dev |
