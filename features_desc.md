# Opisy funkcjonalności

Ten plik dokumentuje działanie kluczowych funkcjonalności aplikacji w przystępny, produktowy sposób.
Każda nowa funkcjonalność lub zmiana zachowania istniejącej powinna mieć tutaj krótki opis.

## 1. Cena specjalna dla Ciebie (parametr `offer`)
- **Cel**: personalizowana oferta cenowa, która wygląda na przygotowaną indywidualnie dla użytkownika.
- **Wejście**: link z parametrem `offer`, który zawiera zakodowaną wartość rabatu (np. base64url z `offerDiscount=5000`).
- **Szyfrowanie**: base64url (proste, odwracalne kodowanie tekstu dla ukrycia wartości liczbowej w URL).
- **Format linku**:
  - `https://twoja-domena.pl/?offer=<BASE64URL>` (np. `https://twoja-domena.pl/?offer=b2ZmZXJEaXNjb3VudD01MDAw`)
  - `https://twoja-domena.pl/listing/<ID>?offer=<BASE64URL>`
- **Zachowanie**:
  - Po wejściu w URL, frontend odczytuje parametr `offer`, dekoduje rabat i zapisuje go w cookie z maksymalnym czasem życia.
  - Rabat jest uwzględniany we wszystkich widokach cen (lista, karta, lead, kalkulator finansowania).
  - Na karcie pojazdu pojawia się tag „Oferta dla Ciebie” (pomarańczowy), który po kliknięciu odświeża widok, aby ponownie zastosować ustawienia rabatu.
  - Przy odświeżeniu strony aplikacja wczytuje rabat z cookie i utrzymuje spójne wartości cen/rat.

### Prompt dla CRM (tworzenie i „hasłowanie” linku)
Poniższy prompt możesz wkleić do narzędzia/automatyzacji w CRM, aby generować linki z rabatem:

```
Twoim zadaniem jest wygenerowanie linku do aplikacji z zaszyfrowanym parametrem `offer`.

Wejście:
- baseUrl: pełny adres strony (np. https://twoja-domena.pl lub https://twoja-domena.pl/listing/12345)
- discountPln: wartość rabatu w PLN (liczba całkowita, np. 5000)

Zasady:
1) Zbuduj tekst payload: "offerDiscount=<discountPln>".
2) Zakoduj payload w base64url:
   - najpierw standardowe Base64 z UTF-8,
   - usuń znaki "=" z końca,
   - zamień "+" na "-" oraz "/" na "_".
3) Dodaj parametr `offer=<BASE64URL>` do URL:
   - jeśli baseUrl ma już query string, dodaj "&offer=...".
   - jeśli nie ma query string, dodaj "?offer=...".

Wyjście:
- finalUrl: poprawny URL z parametrem `offer`.

Przykład:
baseUrl: https://twoja-domena.pl/
discountPln: 5000
payload: offerDiscount=5000
base64url: b2ZmZXJEaXNjb3VudD01MDAw
finalUrl: https://twoja-domena.pl/?offer=b2ZmZXJEaXNjb3VudD01MDAw
```

## 2. Produkty kredytowe z integracjami instytucji finansowych
- **Cel**: umożliwienie administratorowi dodawania produktów kredytowych od wielu partnerów (np. Inbank) oraz sterowanie tym, który produkt jest widoczny na karcie oferty.
- **Zasada działania**:
  - Administrator wybiera partnera finansowego podczas dodawania nowego produktu kredytowego.
  - Dla integracji bankowych (np. Inbank) wysokość raty jest liczona na podstawie wywołań API partnera.
  - Dla „Produktu własnego” używany jest dotychczasowy, lokalny mechanizm kalkulacji.
  - Widoczność produktów na karcie oferty jest konfigurowalna w panelu administratora jako **lista z priorytetem i warunkami** (np. zakres kwoty finansowania = cena sprzedaży minus pierwsza wpłata).
  - Gdy integracja bankowa nie zwróci kalkulacji (błąd/timeout), system **automatycznie przełącza się na „Produkt własny”**.
  - Integracje mogą wymagać różnego zakresu danych wejściowych — każdy partner ma własny adapter mapujący dane z kalkulatora.
- **Konfiguracja połączeń**:
  - Dostępny jest moduł konfiguracji połączeń z instytucjami (docelowe środowisko produkcyjne i klucze).
  - Konfiguracja przechowuje dane niezbędne do autoryzacji i obsługi API dla każdego partnera.
- **Wymagane dane dla Inbank (przykład)**:
  - `productCode` (z konfiguracji produktu)
  - `amount` = cena sprzedaży minus pierwsza wpłata
  - `period` (z kalkulatora)
  - `paymentDay` (z konfiguracji produktu)
  - `downPaymentAmount` (z kalkulatora)
  - `currency` (np. PLN, z konfiguracji produktu)
  - `responseLevel` (np. `simple`, z konfiguracji produktu)

