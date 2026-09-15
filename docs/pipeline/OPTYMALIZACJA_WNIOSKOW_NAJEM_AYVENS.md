# Analiza i Architektura: Optymalizacja Stawiania Wnioskow na Najem (Ayvens / LeasePlan)

## 1. Diagnoza obecnego procesu i punkty bolu (As-Is)

Obecny proces wnioskowania o najem opiera sie na manualnym laczeniu danych z 4 niezaleznych zrodel przez operatora / doradce call center:
1. **Dane klienta w Thulium**: Imie, Nazwisko, PESEL lub NIP, Adres e-mail, Telefon, ID ticketu / klienta.
2. **Lista dostepnych pojazdow (Stok)**: Plik Excel (`Stok SME 24.08.26.xlsx`) zawierajacy 552 pojazdy z kolumnami: `NR stok` (np. 3460697), `NR Spec` (np. 294), Marka, Model, Wersja, Kolor, VIN, Dealer, Data dostawy.
3. **Matryca cenowa (Cennik)**: Plik Excel (`Cennik Rental Plan 10082026.xlsx`) mapujacy `NR Spec` na warianty okresow (24, 36, 48 msc) i przebiegow (10k, 15k, 20k... km/rok), koszty ubezpieczenia AC (udzial wlasny 1000/500/0), opony nielimitowane oraz warianty prowizji (bazowa, 5%, 7%).
4. **Wysylka mailowa do partnera**: Reczne formatowanie wiadomosci e-mail do `wnioski@leaseplan.com` z tabelka w tresci i tematem w formacie `FW: [Imie Nazwisko] Pesel [PESEL]`.

### Zidentyfikowane problemy operacyjne
- **Przelaczanie kontekstu (Context Switching)**: Operator musi jednoczesnie pracowac w Thulium, dwoch ciezkich arkuszach kalkulacyjnych oraz kliencie poczty.
- **Ryzyko bledu ludzkiego**: Ryzyko literowki w PESEL, pomylenia numeru stoku (np. zly kolor lub skrzynia biegow), nieprawidlowo skalkulowanej raty.
- **Brak sladu w Pipeline**: Wniosek wychodzi mailem, ale sprawa w Car-Scout Pipeline nie zostaje odnotowana natychmiast, co zaburza analityke lejka sprzedazowego.
- **Brak statusu w Thulium**: Kolejny konsultant rozmawiajacy z klientem nie widzi, czy wniosek zostal wyslany, na jaki samochod i za jaka kwote.

---

## 2. Przeglad 4 Scenariuszy Rozwiazania

### Scenariusz A: Wtyczka do przegladarki Chrome dla Thulium (Thulium Rental Companion)
- **Koncepcja**: Lekkie rozszerzenie Chrome (Manifest V3) uruchamiane na domenie Thulium (`motolia.thulium.com`).
- **Przebieg**:
  1. Operator otwiera ticket / karte klienta w Thulium.
  2. Wtyczka automatycznie zczytuje dane klienta (Imie, Nazwisko, PESEL, NIP, E-mail, Telefon) z pol Thulium.
  3. W wysuwanym panelu bocznym wtyczki operator wpisuje fragment nazwy auta lub numer stoku (dane pobierane z API Car-Scout).
  4. Wybiera parametry (okres, roczny przebieg, ubezpieczenie, opony, marza) - rata przelicza sie automatycznie w locie.
  5. Klikniecie "Zloz wniosek":
     - Backend Car-Scout wysyla mail z tabelka do `wnioski@leaseplan.com`.
     - Zapisuje wniosek w Car-Scout Pipeline (`PRECHECK_SUBMITTED`).
     - Dodaje notatke w Thulium z potwierdzeniem.
- **Zalety**: Najwyzsza wygoda operatora (zero przelaczania kart, czas skrocony do 15 sekund).
- **Wyzwania**: Koniecznosc instalacji wtyczki w przegladarkach konsultantow.

---

### Scenariusz B: Wbudowana Karta CRM / iFrame w Thulium (External CRM Tab)
- **Koncepcja**: Wykorzystanie wbudowanej funkcji Thulium do osadzania zewnetrznych stron CRM w ramce iFrame w karcie klienta.
- **Przebieg**:
  1. Thulium konfiguruje zakladke wskazujaca na:  
     `https://motolia.pl/admin/pipeline/embedded-rental?phone={{phone}}&email={{email}}&name={{name}}&pesel={{pesel}}&nip={{nip}}&ticket_id={{ticket_id}}`
  2. Car-Scout serwuje zoptymalizowany, lekki komponent kreatora wniosku.
  3. Operator wybiera samochod ze zintegrowanego stoku, zatwierdza parametry i klika wysylke.
  4. Backend Car-Scout realizuje wysylke maila, zapis w Pipeline oraz aktualizacje danych w Thulium.
