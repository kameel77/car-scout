# 🔧 Troubleshooting & Production Notes

Ten plik służy jako baza wiedzy do szybszego debugowania. Zacznij od niego gdy pojawią się problemy.

---

## 📌 Środowiska

| Środowisko | Frontend URL | Backend URL | Branch |
|---|---|---|---|
| Produkcja | https://carsalon.pl | https://carsalon.pl/api | `main` |
| Staging | (staging URL) | (staging URL)/api | `staging` |
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

---

## ⚙️ Deployment

- **Build**: Coolify buduje z Dockerfile (nie Nixpacks!)
- Backend Dockerfile: `backend/Dockerfile` — buduje TS → dist, uruchamia `node dist/server.js`
- Frontend Dockerfile: `Dockerfile` (root) — Vite build → Nginx
- Docker Compose: `docker-compose.prod.yml`
- `INBANK_BASE_URL` — env var opcjonalna, jeśli nie ustawiona używa `connection.apiBaseUrl` z bazy danych

---

## 📝 Historia zmian (chronologicznie)

| Data | Problem | Rozwiązanie | Branch |
|---|---|---|---|
| 2026-02-23 | Pętla 502 requestów kalkulatora | Debounce 500ms + max 3 retry + logi InBank | staging |
| 2026-02-23 | Max wpłata = 0% powoduje złe filtrowanie | Zmieniono na 50% w admin panelu | n/a (DB) |
