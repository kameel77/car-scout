# Strategia komunikacji B2B — motolia.pl (oferta dla firm)

Data: 2026-07-15. Zakres: komunikat, UI/UX, CTA, wyróżniki, treść strony `/dla-firm`
(brand=motolia), kierunek marketingowy. Cel biznesowy: **poszerzenie** oferty o klienta
firmowego (JDG + spółki, 1–20 aut), bez migracji z klienta detalicznego. Produkt
priorytetowy: **auta nowe w leasingu operacyjnym i najmie długoterminowym** (najbardziej
kaloryczne). Powiązane: [SEO_LINKING_STRATEGY_MOTOLIA.md](SEO_LINKING_STRATEGY_MOTOLIA.md),
persony (Nowak — JDG, Wiśniewski — MŚP).

---

## 1. Kontekst rynkowy — dlaczego teraz (skrót researchu)

- MŚP to rdzeń rynku, nie nisza: **70,9% wartości leasingu 2025** to MŚP; ~63% MŚP ma
  floty 1–5 aut, ~93% do 20 aut. Firmy odpowiadają za **69% sprzedaży nowych aut** (2025).
- PZWLP (II 2026): „głównym motorem wzrostu staje się sektor MŚP i klienci detaliczni" —
  prognoza wzrostu najmu ~8% w 2026 z MŚP jako filarem.
- Kryteria wyboru finansującego wg ZPL 2025: cena 84%, dopasowanie do branży 70%,
  **szybkość decyzji 67%**, negocjowalność 63%. Badanie 2026: decyduje „szybkość decyzji,
  prostota procesu i **relacja z doradcą**" — model hybrydowy (online + człowiek) wygrywa.
- Dźwignia 2026: **nowe limity KUP wg emisji CO2** (100 tys. zł spalinowe / 150 tys. PHEV /
  225 tys. EV) — największy magnes contentowy i realny argument doradczy roku.
- Raty najniższe od 3 lat (obniżki stóp −150 p.b. od V 2025) — konkretny argument „teraz".

## 2. Luka konkurencyjna (skrót analizy 9 graczy)

| Luka na rynku | Kto ją częściowo zajmuje | Szansa Motolii |
|---|---|---|
| Segment „firma z 2–20 autami" komunikacyjnie bezpański | tylko Arval (landing „flota <10 aut", ale katalog+formularz bez obietnic) | pozycjonowanie „od pierwszego auta po całą flotę" |
| „Wielu finansujących" sprzedawane tylko cenowo | OTOMOTO Lease (14), Superauto (15) | sprzedawać jako **skuteczność decyzji** („odmowa ≠ koniec") |
| Dedykowany opiekun nigdzie nie jest produktem | GO-leasing (oddolnie, przez opinie) | obiecać wprost: jeden opiekun dla wszystkich aut firmy |
| Nowe JDG (<12 mies.) jawnie wykluczane (Ayvens) | GO-leasing („Leasing na Start") | „finansowanie od pierwszego dnia działalności" |
| Brak „miksu finansowania" dla jednej firmy | nikt | „dostawczak w leasingu + auto szefa w najmie — policzymy całość" |
| Program pracowniczy dla MŚP | tylko CFM-y dla korporacji (Athlon EmployeeLease, Masterlease) | Pracowniczy Program Najmu w wersji dla firm 10–50 osób |

Marketplace'y konkurują ceną i szybkością, CFM-y skalą i żargonem korporacyjnym (TCO,
ESG). **Nikt nie mówi językiem właściciela małej firmy o kilku autach.** To jest nasze pole.

## 3. Pozycjonowanie i komunikat główny

### Pozycjonowanie (wewnętrzna definicja)

> Motolia dla firm: doradca finansowania aut nowych dla małych i średnich firm — od
> pierwszego auta JDG po flotę 20 pojazdów. Jeden opiekun, wielu finansujących, leasing
> i najem policzone pod podatki firmy.

### Komunikat główny (hero, rekomendowany)

**H1:** „Auta dla Twojej firmy. Ważnej dla nas od pierwszego samochodu."

**Subtitle:** „Nowe samochody w leasingu i najmie długoterminowym — jedno auto czy
dwadzieścia. Jeden opiekun, oferty wielu finansujących, rata policzona pod podatki
Twojej firmy."

