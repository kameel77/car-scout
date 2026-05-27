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

## 8. Nowa struktura URL dla ofert (SEO-friendly)
- **Cel**: poprawa SEO i czytelności URL-i dla ofert pojazdów.
- **Zmiana**:
  - Stary format: `/listing/<ID>` (np. `/listing/clh123abc456`)
  - Nowy format: `/oferta/marka-model-trim-rocznik-typ-paliwo-id_ogloszenia` (np. `/oferta/bmw-3-series-320d-xdrive-2020-sedan-diesel-clh123abc456`)
- **Zachowanie**:
  - Wszystkie nowe linki generowane przez aplikację używają nowego formatu.
  - Stary format `/listing/:id` nadal działa (backward compatibility) - obsługiwany przez ten sam komponent.
  - Przy imporcie CSV automatycznie generowany jest slug dla każdej oferty.
  - Slug zawiera: markę, model, wersję/trim, rocznik, typ nadwozia, rodzaj paliwa oraz ID oferty.
  - Polskie znaki są transliterowane do ASCII (np. 'ł' → 'l', 'ą' → 'a').
  - Wielokrotne spacje i myślniki są normalizowane.
- **API**:
  - Nowy endpoint: `GET /api/listings/by-slug/:slug`
  - Endpoint obsługuje zarówno pełne slugi jak i fallback do ID (jeśli slug nie zostanie znaleziony).
- **Komponenty zaktualizowane**:
  - `ListingCard` - generowanie nowych linków
  - `ListingDetailPage` - obsługa nowego parametru `:slug`
  - `LeadFormPage` - obsługa nowego parametru oraz linki powrotne
  - `App.tsx` - nowe ścieżki routing
- **Migracja**:
  - Dodano pole `slug` do tabeli `listings` (unikalne, indeksowane).
  - Przy kolejnym imporcie CSV wszystkie oferty otrzymają automatycznie wygenerowane slugi.

## 9. Archiwizacja ofert w panelu administratora
- **Cel**: umożliwienie administratorowi usuwania widoczności pojazdów w serwisie bez ich fizycznego usuwania z bazy.
- **Lokalizacja**: Panel administratora → Pojazdy (ListingManagementPage).
- **Zachowanie**:
  - Na liście pojazdów dostępne jest mini menu (trzy kropki) przy każdej ofercie.
  - Dla aktywnych ofert: opcja "Archiwizuj" (czerwona) - ukrywa pojazd w serwisie.
  - Dla zarchiwizowanych ofert: opcja "Przywróć" (zielona) - przywraca widoczność.
  - Opcja "Usuń definitywnie" (ciemnoczerwona) - trwale usuwa pojazd z bazy (z separatorem nad nią dla wyróżnienia).
  - Zarchiwizowane oferty są oznaczone etykietą "Archiwalny" na liście.
  - Zarchiwizowane oferty nie pojawiają się w wynikach wyszukiwania dla klientów.
  - Link "Zobacz w serwisie" otwiera ofertę w nowym oknie (dla weryfikacji).
- **API**:
  - `POST /api/listings/:id/archive` - archiwizacja oferty.
  - `POST /api/listings/:id/restore` - przywrócenie oferty.
  - `DELETE /api/listings/:id` - trwałe usunięcie oferty (admin only).
- **Komponenty**:
  - `AdminListingList` - lista pojazdów z obsługą archiwizacji.
  - `AdminListingItem` - pojedynczy wiersz z mini menu akcji.
  - `ListingManagementPage` - strona zarządzania z handlerami archiwizacji.

## 10. Masowe akcje na ofertach w panelu administratora
- **Cel**: umożliwienie administratorowi wykonywania akcji na wielu ofertach jednocześnie, co przyspiesza zarządzanie dużą liczbą pojazdów.
- **Lokalizacja**: Panel administratora → Pojazdy (ListingManagementPage).
- **Zachowanie**:
  - Przy każdej ofercie na liście dostępny jest checkbox do zaznaczania.
  - W nagłówku listy znajduje się checkbox "Zaznacz wszystkie" - zaznacza/odznacza wszystkie oferty na aktualnej stronie.
  - Po zaznaczeniu minimum jednej oferty pojawia się pasek akcji masowych (niebieski).
  - Pasek wyświetla liczbę zaznaczonych ofert i przycisk "Wyczyść" do odznaczenia wszystkich.
  - Dostępne akcje masowe:
    - **Archiwizuj** (czerwona) - ukrywa wszystkie zaznaczone oferty w serwisie.
    - **Przywróć** (zielona) - przywraca widoczność zaznaczonych ofert.
    - **Usuń definitywnie** (ciemnoczerwona) - trwale usuwa zaznaczone oferty z bazy danych.
  - Przed wykonaniem akcji masowej wyświetlane jest okno potwierdzenia z informacją o liczbie ofert.
  - Dla akcji usuwania okno potwierdzenia zawiera dodatkowe ostrzeżenie o nieodwracalności operacji.
  - Akcje masowe wykonywane są równolegle (Promise.all) dla wydajności.
  - Po zakończeniu wyświetlane jest powiadomienie z liczbą przetworzonych ofert.
  - Zaznaczenie jest automatycznie czyszczone po udanej akcji masowej.