- **Zalety**: Zero instalacji oprogramowania na komputerach (czysty standard webowy), proste utrzymanie.
- **Wyzwania**: Thulium musi miec skonfigurowane przekazywanie PESEL/NIP w szablonie URL.

---

### Scenariusz C: Modul Wnioskowania w Car-Scout Pipeline z Deep-Linkiem
- **Koncepcja**: Operator klika link do sprawy w Thulium i wypelnia wniosek bezposrednio w Car-Scout.
- **Przebieg**:
  1. Operator klika link "Link do sprawy", ktory juz dzis jest zwracany do Thulium przez endpoint lookup.
  2. W widoku sprawy w Car-Scout pojawia sie sekcja "Zloz wniosek najmu (Ayvens)".
  3. System sam pobiera dane klienta i umozliwia szybki wybor auta ze stoku z automatyczna kalkulacja raty.
  4. Wysylka maila i rejestracja wniosku odbywa sie jednym kliknieciem.
- **Zalety**: Proste wdrozenie, pelna spojnosc z UI pipeline.
- **Wyzwania**: Operator musi przejsc do drugiej karty w przegladarce (nieco dluzszy czas niz wariant A/B).

---

### Scenariusz D: Hybryda Rekomendowana (Car-Scout Rental Engine + Front dla Konsultanta)
Najbardziej skalowalne i stabilne rozwiazanie skladajace sie z trzech spojnych warstw:

1. **Warstwa Danych i Silnika (Car-Scout Backend)**:
   - Modul synchronizacji stoku: import arkusza `Stok SME.xlsx` i powiazanie z matryca cenowa `Cennik Rental Plan` po relacji `NR Spec`.
   - Wyszukiwarka aut ze stoku w API (marka, model, skrzynia, kolor, rocznik, termin odbioru, numer stoku).
   - Silnik wyceny kalkulujacy rate calkowita:  
     `Rata = Rata bazowa (z cennika dla okresu i km) + Ubezpieczenie + Opony + Prowizja`
   - Endpoint zlecenia wniosku: wysylka maila przez SMTP do `wnioski@leaseplan.com`, zapis w bazie Pipeline (`PipelineOpportunity`, `PipelineApplication` w stanie `PRECHECK_SUBMITTED`, powiazanie `PipelineOffer` i zdarzenie `APPLICATION_SUBMITTED`).

2. **Warstwa Interfejsu Konsultanta**:
   - Dedykowany, responsywny widok kreatora (gotowy do pracy jako iFrame w Thulium lub popup wtyczki Chrome).

3. **Warstwa Integracji i Statusow w Thulium**:
   - Aktualizacja istniejacego endpointu `GET /api/pipeline/integrations/thulium/customer-lookup?phone_number=...`, ktory juz dzis zasila pola CRM w Thulium.
   - W polach Thulium pojawia sie:
     - `Status wniosku`: `Ayvens - zlozony (VW Polo, rata 949 zl, stok: 3460697)`
     - `Pojazd`: `VOLKSWAGEN Polo (Stok 3460697)`
     - `Rata`: `949 zl/mies.`
   - Dopisywanie komentarza do ticketu przez Thulium REST API po wyslaniu wniosku.

---

## 3. Macierz Porownawcza

| Kryterium | Scenariusz A (Wtyczka Chrome) | Scenariusz B (iFrame w Thulium) | Scenariusz C (Tylko Car-Scout) | Scenariusz D (Rekomendowana Hybryda) |
|---|:---:|:---:|:---:|:---:|
| **Szybkosc pracy operatora** | Najszybsza (~15s) | Bardzo szybka (~20s) | Srednia (~45s) | **Najszybsza (~15-20s)** |
| **Brak przelaczania okien** | Pelny (w Thulium) | Pelny (w Thulium) | Wymaga przejscia do CS | **Pelny (w Thulium)** |
| **Eliminacja bledow (PESEL, Stok, Rata)** | 100% | 100% | 90% | **100%** |
| **Zgodnosc z Pipeline Car-Scout** | Wymaga backend API | Wymaga backend API | Natywna | **Natywna i kompletna** |
| **Widocznosc statusu w Thulium** | Przez API / Lookup | Przez API / Lookup | Przez API / Lookup | **Automatyczna dwukierunkowa** |
| **Utrzymanie rozwiazania** | Srednie (aktualizacje Chrome) | Wysokie (standard WWW) | Wysokie | **Wysokie (niezalezny backend)** |
| **Skalowalnosc na kolejnych partnerow** | Srednia | Wysoka | Bardzo wysoka | **Bardzo wysoka** |

