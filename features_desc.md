# Opisy funkcjonalności

Ten plik dokumentuje działanie kluczowych funkcjonalności aplikacji w przystępny, produktowy sposób.
Każda nowa funkcjonalność lub zmiana zachowania istniejącej powinna mieć tutaj krótki opis.

## Wcześniejsze pobieranie ofert katalogu
- `/samochody` nie pobiera od razu kalkulatora finansowania, sekcji artykułu ani formularza powiadomień. Są pobierane tylko wtedy, gdy dana sekcja jest potrzebna; nagłówek, lead i pierwsze karty pozostają poza tymi granicami ładowania.
- Na trasach katalogu GTM rozpoczyna ładowanie po zamontowaniu kart i dwóch klatkach animacji, po wczesnej interakcji lub najpóźniej po 3,5 s. Pozostałe strony korzystają z zakończenia ładowania dokumentu. Tag Assistant, kolejka zdarzeń oraz domyślne zgody pozostają zachowane. Thulium uruchamiane przez GTM korzysta z tej samej kolejności.
- Domyślne wejście na `/samochody`, `/nowe` i `/uzywane` rozpoczyna publiczne zapytanie o oferty już z HTML, przed uruchomieniem Reacta.
- Trasa `/wynajem-dlugoterminowy` (strona 1) wykorzystuje prefetch ofert najmu ze skryptu HTML (`window.__RENTAL_PREFETCH__`), czytając segment klienta (`rentalClientType`: b2b / consumer -> b2c) bezpośrednio w przeglądarce przed wykonaniem zapytania, dzięki czemu współdzielony HTML nie wymusza na stałe typu klienta. Dodatkowo usunięto nieużywany preload `limit=1` na listingu najmu.
- Frontend wykorzystuje tę samą odpowiedź jednokrotnie wyłącznie dla identycznego originu, endpointu i parametrów. Zapytania autoryzowane nie korzystają z publicznego prefetchu; błąd prefetchu uruchamia zwykłe pobieranie.
- URL z parametrami pozostaje przy standardowym pobieraniu. Sprawdzenie w przeglądarce chroni również wejścia z filtrami obsługiwane przez cache HTML.

## Etapowe wyświetlanie katalogu na telefonach
- Na ekranach poniżej 640 px katalogi `/nowe`, `/uzywane`, `/samochody` i `/wynajem-dlugoterminowy` montują najpierw dwie karty. Następne pojawiają się w partiach po dwie, gdy użytkownik zbliża się do końca widocznej części listy.
- Przycisk „Pokaż wszystkie oferty na tej stronie” udostępnia pełną stronę wyników bez przewijania i działa z klawiatury. Ma tłumaczenia PL/EN/DE.
- Desktop, wydruk i przeglądarki bez IntersectionObserver mają pełną listę. Powrót z szerokiego ekranu do wąskiego nie ukrywa odsłoniętych kart.
- Paginacja, sortowanie, liczba wyników API i pierwsza karta LCP pozostają bez zmian. Rezerwacja miejsca opiera się na wysokości pierwszej karty; CLS i TBT wymagają oceny online na różnych ofertach.

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
  - **Integracja z CRM (Thulium)**: System CRM (Thulium) odbiera leady poprzez integrację typu *mail-to-ticket*. Każda wysyłana z poziomu aplikacji wiadomość e-mail (wysyłana poprzez serwer SMTP nadawcy, np. `kontakt@motolia.pl`) trafia na adres docelowy powiadomień (wybrany `leadRecipientUserId` lub fallback `smtpRecipientEmail`, zazwyczaj `lead@motolia.pl`). System Thulium cyklicznie odpytuje tę skrzynkę pocztową i na podstawie zawartości wiadomości e-mail automatycznie generuje nowe zgłoszenia (tickety) w panelu CRM.
- **Ograniczenia dostępu**:
  - Wybór odbiorcy leada jest całkowicie ukryty przed użytkownikami o niższych rolach (np. Dealer Admin, Dealer Employee, Platform Manager). Opcja ta jest widoczna i modyfikowalna wyłącznie dla roli `SUPERADMIN_PLATFORM`.

## 28. Dedykowany panel Leady, rejestracja URL źródłowego i obsługa braku e-maila
- **Dedykowana pozycja w menu bocznym ("Leady")**:
  - Sekcja zarządzań zapytaniami klientów (Lead Management) została przeniesiona z Pulpitu Nawigacyjnego (`DashboardPage`) do osobnej pozycji w menu bocznym pod adresem `/admin/leads`.
  - Dostępna pod ikoną `MessageSquare` dla wszystkich uprawnionych ról (`ALL_ROLES`).
- **Rejestrowanie adresu URL strony dla szybkiego kontaktu**:
  - Formularze szybkiego kontaktu (prośby o oddzwonienie) automatycznie przechwytują adres URL strony, na której klient wypełnił formularz (np. strona danej oferty, strona główna, strona kontaktu).
  - Adres ten jest przesyłany do backendu w polu `pageUrl` i automatycznie dołączany do treści wiadomości leada (`Strona wysłania: https://...`), co pozwala obsłudze oraz CRM natychmiast zweryfikować kontekst zgłoszenia.
- **Obsługa braku e-maila (wartość `null` zamiast `'brak@email.pl'`)**:
  - W przypadkach, gdy klient nie podaje adresu e-mail (np. w szybkim kontakcie telefonicznym), w bazie danych oraz API wartość pola `email` ustawiana jest na `null` zamiast fikcyjnego ciągu `'brak@email.pl'`.
  - Zapobiega to błędnej automatyzacji wysyłki wiadomości e-mail na nieistniejące adresy w zewnętrznym systemie CRM.

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

## 28. Automatyczne formatowanie linków telefonicznych (tel:) dla połączeń międzynarodowych
- **Cel**: ułatwienie połączeń telefonicznych z zagranicy oraz eliminacja błędów wybierania numeru na urządzeniach mobilnych.
- **Problem**: numery telefonów zapisywane w systemie (np. 445 445 485 lub +48 445 445 485) zawierają spacje, które blokują lub psują obsługę połączeń na smartfonach (iOS/Android). Dodatkowo, brak kodu kraju uniemożliwia dodzwonienie się z zagranicy.
- **Rozwiązanie**:
  - Wprowadzono globalny pomocnik `formatPhoneForTelLink`, który automatycznie oczyszcza każdy numer telefonu przekazywany do linku `tel:` z wszelkich znaków niebędących cyframi lub znakiem plus.
  - Pomocnik automatycznie wykrywa polskie numery bez prefiksu międzynarodowego (w tym 9-cyfrowe numery komórkowe i stacjonarne) i automatycznie dodaje przedrostek `+48`.
  - Normalizuje prefiksy `00` na standard międzynarodowy `+`.
  - Zabezpiecza i zachowuje numery zagraniczne (np. z Niemiec) posiadające już własne prefiksy.
  - Zastosowano formatowanie dla wszystkich miejsc w aplikacji renderujących linki telefoniczne (nagłówek, stopka, karta oferty, FAQ, strona kontaktu, detal najmu).

## 29. Usprawnienia w panelu administratora: ID dealera i wyszukiwarka tekstowa
- **Cel**: Ułatwienie zarządzania dealerami oraz szybkiego kopiowania ich ID w konfiguracjach systemowych (szczególnie przydatne dla integracji i logów).
- **Zachowanie**:
  - Kopiowanie ID: Na listingu dealerów (`/admin/dealers`), pod warunkiem, że aktywna marka to Motolia (`brand=motolia`), obok nazwy każdego dealera wyświetla się jego ID z przyciskiem do szybkiego kopiowania. Kliknięcie kopiuje pełny identyfikator UUID dealera do schowka z wizualnym potwierdzeniem (checkmark).
  - Wyszukiwarka tekstowa: Dodano pole wyszukiwania tekstowego obok dropdownu 'Wszyscy'. Umożliwia ono dynamiczne, natychmiastowe filtrowanie listy dealerów po nazwie, ID, mieście, adresie e-mail, telefonie kontaktowym oraz przypisanej grupie dealerskiej.

## 30. Wyszukiwalny wybór dostawcy/dealera w formularzu pojazdu
- **Cel**: Ułatwienie przypisywania dealerów i dostawców do pojazdów (zarówno w modelu sprzedaży, jak i najmu) poprzez usunięcie ograniczeń wczytywania dealerów oraz dodanie wyszukiwarki.
- **Zachowanie**:
  - Poprawiono pobieranie dealerów w `RentalVehiclesPage.tsx` - system pobiera teraz wszystkich aktywnych dealerów z dedykowanej końcówki administracyjnej (`/api/admin/dealers`).
  - Zastąpiono tradycyjne kontrolki `<select>` w sekcji dostawców/dealerów (`ProviderSection.tsx`) nowoczesnym, wyszukiwalnym komponentem typu Combobox (zbudowanym w oparciu o Radix Popover oraz Input).
  - Wyszukiwarka pozwala na dynamiczne filtrowanie opcji w locie po wpisaniu nazwy, ID lub miasta.

## 31. Poprawna interpretacja pakietów usług w matrycach rentalowych (Masterlease)
- **Cel**: Wyeliminowanie błędu, przez który usługi (ubezpieczenie, opony) były oznaczane jako wliczone w cenę najmu, mimo braku oznaczenia 'I' (Included) w matrycy.
- **Zachowanie**:
  - Poprawiono funkcję `parseServiceFlags` w parserze CSV (`rental-csv-mapper.ts`). Usunięto automatyczne zaliczanie kosztów numerycznych jako włączonych.
  - Usługi są teraz uznawane za wliczone w cenę najmu wyłącznie przy obecności jawnych znaczników tekstowych (np. `I`, `true`, `yes`, `1`, `tak`). Jeśli w kolumnie znajduje się konkretny koszt (liczba), usługa nie jest oznaczana jako wliczona w ratę podstawową najmu.