- **Komponenty**:
  - `AdminListingItem` - checkbox przy każdej ofercie, obsługa zaznaczania.
  - `AdminListingList` - nagłówek z checkboxem "Zaznacz wszystkie", zarządzanie stanem zaznaczenia.
  - `ListingManagementPage` - pasek akcji masowych, okna potwierdzenia, logika wykonywania akcji masowych.
- **API**:
  - Wykorzystuje istniejące endpointy `POST /api/listings/:id/archive` i `POST /api/listings/:id/restore`.
  - Wywołania wykonywane równolegle dla wszystkich zaznaczonych ofert.
  - **Usuwanie**: `DELETE /api/listings/:id` - trwałe usunięcie oferty wraz z powiązanymi danymi (leady, historia cen) przez `onDelete: Cascade` w schemacie Prisma.

## 11. Model multi-tenant (platforma / grupa dealerska / dealer) — propozycja wdrożenia
- **Cel**: zapewnienie bezpiecznej izolacji danych i uprawnień między dealerami oraz grupami dealerskimi, przy zachowaniu możliwości pracy cross-tenant dla ról platformowych.
- **Zakres ról biznesowych**:
  - `superadmin_platform`: pełny dostęp do wszystkich kontekstów i ustawień.
  - `platform_manager`: zarządzanie stockiem, grupami dealerskimi i dealerami w całej platformie.
  - `dealer_group_admin`: zarządzanie dealerami oraz użytkownikami w obrębie swojej grupy dealerskiej.
  - `dealer_admin`: zarządzanie stockiem i użytkownikami własnego dealera.
  - `dealer_employee`: zarządzanie stockiem własnego dealera.
- **Model danych (docelowo)**:
  - Nowa encja `DealerGroup` (grupy dealerskie).
  - Nowa encja `Membership` (użytkownik + rola + scope: platforma/grupa/dealer).
  - `Dealer` rozszerzony o relację do `DealerGroup`.
  - `Listing` rozszerzony o opcjonalnego właściciela/opiekuna (`ownerUserId`) i tryb kontaktu.
- **Zachowanie ofert**:
  - Każdy pojazd ma przypisanego dealera (owner biznesowy).
  - Dane kontaktowe mogą pochodzić z:
    - kontaktu generycznego dealera (istniejące pola firmy/dealera), albo
    - konkretnego pracownika dealera (opiekun pojazdu).
  - Role platformowe mogą wprowadzać i edytować pojazdy w dowolnym kontekście po wyborze aktywnego scope.
- **Panel administracyjny**:
  - Dodanie przełącznika kontekstu (platforma/grupa/dealer) dla ról platformowych.
  - Dodanie widoków do zarządzania grupami dealerskimi, dealerami i użytkownikami per scope.
- **Status**: analiza i projekt architektury przygotowane; implementacja etapowa (schema -> migracja danych -> permission engine -> UI).

- 2026-04-01: Dodano proces negocjacji ceny na stronie oferty: osobny CTA, osobny flow formularza i backendowy typ leada `price_negotiation` z automatyczną klasyfikacją odpowiedzi (great_match/review_zone/too_low).

## 12. Izolacja źródeł danych podczas importu pojazdów
- **Cel**: zapobieganie sytuacjom, w których import z jednego źródła (np. plik CSV z Otomoto) przypadkowo nadpisze lub usunie pojazdy zaimportowane z innego źródła (np. plik CSV od innego dealera lub API).
- **Zachowanie**:
  - Na ekranie importu ("Import") użytkownik każdorazowo podaje nazwę źródła (Data Source) przed wgraniem pliku CSV (np. `otomoto`, `getcars`, `manual`).
  - System przechowuje informację o źródle w polu `importSource` dla każdego pojazdu w bazie.
  - Zastępowanie trybem aktualizacji (Replace): System wyszukuje istniejące oferty do zarchiwizowania tylko w ramach aktualnie wybranego źródła (chroniąc pojazdy innych źródeł przed zniknięciem).
  - Weryfikacja duplikatów: Kod zapobiega nadpisywaniu się ofert, gdy system rozpoznaje ten sam `vin` należący do innego `importSource`. W takiej sytuacji ignoruje dany pojazd, chroniąc integralność bazy danych. Taki odrzucony rekord będzie zaliczony jako pominięty (Pominięte błędy/duplikaty) w wynikach importu.

