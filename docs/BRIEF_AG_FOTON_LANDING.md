# Brief dla agenta — strona marki FOTON (`/foton`)

Kontekst strategiczny: `~/Documents/Vault/projects/motolia/foton-partnerstwo-2026-08.md`.
**Przeczytaj go przed rozpoczęciem** — zawiera ramy prawne, których nie wolno naruszyć.

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Cel biznesowy

Motolia została **Agentem Importera marki FOTON** — importerem i sprzedawcą jest
**Power Truck Poland Sp. z o.o.** FOTON to marka pojazdów użytkowych: pickupy (Tunland G7, V9),
vany (eToano Pro, Cavan), pojazdy ciężarowe (eMiler, eAumark, Aumark S).

Zbuduj `motolia.pl/foton` — stronę główną marki, która realizuje trzy cele naraz:

1. **Prezentuje markę FOTON** komuś, kto jej nie zna (marka jest w Polsce nowa).
2. **Prezentuje Motolię jako podmiot wspierający** w doborze, zamówieniu i finansowaniu —
   to jest nasz produkt, nie sam pojazd.
3. **Generuje leady** w dwóch segmentach o różnych potrzebach (patrz niżej).

**Teza pozycjonująca, na której opiera się cała strona:** FOTON to marka nowa w Polsce,
więc *sfinansowanie* jej jest trudniejsze niż kupienie — instytucje finansowe ostrożnie
wyceniają wartość rezydualną nieznanych marek. Motolia jest brokerem finansowania z dostępem
do wielu banków i leasingodawców, więc **rozwiązuje najtrudniejszy element tej transakcji**.
Tego nie zaoferuje dealer jednomarkowy. To musi być czytelne na stronie, nie ukryte w podstronie.

## Dwa segmenty — jedna strona, dwa rejestry

| Segment | Modele | Odbiorca | Rejestr | CTA |
|---|---|---|---|---|
| **Flota / użytkowe** | eToano Pro, Cavan, eMiler, eAumark, Aumark S | firmy transportowe, dystrybucja, zabudowy | TCO, koszty, serwis | „Zapytaj o ofertę dla floty" |
| **Lifestyle / mieszany** | Tunland G7, Tunland V9 | JDG, budowlanka, holowanie, off-road, agro | wyposażenie, napęd, „praca i weekend" | „Policz ratę" |

Strona główna marki musi **rozgałęziać** te dwie ścieżki wcześnie i wyraźnie. Nie uśredniaj
komunikatu — „pojazdy dla biznesu" zabija segment lifestyle, a „auto na każdą przygodę"
zabija wiarygodność flotową.

## ⛔ Ograniczenia prawne — bezwzględne, nie do negocjacji

Motolia jest **agentem**, nie dealerem i nie sprzedawcą. Naruszenie tego to ryzyko sporu
z importerem i nieuczciwej praktyki rynkowej.

**Wolno:** „Agent Importera marki FOTON", „autoryzowany partner handlowy",
„Zamów FOTON przez Motolia", „Dobierzemy finansowanie".

**Nie wolno:** ❌ „dealer" ❌ „sprzedajemy" ❌ „kupisz u nas" ❌ „nasza oferta pojazdów"
❌ „oficjalny importer/dystrybutor" ❌ publikowania cen bez potwierdzenia zgody (zapytaj Kamila).

**Obowiązkowe elementy ujawnienia — zaprojektuj je jako część UI, nie jako drobny druk:**

1. **Pasek kontekstu** pod headerem, tylko na `/foton/*`:
   „FOTON · pojazdy użytkowe · Motolia działa jako Agent Importera".
2. **Blok „Kto za co odpowiada"** — trzy kolumny, nad formularzem, na hubie i każdej podstronie:

   | Sprzedaż i umowa | Finansowanie | Serwis i gwarancja |
   |---|---|---|
   | Power Truck Poland Sp. z o.o. — sprzedawca i strona umowy | **Motolia** — leasing, najem lub kredyt z wielu instytucji | Power Truck Poland / sieć partnerów |

   Kolumna Motolii wyróżniona. **To nie jest disclaimer — to element sprzedażowy.**
   Menedżer floty i tak zapyta, kto serwisuje; odpowiedź wprost skraca cykl.