## 3. Integracja VASH (Vehis Tools) dla kalkulacji leasingu
- **Cel**: obsługa zewnętrznych kalkulacji leasingowych (VASH) obok produktów własnych i Inbank, z możliwością użycia danych pojazdów z VASH jako źródła kalkulacji.
- **Konfiguracja w panelu**:
  - Administrator dodaje połączenie „Vehis” z danymi logowania (email/hasło) oraz bazowym URL API.
  - Dostępny jest test połączenia, który weryfikuje poprawność logowania przez `/login`.
  - Produkt „Vehis leasing” jest dostępny jako jeden z produktów leasingowych i może być oznaczony jako domyślny.
- **Źródło danych**:
  - Wyszukanie pojazdu po fragmencie nazwy przez `/broker/search` lub pobranie listy przez `/broker/subjects` w celu uzyskania `subjectId` i szczegółów pojazdu.
  - `subjectId` staje się kluczowym identyfikatorem do dalszych wyliczeń.
- **Zakresy opłat**:
  - Endpoint `/broker/calculation/value/{subjectId}` zwraca dopuszczalne zakresy opłaty wstępnej oraz wykupu dla danego pojazdu.
  - Te wartości powinny zasilać ograniczenia sliderów w kalkulatorze leasingu (min/max/default).
- **Kalkulacja rat**:
  - Endpoint `/broker/calculate` wylicza ratę na podstawie:
    - `client`: `consumer` lub `entrepreneur` (mapowanie na typ klienta w aplikacji),
    - `initialFee`: procent opłaty wstępnej,
    - `repurchase`: procent wykupu,
    - `duration`: okres w miesiącach (36/48/60),
    - `cars`: lista aut z parametrami `state` (nowe/używane), `manufacturing_year`, `price`.
  - Do wyliczenia raty endpoint `/broker/calculate` **nie wymaga `subjectId`** — jest używany tylko do pobrania zakresów opłat w `/broker/calculation/value/{subjectId}`.
- **Autoryzacja**:
  - Token uzyskiwany przez `/login` z `email` i `password` (token przechowywany bezpiecznie, np. w cache z TTL).
  - Każde zapytanie do API VASH wymaga nagłówka autoryzacyjnego z tokenem.
- **Obsługa błędów i fallback**:
  - Przy błędach API VASH kalkulator powinien przełączać się na produkt własny (analogicznie do obecnego fallbacku Inbank).
  - Logika retry i krótkie cache’owanie odpowiedzi ograniczy liczbę wywołań i opóźnienia.

## 4. Konfiguracja proxy API frontendu przez zmienne srodowiskowe
- **Cel**: umozliwienie wdrozen z roznymi adresami backendu (Coolify, docker-compose) bez zmian w kodzie frontendu.
- **Zachowanie**:
  - Obraz frontendu podstawia adres backendu w konfiguracji Nginx przez zmienna `BACKEND_URL`.
  - Domyslna wartosc to `http://backend:3000`, co pasuje do srodowiska docker-compose.
  - W srodowiskach zarzadzanych (np. Coolify) `BACKEND_URL` powinien wskazywac na wewnetrzny adres backendu.

## 5. Ukrycie znacznika "Najniższa cena z 30 dni"
- **Cel**: uproszczenie karty oferty przez usunięcie znacznika informującego o najniższej cenie z 30 dni.
- **Zachowanie**:
  - Znacznik nie jest renderowany ani w widoku mobilnym, ani w bocznej karcie ceny.

## 6. Sekcja "Dlaczego my" na stronie oferty
- **Cel**: wzmocnienie zaufania klienta przez przedstawienie powodów wyboru oferty.
- **Zachowanie**:
  - Sekcja pojawia się na stronie oferty nad FAQ.
  - Składa się z czterech kafelków z ikonami i krótkim opisem.

## 7. Integracja CRM/CMS: identyfikacja klienta i tracking odwiedzonych URL
- **Cel**: powiązanie anonimowej aktywności w aplikacji z klientem CRM poprzez zaszyfrowany link oraz udostępnienie historii odwiedzin w CMS.
- **Wejście**: link z parametrem zawierającym zaszyfrowany payload (analogicznie do `offer`) rozszerzony o UUID klienta z CRM oraz parametr kalkulatora pierwszej wpłaty.
- **Format linku (przykład)**:
  - Parametr URL ma nazwę `offer` (taka sama struktura jak wcześniej) i przenosi zakodowany payload w base64url.
  - `https://carsalon.pl/?offer=<BASE64URL>` lub `https://carsalon.pl/listing/<ID>?offer=<BASE64URL>`
  - Payload przykładowy: `offerDiscount=<wartość>&uuid=<UUID>` zakodowany w base64url.
- **Zachowanie**:
  - Frontend dekoduje payload, używa `offerDiscount` do ustawienia wartości pierwszej wpłaty oraz zapisuje `uuid` i identyfikator sesji śledzenia w cookie z maksymalnym czasem życia.
  - Podczas nawigacji aplikacja zapisuje do cookie (lub synchronizuje z backendem) odwiedzane URL-e i timestampy.
  - Backend udostępnia API do pobrania historii odwiedzin na podstawie UUID klienta, aby CMS mógł pobrać dane do dalszej analizy.