## 13. Zarządzanie zdjęciami i specyfikacją pojazdów najmu (refaktor)
- **Cel**: naprawienie błędu, w którym zdjęcia/specyfikacja dodane do pojazdu najmu nie były zapisywane po kliknięciu „Zapisz" i odświeżeniu strony.
- **Przyczyna**: formularz edycji pojazdu przechowywał `primaryImageUrl`, `imageUrls` i `specificationUrl` w lokalnym stanie formularza. Przy zapisie te stale (nieaktualne) wartości nadpisywały świeżo wgrane dane z dedykowanych sekcji upload.
- **Rozwiązanie**:
  - Zdjęcia i specyfikacja są teraz zarządzane **wyłącznie** przez dedykowane sekcje (`ImageSection`, `SpecificationSection`), które pojawiają się po zapisaniu pojazdu.
  - Formularz edycji **nie wysyła** pól `primaryImageUrl`, `imageUrls` ani `specificationUrl` — eliminuje to wyścig danych (race condition).
  - Każda zmiana (upload pliku, dodanie URL, usunięcie, zmiana kolejności) jest natychmiast zapisywana do bazy (bez konieczności klikania „Zapisz" w formularzu).
- **Nowe możliwości**:
  - **Dodawanie zdjęć po URL**: w sekcji zdjęć dostępne jest pole do wklejenia URL zewnętrznego zdjęcia (natychmiastowy zapis).
  - **Dodawanie specyfikacji po URL**: w sekcji specyfikacji dostępne jest pole do wklejenia URL (natychmiastowy zapis) lub upload PDF.
  - **Usuwanie specyfikacji**: przycisk X przy aktualnym linku specyfikacji.
  - Przy tworzeniu nowego pojazdu wyświetlany jest komunikat, że zdjęcia i specyfikację można dodać po zapisaniu pojazdu.

### Refaktor UI edycji pojazdu (v2)
- **Buttony Zapisz / Anuluj**: przeniesione na sam dół strony edycyjnej (po sekcjach zdjęć, specyfikacji i przypisań). Formularz używa wzorca `formId` — buttony mają `form="edit-vehicle-form"`.
- **Styled upload buttons**: natywne `<input type="file">` zastąpione ukrytym inputem + przyciskiem `<Button>` z ikoną Upload. Etykiety: "Dodaj plik" (specyfikacja PDF), "Dodaj zdjęcia" (galeria).

### Wyposażenie — pełna ekspozycja
- Strona publiczna `/najem/:slug` wyświetla **4 kategorie** wyposażenia z ikonami: Audio i Multimedia (🎵), Bezpieczeństwo (🛡️), Komfort i Dodatki (🛋️), Inne (📦).

### Kalkulator najmu — lepsze pozycjonowanie
- Kalkulator jest teraz `sticky` z `top-20` (wyrównanie pod navbar) i `max-h + overflow-y-auto` aby nie wychodził poza viewport.

### Typ oferty — firma / prywatnie
- Nowe pole `offerType` w modelu `RentalMatrixEntry` (wartości: `"business"`, `"consumer"`, `"all"`; domyślnie `"all"`).
- CSV import obsługuje opcjonalną kolumnę `offer_type` — jeśli pusta, przyjmuje `"all"`.
- Kalkulator publiczny zawiera toggle „Na firmę / Prywatnie":
  - Jeśli pojazd ma only `"business"` → przycisk „Prywatnie" wyszarzony.
  - Jeśli only `"consumer"` → przycisk „Na firmę" wyszarzony.
  - Jeśli `"all"` → oba aktywne.
- Backend filtruje wyniki kalkulatora po `offerType` (pasują zarówno dokładne trafienia, jak i `"all"`).

### Widoczność nazwy firmy
- Nazwa firmy rental w wynikach kalkulatora jest widoczna **wyłącznie dla zalogowanych użytkowników** (admin, manager). Visitor widzi anonimowe "Firma #N".

### Galeria pełnoekranowa (Lightbox)
- Po kliknięciu w główne zdjęcie pojazdu na stronie `/najem/:slug` otwiera się pełnoekranowa galeria.
- Nawigacja: strzałki ← → (klawiatura), przyciski na ekranie, kliknięcie w miniaturę na pasku dolnym.
- Zamknięcie: Escape / kliknięcie w tło / przycisk X.
- Automatycznie blokuje scroll body gdy galeria jest otwarta.
- Hover na główne zdjęcie wyświetla ikonę powiększenia i licznik zdjęć (np. „3/12").

### Formularz zapytania o najem (Zapytaj o ofertę)
- Nowa strona `/najem/:slug/zapytanie` — formularz leadowy dedykowany dla najmu.
- Wzorowany na `LeadFormPage` (kredyt/leasing) z zachowaniem spójnego UX.
- Dane z kalkulatora (firma, rata, przebieg, okres, wpłata) przekazywane przez `location.state` i automatycznie wstępnie wypełniają treść wiadomości.
- Sidebar z podsumowaniem oferty (zdjęcie, specyfikacja, konfiguracja kalkulatora).
- Walidacja: zod schema, zgody RODO wymagane.
- Backend: `POST /api/leads/rental` (istniejący endpoint) — tworzy lead typu `rental` z powiązanym pojazdem.
- Frontend API client: `leadsApi.submitRentalLead(...)`.
- Po wysłaniu: ekran sukcesu z numerem referencyjnym.

### Zaokrąglanie rat do pełnych złotych
- Wszystkie raty miesięczne (netto i brutto) wyświetlane na listingu `/najem` oraz w kalkulatorze są zaokrąglane **w górę** do pełnych złotych (`Math.ceil`).
- Zaokrąglanie odbywa się po stronie backendu (`rental-public.ts`) — zarówno na listingu (`minRate`) jak i w kalkulatorze (`/calculate`).

### Globalny wybór typu klienta (firma / prywatnie)
- Na listingu `/najem` w pasku filtrów dostępny jest toggle „Na firmę / Prywatnie".
- Wybór jest zapisywany w `localStorage('rentalClientType')` — persystuje między stronami.
- **Na firmę** → cena główna **netto**, pod spodem brutto (mniejsza czcionka).
- **Prywatnie** → cena główna **brutto**, pod spodem netto (mniejsza czcionka).
- Strona detalu `/najem/:slug` wczytuje `rentalClientType` z localStorage jako domyślny tryb kalkulatora.
- Zmiana trybu na kalkulatorze synchronizuje się zwrotnie do `localStorage`.
- Ikony: `Building2` (firma) i `User` (prywatnie) z lucide-react — spójne ze stylem reszty serwisu.

### Polskie etykiety usług w kalkulatorze
- Usługi wyświetlane na kartach ofert kalkulatora mają polskie nazwy: `insurance` → Ubezpieczenie, `tires` → Opony, `service` → Przeglądy techniczne, `other` → Assistance 24h.

### Cena katalogowa w nagłówku
- Cena katalogowa (przekreślona) i cena sprzedaży zostały przeniesione do nagłówka obok tytułu pojazdu (po prawej stronie), zamiast osobnej sekcji pod specyfikacjami.

### Wyposażenie — zwijane sekcje (collapsible)
- Kategorie wyposażenia na stronie `/najem/:slug` są teraz wyświetlane jako elementy `<details>` (rozwijane/zwijane).
- Każda kategoria pokazuje liczbę elementów w nawiasie, np. „Audio i Multimedia (12)".
- Domyślnie złożone — użytkownik rozwija je kliknięciem. Eliminuje to problem zbyt długich list (np. 20+ pozycji) które przytłaczały stronę.
- Elementy wyposażenia wyświetlane w kolumnie (zamiast 2-kolumnowej siatki) z lepszym paddingiem i wyrównaniem.

### Stabilizacja kalkulatora (placeholderData)
- Zmiana parametrów w kalkulatorze (przebieg, okres, wpłata) nie powoduje przeładowania całego kontenera oferty.
- TanStack Query używa `placeholderData: (prev) => prev` — stare wyniki pozostają widoczne podczas ładowania nowych, aktualizowane są jedynie wartości rat i zakres usług.

## 25. FAQ i reklamy — placementy i kontekst stron

### FAQ placement „Strona najmu"
- W admin panelu FAQ dodano nową opcję strony: **Strona najmu** (`rental`).
- Wpisy FAQ przypisane do strony „Strona najmu" są wyświetlane wyłącznie na stronach ofert najmu (`/najem/:slug`).
- Na stronie oferty najmu FAQ renderowane jest jako Accordion pod główną treścią.

### Reklamy — placement „Pod wyposażeniem" (DETAIL_BELOW_EQUIPMENT)
- Nowy placement reklam wyświetlany w sekcji głównej oferty, bezpośrednio pod wyposażeniem.
- Dostępny zarówno na stronach ofert (ListingDetailPage), jak i na stronach najmu (RentalDetailPage).
- Wykorzystuje komponent `PartnerSidebarAd` z pełnym wsparciem i18n.

### Kontekst stron (pageContext)
- Nowe pole `pageContext` na obu modelach: **FaqEntry** i **PartnerAd**.
- Dostępne wartości: `offers` (sprzedaż - samochody nowe/używane), `rental` (najem), `all` (wszystkie).
- Domyślna wartość: `all` - istniejące wpisy bez zmian, wyświetlają się na wszystkich typach ofert.
- Admin UI: dodano select „Kontekst stron" w formularzach FAQ i Reklam z kolorowymi badge'ami na liście.
- Filtrowanie: backend filtruje `WHERE pageContext IN ('all', <requested>)`, frontend wysyła odpowiedni kontekst (`offers` / `rental`).

## 26. Dynamiczne kierowanie zapytań kontaktowych (leadów) do wybranego operatora
- **Cel**: automatyczne przesyłanie powiadomień o nowych leadach do skrzynki e-mail wybranego pracownika/operatora platformy, zamiast wyłącznie na ogólny adres e-mail.
- **Zasada działania**:
  - Superadmin w backoffice, w sekcji "Lead Management", ma dostęp do dedykowanego panelu konfiguracji odbiorcy.
  - Panel wyboru pobiera listę aktywnych użytkowników z bazy danych za pomocą API użytkowników platformy.
  - Wybór jest zapisywany w globalnych ustawieniach aplikacji w polu `leadRecipientUserId`.
  - Po zapisaniu, każde nowe zapytanie (formularz sprzedaży, leasingu, najmu czy prośba o szybki kontakt) automatycznie ustala adres e-mail wybranego użytkownika jako głównego odbiorcę.
  - **Bezpieczny fallback**: W przypadku braku wybranego użytkownika (wartość domyślna) lub gdy wybrany użytkownik zostanie usunięty/dezaktywowany, system automatycznie wysyła powiadomienie na ogólny adres e-mail zdefiniowany w konfiguracji SMTP (`smtpRecipientEmail`).
- **Ograniczenia dostępu**:
  - Wybór odbiorcy leada jest całkowicie ukryty przed użytkownikami o niższych rolach (np. Dealer Admin, Dealer Employee, Platform Manager). Opcja ta jest widoczna i modyfikowalna wyłącznie dla roli `SUPERADMIN_PLATFORM`.

## 27. Śledzenie konwersji i leadów (GTM i GA4)
- **Cel**: automatyczne informowanie Google Tag Manager oraz Google Analytics 4 o każdym udanym przesłaniu leada ze strony, z podziałem na typ formularza oraz dynamiczne dane pojazdu i finansowania.
- **Zdarzenie w dataLayer**:
  - Każde udane przesłanie formularza rejestruje w tablicy `window.dataLayer` ujednolicone zdarzenie `generate_lead`.
- **Parametry zdarzenia**:
  - `lead_type`: typ leada (np. `offer_inquiry` - formularz ofertowy, `negotiation` - negocjacja ceny, `rental_inquiry` - zapytanie o najem, `general_contact` - formularz kontaktowy, `quick_callback` - prośba o telefon).
  - `form_id`: identyfikator formularza (np. `offer_inquiry_form`, `negotiation_form`, `rental_inquiry_form`, `contact_page_form`, `callback_form`, `home_page_cta_form`).
  - `brand`: identyfikator marki (np. `motolia` lub `carsalon`), pobierany dynamicznie z kontekstu marki.
  - `lead_details`: dane leada, takie jak imię, e-mail (jeśli podane), a w przypadku negocjacji kwota propozycji.
  - `vehicle_details`: szczegółowe dane pojazdu (np. `listing_id`, `make`, `model`, `version`, `year`, `price`, `financing_type`).
  - `financing_details` / `rental_details`: parametry kalkulatora wybrane przez klienta (np. rata miesięczna, okres, wpłata wstępna, roczny przebieg).
- **Zalety**:
  - Ułatwia bezpośrednie wdrożenie konwersji w GTM i GA4 bez konieczności parsowania DOM-u ani nasłuchiwania na adresy URL podziękowań.