---

## 4. Wzorzec wiadomosci generowanej do partnera finansowego (Ayvens / LeasePlan)

Wiadomosc jest wysylana automatycznie przez zintegrowane konto pocztowe (SMTP):

- **Do**: `wnioski@leaseplan.com`, `SME L`
- **DW (CC)**: `k.tonkowicz@motolia.pl`, `l.dobosz@motolia.pl`, adres mailowy operatora
- **Temat**: `FW: {{klient.imie}} {{klient.nazwisko}} Pesel {{klient.pesel}}` (lub `NIP {{klient.nip}}` dla firm)
- **Tresc**:
```html
<p>Dzien dobry,</p>
<p>Przesylam wniosek na najem pojazdu ze stoku:</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
  <tr><td style="font-weight: bold; width: 240px;">Okres</td><td>{{kalkulacja.okres}}</td></tr>
  <tr><td style="font-weight: bold;">Przebieg roczny</td><td>{{kalkulacja.przebiegRoczny}}</td></tr>
  <tr><td style="font-weight: bold;">Ubezpieczenie (1000/500/0)</td><td>{{kalkulacja.udzialWlasny}}</td></tr>
  <tr><td style="font-weight: bold;">Opony (tak/nie)</td><td>{{kalkulacja.opony ? 'Tak' : 'Nie'}}</td></tr>
  <tr><td style="font-weight: bold;">Rata calkowita</td><td><b>{{kalkulacja.rataCalkowitaNetto}} zl</b></td></tr>
  <tr><td style="font-weight: bold;">numer stokowy</td><td><b>{{pojazd.numerStokowy}}</b> ({{pojazd.marka}} {{pojazd.model}}, {{pojazd.kolor}})</td></tr>
  <tr><td style="font-weight: bold;">NIP*</td><td>{{klient.nip || ''}}</td></tr>
  <tr><td style="font-weight: bold;">PESEL*</td><td>{{klient.pesel || ''}}</td></tr>
  <tr><td style="font-weight: bold;">Adres mailowy</td><td><a href="mailto:{{klient.email}}">{{klient.email}}</a></td></tr>
  <tr><td style="font-weight: bold;">Prowizja (Standard/5/7)</td><td>{{kalkulacja.prowizja}}</td></tr>
</table>
<p>Pozdrawiam,<br>{{operator.imieNazwisko}}<br>Motolia Sp. z o.o.</p>
```

---

## 5. Plan wdrozenia krok po kroku

1. **Krok 1 - Baza i Wycena (Car-Scout Backend)**:
   - Utworzenie tabeli / modelu pod stok pojazdow najmu (`RentalStockEntry`) powiazanej z `RentalVehicle` i `RentalMatrixEntry`.
   - Skrypt/endpoint importu pliku `Stok SME.xlsx` laczacy `NR Spec` z cennikiem.
   - Endpoint kalkulatora wyliczajacy dokladna rate calkowita.
2. **Krok 2 - Generator i Wysylka Wniosku**:
   - Endpoint `POST /api/pipeline/rental/submit-ayvens-application`.
   - Zapis rekordu w `PipelineApplication` (`PRECHECK_SUBMITTED`) i rejestracja w `pipeline_events`.
   - Wysylka e-mail przez SMTP z prawidlowa tabelka i tematem.
3. **Krok 3 - Frontend Operatora (iFrame w Thulium lub Wtyczka Chrome)**:
   - Utworzenie widoku `/admin/pipeline/embedded-rental` z szybkim wyszukiwaniem po stoku.
   - Konfiguracja zakladki w Thulium lub wdrozenie wtyczki Chrome przekazujacej dane klienta.
4. **Krok 4 - Pelna widocznosc w Thulium**:
   - Wzbogacenie istniejacego endpointu lookup w Car-Scout o detale zlozonego wniosku najmu.
   - Opcjonalne dodawanie automatycznego wpisu w historii ticketu w Thulium.