3. **Nota przy formularzu**, inline nad przyciskiem: „Wysyłając formularz kontaktujesz się
   z Motolia Sp. z o.o., działającą jako Agent Importera. Umowa sprzedaży zawierana jest
   z Power Truck Poland Sp. z o.o."

## Branding i UI — ramy do zaprojektowania

Sekcja ma mieć **własny język wizualny**: inna kolorystyka, typografia, rejestr fotografii.
Uzasadnienie: inny odbiorca, inny produkt, strona docelowa kampanii.

**Ale — i to jest warunek brzegowy:** to nie może być re-skin, w którym FOTON wypiera Motolię.
Powody:

- przy statusie **agenta** strona wyglądająca jak serwis FOTON wprowadza w błąd co do tego,
  z kim użytkownik zawiera umowę i do kogo pisze;
- **umowa nakłada ograniczenia CI** — użycie identyfikacji FOTON wymaga potwierdzenia zakresu
  (zapytaj Kamila, zanim zaprojektujesz cokolwiek wokół logo i palety FOTON);
- cała wartość tej strony to „Motolia pomoże Ci dobrać, zamówić i sfinansować".
  Jeśli strona wygląda jak strona producenta, ta wartość znika.

**Zasada podziału ról:** FOTON prowadzi w warstwie produktowej (hero, galerie, dane techniczne,
modele). Motolia prowadzi w warstwie usługowej — **każde CTA, każdy formularz, każdy blok
o finansowaniu i cały header/footer są jednoznacznie Motolii.** Użytkownik w żadnym momencie
nie może mieć wątpliwości, czyją stronę czyta i do kogo pisze.

Header i footer zostają **niezmienione** (globalna nawigacja Motolii). Motyw dotyczy wyłącznie
obszaru treści.

## Stan obecny — zweryfikowany w kodzie

- **`src/contexts/BrandContext.tsx`** — brand wybierany przez `import.meta.env.VITE_BRAND`,
  czyli **build-time**, jeden brand na build. Kolory wstrzykiwane są przez
  `root.style.setProperty('--primary', …)` na `document.documentElement`, czyli **globalnie**.

  ⚠️ **Pułapka: nie próbuj dodać `fotonConfig` do `brandMap`.** Ten mechanizm służy rozdzieleniu
  domen (motolia.pl vs carsalon.pl), a nie motywowaniu ścieżki wewnątrz jednej domeny.
  Użycie go tutaj przefarbuje **cały serwis**, łącznie z katalogiem aut osobowych.

  Zaproponuj zamiast tego motyw **scopowany do sekcji** — np. wrapper z lokalnymi custom
  properties albo `data-section="foton"` na kontenerze trasy. Opisz wybór i uzasadnij.
- **`src/components/Header.tsx`** — `ALL_NAV_LINKS` filtrowane przez
  `settings.navItemsVisibility`; `faq`, `kontakt`, `dlafirm` są zawsze widoczne.
  **Na Etap 1 nie dodawaj pozycji FOTON do nawigacji głównej** (uzasadnienie w dokumencie
  strategii). Dodaj natomiast klucz `foton` do mechanizmu widoczności, żeby dało się włączyć
  wejście z panelu admina bez deployu.
- **`src/pages/MotoliaB2BPage.tsx`** (`/dla-firm`) — wzorzec strony marketingowej bez
  `framer-motion` (własny `FadeIn` na `IntersectionObserver`). **Trzymaj się tego wzorca** —
  nie dociągaj nowych bibliotek animacji do bundla.
- **`src/components/FinancingCalculator.tsx`** — kalkulator związany z `listingId`.
  Dla pickupów (rejestracja bliska osobowym) powinien być użyteczny; dla N2/N3 nie.
  Sprawdź, co realnie da się podpiąć, i **napisz wprost, czego nie da się policzyć**.
- Lead-gen: `faqApi`, `leadsApi` w `src/services/api.ts` — leady FOTON muszą mieć
  **osobny typ/źródło**, żeby nie mieszały się z leadami finansowymi w CRM i GA4.
