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
