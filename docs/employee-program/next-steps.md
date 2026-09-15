# Program pracowniczy - kolejne bramy odbioru

## Zakres bieżącej iteracji

Naprawa P3a (sesje, rejestracja, separacja tożsamości) i podłączenie logowania/rejestracji do portalu. Bez commitów, publikacji, zmian ENV i wdrożenia na istniejące środowiska. Katalog nadal nie prezentuje rzeczywistych ofert programu.

## 1. Odzyskiwanie hasła - przed pilotażem

- Osobny, jednokrotny token resetu o krótkim TTL, wyłącznie hash w bazie; nie kod rejestracji firmy.
- Jednakowa odpowiedź żądania resetu niezależnie od istnienia i aktywności konta.
- Ograniczenia liczby prób i częstotliwości wysyłki per IP oraz konto.
- Atomowe zużycie tokenu i zmiana hasła; unieważnienie wszystkich wcześniejszych sesji.
- Link z jawnie skonfigurowanym adresem portalu, nie z niezaufanego nagłówka Host.
- Wysyłka przez uzgodniony kanał pocztowy. Testy z lokalnym sinkiem; żadnych prawdziwych maili w testach.
- Osobny przegląd migracji modelu tokenów i wersjonowania sesji przed wykonaniem migracji.

## 2. Prywatny katalog i warunki programu

- Identyfikatory firmy i programu wyłącznie z uwierzytelnionego, aktualnie sprawdzonego członkostwa.
- Katalog korzysta z powiązań EmployeeProgramOffer, nie kopiuje ani nie modyfikuje publicznych cen Listing.
- Uwzględnia aktualną dostępność źródła, wycofanie pojazdu i stan publikacji matrycy.
- Matryce najmu importowane do wersji DRAFT, walidowane i jawnie publikowane jako wersje niezmienne.
- Ceny finansowania oraz ograniczenia produktu według ADR-05; referencyjne raty poza publicznymi polami Listing.
- Dostępność CONSUMER / EMPLOYEE_B2B / EMPLOYER_COMPANY sprawdzana przed kalkulacją.
- Brama testowa: brak przecieku między dwoma programami, brak mutacji danych Motolii, nieaktualna oferta znika, zmiana cennika zmienia fingerprint.

## 3. Zgłoszenia i obsługa konsultanta

- Zgłoszenie z kluczem idempotencji i niezmiennym snapshotem wyceny, benefitów oraz wybranej strony umowy.
- Powiązanie z CRM/Lead bez automatycznego uruchamiania formalnego wniosku u finansującego.
- Ponowne sprawdzenie dostępności i warunków przed przyjęciem zgłoszenia.
- Brama testowa: ponowienie żądania nie tworzy dwóch leadów; snapshot nie zmienia się po zmianie matrycy.

## 4. Pilotaż i deployment - osobna zgoda

- Uzgodniona domena/marka i reverse proxy same-origin dla API; HTTPS obowiązkowy dla cookies __Host-.
- Program pilotażowy i kod dostępu utworzone kontrolowanym procesem operatora; kod pokazany tylko przy wydaniu, nie w logach.
- Zweryfikowane dokumenty programu, benefitów i prywatności, operator oraz kontakt do wsparcia.
- Pełna próba w przeglądarce z rzeczywistym lokalnym/testowym backendem, w tym rejestracja, powrót do sesji, wylogowanie, cofnięcie dostępu.
- Testy izolowanej bazy, kompilacja, lint, testy UI i niezależny audyt najwyższym dostępnym modelem zakończone przed publikacją.
- Commit/push i deployment wyłącznie po odrębnej dyspozycji. Nie przenosić automatycznie zmian na produkcję Motolii.