Uwaga językowa: **słowa „flota" nie używamy w hero i komunikatach do JDG/małych firm**
— brzmi korporacyjnie i może sygnalizować „to nie dla mnie" (~63% MŚP ma 1–5 aut).
Skalę wyrażamy prostymi słowami („jedno auto czy dwadzieścia"); „flota"/„oferta
flotowa" zarezerwowane dla segmentu 6–20 aut i treści o rabatach wieloautowych.

Warianty do testów A/B:

- „Twoja firma zasługuje na własnego doradcę od aut." (relacja)
- „Jedno auto czy dwadzieścia — finansujemy samochody małych i średnich firm." (segment)
- „Leasing i najem dla firm. Porównujemy finansujących, Ty wybierasz auto." (mechanika)

### Zasady języka (spójne z personas.md)

- Do JDG (Nowak): konkret, liczby, podatki wprost („cała rata w koszty, VAT do odliczenia").
- Do MŚP (Wiśniewski): rozwiązanie, nie produkt; „my" i partnerstwo; opiekun z imienia.
- Nigdy żargonem CFM (TCO, car policy, ESG) — to język korporacji, nie naszego klienta.
- Nie licytować się na „taniej niż najtaniej" (VEHIS) — nasza oś to **pewność i opieka**,
  cena jako efekt porównania wielu ofert, nie jako krzyk.

## 4. Komunikacja w serwisie (UI/UX)

### 4.1 Nawigacja i strona główna (MotoliaHomePage)

- Pozycja **„Dla firm"** w głównym menu (desktop + mobile) → `/dla-firm`.
- Sekcja na HP (po hero, przed lub po listingach): karta „Motolia dla firm" —
  3 bullety (opiekun, wielu finansujących, leasing/najem pod podatki) + CTA
  „Zobacz ofertę dla firm". HP pozostaje uniwersalne — sekcja poszerza, nie wypiera
  komunikacji detalicznej (cel: rozszerzenie, nie migracja).
- Rozważyć w hero HP mikroprzełącznik kontekstu „Prywatnie / Na firmę" sterujący
  wyświetlaniem cen (brutto/netto) w całym serwisie (zapamiętany w localStorage).
  Wzorzec rynkowy: OTOMOTO Lease, Ayvens. To najtańszy sygnał „jesteśmy też dla firm".

### 4.2 Listingi (/leasing, /wynajem-dlugoterminowy)

- **Przełącznik netto/brutto** przy cenach (domyślnie wg kontekstu z 4.1). Kalkulator
  Vehis już rozróżnia `consumer`/`entrepreneur` — UI powinno to eksponować, nie ukrywać.
- Przy racie leasingu dla trybu firmowego dopisek: „netto — dla firmy rata w kosztach".
- **Moduł wieloautowy na listingu:** wpięty co N kart lub w sidebarze baner
  „Potrzebujesz 2 lub więcej aut? Przygotujemy ofertę flotową" → CTA do `/dla-firm`
  lub bezpośrednio formularz. Nikt z konkurencji tego nie robi na listingu.
- Filtr/zakładka „Popularne w firmach" (segmenty: kombi/SUV dla handlowca, dostawcze) —
  później, gdy będzie podaż i dane.

### 4.3 Strona oferty (ListingDetailPage / RentalDetailPage)

- Kalkulator: tryb „Na firmę" jako pierwszy tab dla wejść z kontekstem firmowym;
  obok raty netto box „Korzyści dla firmy”: rata w KUP, odliczenie VAT (50/100%),
  bez angażowania kapitału. Krótko, bez porady podatkowej — z dopiskiem
  „ostateczne rozliczenie zależy od formy opodatkowania".
- Pod kalkulatorem link kontekstowy: „Bierzesz auta dla pracowników? Zobacz ofertę
  dla firm" → `/dla-firm` (zgodnie ze strategią linkowania: anchor z encją).

### 4.4 Formularz leadowy (LeadFormPage / RentalLeadFormPage)

- Pole wyboru „Auto na firmę / prywatnie" (jeśli go nie ma) + przy „na firmę":
  opcjonalny NIP i pytanie „Ile aut planujesz?" (1 / 2–5 / 6–20 / 20+). To jedno pole
  segmentuje lead dla call center **przed** rozmową — dziś agent nie wie, czy dzwoni
  do firmy (process.md, „czego agent nie wie").
- Lead z liczbą aut ≥2 → osobny routing/priorytet w CRM (lead flotowy = kaloryczny).

### 4.5 Nowa strona `/dla-firm` (brand=motolia)

Osobna, pełnoprawna strona (nie onepager do druku jak wariant Carsalon). Struktura
i copy w sekcji 7. Docelowo indeksowana, wpięta w oś finansowania jako czwarty filar
kontekstowy obok `/leasing`, `/kredyt`, `/wynajem-dlugoterminowy`.

## 5. CTA — rekomendacje

Zasada: **CTA prowadzi do rozmowy z człowiekiem, nie do „wyślij i czekaj”.** Research:
przewagę procesową komunikują ci, którzy obiecują kontakt konkretnie („zadzwonimy
w 120 sekund" — GO-leasing). Nasz atut to call center — CTA ma go sprzedawać.

| Miejsce | CTA główne | CTA drugorzędne |
|---|---|---|
| `/dla-firm` hero | **„Porozmawiaj z opiekunem firm"** (formularz: telefon + liczba aut) | „Zobacz auta dostępne dla firm" |
| `/dla-firm` sekcje | „Zamów ofertę dla swojej floty" | „Oblicz ratę dla firmy" |
| HP sekcja firmowa | „Zobacz ofertę dla firm" | — |
| Listing (baner flotowy) | „Zapytaj o ofertę na kilka aut" | — |
| Strona oferty (tryb firma) | „Zapytaj o to auto na firmę" | „Dodaj kolejne auto do zapytania" (docelowo) |

Wzmocnienie pod przyciskiem (microcopy): „Oddzwaniamy tego samego dnia. Bez zobowiązań."
— tylko jeśli call center może to utrzymać; jeśli tak, to jest to nasza wersja
„120 sekund" GO-leasingu. Unikać generycznego „Wyślij" (wzorzec Arval — słaby).

## 6. Wyróżniki Motolii (do komunikowania wszędzie, spójnie)

Kolejność wg siły na tle konkurencji (wszystkie potwierdzone operacyjnie):

1. **Dedykowany opiekun firmy** — jedna osoba do wszystkich aut i umów, także przy
   kolejnych autach za rok. Nikt na rynku nie deklaruje tego jako standardu; klient MŚP
   kupuje człowieka (dowód: opinie GO-leasing, badanie ZPL o relacji z doradcą).
   Komunikat: „Poznasz swojego doradcę z imienia i nazwiska."
2. **Wielu finansujących = wyższa szansa na finansowanie** — porównujemy oferty
   i przy odmowie ponawiamy wniosek u innego partnera (process.md, etap 7). Rynek
   używa multi-lendingu tylko cenowo — my sprzedajemy go jako pewność decyzji.
   Komunikat: „Jedna rozmowa, oferty wielu instytucji. Odmowa u jednej nie kończy tematu."
3. **Od pierwszego auta po dwadzieścia** — obsługa wielu wniosków naraz, rabaty
   wieloautowe, oferta rośnie z firmą. Zajmuje bezpańską lukę segmentową.
4. **Leasing + najem pod podatki firmy (mix finansowania)** — dobieramy produkt per
   auto i per firma, z uwzględnieniem limitów KUP 2026. Nikt nie oferuje miksu.
   Komunikat: „Dostawczak w leasingu, auto zarządu w najmie — policzymy, co się opłaca."
5. **JDG od pierwszego dnia działalności** — kontra do jawnych wykluczeń rynku
   (Ayvens: min. 12 mies.). Frazy „leasing dla nowej firmy" to niedoceniona nisza SEO.
6. **Pracowniczy Program Najmu** — auto jako benefit dla pracowników klienta, w wersji
   dla firm 10–50 osób (rynek adresuje tylko korporacje). Wyróżnik drugiej fazy —
   komunikować na `/dla-firm`, rozwinąć osobną stroną, gdy będzie ruch.

Anty-wyróżniki (nie obiecywać): „decyzja w 15 minut" (licytacja z VEHIS bez własnego
finansującego), „najtaniej na rynku" (nie do obrony), samoobsługa 100% online
(60,5% umów wciąż papierowo; nasz model to hybryda z człowiekiem).

## 7. Treść strony `/dla-firm` — szkic sekcja po sekcji

### Hero
- Badge: „Motolia dla firm"
- H1: **Auta dla Twojej firmy. Ważnej dla nas od pierwszego samochodu.**
- Sub: Nowe samochody w leasingu i najmie długoterminowym dla JDG i spółek —
  jedno auto czy dwadzieścia. Jeden opiekun, oferty wielu finansujących, rata
  policzona pod podatki Twojej firmy.
- Trust badges: „Dedykowany opiekun" • „Wielu finansujących" • „Od 1 do 20 aut"
- CTA: „Porozmawiaj z opiekunem firm" + microcopy „Oddzwaniamy tego samego dnia."

### Sekcja „Dla kogo" (3 karty — mapują persony)
1. **Prowadzisz JDG** — pierwsze auto na firmę? Leasing operacyjny od pierwszego dnia
   działalności. Rata w kosztach, VAT do odliczenia, minimum formalności.
2. **Masz małą firmę (2–5 aut)** — auta dla handlowców i serwisantów. Obsłużymy kilka
   wniosków naraz, wynegocjujemy warunki, dopilnujemy terminów odbioru.
3. **Rozwijasz flotę (6–20 aut)** — oferta flotowa: rabaty wieloautowe, mix leasingu
   i najmu, przewidywalny koszt na budżet. Jeden opiekun do całości.

### Sekcja „Jak pracujemy" (proces w 4 krokach — spójny z process.md)
1. Rozmowa z doradcą (15 min) — potrzeby firmy, kilometry, budżet, podatki.
2. Oferta z porównaniem finansujących — leasing vs najem, netto, z rekomendacją.
3. Wniosek i decyzja — prowadzimy formalności; przy odmowie ponawiamy u innego partnera.
4. Odbiór auta u dealera — a opiekun zostaje z Tobą na kolejne auta.

### Sekcja „Leasing czy najem?" (tabela porównawcza)
Kolumny: leasing operacyjny / najem długoterminowy. Wiersze: własność i wykup, co
zawiera rata, limit km, korzyści podatkowe, dla kogo. Zakończona zdaniem: „Nie musisz
wybierać sam — doradca policzy oba warianty dla Twojej firmy." (rozbraja obawę
„haczyków" najmu — bariera nr 1 wg researchu). Linki kontekstowe do filarów `/leasing`
i `/wynajem-dlugoterminowy` z anchorami encyjnymi.

### Sekcja „Podatki 2026" (przewaga contentowa)
Krótki, konkretny blok: nowe limity KUP wg emisji CO2 (100/150/225 tys. zł), co to
znaczy dla wyboru auta i formy finansowania. CTA: „Zapytaj doradcę, jak limity 2026
wpływają na Twoje auto." Dopisek: nie stanowi porady podatkowej.

### Sekcja „Pracowniczy Program Najmu"
Auto jako benefit: pracownicy klienta wynajmują nowe auta na preferencyjnych
warunkach wynegocjowanych dla firmy. Dla firm 10+ pracowników. CTA: „Zapytaj o program
dla swojej firmy."

### Sekcja social proof
Docelowo: 2–3 opinie klientów firmowych **z imieniem doradcy** (wzorzec GO-leasing —
najskuteczniejszy social proof „opiekuna" na rynku) + liczby (lata doświadczenia
zespołu, liczba obsłużonych firm — uzupełnić realnymi danymi).

### Sekcja ofert (dynamiczna)
Moduł „Popularne auta firmowe" — 4–6 ofert z bazy z ratą netto (transfer mocy w dół
hierarchii, zgodnie ze strategią linkowania). Link „Zobacz wszystkie auta w leasingu".

### FAQ (JSON-LD FAQPage, odpowiedzi samowystarczalne, bez linków)
Propozycje pytań: Czy nowa firma dostanie leasing? • Czym różni się leasing od najmu
dla firmy? • Czy mogę odliczyć VAT od raty? • Jak wygląda oferta przy kilku autach? •
Co jeśli dostanę odmowę finansowania? • Czy obsługujecie spółki i JDG?

### CTA końcowe
Powtórzenie hero-CTA + telefon i e-mail wprost (wzorzec: klient MŚP chce widzieć
numer, nie tylko formularz).

## 8. Marketing i SEO/GEO — kierunek

- **Czwarty filar treściowy:** `/dla-firm` dołącza do osi finansowania. Filary
  `/leasing` i `/wynajem-dlugoterminowy` dostają sekcję „dla firm" z linkiem do
  `/dla-firm` (anchor: „oferta leasingu dla firm" itp., wariantowane).
- **Frazy docelowe (wysoka intencja, niższa konkurencja):** „leasing dla nowej firmy /
  JDG od pierwszego dnia", „auto dla firmy bez wykupu", „najem długoterminowy dla
  małej firmy", „oferta flotowa dla małych firm", „auto jako benefit dla pracowników",
  „limit 100 tys. zł leasing 2026". Nie bić się o generyczne „leasing samochodu"
  (SERP okupowany przez VEHIS/Superauto/GO-leasing).
- **Content podatkowy 2026 = magnes leadowy roku:** artykuł/kalkulator „ile realnie
  odliczysz w 2026" (limity CO2) linkujący w dół do ofert i do `/dla-firm`.
- **Treści CMS marek/modeli:** w artykułach modeli popularnych w firmach (Octavia,
  Superb, Passat, Corolla, dostawcze) dodawać akapit firmowy + link do `/dla-firm`
  zgodnie z regułami linkowania (1 link, anchor z encją).
- **Kampanie:** osobne kampanie leadowe na segment firmowy (Google: frazy powyżej;
  Meta/LinkedIn: właściciele MŚP), landing = `/dla-firm`. Lead z formularza firmowego
  z liczbą aut trafia do wyróżnionego routingu call center.
- **GEO (LLM):** akapity definicyjne i FAQ samowystarczalne na `/dla-firm` — strona ma
  być cytowalnym źródłem odpowiedzi „jak sfinansować auta w małej firmie".

## 9. Ryzyka i zasady ochronne

- **Nie kanibalizować detalu:** HP i listingi pozostają uniwersalne; segmentacja przez
  kontekst (przełącznik, sekcja, strona `/dla-firm`), nie przez przebudowę serwisu pod B2B.
- **Obietnice procesowe tylko pokrywalne operacyjnie:** „oddzwaniamy tego samego dnia"
  wymaga SLA call center; zweryfikować przed publikacją.
- **Podatki:** wszystkie treści o VAT/KUP z zastrzeżeniem o formie opodatkowania;
  bez indywidualnego doradztwa podatkowego.
- **Rabaty flotowe:** komunikować „wynegocjujemy warunki", nie sztywne procenty,
  dopóki nie ma cennika progowego z partnerami.

## 10. Proponowana kolejność wdrożenia

1. **Faza 1 (fundament):** strona `/dla-firm` (motolia) + „Dla firm" w menu + pole
   firma/liczba aut w formularzu leadowym + routing leadów flotowych.
2. **Faza 2 (serwis):** przełącznik netto/brutto na listingach i HP, box podatkowy
   przy kalkulatorze, baner flotowy na listingach, sekcja firmowa na HP.
3. **Faza 3 (treść i marketing):** content podatkowy 2026, akapity firmowe w CMS
   marek/modeli, kampanie leadowe na frazy firmowe, opinie z imieniem doradcy.
4. **Faza 4 (produkt):** strona Pracowniczego Programu Najmu, multi-auto w zapytaniu
   („dodaj kolejne auto"), zakładka „Popularne w firmach".

---

*Źródła researchu: ZPL (leasing.org.pl), PZWLP (pzwlp.pl), FmLeasing.pl, badanie CBM
Indicator/ZPL „Małe firmy o leasingu 2025", analiza serwisów: OTOMOTO Lease (d. Carsmile),
Superauto.pl, GO-leasing, VEHIS, Arval, Ayvens, Alphabet, Athlon (lipiec 2026).*