- SEO: obowiązuje `docs/SEO_LINKING_STRATEGY_MOTOLIA.md` (nagłówki CMS nie kończą się `?`,
  anchor zawsze z encją, FAQ bez linków).

## Zakres do zaprojektowania

To zadanie zaczyna się od **propozycji rozwiązania, nie od implementacji.**
Przedstaw plan i poczekaj na akceptację Kamila.

### 1. Struktura strony `/foton`

Zaproponuj układ sekcji realizujący trzy cele z góry briefu. Minimum:
hero z rozgałęzieniem na dwa segmenty, blok „Kto za co odpowiada", przegląd modeli
pogrupowany (pickupy / dostawcze / ciężarowe), blok „Dlaczego przez Motolię"
(dobór → zamówienie → finansowanie), dowody wiarygodności marki (30 lat, 140+ krajów,
gwarancja 5 lat / 200 tys. km, 8 lat / 400 tys. km na baterie), FAQ, formularz.

Kolejność i hierarchia to Twoja propozycja — uzasadnij ją.

### 2. Mechanizm motywowania sekcji

Patrz ostrzeżenie o `BrandContext`. Zaproponuj rozwiązanie scopowane, opisz wpływ na bundle
i na tryb ciemny, jeśli występuje.

### 3. Routing i SEO

Trasy `/foton` + podstrony (drzewo w dokumencie strategii, sekcja 5a).
`BreadcrumbList` JSON-LD **płaski**: `Strona główna → FOTON → <model>` — nie przez `/dla-firm`.
Zaproponuj `MetaHead`, dane strukturalne i wpięcie do sitemapy.

### 4. Formularze i tracking

Osobny typ leada, osobne eventy GA4, nota prawna inline. Zaproponuj, jak rozróżnić lead
flotowy od lifestyle'owego już na poziomie formularza.

### 5. Kwestie otwarte — zgłoś je, nie zgaduj

- **Ceny:** czy wolno je publikować? Bez cen segment lifestyle nie skonwertuje
  (klient porównujący Tunlanda z używanym Hiluxem odbije się od strony bez ceny),
  ale segment flotowy zaakceptuje „cena na zapytanie". **Zapytaj Kamila.**
- **Materiały CI:** zakres dozwolonego użycia logo i palety FOTON. **Zapytaj Kamila.**
- **Serwis:** kto konkretnie i gdzie. Bez tej informacji blok „Kto za co odpowiada"
  jest niekompletny, a leady flotowe będą odpadać.
- **RODO:** jeśli leady trafiają do Power Truck Poland — odrębni administratorzy czy
  współadministrowanie? Wpływa na klauzulę przy formularzu.
- **Kalkulator:** czy i dla których modeli da się policzyć wiarygodną ratę.
  Nie pokazuj liczby sugerującej precyzję, której nie mamy.

### 6. Treść

**Nie kopiuj materiałów importera jako trzonu strony** — te same teksty będzie miał każdy agent,
więc nie dają przewagi w wyszukiwarce. Wartość tworzy warstwa redakcyjna Motolii.

⚠️ **Weryfikuj dane techniczne.** Importer w części alt-tekstów nazywa Tunland G7
„elektrycznym pickupem" — **to pojazd wysokoprężny** (AVL 119 kW / 390 Nm, Common Rail Bosch,
7,5 l/100 km, ZF 8AT, napęd 4WD BorgWarner, blokada Eatona). Powielenie tego błędu kosztowałoby
nas wiarygodność w segmencie, który zna się na sprzęcie.

Nie publikuj treści o dopłatach do pojazdów elektrycznych bez potwierdzenia aktualnego statusu
programów NFOŚiGW — program NaszEauto mógł zostać wyczerpany.

## Definicja ukończenia

- Plan zaakceptowany przez Kamila **przed** implementacją
- Wszystkie trzy elementy ujawnienia obecne i widoczne bez scrollowania do stopki
- Zero sformułowań z listy zakazanej — sprawdź tekst przed oddaniem
- Motyw nie wycieka poza `/foton/*` — zweryfikuj na `/samochody` i stronie głównej
- Brak regresji w bundlu i w Core Web Vitals na istniejących stronach
- Leady FOTON rozróżnialne od finansowych w CRM i GA4