## 32. Poprawki kalkulatora, wyświetlania danych pojazdu oraz etykiet netto/brutto (Motolia)
- **Kalkulacja rabatu Motolia**: Wyeliminowano błąd powodujący wyświetlanie ujemnego lub olbrzymiego rabatu (np. -650%) oraz brak sekcji ceny katalogowej pod kalkulatorem w przypadku pustej lub zaniżonej ceny katalogowej pojazdu. Jeśli w bazie danych cena katalogowa jest mniejsza lub równa cenie pojazdu, system automatycznie wylicza wirtualną cenę katalogową jako sumę ceny pojazdu i rabatu Motolia, co pozwala na poprawne wyliczenie procentu rabatu i wyświetlenie kompletnych informacji.
- **Nazwa i parametry pojazdu w ofercie**: Dodano brakujący nagłówek z marką, modelem i wersją pojazdu w widoku stacjonarnym (desktop) na stronie oferty Motolia, dzięki czemu dane te są widoczne bezpośrednio nad galerią zdjęć.
- **Etykiety netto i brutto**: W sekcji kalkulatora finansowania etykiety "Cena katalogowa" oraz "Cena pojazdu" automatycznie otrzymują dopisek "netto:" lub "brutto:" w zależności od wybranego profilu klienta (odpowiednio: "Na firmę" lub "Prywatnie").
- **Opis rabatu w tooltipie**: Zaktualizowano i uproszczono tekst tooltipu "i" obok ceny pojazdu na: "Cena pojazdu zawiera dodatkowy rabat z tytułu finansowania pojazdu z Motolia."
- **Domyślny URL integracji CSFlow**: Ustawiono, że w przypadku marki "motolia" system automatycznie korzysta z produkcyjnego API Grupy Bemo (https://webapi.grupabemo.csflow.pl) jako domyślnego, zamiast środowiska testowego (demo). Dzięki temu po wdrożeniu na serwer import pobiera rzeczywistą bazę ofert (ponad 580 pojazdów, w tym samochody dostawcze jak Sprintery) bez konieczności wprowadzania dodatkowej konfiguracji w panelu Coolify.

## 33. Unifikacja nazw marek i filtrowania (Brand Normalization)
- **Cel**: Wyeliminowanie duplikatów marek (np. "Citroën" vs "Citroen") w wyszukiwarce oraz na listach rozwijanych filtrów, co zapewnia spójność danych i lepsze UX.
- **Zachowanie**:
  - **Centralna normalizacja**: Wprowadzono serwis `brand-normalization.service.ts` z listą kanonicznych nazw marek (np. Škoda, Citroën, Mercedes-Benz, SsangYong/KGM).
  - **Ingestia danych**: Każdy sposób dodawania ofert (importy CSV, CSFLOW, Vehis oraz ręczne dodawanie) automatycznie normalizuje nazwę marki przed zapisem do bazy danych.
  - **Filtry i Facety**: API filtrów (zarówno dla ofert sprzedaży, jak i wynajmu) automatycznie grupuje i unifikuje marki w locie, dzięki czemu w dropdownach i licznikach (facetach) marki zawsze wyświetlają się w poprawnej, zunifikowanej formie.
  - **Migracja**: Istniejące dane w bazie zostały zaktualizowane skryptem migracyjnym `migrate-brands.ts`, co natychmiastowo "oczyściło" interfejs użytkownika z duplikatów.

## 34. Edycja przypisania dealera dla ofert importowanych
- **Cel**: Umożliwienie ręcznej zmiany przypisanego dealera dla pojazdów pochodzących z importu (np. CSFlow, CSV).
- **Rozwiązanie**: Dodano pole `dealerId` do listy `CSV_EDITABLE_FIELDS` w konfiguracji mapera ofert (`listing-mapper.ts`). Dzięki temu administrator może skutecznie aktualizować przypisanie dealera poprzez formularz edycji w panelu admina, a zmiana ta nie jest już ignorowana (odfiltrowywana) przez backend podczas zapisu.

## 35. Ochrona ręcznych edycji ofert przed nadpisaniem przez import CSFlow
- **Cel**: Zapobieganie nadpisywaniu zmian wprowadzonych przez administratora (np. opisów, cen lub niestandardowych zdjęć) na ofertach zintegrowanych z CSFlow podczas cyklicznej synchronizacji.
- **Zachowanie**:
  - **Blokada aktualizacji pól**: Funkcja synchronizacji `syncCSFlowAPI` w `csflow.service.ts` sprawdza pole `lastManualEditAt` oraz `entrySource` na istniejących ofertach. Jeśli oferta posiada `lastManualEditAt` różny od `null` (ręczna edycja w panelu admina) LUB jej `entrySource` jest inne niż `CSFLOW` (np. MANUAL lub CSV), system pomija nadpisywanie jakichkolwiek pól oraz wywoływanie pobierania zdjęć w tle.
  - **Utrzymanie statusu**: Oferta jest jedynie aktualizowana pod kątem widoczności (jest przywracana z archiwum, jeśli była zarchiwizowana, i nie ulega ponownej automatycznej archiwizacji, dopóki występuje w feedzie API).
  - **Ochrona duplikatów**: W ścieżce duplikowania ofert (`duplicate-offer`) wykluczono kopiowanie kluczy powiązań z integracją (`csflowSourceId`, `csflowCarId`) oraz zresetowano źródło importu (`importSource` ustawione na `null`), aby nowa ręczna oferta była w pełni niezależna od automatycznego procesu.

## 36. Izolacja ofert najmu w dedykowanej sekcji /wynajem-dlugoterminowy
- **Cel**: Wykluczenie wynajmu z innych list ofert (m.in. /nowe, /uzywane, /samochody) i ich wyłączna prezentacja na dedykowanej podstronie /wynajem-dlugoterminowy/.
- **Działanie**: Oferty pojazdów z najmu długoterminowego nie wyświetlają się na stronach /nowe, /uzywane oraz w ogólnych wynikach /samochody. Pojazdy na najem są dostępne i wyświetlane wyłącznie na podstronie /wynajem-dlugoterminowy/.

## 37. Kolumna rodzaju napędu w panelu administracyjnym (/admin/listings)
- **Cel**: Wyświetlanie informacji o rodzaju napędu (np. FWD, RWD, 4x4, AWD) na liście pojazdów w panelu administratora.
- **Zachowanie**: W widoku listy pojazdów (`/admin/listings`) zaktualizowano zbiór kolumn specyfikacji (`AdminListingItem`), dodając 6. kolumnę "Napęd". Wyświetla ona wartość z pola `listing.drive` (np. FWD, RWD, 4x4) lub `-` w przypadku braku danych.

## 38. Dedykowany system landing page'y dla kampanii płatnych i QR (/promo/:slug)
- **Cel**: Zarządzanie dedykowanymi stronami docelowymi dla kampanii reklamowych (Meta/Google Ads, mailingi, kody QR z mediów offline/TV). System umożliwia stworzenie jednej strony docelowej na dany segment odbiorców, z obsługą wielu kampanii i kanałów poprzez parametry URL (`?src=` oraz parametry UTM).
- **Zachowanie**:
  - **Dedykowany URL**: Strony dostępne są pod adresem `/promo/:slug`.
  - **Strict zero conversion leak**: Minimalistyczny nagłówek (logo marki + klikalny telefon) bez głównego menu nawigacyjnego i bez odnośników wyprowadzających użytkownika poza lejek konwersji (z jednym kontrolowanym wyjątkiem dla przycisku przejścia do katalogu pod ofertami).
  - **Formularz kontaktowy above the fold**: Skierowany na szybki kontakt telefoniczny z doradcą (jedne pole na numer telefonu).
  - **Przeznaczenie aut**: Strona obsługuje dwa tryby doboru aut: `MANUAL` (lista wyselekcjonowanych aut po ID) oraz `FILTERED` (automatyczne dopasowanie filtrami po marce, cenie, roczniku itp.).
  - **Przycisk przejścia do katalogu**: Pod listą pojazdów przycisk akcentowy w kolorze motywu (domyślnie "Sprawdź całą ofertę" na `/samochody` lub `/wynajem-dlugoterminowy`), rejestrujący zdarzenie `lp_offer_cta` w GA4 dataLayer.
  - **Regulamin promocji (PDF)**: Możliwość wgrania per LP pliku PDF (limit 8 MB z walidacją magii `%PDF`), z opcjonalną etykietą i automatyczną sekcją w stopce.
  - **Sloty treści i edytory**: Elastyczna struktura slotów w panelu:
    - **Jak to działa**: 3 podstawowe kroki + opcjonalny, niezależny 4. kafel odbioru nagrody, z automatyczną responsywną siatką (4 kolumny na desktopie przy 4 krokach).
    - **Edytor FAQ**: Lista pytań i odpowiedzi (do 6 wpisów) z pełną edycją w panelu bez konieczności deployu.
    - **Usuwanie zdjęć hero**: Przycisk bezpiecznego usuwania obrazu hero w panelu z kasowaniem wariantów z dysku.
  - **Indeksowanie i SEO**: Domyślnie strony posiadają nagłówek `noindex`. Flaga `isIndexable` zezwala na indeksowanie wyłącznie dla evergreenowych stron bez daty zakończenia. Strony wygasłe (`validTo < now()`) zwracają status HTTP 410 i automatycznie przekierowują użytkownika na `/samochody`.
  - **Panel administracyjny**: Zarządzanie stronami w zakładce `/admin/landing-pages` pozwala na tworzenie, edycję, duplikowanie oraz generowanie gotowych kodów QR PNG w rozdzielczości 1024px z przypisanym źródłem ruchu `?src=qr`.
## 39. Pakiet poprawek SEO On-Site dla strony głównej motolia.pl (2026-07)
- **Cel**: Optymalizacja strony głównej pod kątem wyszukiwarki Google (podniesienie stopnia indeksacji, spójność nagłówków i metadanych oraz grafu encji JSON-LD).
- **Zastosowane zmiany**:
  - **Nagłówek H1 (P0)**: Przywrócono pojedynczy, widoczny nagłówek `<h1>` na stronie głównej w obu stanach (z aktywnym banerem karuzeli CMS oraz bez banera), a także w statycznym shellu SSR `homeHeroShellHtml()`. Nagłówek jest umieszczony pod sekcją hero/karty wyszukiwarki, nie zaburzając wskaźnika LCP na urządzeniach mobilnych.
  - **Title & Meta Description (P1)**: Ujednolicono i wydłużono metadane strony głównej w `BRAND_DEFAULTS` oraz `vite.config.ts`:
    - Title: `"Motolia — leasing, kredyt i wynajem samochodów bez formalności"` (~62 zn.)
    - Description: `"Nowe i używane auta z finansowaniem dopasowanym do Twojej sytuacji — leasing, kredyt, wynajem długoterminowy. Sprawdź oferty i policz ratę online w 2 minuty."` (156 zn.)
    - Zabezpieczono testem automatycznym w `render.test.ts` pilnującym braku regresji długości metadanych.
  - **Dane strukturalne JSON-LD (P2)**: Rozszerzona struktura JSON-LD na stronie głównej dostarcza botom kompletny zestaw encji: `Organization`, `WebSite` wraz z akcją `SearchAction` (`/samochody?search={search_term_string}`), a także dynamiczną `FAQPage` bazującą na pytaniach z CMS (`page=home`).
  - **Porządki w sitemapie i linkach (P3)**:
    - Zaktualizowano sitemapę (`/api/sitemap.xml`) dla strony głównej na `<loc>https://motolia.pl/</loc>` z ukośnikiem końcowym (spójnie z URL-em kanonicznym).
    - Skierowano martwy anchor `#jak-to-dziala` w hero na sekcję `#produkty`.
    - Wzmocniono słowa kluczowe w nagłówkach H2 produktów oraz marek.

## 40. Samodzielny kalkulator finansowania samochodów (/kalkulator-rat)
- **Cel**: Pozyskanie leadów od klientów poszukujących auta poza naszą bazą (OTOMOTO, dealer, OLX) oraz zdobycie widoczności SEO na frazy narzędziowe („kalkulator leasingu”, „kalkulator kredytu samochodowego”, „kalkulator najmu”).
- **Zachowanie i funkcjonalności**:
  - **Dedykowany URL & SSR**: Dostępny pod adresem `/kalkulator-rat` z pełną obsługą SSR (tytuł, opis, canonical, JSON-LD `FinancialProduct` & `WebApplication`), bez zbędnej siatki aut w prerenderze (`LISTINGLESS_STATIC_ROUTES`) oraz z automatycznym wpisem w `sitemap.xml`.
  - **Domyślna kwota**: Wartość poczatkowa pojazdu ustawiona na 80 000 zł brutto z suwakiem od 5 000 zł do 500 000 zł i możliwością ręcznego wpisania kwoty w polu numerycznym.
  - **Stan i rocznik pojazdu**: Wybór auta nowego lub używanego z rocznikiem produkcji (2016-2026).
  - **Tryby finansowania**: Kredyt samochodowy, Leasing operacyjny oraz Najem długoterminowy.
  - **Wymogi informacyjne dla kredytu (RRSO & Przykład Reprezentatywny)**:
    - **RRSO**: Wyświetlane wyłącznie gdy pochodzi bezpośrednio z API partnera bankowego (Inbank). Dla produktów własnych (`OWN`) ani przy braku wartości z API nie podstawiamy żadnych przybliżeń ani szacunków.
    - **Przykład Reprezentatywny z Backoffice**: Treść okna dialogowego jest wprowadzana ręcznie przez administratora w panelu `/admin/financing` (pole `creditRepresentativeExample` w `AppSettings`). Gdy pole jest puste, ikona i okno dialogowe nie wyświetlają się.
  - **Ubezpieczenia (v1)**: Zbieranie zgłoszeń wyceny ze zweryfikowanymi tekstami:
    - Nagłówek: *Dołącz bezpłatną wycenę pakietu OC/AC/GAP*
    - Podpis: *Nasi eksperci dobiorą optymalną stawkę ubezpieczenia dla tego pojazdu.*
  - **Zapis w CRM & Identyfikacja Leadów**:
    - Wysłanie zapytania z kalkulatora otwiera modal `CallbackForm` z zachowaniem natywnego zapisu parametrów finansowania w bazie danych (`financingAmount`, `financingDownPayment`, `financingPeriod`, `financingInstallment`, `financingFinalPayment`, `financingProductId`) przy opcjonalnym `listingId=null`.
    - Identyfikatory `formId` per miejsce wywołania w konwencji `snake_case` (np. `kalkulator_rat_callback`, `leasing_pillar_calculator_callback`, itd.).

## 41. Hardening bezpieczeństwa po audycie black-box (2026-08-13)
- **Cel**: zamknięcie ustaleń audytu bezpieczeństwa `AUDYT-BEZPIECZENSTWA-MOTOLIA_2026-08-13.md` bez zmiany zachowania widocznego dla użytkownika.
- **Publiczne `GET /api/settings` zwraca tylko allowlistę pól**:
  - Endpoint pozostaje publiczny (potrzebuje go SSR i cała strona), ale zwraca wyłącznie pola z `PUBLIC_SETTINGS_FIELDS` (języki, waluta, dokumenty prawne, dane rejestrowe w stopce, loga, nazwy serwisu, domyślne OG, widoczność modułów, domyślne sortowania, przełączniki funkcji).
  - Z odpowiedzi publicznej usunięto: wszystkie pola `smtp*`, wszystkie `pdfParser*`, `leadRecipientUserId`, `csflowEnabled`, `eurExRate`, `brokerFeePctPln`, `brokerFeePctEur`.
  - **Nowy endpoint `GET /api/admin/settings`** (`fastify.authenticate` + `authorizeRoles(['admin'])`) zwraca pełny rekord `AppSettings` z zamaskowanym `smtpPassword`. Korzystają z niego panel Ustawień, `LeadList` i `CSFlowImporter`.
- **Usunięcie niesanityzowanych sinków HTML we froncie**:
  - `DynamicFinancingContent` i `RentalFinancingContent`: lokalna funkcja `renderTextWithHtml` (wstrzykiwała `dangerouslySetInnerHTML` z danymi oferty pochodzącymi z importu CSV, parsera PDF i synchronizacji CRM) zastąpiona komponentem `MarkdownText`, który buduje elementy Reacta i escapuje treść.
  - `PublicFaqPage`: odpowiedź FAQ z CMS renderowana jako escapowany tekst z `whitespace-pre-line` zamiast `dangerouslySetInnerHTML`.
  - `MarkdownText`: linki przepuszczane przez `safeHref` - dozwolone tylko adresy względne (`/`, `#`, `?`) oraz `http`, `https`, `mailto`, `tel`. Adresy `javascript:`, `data:`, `vbscript:` i protokołowo-względne (`//host`) renderują się jako zwykły tekst.
  - `SeoContentPage` (podgląd w panelu): `simpleMarkdownPreview` escapuje dodatkowo `"`, żeby wklejony URL nie mógł wyjść z atrybutu `href`.
- **Content Security Policy w trybie Report-Only**: nagłówek `Content-Security-Policy-Report-Only` w `nginx.conf` w blokach `location @render` i `location @spa_fallback`, z allowlistą GTM, GA4, Clarity i Cloudflare Turnstile. Naruszenia trafiają na `POST /api/csp-report` i lądują w logach backendu jako `fastify.log.warn(..., 'CSP violation')`. Nagłówek nie egzekwuje polityki - służy do zebrania listy realnych źródeł przed przełączeniem na tryb wymuszający.
  - Przy okazji: oba bloki `location` odzyskały nagłówki `X-Frame-Options`, `X-XSS-Protection` i `X-Content-Type-Options`. Blok `@spa_fallback` gubił je wcześniej po cichu (reguła dziedziczenia `add_header` w nginx).
- **Jednolite 404 dla nieznanych ścieżek `/api/*`**: `setNotFoundHandler` w `backend/src/app.ts` zwraca `{statusCode: 404, error: 'Not Found', message: 'Route not found'}` zamiast błędu warstwy proxy.
- **Kanał zgłoszeń bezpieczeństwa**: `public/.well-known/security.txt` (RFC 9116) z adresem `security@motolia.pl`, serwowany przez dedykowaną regułę w `nginx.conf`.

## 42. Hardening autoryzacji i sekretów integracji (etap 2 audytu, 2026-08-13)
- **Cel**: zamknięcie ustaleń 9, 10 i 11 z drugiej części audytu (`AUDYT-BEZPIECZENSTWA-MOTOLIA_cz_2_2026-08-13.md`), przeprowadzonej na kontach testowych o różnych rolach.
- **Autoryzacja po roli z membershipu, nie po zgrubnym polu `role` z tokenu**:
  - Nowa funkcja `requirePlatformRole({ superadminOnly? })` w `backend/src/middleware/authorize.ts` wyznacza rolę na podstawie `memberships` + `activeContext` (przez `isPlatformRole`/`getEffectiveRole`), nigdy przez pole `request.user.role`.
  - **Dlaczego to było potrzebne**: `backend/src/routes/users.ts` nadaje legacy `role` wartość `admin` tylko dla `SUPERADMIN_PLATFORM`, a `manager` dla wszystkich pozostałych - łącznie z `DEALER_EMPLOYEE`. W praktyce `authorizeRoles(['admin', 'manager'])` znaczyło więc „każdy zalogowany".
  - `authorizeRoles` zostaje bez zmian dla pozostałych tras (`['admin']` odpowiada roli superadmina).
- **Endpointy przełączone na `requirePlatformRole()`**: `/api/partners` (globalny hook, obejmuje listę, tworzenie, edycję i regenerację klucza), `GET /api/financing/connections`, `GET /api/financing/products`, `faq` (2 trasy zapisu), `seo-content` (4 trasy), `seo` (1), `specifications` (1), `translations` (2).
- **Klucze API integracji nie wracają już jawnie z GET**:
  - `GET /api/financing/connections` oraz odpowiedzi `POST`/`PATCH` zwracają `hasApiKey`, `apiKeyLast4`, `hasApiSecret`, `apiSecretLast4` zamiast wartości. Dotyczy Inbank i Vehis.
  - `GET /api/partners` i `PUT /api/partners/:id` zwracają `hasApiKey` i `apiKeyLast4` zamiast klucza Otomoto.
  - Jawny klucz pojawia się wyłącznie w dwóch odpowiedziach: `POST /api/partners` (utworzenie) i `POST /api/partners/:id/regenerate-key`, oba zwracają teraz tylko `{ id, apiKey }`. Panel pokazuje go w jednorazowym oknie z przyciskiem kopiowania i informacją, że to jedyny moment, w którym klucz jest widoczny.
  - Panel admina (`ApiPartnersPage`, `FinancingPage`) pokazuje stan klucza jako `Ustawiony ••••1234` albo `Nie ustawiony`. Pola edycji startują puste, maska trafia wyłącznie do `placeholder`, a puste pole jest usuwane z payloadu - dzięki temu maska nie może nadpisać prawdziwego sekretu w bazie.
  - `POST /api/financing/test-connection` przyjmuje opcjonalne `connectionId`: gdy pole klucza jest puste, backend bierze zapisane dane połączenia z bazy. Testowanie istniejącego połączenia działa bez przepisywania sekretu, który nie jest już wysyłany do przeglądarki.
- **`POST /api/auth/context` waliduje istnienie zakresu** dla każdego wywołującego, także ról platformowych, które wcześniej pomijały wszystkie kontrole. `PLATFORM` wymaga `scopeId = 'PLATFORM'`, `DEALER` i `DEALER_GROUP` są sprawdzane w bazie, nieznany `scopeType` daje 400. Wcześniej rola platformowa dostawała ważny token na wymyślony identyfikator zakresu.
- **Koniec migotania 401 na ważnym tokenie**: w dekoratorze `authenticate` (`backend/src/app.ts`) odpytanie Redis o czarną listę tokenów było w tym samym bloku `try` co weryfikacja JWT, więc chwilowy błąd Redisa zamieniał się w 401 dla poprawnie zalogowanego użytkownika. Zapytanie ma teraz własny `try/catch` i przy błędzie Redisa przepuszcza żądanie (fail-open), logując `Blacklist lookup failed, allowing request`. Trafienie w czarną listę nadal daje 401. Uzasadnienie: czarna lista obejmuje wyłącznie tokeny jawnie wylogowane, więc uzależnianie całego uwierzytelniania od dostępności Redisa zamieniało awarię cache w awarię logowania.

## 43. Zdarzenie `consent_updated` w dataLayer
- **Cel**: dać Tag Managerowi trigger typu custom event, na którym można odpalać tagi dokładnie w momencie, gdy odwiedzający podejmie decyzję o zgodach.
- **Zachowanie**: `commitConsent` w `src/lib/consent.ts` po wysłaniu aktualizacji Consent Mode (`gtag('consent', 'update', ...)`) wypycha do `window.dataLayer` zwykły obiekt `{ event: 'consent_updated' }`. Kolejność jest istotna - tag odpalony na tym zdarzeniu widzi już zaktualizowany stan zgód.
- **Kiedy leci**: wyłącznie przy realnej decyzji użytkownika (banner zgód i okno ustawień zgód, oba przez hook `useConsent`). Nie leci przy zwykłym wejściu na stronę - start serwisu ustawia tylko `gtag('consent', 'default', ...)` w `SeoManager`.
- **Uwaga dla utrzymania**: te dwa pushe celowo mają różny kształt. Consent Mode rozpoznaje wyłącznie obiekt `arguments` (stąd helper `gtag`), a trigger custom event w GTM łapie wyłącznie zwykły obiekt z kluczem `event`. Ujednolicenie ich zepsuje jedno albo drugie. Kolejność i kształt są zabezpieczone testem w `src/lib/__tests__/consent.test.ts`.

## 44. Optymalizacja rozmiaru i rozmieszczenia mini-wyszukiwarki hero na stronie głównej
- **Cel**: Wyeliminowanie problemu wystawania/przepełnienia karty wyszukiwarki poza kontener banera hero na stronie głównej oraz poprawa hierarchii wizualnej przycisków akcji.
- **Zachowanie i zmiany wizualne**:
  - **Ułożenie stopki wyszukiwarki**: Główny przycisk CTA "Pokaż oferty" (żółty, pełna szerokość, wyrazisty) został umieszczony na górze stopki, a odnośnik "Wyszukiwanie zaawansowane" z ikoną został wyśrodkowany pod przyciskiem jako czytelna akcja drugorzędna. Zapobiega to ściśnięciu elementów w poziomie i zawijaniu tekstu.
  - **Kompaktowa siatka i marginesy**: Zoptymalizowano pionowe marginesy i dopełnienia (padding karty z 28px do 20px 22px, selektory i pola z 11px do 9px), dzięki czemu całkowita wysokość karty zmalała z ~477px do ~414px.
  - **Bezpieczny odstęp w banerze**: Na ekranach desktopowych (`lg:h-[520px]`) karta posiada teraz ponad 50px bezpiecznego marginesu od góry i dołu banera, dzięki czemu nie koliduje z zaokrągleniami rogów (`rounded-3xl`) ani wskaźnikami slajdów karuzeli.

## 45. Cykl życia wygasłych ofert i higiena sitemapy (SEO P0)
- **Cel**: Wyeliminowanie ostrzeżeń w Google Search Console (404/błędy indeksacji), zapobieganie powstawaniu soft 404 (nigdy nie przekierowujemy starych ofert na stronę główną `/`), utrzymanie 100% czystej sitemapy oraz zatrzymanie ruchu i intencji zakupowej użytkowników wchodzących na zarchiwizowane ogłoszenia.
- **Zasady cyklu życia ogłoszeń (`/oferta/*`)**:
  - **Aktywna oferta (`isArchived: false`)**:
    - HTTP 200, `<meta name="robots" content="index, follow">`.
    - Obecna w `sitemap.xml` z precyzyjnym tagiem `<lastmod>`.
  - **Niedawno sprzedane auto (`isArchived: true` i czas od archiwizacji $\le$ 90 dni)**:
    - HTTP 200, `<meta name="robots" content="noindex, follow">`.
    - Usunięta z `sitemap.xml`.
    - Widoczny u góry strony wyrazisty baner informacyjny: *„Oferta archiwalna - pojazd niedostępny. Ten samochód został sprzedany lub wycofany z oferty u dealera”*.
    - Przyciski CTA: link do strony modelu (`/samochody/<make>/<model>`) oraz kalkulatora rat (`/kalkulator-rat`).
    - Dedykowana sekcja 6 - 12 podobnych, aktualnie dostępnych samochodów (priorytetyzacja: 1. ta sama marka i model, 2. ta sama marka i nadwozie, 3. cena $\pm 20\%$).
    - Zachowana pełna specyfikacja techniczna, galeria i parametry pojazdu. Formularz kontaktowy dostosowany do poszukiwania podobnego auta.
    - Schema.org: `availability: "https://schema.org/Discontinued"`.
  - **Trwale wygasła oferta (`isArchived: true` i czas od archiwizacji > 90 dni)**:
    - Przekierowanie 301 na stronę modelu `/samochody/<make>/<model>` (jeśli istnieje aktywny katalog modelu), w przeciwnym razie na stronę marki `/samochody/<make>` (jeśli istnieje aktywny katalog marki).
    - Jeśli ani marka, ani model nie posiadają aktywnych stron w katalogu - zwracany jest kod **HTTP 410 Gone**.
    - **Żadne wygasłe ogłoszenie nie jest przekierowywane na stronę główną `/`** (likwidacja soft 404).
  - **Nieistniejący slug**:
    - Zwraca kod HTTP 404.
- **Higiena Sitemapy (`/sitemap.xml`)**:
  - Sitemap zawiera wyłącznie aktywne ogłoszenia (`isArchived: false`, `pricePln > 0`).
  - 100% adresów URL w mapie witryny posiada tag `<lastmod>`.
  - Sygnał świeżości dla ogłoszeń wyznaczany jest jako `max(lastManualEditAt, latestPriceHistory.changedAt, createdAt)`. Nocne automatyczne przeliczanie rat referencyjnych (`referenceCalcAt`) **nie** podbija tagu `<lastmod>`.
  - Sitemap jest buforowana w pamięci z TTL $\le$ 15 minut i natychmiast unieważniana przy zmianach w bazie.
- **Unieważnianie pamięci podręcznej i integracja z Cloudflare**:
  - Moduł `cache-invalidation.service.ts` automatycznie czyści lokalną pamięć podręczną SSR i sitemapy oraz wysyła zapytanie do API Cloudflare (`purge_cache` dla konkretnych URL-i ogłoszenia, sitemapy oraz stron marki/modelu) w momencie archiwizacji, przywrócenia, usunięcia lub synchronizacji CSFlow.

## 46. Higiena typograficzna i formatowanie kwot (spacje niełamliwe, tabular-nums i brak łamania)
- **Cel**: Wyeliminowanie nieestetycznych i mylących łamań wierszy wewnątrz liczb (np. rozbicie tysięcy w `2 739` na dwie linijki) oraz w dopiskach walutowych i finansowych (`zł`, `/mies.`, `brutto`, `netto`) po wdrożeniu skali brandbooka Motolia.
- **Zastosowane rozwiązania**:
  - **Spacje niełamliwe (NBSP / `\u00A0`) w `formatNumber` i `formatPrice`**: Funkcje formatujące liczby i ceny zachowują spacje niełamliwe zamiast zamieniać je na zwykłe spacje ASCII. Dzięki temu przeglądarka nigdy nie przełamuje liczby pomiędzy rzędami wielkości ani między kwotą a symbolem waluty.
  - **Klasy `tabular-nums` i `whitespace-nowrap`**: Nałożone na wszystkie kluczowe elementy prezentujące raty, ceny i parametry (karty ogłoszeń `ListingCard`, `RentalListingCard`, strona oferty `ListingDetailPage`, kalkulator finansowy `FinancingCalculator`, widgety `DynamicWidget`, siatka specyfikacji `SpecsGrid` oraz formularze leadowe `LeadFormPage`).
  - **Struktura siatki rat na kartach ogłoszeń**: W `ListingCard` i `RentalListingCard` kolumny rat otrzymały właściwość `min-w-0` oraz elastyczne zawijanie wierszy z zachowaniem niepodzielności poszczególnych etykiet (`whitespace-nowrap`), zapobiegając rozpychaniu lub niekontrolowanemu łamaniu dopisków `zł brutto` / `zł netto` i `/mies.`.

## 47. Normalizacja adresów email i zarządzanie statusem kont użytkowników
- **Cel**: Wyeliminowanie błędów autoryzacji (401 Invalid credentials) wynikających z wielkości liter w adresie email, białych znaków lub braku kontroli nad statusem aktywności konta.
- **Zastosowane rozwiązania**:
  - **Case-insensitive i trimowanie adresów email**: Przy tworzeniu (`POST /api/users`), edycji (`PATCH /api/users/:id`), logowaniu (`POST /api/auth/login`) oraz resetowaniu hasła adresy email są automatycznie trimowane i konwertowane do małych liter (`toLowerCase()`), a wyszukiwanie w bazie danych odbywa się w trybie `mode: 'insensitive'`.
  - **Jawny status aktywności konta (`isActive`)**: Panel zarządzania użytkownikami (`UsersPage`) oraz endpointy API w pełni wspierają pole wyboru statusu (Aktywny / Nieaktywny) przy tworzeniu i edycji konta.
  - **Precyzyjne komunikaty błędów**: Logowanie na konto dezaktywowane zwraca kod HTTP 403 z jednoznacznym komunikatem informującym o blokadzie konta, a formularz logowania wyświetla dokładną informację z backendu zamiast ogólnego błędu.

## 48. Optymalizacja wydajności mobile - Etap 1 (Hero Picture i Fonty per-brand)
- **Cel**: Zmniejszenie payloadu sieciowego i eliminacja zjawiska podwójnego pobierania obrazu hero na urządzeniach mobilnych oraz redukcja liczby i wagi fontów dla marki Motolia.
- **Zastosowane rozwiązania**:
  - **Jeden obrazek per viewport w Hero (`<picture>`)**: Komponent `OptimizedImage` obsługuje opcjonalny prop `mobileSrc`. W przypadku przekazania wariantu mobilnego renderuje element `<picture><source media="(max-width: 767px)" ... />{img}</picture>`, eliminując konieczność renderowania dwóch osobnych tagów `<img>` (desktop i mobile ukrytych przez CSS `md:hidden` / `md:block`). Zapewnia to pełną zgodność z preloadami SSR i likwiduje niepotrzebne pobranie grafiki desktopowej na telefonach.
  - **Wydzielenie fontów per-brand**: Zamiast globalnego importowania 16 plików fontów w `index.css`, utworzono dedykowane arkusze `src/styles/fonts-motolia.css` (zmienna `Inter Variable` + `Archivo Variable`) oraz `src/styles/fonts-carsalon.css` (`Outfit` + `Inter`).
  - **Brand-aware preloading fontów**: Konfiguracja `vite.config.ts` wstrzykuje preloody fontów precyzyjnie dopasowane do aktywnej marki (dla Motolii: `inter-latin-wght-normal-*.woff2` oraz `/fonts/archivo-latin-wght-normal.woff2`).

## 49. Optymalizacja kafelków funkcyjnych (Feature Tiles) na stronie głównej
- **Cel**: Drastyczna redukcja wagi grafik kafelków funkcyjnych (`/uploads/feature-tiles/`) na stronie głównej bez straty jakości wizualnej.
- **Zastosowane rozwiązania**:
  - **Dedykowane parametry optymalizatora w backendzie (`feature-tiles.ts`)**: Zmniejszono docelowe szerokości generowanych wariantów obrazów dopasowane do siatki 5-kolumnowej na desktopie i 2-kolumnowej na mobile (`largeWidth: 900`, `mediumWidth: 600`, `thumbWidth: 400`, `quality: 72`).
  - **Responsywny `sizes` i usunięcie `forceThumbnail` na froncie (`FeatureTilesSection.tsx`)**: Komponent renderuje pełny `srcset` z precyzyjną definicją `sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"`, pozwalając urządzeniom mobilnym na wybór miniatury 400w zamiast wymuszonego pliku 600w.

## 50. Integracja API PewneAuto (Toyota / Lexus) i generyczny silnik StockSyncEngine
- **Cel**: Zautomatyzowanie zasilania bazy pojazdów bezpośrednio z panelu PewneAuto (Toyota / Lexus) dla grup dealerskich (np. Toyota Chodzeń), eliminacja konieczności ręcznego wgrywania plików CSV oraz zabezpieczenie bazy przed awariami i anomaliami zewnętrznych serwisów.
- **Zastosowane rozwiązania**:
  - **Generyczny silnik giełdowy `StockSyncEngine` (Wzorzec Provider)**: Architektura oddziela silnik transakcyjny (CRUD, historia cen, archiwizacja, inwalidacja cache) od konkretnego formatu dostawcy (`PewneAutoProvider` implementujący `StockFeedProvider`).
  - **Szyfrowanie at-rest (`AES-256-GCM`) i maskowanie sekretów**: Poświadczenia API (`clientSecret`) są szyfrowane w bazie danych z użyciem klucza AES-256-GCM, a w API panelu administratora są zawsze zwracane w formie zamaskowanej (`••••••••`). Dostęp chroniony uprawnieniem `stock:sources:write`.
  - **Bezpiecznik wolumenowy (Circuit Breaker)**: Chroni przed masowym wykasowaniem lub zarchiwizowaniem bazy ofert w przypadku błędu API dostawcy (spadek liczby aut o >20% w stosunku do ostatniego udanego syncu wstrzymuje automatyczną synchronizację i wymaga świadomego zatwierdzenia przez administratora).
  - **Symulacja Dry-Run**: Dedykowany tryb symulacji weryfikuje pobrany feed, liczbę aut do dodania, aktualizacji, archiwizacji oraz dopasowania po VIN bez dokonywania żadnych zmian w bazie danych.
  - **Deduplikacja międzyźródłowa (Cross-source VIN match)**: Pojazdy uprzednio zaimportowane z CSV są automatycznie kojarzone po numerze VIN i przejmowane przez integrację API bez tworzenia duplikatów, z zachowaniem oryginalnego sluga URL i pozycji SEO.
  - **Obsługa rezerwacji (`isReserved`)**: Samochody z aktywną rezerwacją u dealera nie są archiwizowane - otrzymują odznakę „Zarezerwowane” w katalogu oraz dedykowany baner informacyjny na karcie pojedynczej oferty z zachowaniem linkowania do podobnych dostępnych aut.
  - **Historia cen i Omnibus 30d**: Każda zmiana ceny jest rejestrowana w tabeli `PriceHistory`, z której dynamicznie wyznaczana jest najniższa cena z ostatnich 30 dni w przypadku braku takiego parametru w zewnętrznym feedzie.
  - **Automatyczny harmonogram CRON**: Cykliczna synchronizacja w tle co 60 minut w godzinach 6:00 - 22:00.

## 51. Prowizja Motolia (fee_pct) i panel operatora na karcie wynajmu
- **Cel**: Rozszerzenie matrycy najmu długoterminowego o stawkę prowizji Motolia (`fee_pct`) oraz dostarczenie sprzedawcy/operatorowi platformy przejrzystego, kompaktowego narzędzia podglądu informacji wewnętrznych o ofercie i dostawcy bez zaburzania interfejsu publicznego.
- **Zastosowane rozwiązania**:
  - **Model bazy Prisma**: Dodano pole `feePct Float? @map("fee_pct")` w tabeli `rental_matrix_entries` oraz pole `availableFrom String? @map("available_from")` w tabeli `rental_vehicles` (format `YYYY-MM-DD` jako świadomy, niskokosztowy kompromis zapewniający poprawne sortowanie leksykograficzne i prostą integrację).
  - **Kontrakt kolumny CSV i deterministyczny parser**: Obsługa 28. kolumny `fee_pct` w formacie CSV (skala 0-100, separator kropka, bez znaku %).
  - **Dedykowane chronione endpointy RBAC i whitelisting pól publicznych**:
    - `GET /api/rental/vehicles/:slug/operator-info`: zwraca dane pojazdu dostępne tylko dla operatora (pełny obiekt dealera, CFM / firmę właścicielską `ownerRentalCompany`, `availableFrom`, `firstRegistrationDate`, `vin`).
    - `GET /api/rental/vehicles/:slug/operator-financials`: zwraca kalkulowane stawki prowizji (`feePct`) per partner.
    - Dostęp do powyższych wymaga uprawnienia `rental:financials:read`.
    - Publiczny endpoint `GET /api/rental/vehicles/:slug` stosuje jawną białą listę kolumn (`select`), dzięki czemu kolumny wewnętrzne (`vin`, `registrationNumber`, `ownerRentalCompanyId`, `dealerId`, `availableFrom`, `specsJson`, `isPublished`) nie są w ogóle pobierane z bazy danych ani ujawniane użytkownikom publicznym. Dodatkowo funkcja `sanitizeListing` bezwzględnie filtruje dane handlowe.
  - **Kompaktowy przycisk '?' (WCAG 24x24px) i wycentrowany modal operatora (`RentalDetailPage.tsx` + `RentalOperatorOfferModal.tsx`)**:
    - Zastąpiono duży rozwijany panel małym, żółtym przyciskiem `?` (24x24px, zgodnym z WCAG 2.5.8) z Tooltipem (`Informacje wewnętrzne dla operatora`), widocznym wyłącznie dla zalogowanych użytkowników z uprawnieniem `rental:financials:read`.
    - Kliknięcie przycisku otwiera wycentrowany modal (`Dialog`) prezentujący: Partnera wynajmu (CFM), Stawkę prowizji Motolia oraz Dostawcę pojazdu (Dealer / Salon dostarczający oraz ewentualny Właściciel floty CFM).
  - **Komponent wyboru z kalendarza (`DatePicker.tsx`) w formularzu pojazdu**:
    - W sekcji „Ceny i stan” formularza edycji/dodawania pojazdu najmu dodano pole „Dostępny od” oraz wyposażono pola daty („Data pierwszej rejestracji” i „Dostępny od”) w komponent wyboru z kalendarza oparty o `date-fns` z lokalizacją `pl`, listą rozwijaną lat/miesięcy (`captionLayout="dropdown-buttons"`) i odpornością na przesunięcia stref czasowych.
  - **Podgląd w panelu administracyjnym (`RentalMatrixPage.tsx`)**: Komórki macierzy przestawnej (Pivot Table) wyświetlają etykietę `fee: X%`.

## 52. Dwuwarstwowy system buforowania Redis SSR Cache i API Cache
- **Cel**: Drastyczne skrócenie czasu odpowiedzi (TTFB < 10ms z bufora Redis) dla stron renderowanych po stronie serwera (SSR HTML) oraz publicznych zapytań API JSON (katalog ofert i pojazdów najmu), optymalizacja zużycia RAM instancji i pełna integracja z krawędzią Cloudflare Edge Cache dla stron HTML.
- **Zastosowane rozwiązania**:
  - **Dedykowany serwis SSR Cache (`ssr-cache.ts`)**:
    - Przechowywanie skompresowanego bufora HTML (`gzip Buffer`) w Redisie pod kluczami `${brand}:${env}:${host}:ssr:v1:<cacheKey>`.
    - Dwuetapowy model TTL: twardy czas wygaśnięcia 24h (`HARD_TTL_SECONDS = 86400`) oraz próg świeżości 6h (`FRESH_TTL_MS = 6 * 3600 * 1000`).
    - Wzorzec Stale-While-Revalidate (SWR): żądania trafiające na wpis starszy niż 6h natychmiast otrzymują stary HTML z bufora, podczas gdy odświeżenie w tle wykonuje się asynchronicznie.
    - Ochrona przed Cache Stampede (`revalidatingKeys` z 60s timeoutem i okresowym czyszczeniem mapy): blokada równoległego uruchamiania wielu renderów dla tej samej trasy.
    - Krótki czas życia (5 min) dla odpowiedzi z kodami błędów lub stron z dyrektywą `noindex`.
    - Dla tras `/samochody` kanoniczne rozwiązywanie parametrów query opiera się na 60-sekundowym in-memory buforze katalogu marek i modeli (`getBrandCatalog`, `getModelCatalog`), zapobiegając zanieczyszczeniu kluczy w Redisie i pętlom przekierowań 301.
  - **Dedykowany serwis API Cache (`api-cache.ts`)**:
    - Buforowanie zserializowanych i skompresowanych obiektów JSON (gzip dla >512B) pod kluczami `${brand}:${env}:${host}:api:v1:...` dla `GET /api/listings` i `GET /api/rental/vehicles` (180s TTL) oraz detali ofert/pojazdów po slugu (300s TTL).
    - Ochrona Singleflight przed Cache Stampede (`inFlightRequests` Map): jednoczesne zapytania o ten sam wygasły klucz dzielą jedną operację pobrania z bazy danych SQL.
    - Kanoniczne budowanie kluczy (`buildListingsQueryCacheKey`, `buildRentalVehiclesQueryCacheKey`) z alfabetycznym sortowaniem parametrów query, klampowaniem paginacji do 10000, bezpiecznym zakresem numerycznym (np. cena do 100 mln PLN, przebieg do 2 mln km), sanitizacją długości fraz wyszukiwania (`q`/`search` do 100 znaków) oraz precyzyjną normalizacją walut (`currency === 'EUR'`) i zachowaniem pól sortowania camelCase (np. `minMonthlyRateNet`).
    - Zachowanie wielkości liter w zapytaniu `parsed.q` do bazy danych (poprawne działanie zapytań wielkich liter, np. "ABS", w polach wyposażenia).
  - **Bezpieczeństwo i izolacja autoryzacji**:
    - Żądania zweryfikowanych użytkowników (np. zalogowany dealer, administrator) bezwzględnie omijają bufor Redis (odczyt i zapis) i zwracają nagłówek `Cache-Control: private, no-store`.
    - Trasy administracyjne (`/admin/*`) oraz kody 404/500 nigdy nie są buforowane na krawędzi publicznej.
  - **Zero blokowania Event Loopa (Kursor SCAN)**:
    - Eliminacja komendy `KEYS` na rzecz nieblokującej pętli `SCAN` (`COUNT 200`) i batchowego usuwania kluczy (`DEL` w paczkach po 100).
  - **Pełne pokrycie inwalidacji we wszystkich ścieżkach zapisu (`cache-invalidation.service.ts`)**:
    - Rozdzielenie stron agregacyjnych na `LISTING_AGGREGATE_URLS` (sprzedaż) i `RENTAL_AGGREGATE_URLS` (najem), co zapobiega zbędnemu czyszczeniu katalogu najmu przy modyfikacji aut sprzedaży.
    - Natychmiastowe czyszczenie lokalnych buforów komponentów (`__resetComponentCaches()`) przy każdej operacji inwalidacji, co chroni przed serwowaniem starych banerów lub ustawień siatki.
    - Selektywna inwalidacja zmienionych ofert (zarówno sluga, jak i ID, oraz starych i nowych adresów przy edycji PATCH), stron marek/modeli i agregatów w silnikach `CSFlow` i `StockSyncEngine` (wyzwalana wyłącznie przy rzeczywistych zmianach pól/ceny ze znormalizowanym porównaniem null/undefined).
    - Globalna inwalidacja strefy (`purgeEverything: true`) przy masowym przeliczeniu cen wszystkich ofert w ustawieniach (`settings.ts`) oraz masowym usuwaniu/archiwizowaniu według źródła (`listings.ts`).
    - Asynchroniczne oczekiwanie (`await`) na wykonanie inwalidacji we wszystkich trasach mutacji (`listings.ts`, `rental-vehicles.ts`, `rental-matrix.ts`, `settings.ts`, `hero-banners.ts`, `seo-content.ts`).
  - **Poprawność nagłówków CORS i Cloudflare**:
    - Ustawianie `Vary: Origin, Accept-Encoding` na publicznych endpointach API JSON.
    - Wewnętrzny endpoint SSR `/api/render` używa `Vary: Accept-Encoding` i `s-maxage=3600` do optymalnego buforowania HTML na krawędzi Cloudflare.

## 53. Stabilna ścieżka LCP strony głównej i responsywne obrazy katalogu
- Strona główna zachowuje statyczny import `HomePage`, zgodny shell SSR oraz pojedynczy preload obrazu LCP. Zapobiega to miganiu hero i zerwaniu obrazu podczas montowania Reacta.
- Szczegółowe niezmienniki i checklistę opisuje `docs/HOMEPAGE_PERFORMANCE_ARCHITECTURE.md`.
- Katalogi `/nowe` i `/uzywane` preloadują tylko obraz pierwszej karty i używają istniejących wariantów WebP `-thumb`, `-md` oraz pełnego obrazu.
- Nieistniejące warianty AVIF nie są już wybierane przez przeglądarkę. Usuwa to 404 przed pobraniem właściwego obrazu i pozwala użyć mniejszego wariantu WebP na mobile.
- Tylko pierwsza karta otrzymuje `loading="eager"` i `fetchpriority="high"`; pozostałe obrazy są ładowane leniwie.
- Widoki kondycji czekają na ustawienia siatki przed pierwszym zapytaniem o oferty, dzięki czemu nie pobierają kolejno 32 i 30 tych samych rekordów.
- Gdy pierwsza oferta katalogu nie ma zdjęcia, SSR preloaduje używany przez kartę placeholder zamiast obrazu późniejszej oferty. Dzięki temu preload pozostaje zgodny z rzeczywistym elementem LCP.

## 54. Izolacja grafu zależności `/nowe` i `/uzywane`
- Trasy `/nowe` i `/uzywane` nie importują już komponentów, klienta API ani logiki scalania ofert najmu, ponieważ w tych widokach najem jest stale ukryty. Zmniejsza to chunk trasy i liczbę zależności wykonywanych przed wyrenderowaniem pierwszej karty.
- Zmiana jest zamknięta w lazy chunku `ConditionPage`: nie modyfikuje globalnego `App`, statycznego shellu, preloadów ani entry bundle homepage.
- Pełne drzewo `modulepreload` pozostaje domyślnie wyłączone, ponieważ wcześniejszy eksperyment wykazał opóźnienie strumienia HTML i FCP. Optymalizacja redukuje zależności u źródła zamiast podnosić ich priorytet.

## 55. Optymalizacja ścieżki krytycznej katalogów (`/nowe` i `/uzywane`)
- **Usunięcie martwego preloadu `/api/geo`**: Usunięto nieużywany tag `<link rel="preload" href="/api/geo">` z `index.html`.
- **Wstrzykiwanie ustawień aplikacji w SSR (`window.__APP_SETTINGS__`)**: `render.ts` wstrzykuje publiczne ustawienia aplikacji bezpośrednio do tagu `<head>` w dokumencie HTML. `useAppSettings` konsumuje je natychmiast jako `initialData` z `initialDataUpdatedAt: 0` (rewalidacja w tle bez blokowania). Bramki `useListings` i `ConditionPage` nie blokują się już na zapytaniu sieciowym o ustawienia (`settings !== undefined` zamiast oczekiwania na `isFetched`).
- **Prefetch katalogu w nagłówku HTML (`window.__CATALOG_PREFETCH__`)**: Dla pierwszej strony tras `/nowe` oraz `/uzywane` serwer SSR generuje jedno-linijkowy skrypt z asynchronicznym wywołaniem `fetch()` dla domyślnego zapytania `/api/listings?...`. Zapytanie sieciowe o listę ofert rozpoczyna się równolegle z parsowaniem dokumentu HTML, na sekundy przed pobraniem i wykonaniem bundle'a JS. Funkcja `listingsApi.getListings` natychmiast konsumuje przechowywany promise przy zgodności adresu URL.

## 56. Optymalizacja czasu wątku głównego (Main Thread) i wariantów obrazów
- **Warianty obrazów i deskryptor `-md` 900w**: Zmieniono domyślną szerokość wariantu pośredniego `mediumWidth` z 1200 na 900 px w `image-optimizer.ts`. Zaktualizowano deskryptory srcset w `OptimizedImage.tsx` oraz `seo-meta.ts` (`buildImagePreload` i `homeHeroShellHtml`) z `1200w` na `900w`. Zapobiega to nadmiarowemu pobieraniu plików 1200 px dla slotów kart 422 CSS px na urządzeniach mobilnych (DPR 1.75–2.0). Odchudzono również statyczny placeholder `public/motolia-placeholder.webp` o ponad 57% do 9 KB.
- **Konsolidacja mikro-chunków (`vendor-lucide` i `vendor-radix`)**: W konfiguracji `vite.config.ts` wdrożono regułę `build.rollupOptions.output.manualChunks`, która grupuje ikony `lucide-react` oraz komponenty bazowe `@radix-ui/*` w dwa stabilne, współdzielone chunki zamiast ponad 20 pojedynczych mikro-plików 0.3–0.7 KB.
- **Czyszczenie operacji I/O w wątku głównym**: Usunięto deweloperskie wywołania `console.log` ze ścieżki mapowania 32 kart katalogu (`listingMapper.ts`) oraz zapytań API (`api.ts`).

## 57. Nowoczesny stepper procesu zakupu (PurchaseProcessStepper)
- **Cel**: Uproszczenie i unowocześnienie prezentacji etapów zakupu na stronie głównej oraz na kartach ofert i wynajmu długoterminowego.
- **Zmiany w interfejsie**:
  - Usunięcie zdublowanego, osobnego rzędu żółtych kółek z numerami 1-5 nad ikonami.
  - Zintegrowanie mikro-badge'a numerycznego bezpośrednio w narożniku kafelka ikony (`rounded-2xl` z motywem Motolia Soft Yellow).
  - Wprowadzenie eleganckich łączników procesowych w postaci linii z gradientem i okrągłych szewronów kierunkowych (`ChevronRight`), precyzyjnie wyśrodkowanych w osi poziomej ikon.
  - Na desktopie i tabletach wszystkie 5 kroków układa się zawsze w 1 ciągły wiersz (`grid-template-columns: repeat(5, minmax(0, 1fr))`).
  - Na urządzeniach mobilnych (<= 768px) stepper automatycznie przełącza się w pionowy łańcuch ze strzałkami skierowanymi w dół.
  - W wariancie kompaktowym (`variant="compact"` na kartach pojazdów) wdrożono zoptymalizowane hasła Smart Micro-Copy zbijające obiekcje (np. „100% zdalnie, minimum formalności”, „Wygodnie online lub przez kuriera”), zachowując kompaktowy profil bez spychania kalkulatora i formularzy kontaktowych.

## 58. Obsługa powiadomień e-mail dla leadów i separacja zgłoszeń w Thulium / Helpdesk
- **Cel**: Wyeliminowanie problemu łączenia (scalania) wiadomości e-mail w jeden wątek w systemach helpdesk/CRM (np. Thulium) przy zgłoszeniach typu szybki kontakt bez adresu e-mail klienta.
- **Unikalny temat wiadomości**: Każdy e-mail powiadomienia o leadzie posiada teraz unikalny temat z numerem referencyjnym leada (np. `[Motolia] [AF-73267175] Szybki kontakt: 512 655 885`). Zapobiega to automatycznemu grupowaniu ticketów po stronie systemów pocztowych i CRM.
- **Nagłówek Reply-To**: Nagłówek `Reply-To` jest ustawiany wyłącznie wtedy, gdy klient podał prawdziwy adres e-mail. Przy zgłoszeniach telefonicznych bez adresu e-mail nagłówek nie jest dodawany (brak sztucznych adresów, co zapobiega błędom zwrotnym / bounce w Thulium).
- **Prezentacja danych w treści e-maila**:
  - Pole imię i nazwisko: jeśli puste lub domyślny placeholder, wyświetla wartość `null`.
  - Pole e-mail: jeśli brak, wyświetla wartość `null`.
  - Dane kontaktowe: klikalne linki `tel:` oraz `mailto:` (jeśli obecny), preferowany kanał kontaktu.
  - Kontekst zgłoszenia: typ leada, unikalny numer referencyjny, źródło ruchu (UTM/trafficSource), ID landing page.
  - Dane pojazdu / wynajmu: marka, model, rocznik, VIN, cena, przebieg, dealer, bezpośredni link do oferty.
  - Dane kalkulatora finansowania: wybrany produkt finansowy, kwota, okres, pierwsza wpłata, miesięczna rata, wykup.
  - Wiadomość klienta: zabezpieczony przed HTML injection blok cytatu z zachowaniem formatowania.
## 59. Domyślny rodzaj napędu („Przedni”) przy imporcie ogłoszeń i ekstrakcji AI
- **Cel**: Wyeliminowanie sytuacji, w których brak podania napędu przez sprzedawcę na Otomoto powodował błędną interpretację (np. halucynację AI klasyfikującą wersje z literą „X”, mHEV lub standardowe wersje jako napęd 4x4) lub pozostawianie pustej wartości.
- **Zachowanie**:
  - **Parser wtyczki (`content.js` / `popup.js`)**: W przypadku braku parametru napędu na Otomoto lub braku dopasowania, parser oraz formularz wtyczki Chrome ustawiają domyślnie wartość `'Przedni'`.
  - **Warstwa AI (`ai.js`)**: Prompt systemowy precyzuje, że klasyfikacja jako `'4x4'` lub `'Tylny'` jest dozwolona wyłącznie, gdy rodzaj napędu jest wprost wymieniony w opisie lub specyfikacji ogłoszenia. W przeciwnym razie AI zwraca `'Przedni'`.
  - **Backend CarScout (`listings.ts` - trasy `/api/v1/external/listings`)**: Funkcja `normalizeDrive` w przypadku braku parametru napędu lub nierozpoznanej wartości przypisuje domyślnie `'Przedni'`.

## 61. Moduł Motolia Pipeline CRM (Kamień Milowy M1 - Core, Inbox i Kolejka Doradcy)
- **Cel**: Dedykowany, operacyjny moduł CRM dla doradców leasingowych i menedżerów floty zastępujący arkusz kalkulacyjny i umożliwiający podejmowanie leadów w czasie poniżej 30 sekund.
- **Kolejka Doradcy (Queue - Domyślny widok operacyjny)**:
  - Automatyczny podział spraw na 4 priorytetowe sekcje:
    1. **Zaległe (Overdue)**: sprawy z przekroczonym terminem SLA (czerwona odznaka ostrzegawcza).
    2. **Dzisiejsze (Today)**: sprawy i telefony zaplanowane na bieżący dzień.
    3. **Nowe w Inboxie (Inbox)**: niepodjęte zapytania ze strony www czekające na 1-kliknięciową kwalifikację.
    4. **Bez wyznaczonej akcji (No Action)**: sprawy aktywne bez zaplanowanego terminu kolejnego kroku.
  - Szybkie akcje 1-kliknięciowe w wierszu sprawy:
    - **Kontakt**: rejestracja rozmowy/e-maila/SMS-a wraz z natychmiastowym wyznaczeniem kolejnego terminu kontaktu.
    - **Termin / Snooze**: szybkie odłożenie na jutro (+1d), za 3 dni (+3d) lub za tydzień (+7d).
    - **Etap**: natychmiastowe przejście do kolejnej fazy procesu.
    - **Kwalifikacja**: 1-kliknięciowe przekształcenie leada z Inboxu w sprawę CRM z przypisaniem doradcy.
- **Tablica Kanban (Board)**:
  - Wizualny widok 7 kanonicznych faz procesu (`INBOX`, `QUALIFICATION`, `SELECTION`, `COMPLETING`, `FINANCIAL_DECISION`, `CONTRACT`, `DELIVERY`).
  - Przeciąganie spraw (drag-and-drop) między kolumnami z automatyczną weryfikacją reguł przejść.
  - Karty spraw z wyróżnieniem wybranego pojazdu, typu klienta (B2C/B2B), formy finansowania, doradcy oraz statusu terminu SLA.
- **Audytowalny Event Log (Append-Only Event Sourcing)**:
  - Wszystkie operacje biznesowe (utworzenie, zmiana etapu, przypisanie doradcy, kontakt, wyznaczenie kolejnej akcji, zamknięcie sprawy) są atomowo rejestrowane jako niemutowalne zdarzenia w tabeli `pipeline_events`.
  - Blokada bazodanowa (trigger PostgreSQL) uniemożliwiająca usuwanie oraz modyfikację rekordów zdarzeń.
  - Dokładny pomiar czasu trwania spraw w poszczególnych fazach (`durationSeconds`) z automatycznym resetem znacznika `phaseEnteredAt`.
- **Atomowa numeracja spraw**:
  - Unikalny, sekwencyjny format `MTL-YYYY-XXXXX` (np. `MTL-2026-00042`) alokowany atomowo przez instrukcję `INSERT ... ON CONFLICT (year) DO UPDATE` z rocznym resetem licznika.
- **Wymóg atrybucji leada**:
  - Bezwzględny wymóg wskazania źródła ruchu (`leadSource`: META, GOOGLE, ORGANIC, TV, DEALER, PARTNER, REFERRAL, OTHER) przy każdym tworzeniu sprawy.
- **Uprawnienia i Bezpieczeństwo**:
  - Dostęp chroniony uprawnieniami `pipeline:read` oraz `pipeline:write`.
  - Ścisła izolacja wielotenantowa oparta o token JWT (`scopeType`, `scopeId`).

### 62. Moduł Pipeline CRM - Oferty, Wnioski Leasingowe, Równoległe Rundowanie, Rerouting, Dokumenty i Bramki Etapów (Kamień Milowy M2)
- **Kandydaci pojazdów (Vehicle candidates shortlist)**:
  - Możliwość dodawania do sprawy wielu propozycji pojazdów: ze stoku ogłoszeń (`Listing`), z floty wynajmu (`RentalVehicle`) lub aut spoza katalogu wprowadzanych ręcznie.
  - Wybór 1 pojazdu głównego (`selectionStatus = 'SELECTED'`) stanowiącego bazę pod ofertę i wniosek leasingowy, z emisją zdarzeń `VEHICLE_CANDIDATE_ADDED` oraz `VEHICLE_SELECTED`.
- **Oferty i Kalkulacja PMT w miejscu (Offers in-place)**:
  - Jedna aktywna oferta edytowana bezpośrednio na karcie sprawy bez skomplikowanych kreatorów.
  - Automatyczne przeliczanie raty miesięcznej w oparciu o silnik PMT i standardowe parametry rynkowe.
  - Wersjonowanie ofert (`versionNumber + 1`) przy tworzeniu nowych wariantów (`supersedeOffer`) oraz rejestracja przedstawienia (`OFFER_PRESENTED`) i akceptacji klienta (`OFFER_ACCEPTED`).
- **Wnioski leasingowe i Równoległe Rundowanie (Parallel Applications & Reroute)**:
  - Pełny cykl życia wniosku u partnerów finansowych (`DRAFT` → `PRECHECK_SUBMITTED` / `FULL_SUBMITTED` → `APPROVED` / `CONDITIONALLY_APPROVED` / `REJECTED` / `WITHDRAWN`).
  - **Dopuszczenie wniosków równoległych**: doradca może składać wnioski równolegle do wielu finansujących w tej samej rundzie (`roundMode = 'JOIN_CURRENT'`) lub otwierać nowe rundy (`roundMode = 'NEW_ROUND'`).
  - Klucz unikalny `[opportunityId, financierId, roundNumber]` gwarantuje brak duplikatów w tej samej rundzie.
  - Wymóg wskazania przyczyny odmowy ze słownika `FINANCIER` przy negacie.
  - **Odrzucenie wniosku nigdy nie zamyka sprawy** - sprawa pozostaje aktywna w stanie `OPEN`.
  - **1-klikowy Reroute**: natychmiastowe utworzenie kolejnego wniosku w nowej rundzie (`roundNumber + 1`, powiązanie `rerouteFromId`), delegacja powrotu do etapu weryfikacji finansowej bez duplikacji logiki i wyemitowanie zdarzenia `APPLICATION_REROUTED`.
  - **Wycofanie przy podpisaniu umowy**: wskazanie wygranego wniosku (`contractedApplicationId`) i podpisanie umowy (`contractSignedAt`) automatycznie wycofuje pozostałe aktywne wnioski ze statusem `WITHDRAWN` i powodem `CONTRACTED_ELSEWHERE` (nie liczącym się jako porażka doradcy) oraz przypina prowizję do wygranego partnera.
- **Bramki Etapów i Pasek Kompletności (Stage Gating Engine & Completeness Bar)**:
  - Centralny mechanizm walidacji wymagań `PipelinePhaseRequirement` z blokadą wyłącznie dla ruchów w przód (ruchy wstecz są zawsze dozwolone).
  - Semantyka reguł `application.*`: warunek jest spełniony, gdy **dowolny aktywny (nie-WITHDRAWN)** wniosek spełnia dane kryterium.
  - Twarde bramki (`HARD`):
    - `FINANCIAL_DECISION`: wymaga rodzaju finansowania, ceny pojazdu, raty miesięcznej, wybranego finansującego oraz NIP firmy (dla klientów B2B).
    - `DELIVERY`: wymaga daty podpisania umowy (`contractSignedAt`).
  - Próba niespełnionego przejścia w przód zwraca strukturalny błąd **HTTP 422** z listą brakujących pól, całkowicie wycofuje transakcję (rollback bazy) i nie zapisuje żadnych zdarzeń.
  - Interfejs wyświetla dedykowany modal `StageGateAlertModal` z czytelnym wyjaśnieniem brakujących danych.
  - **Pasek Kompletności (Completeness Bar)**: dynamiczny wskaźnik gotowości sprawy do **kolejnego etapu** procesu (`met/total` i procent), wyliczany jednoprzebiegowo w zapytaniach listowych i prezentowany na kartach tablicy Kanban oraz w wierszach kolejki doradcy.
- **Automatyczna Checklista Dokumentów (Documents)**:
  - Automatyczna materializacja listy wymaganych dokumentów (`PipelineDocumentRequirement`) jako **suma (unia)** wymagań wszystkich aktywnych partnerów finansowych powiązanych ze sprawą oraz typu klienta i produktu.
  - 1-klikowa zmiana statusu (`REQUIRED` → `REQUESTED` → `RECEIVED` → `VERIFIED` / `WAIVED`) z automatycznym pomiarem czasu oczekiwania na dokument (`hoursSinceRequest`).
  - Zmiana produktu oznacza nieaktualne dokumenty jako `WAIVED`, gwarantując, że już otrzymane i zweryfikowane dokumenty nie znikną z historii sprawy.
- **Integracja Thulium / Motolia pipeline context**:
  - CRM Connector przyjmuje pole `pipeline_context` i renderuje z niego w treści ticketu Thulium blok z kontekstem sprawy Motolia: numer/opportunity ID, etap, status, doradcę, source lead oraz link do panelu pipeline na motolia.pl. Wypełnienie tego pola wymaga jednak integracji po stronie wywołującego (n8n / agent AI) — dziś leady trafiają do Thulium mailem przez `sendLeadEmail`, więc dopóki taka integracja nie powstanie, blok się nie pojawia.
  - W module pipeline widoczne są identyfikatory powiązań Thulium (`thuliumTicketId`, `thuliumCustomerId`) oraz metadane źródłowego leada, co ułatwia korelację ticketu z kartą sprawy.
  - Webhook zwrotny przyjmuje natywny format powiadomień Thulium (pole `action`). Nagrania rozmów trafiają do historii sprawy dzięki parze zdarzeń `AGENT_RINGING` (dopasowanie po numerze telefonu do jednej otwartej sprawy) + `RECORDING_READY` (dopasowanie po `connection_id` zapisanym wcześniej przy `AGENT_RINGING`). Brak jednoznacznego dopasowania nie zmienia danych; endpoint jest chroniony Basic Auth, limitem żądań i idempotencją zdarzeń.
- **Edycja i aktualizacja danych klienta (Customer Data Management)**:
  - **Kwalifikacja leada**: w oknie `QualifyLeadModal` doradca może od razu skorygować lub uzupełnić dane kontaktowe (imię i nazwisko leada np. zamiana placeholderu "Szybki kontakt" na właściwe personalia, telefon, e-mail, firma, NIP) przed utworzeniem sprawy.
  - **Karta sprawy (Modal szczegółów)**: w zakładce *Klient* oraz bezpośrednio z nagłówka sprawy (przycisk edycji obok nazwiska) doradca może w dowolnym momencie zaktualizować imię i nazwisko, typ klienta (`B2C` / `B2B` / `UNKNOWN`), numer telefonu, adres e-mail, nazwę i NIP firmy, preferowaną formę finansowania oraz źródło leada / tagi kampanii. Zmiany są natychmiast synchronizowane w bazie (`PipelineCustomer` oraz `PipelineOpportunity`).




### 63. Moduł Wynajmu - Stok Pojazdów Partnerów, Warianty Cenowe Matrycy i Silnik Wyceny (Etap 1)
- **Cel**: automatyzacja warstwy danych o stoku pojazdów z wynajmu długoterminowego (np. Ayvens) oraz deterministyczny silnik wyceny raty dla konkretnego numeru stockowego na podstawie parametrów zapytania.
- **Warianty cenowe w matrycy wynajmu (`priceVariant`)**:
  - Rozszerzenie matrycy stawek `RentalMatrixEntry` o wymiar `priceVariant` (domyślnie `"base"`) oraz klucz unikalny `[assignmentId, months, annualKm, priceVariant]`.
  - Możliwość przechowywania alternatywnych cenników (np. marża 6%, 8%) obok cennika bazowego.
  - Import CSV matrycy wspiera kolumny `price_variant` / `variant` z pierwszeństwem wartości wiersza nad parametrem zapytania i domyślnym fallbackiem do `"base"`.
  - Czyszczenie poprzednich wpisów przy imporcie jest ograniczone wyłącznie do importowanych wariantów (`priceVariant: { in: variantsToDelete }`), co zapobiega nadpisywaniu innych wariantów stawek.
- **Koszt nadprzebiegu z oponami (`overMileageTiresNoLimit`)**:
  - Obsługa dedykowanej stawki za nadprzebieg w wariancie z oponami (kolumna 23 cennika Ayvens).
  - Wycena z parametrem `tires=true` zwraca stawkę `overMileageTiresNoLimit`. Jeśli wartość w matrycy nie jest uzupełniona, system zwraca `overMileageNet: null` oraz `overMileageUnavailable: true` zamiast błędnie podstawiać stawkę bez opon.
- **Baza stoku pojazdów wynajmu (`RentalStockUnit`)**:
  - Nowa tabela `rental_stock_units` powiązana z firmą wynajmu (`RentalCompany`), przechowująca numer stocku (`stockNo`), numer specyfikacji cennikowej (`specNo`), notatkę specyfikacji (`specNoNote`), dane pojazdu (marka, model, wersja, skrzynia, napęd, moc, paliwo, kolor, VIN), daty dostępności oraz status aktywności (`isActive`).
  - Klucz unikalny `[rentalCompanyId, stockNo]`.
- **Import kanonicznego CSV stoku (`POST /api/rental-stock/import`)**:
  - Obsługa kanonicznego formatu CSV z elastycznym parsowaniem dat (`YYYY-MM-DD`, `DD.MM.YYYY`, ISO) i automatyczną ekstrakcją czystego numeru specyfikacji (`extractSpecNo`) z zachowaniem dopisków (np. "294 (krajowy)") w `specNoNote`.
  - Wymóg obecności co najmniej jednego poprawnego wiersza danych stoku (blokada przed przypadkowym wyczyszczeniem stoku przy pustym pliku).
  - Mechanizm upsert: aktualizacja istniejących jednostek i dodawanie nowych.
  - Automatyczna deaktywacja brakujących: jednostki danej firmy najmu nieobecne w przesyłanym pliku CSV są oznaczane jako `isActive: false`.
  - Zwraca raport: `{ totalRows, inserted, updated, deactivated, unmatched, errors }`.
- **Wyszukiwarka stoku (`GET /api/rental-stock/search`)**:
  - Wyszukiwanie aktywnych jednostek po numerze stocku, marce, modelu, opisie lub numerze VIN.
  - Filtr po firmie wynajmu (`companyId`).
  - Dynamiczne wzbogacanie wyników o flagę `hasPricing` (czy istnieje powiązana specyfikacja w matrycy stawek) oraz sortowanie priorytetyzujące pojazdy wycenione (`hasPricing` malejąco) oraz z najwcześniejszą datą odbioru, z poprawnym zliczaniem `total` w bazie.
- **Silnik wyceny raty dla numeru stockowego (`GET /api/rental-stock/:id/quote`)**:
  - Parametry: `months` (24/36/48/60), `annualKm` (10000..50000), `insurance` (udział własny: 1000, 500 lub 0 PLN), `tires` (true/false), `variant` (np. base, 6, 8), opcjonalny `companyId`.
  - Deterministyczne mapowanie ze stoku na specyfikację matrycy z wyborem najniższego identyfikatora przypisania (`assignmentId`) w przypadku wielu pasujących wpisów o identycznych stawkach.
  - Wykrywanie rozbieżności stawek: w przypadku niezgodności stawek pomiędzy wieloma przypisaniami tej samej specyfikacji endpoint zwraca `HTTP 409 Conflict` z listą rozbieżności.
  - Zwraca pełną strukturę wyceny: identyfikatory, dane pojazdu, parametry wejściowe, ratę bazową, zwyżki za ubezpieczenie i opony, finalną ratę netto/brutto oraz stawkę za nadprzebieg.

### 64. Składanie i Wysyłka Wniosku Najmu do Partnera Finansowego (Etap 2)
- **Cel**: zastąpienie ręcznego wysyłania maili z wnioskiem do partnera finansowego (np. Ayvens) pojedynczym, atomowym wywołaniem API orkiestrującym założenie klienta, sprawy w pipeline, przypisanie kandydata pojazdu ze stoku, zamrożenie oferty, rejestrację wniosku w statusie `PRECHECK_SUBMITTED`, wysyłkę sformatowanego zgłoszenia e-mail oraz rejestrację audytowalnych zdarzeń biznesowych.
- **Bezpieczeństwo danych wrażliwych (PESEL)**:
  - Przechowywanie numeru PESEL w `PipelineCustomer` w formie zaszyfrowanej kryptograficznie symetrycznym algorytmem AES-256-GCM (`peselEnc`) z 12-bajtowym wektorem IV oraz 16-bajtowym tagiem uwierzytelniającym, wraz z maskowaną reprezentacją (`peselMasked`: `*******1234`).
  - Twarda reguła fail-closed: brak lub nieprawidłowy format klucza szyfrowania `PESEL_ENCRYPTION_KEY` natychmiast przerywa operację ze statusem **HTTP 503**, nie dopuszczając do zapisu nieszyfrowanych danych.
  - Algorytmiczna walidacja sumy kontrolnej numeru PESEL: błędna suma kontrolna natychmiast odrzuca żądanie kodem **HTTP 422**, bez tworzenia żadnych encji w bazie i bez zwracania numeru PESEL w treści komunikatu błędu.
  - Ochrona przed wyciekiem (PII Guard): odczyt sprawy `GET /api/pipeline/opportunities/:id` oczyszcza obiekt klienta z pola `peselEnc`. Odszyfrowany PESEL jest dostępny wyłącznie na dedykowanym endpointcie `GET /api/pipeline/customers/:id/pii` chronionym uprawnieniem `pipeline:pii:read`.
  - Bezwzględny zakaz występowania numeru PESEL w logach serwera, tabeli zdarzeń `PipelineEvent`, dead letterach oraz parametrach zapytań (URL query string).
- **Złożenie wniosku o wynajem (`POST /api/pipeline/rental-applications`)**:
  - Walidacja danych klienta dla osób fizycznych (`B2C`: wymagane imię, nazwisko oraz poprawny PESEL) oraz firm (`B2B`: wymagana nazwa firmy lub imię i nazwisko osoby kontaktowej oraz NIP).
  - Weryfikacja niejednoznaczności klienta: jeśli podany telefon lub email pasuje do wielu kartotek w ramach organizacji, API zwraca **HTTP 409 Conflict** z listą kandydatów do manualnego rozstrzygnięcia.
  - Atomowa transakcja bazodanowa:
    1. Utworzenie lub aktualizacja kartoteki klienta (`PipelineCustomer`).
    2. Utworzenie nowej sprawy w pipeline (`PipelineOpportunity`) w etapie `QUALIFICATION`.
    3. Pobranie i zweryfikowanie deterministycznej wyceny ze stoku (`calculateRentalQuote`).
    4. Utworzenie wybranego kandydata pojazdu (`PipelineVehicleCandidate`) z powiązaniem do `RentalStockUnit` (`rentalStockUnitId`).
    5. Zapisanie zamrożonej oferty handlowej (`PipelineOffer`) z wariantem marży (`rentalPriceVariant`), poziomem ubezpieczenia (`rentalInsuranceVariant`) i flagą opon (`rentalTiresIncluded`).
    6. Utworzenie wniosku u partnera finansowego (`PipelineApplication`) i przejście do stanu `PRECHECK_SUBMITTED`.
  - Niezależność wysyłki e-mail: wysyłka wiadomości SMTP do odbiorców partnera (`applicationEmailTo` z tabeli `PipelineFinancier`) odbywa się poza transakcją bazodanową. Ewentualny błąd serwera pocztowego zwraca **HTTP 201** z flagą `emailStatus: "FAILED"` i nie cofa transakcji ani nie zwraca błędu 500.
  - Rejestracja zdarzenia `RENTAL_APPLICATION_EMAILED` z adresem odbiorców i statusem wysyłki.
- **Ponowna wysyłka zgłoszenia e-mail (`POST /api/pipeline/applications/:id/resend-email`)**:
  - Możliwość ponownego wysłania wniosku do partnera finansowego w przypadku awarii serwera pocztowego.
  - Odtworzenie danych ze snapshotu zamrożonej oferty i wybranego pojazdu bez konieczności ponownego przeliczania stawek.
- **Widoczność w Thulium**:
  - Dzięki utworzeniu powiązania `PipelineCustomer` z poprawnym numerem telefonu, istniejący lookup doradcy w Thulium natychmiast widzi nową sprawę, numer wniosku i pojazd bez konieczności jakichkolwiek modyfikacji integracji z Thulium.

### Korekta zależności katalogu mobilnego
- SearchPage korzysta wyłącznie z danych sprzedaży; usunięto wyłączone zapytanie najmu i nieosiągalne karty najmu. Cache najmu nie uzupełnia już filtrów sprzedaży.
- HomePage pozostaje importowany synchronicznie, bez zmiany zachowania względem dev.
- Audyt i ograniczenia pomiarów: `docs/performance/astra-mobile-review.md`. Nie potwierdzono jeszcze poprawy LCP ani celu 200-250 ms.

### 65. Liczniki Ofert Dealera w Backoffice oraz Automatyczne Przywracanie Ofert w StockSyncEngine
- **Cel**: wyeliminowanie mylących rozbieżności pomiędzy liczbą ofert widoczną w panelu dealerów a stanem faktycznym na listingu publicznym oraz zapewnienie bezstratnej migracji ofert z importów CSV do automatycznych integracji API (np. PewneAuto).
- **Zliczanie ofert dealera w backoffice (`GET /api/admin/dealers`, `GET /api/admin/dealers/:id`)**:
  - Wskaźnik `_count.listings` uwzględnia wyłącznie oferty aktywne (`where: { isArchived: false }`), zapobiegając wliczaniu ofert zarchiwizowanych/sprzedanych do bieżącego stanu salonu w panelu administracyjnym.
- **Automatyczne odarchiwizowanie w StockSyncEngine**:
  - Silnik synchronizacji feedów (`StockSyncEngine`) przy napotkaniu pojazdu (po VIN lub zewnętrznym identyfikatorze), który był wcześniej oznaczony jako archiwalny z powodem `Not in latest import` (wynikającym z niepełnych lub selektywnych importów CSV), automatycznie przywraca ofertę do stanu aktywnego (`isArchived: false`, `archivedReason: null`, `archivedAt: null`), zachowując jednocześnie twardą ochronę przed odarchiwizowaniem ofert wygaszonych ręcznie przez administratora (`Manual archive`).

### 66. Panel Zarządzania Programem Pracowniczym (Backoffice Superadmina)
- **Cel**: Umożliwienie Superadminowi platformy pełnej konfiguracji firm partnerskich, programów rabatowych, generowania bezpiecznych kodów dostępu dla pracowników, tworzenia ofert specjalnych oraz masowego importu flotowych matryc wynajmu długoterminowego (CSV).
- **Lokalizacja i Autoryzacja**:
  - Panel dostępny pod adresem `/admin/employee-programs` w backoffice Motolia.
  - Ochrona uprawnieniem `platform:settings:write` (wymaga roli Superadmina platformy; odmowa dostępu 403 dla pozostałych ról).
- **Zarządzanie Firmami i Programami**:
  - Tworzenie firm partnerskich z automatycznym generowaniem domyślnego programu pracowniczego.
  - Widok listy z filtrowaniem i statystykami (liczba kodów, przypisane oferty specjalne, status aktywności).
  - Widok szczegółowy organizacji podzielony na 4 moduły (karty).
- **Moduł Kodów Rejestracyjnych**:
  - Generowanie unikalnych kodów dostępu (ręcznych lub losowych).
  - Bezpieczeństwo (Zero-Knowledge): W bazie danych zapisywany jest wyłącznie skrót SHA-256 (`codeHash`). Jawny kod zwracany jest jednorazowo w oknie modalnym z możliwością natychmiastowego skopiowania do schowka.
  - Wyświetlanie statystyk użycia oraz możliwość natychmiastowej dezaktywacji kodu.
- **Moduł Ofert Specjalnych**:
  - Przypisywanie pojazdów z bazy `Listing` do programu pracowniczego jako oferty specjalne ze statusem `FINANCING` (zgodnie z ADR-04).
  - Wbudowany kalkulator rabatu procentowego i kwotowego (dynamiczne przeliczanie ceny katalogowej na cenę w programie).
  - Możliwość powiązania oferty ze zdefiniowanym pakietem benefitów (karta paliwowa Moya, dedykowany doradca).
- **Moduł Prywatnych Matryc Najmu (ADR-03)**:
  - Obsługa zestawów matrycowych izolowanych od oferty publicznej (`EmployeeMatrixSet`, `EmployeeMatrixVersion`, `EmployeeMatrixRow`).
  - Import plików CSV w formatach zewnętrznych dostawców oraz wewnętrznym formacie Motolia.
  - Wersjonowanie w trybie DRAFT z podglądem zaimportowanych stawek przed publikacją.
  - Publikacja 1-klikiem (dezaktywacja poprzedniej wersji aktywnej i natychmiastowe udostępnienie nowych stawek pracownikom).
- **Moduł Ustawień Programu i Polityk Benefitów**:
  - Konfiguracja globalnego rabatu procentowego programu.
  - Pełny CRUD polityk benefitowych (kwota karty paliwowej Moya, opieka dedykowanego opiekuna floty, warunki regulaminowe).

### 67. Prywatny Katalog Ofert w Portalu Pracowniczym (Etap P3b)
- **Cel**: Udostępnienie zweryfikowanemu i zalogowanemu pracownikowi firmy partnerskiej prywatnego katalogu pojazdów z dedykowanymi warunkami cenowymi, pakietami korzyści oraz izolacją tenantów.
- **Backend API**:
  - `GET /api/employee/offers`: Zwraca listę aktywnych ofert przypisanych do programu pracownika. Autoryzacja przez bezpieczne ciasteczko sesyjne `__Host-ep-session` z walidacją Redis allowlist i bazy danych (`verifyEmployeeAuth`).
  - `GET /api/employee/offers/:offerId`: Zwraca szczegóły pojedynczej oferty. W przypadku próby odpytania o ofertę należącą do innego programu/firmy endpoint zwraca kod **404 Not Found** (nigdy 403, aby zapobiec sondowaniu identyfikatorów obcych tenantów).
  - Paginacja keyset (`cursor`, `limit` 1-50, domyślnie 24) po `createdAt desc, id desc`.
  - Wyszukiwanie (`search` max 100 znaków) po marce, modelu lub wersji pojazdu.
  - Ochrona przed zarchiwizowanymi pojazdami (`listing.isArchived = false`) oraz pomijanie niespójnych rekordów bez listingId (`fastify.log.warn`).
  - Przycinanie tablicy zdjęć `imageUrls` do maksymalnie 5 pozycji dla oszczędności transferu.
- **Reguła rozstrzygania cen i rabatów (§4 briefu)**:
  1. `customPricePln` (ręcznie wynegocjowana kwota) ma bezwzględne pierwszeństwo.
  2. W drugiej kolejności stosowany jest rabat z oferty `discountPct`.
  3. W trzeciej kolejności dziedziczony jest rabat domyślny programu `program.defaultDiscountPct`.
  4. Domyślnie: cena katalogowa z zerowym rabatem.
  - Kwota pracownicza jest zaokrąglana matematycznie (`Math.round`), a faktyczny rabat `discountPct` jest zawsze przeliczany z finalnej ceny z dokładnością do 2 miejsc po przecinku (z obcięciem zer zbędnych).
- **Interfejs Portalu Pracowniczego (`apps/employee-portal`)**:
  - 4 stany widoku katalogu:
    - **Ładowanie**: responsywna siatka szkieletów kafli (skeleton) z pulsującą animacją.
    - **Lista ofert**: siatka kart samochodów z podglądem zdjęcia (i fallbackiem), specyfikacją (rok, paliwo, skrzynia biegów), przekreśloną ceną katalogową, wyróżnioną ceną pracowniczą, plakietką zaoszczędzonej kwoty i rabatu oraz plakietką pakietu benefitów (np. Karta paliwowa Moya).
    - **Stan pusty**: estetyczny komunikat informujący o braku dostępnych ofert z kontaktem do opiekuna programu.
    - **Stan błędu**: czytelne powiadomienie o niepowodzeniu pobrania danych z przyciskiem ponowienia zapytania.
  - Wykorzystanie natywnego stanu React (`useState`, `useEffect`) z obsługą anulowania żądań (`AbortController`) i `credentials: 'same-origin'`.
