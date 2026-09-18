# Prezentacja raty najmu — specyfikacja obowiązująca w całym serwisie

**Data:** 18.09.2026 · **Status:** do zatwierdzenia i wdrożenia
**Zakres:** każde miejsce, w którym Motolia pokazuje, wysyła albo wymawia kwotę raty najmu

Ten dokument jest źródłem prawdy dla produktu najmowego. Jeśli jakikolwiek ekran, tekst, mail albo skrypt rozmowy pokazuje ratę inaczej, niż tu opisano, to ten ekran jest błędny, a nie dokument.

---

## 1. Punkt wyjścia: interpretacja jest konfigurowana per firma najmowa

W panelu (`Firmy najmowe` → edycja) każda firma ma dwa ustawienia:

**A. Sposób doliczania ubezpieczenia** — odpowiada na pytanie *jak policzyć kwotę*:

| Tryb | Co znaczy |
|---|---|
| `23%` | ubezpieczenie doliczane do netto, VAT naliczany od całości |
| `0%` | stała kwota z matrycy, osobno na fakturze, bez VAT |
| `All-In` | ubezpieczenie już siedzi w racie w matrycy, nie doliczamy |

**B. Domyślne usługi wliczone w ratę** (ubezpieczenie / serwis / opony / inne) — odpowiada na pytanie *co obiecujemy klientowi*.

Na rynku występują dziś dwa modele matryc:

- **Ayvens, Athlon** — komponent ubezpieczenia jest wewnątrz raty całkowitej, rata przychodzi netto.
- **Masterlease** — komponent ubezpieczenia jest w matrycy osobno, a sposób jego prezentacji ustalamy przy konfiguracji firmy.

---

## 2. Dwa ustawienia odpowiadają na dwa różne pytania

Ustawienie A mówi, **jak policzyć kwotę**. Ustawienie B mówi, **co ta kwota zawiera**. To nie są ustawienia sprzeczne ani redundantne, ale bywają mylnie czytane, więc zapisujemy to jednoznacznie:

> **„Osobno na fakturze" nie znaczy „poza prezentowaną ratą".** W trybie `0%` składka jest częścią miesięcznego kosztu klienta i częścią kwoty, którą pokazujemy — po prostu idzie osobną pozycją na fakturze i nie łapie VAT-u. Checkbox „Ubezpieczenie wliczone w ratę" odnosi się do **raty prezentowanej**, nie do układu faktury.

**Reguła, która wynika z konstrukcji podatkowej:** komponent ubezpieczenia ma **tę samą wartość w widoku netto i brutto**. Zmienia się tylko część bazowa. Dlatego przełączenie netto/brutto nigdy nie przelicza składki.

**Wymaganie:** przy zapisie konfiguracji walidacja sprawdza, czy tryb i zaznaczone usługi opisują ten sam stan. Jeżeli tryb to `All-In`, a checkbox „Ubezpieczenie" jest odznaczony (albo odwrotnie) — zapis blokowany z komunikatem. Nie chodzi o to, że dziś jest źle; chodzi o to, żeby przy dziesiątej firmie najmowej nikt tego nie rozjechał.

---

## 3. Model kanoniczny — już istnieje w kodzie, nie tworzymy nowego

Sprawdzone w repo 18.09. **Kanoniczna implementacja to `calculateRatesWithInsurance` w `backend/src/routes/rental-public.ts:7`.** Robi dokładnie to, co opisuje sekcja 2, na istniejących polach:

| Pole w bazie | Rola |
|---|---|
| `RentalMatrixEntry.monthlyRateNet` / `monthlyRateGross` | rata bazowa, obie jednostki trzymane w bazie |
| `RentalMatrixEntry.insuranceNet` | komponent ubezpieczenia |
| `RentalCompany.insuranceAddMode` + `VehicleRentalAssignment.insuranceAddModeOverride` | tryb doliczania, z nadpisaniem per pojazd |
| `RentalCompany.includedServices` + `includedServicesOverride` + `entry.servicesIncluded` | zakres usług, kaskadowo |

Logika trybów (`INSURANCE_23`, `INSURANCE_0`, `INSURANCE_INCLUDED`) jest zaimplementowana poprawnie i zgodnie z przykładem kontrolnym z sekcji 2. **Nie wprowadzamy nowych nazw pól ani nowej warstwy — używamy tej funkcji.**

### Problem: ta sama logika jest w repo trzy razy

| Miejsce | Stan |
|---|---|
| `routes/rental-public.ts:7` `calculateRatesWithInsurance` | kanoniczne, pełna obsługa trybów, bez zaokrąglania |
| `modules/employee-program/rental/employee-rental-pricing.utils.ts:44` | kopia tej samej logiki, ale **zaokrągla `Math.round()` do pełnych złotych** |
| `services/rental-quote.service.ts:~200` | **nie czyta `insuranceAddMode` w ogóle** — liczy `monthlyRateNet * 1.23` na całości łącznie ze składką |

Dwie pierwsze już się rozjechały: ten sam pojazd pokazany publicznie i w programie pracowniczym może różnić się o niecałą złotówkę przez samo zaokrąglenie.

Trzecia jest poważniejsza, bo `rental-quote.service.ts` obsługuje `routes/rental-stock.ts:303` oraz `modules/pipeline/routes/rental-applications.routes.ts:240` — czyli **ścieżkę wniosków**. Jeśli firma w tej ścieżce ma tryb `INSURANCE_0`, kwota zapisana na wniosku będzie wyższa od tej, którą klient widział na ofercie, o 23% wartości składki. Ta ścieżka używa innych kolumn (`insuranceExcess500`, `insuranceNoLimit`, `tiresNoLimit`) niż publiczna, więc możliwe, że tak miało być — **to jest do rozstrzygnięcia, nie stwierdzony błąd.**

### Wymaganie

1. Wynieść `calculateRatesWithInsurance` do wspólnego modułu (np. `services/rental-pricing.ts`), zaimportować w trzech miejscach, skasować kopie.
2. Ujednolicić zaokrąglanie — jedna zasada dla całego serwisu.
3. Rozstrzygnąć, czy ścieżka `rental-quote.service.ts` ma honorować `insuranceAddMode`. Jeśli tak — podpiąć wspólny moduł.
4. Test jednostkowy z przykładem z sekcji 2 (1 000 + 350 → 1 350 netto / 1 580 brutto) w trybie `INSURANCE_0`. Testy dla trzech trybów istnieją już w `employee-rental-pricing.isolated.test.ts` — przenieść je razem z modułem.

To jest dokładnie sens „nie buduj nowego, zrób istniejące reużywalnym": model jest wypracowany, brakuje jednego miejsca, z którego wszyscy go biorą.

---

## 4. Jednostka: kto widzi netto, kto brutto

| Kontekst | Jednostka domyślna |
|---|---|
| `/dla-firm`, oferty oznaczone jako firmowe, klient B2B | netto, z brutto w drugiej linii |
| `/dla-ciebie`, klient konsumencki | brutto, z netto w drugiej linii |
| Listing ogólny bez wybranego segmentu | brutto, z widocznym przełącznikiem |

Zasady bezwzględne:

- **Przy każdej kwocie stoi jednostka.** Nie „1 523 zł", tylko „1 523 zł netto".
- **Przełącznik netto/brutto przestawia także progi filtra budżetowego.** Inaczej „do 1500 zł" znaczy co innego na dwóch stronach przy tym samym aucie.
- **Jednostka jest wybierana raz na sesję i pamiętana.** Klient, który przełączył na netto, nie ma wracać do brutto po przejściu na inną stronę.

---

## 5. Jednostka porównania: najtańsza oferta danej firmy na dany model

Porównanie nie jest listą wszystkich ofert obok siebie, tylko zestawieniem **najtańszej oferty każdej firmy najmowej na ten sam model**. To jest właściwa jednostka, bo odpowiada na pytanie, które klient realnie zadaje: „u kogo wezmę ten samochód najtaniej".

Filtr budżetowy i sortowanie nadal działają na `rataPorownawczaNetto` — pełnym miesięcznym koszcie klienta, niezależnie od tego, w jakiej postaci przyszła matryca. To jedyne pole, po którym wolno filtrować i sortować.

**Element, który z tego zestawienia robi przewagę Motolii, a nie kolejną tabelkę: różnica w tym, co jest wymagane, a co opcjonalne.** Ayvens wymaga ubezpieczenia, Masterlease nie. Ta sama rata u dwóch operatorów znaczy więc co innego, a klient nie ma jak tego sprawdzić sam — to nie stoi w cenniku ani w ofercie.

Wymaganie dla zestawienia: przy każdym wierszu widoczne **co jest w racie, co jest wymagane i co opcjonalne**. Nie jako przypis, tylko jako kolumna. Operator z pozornie wyższą ratą, który ma w niej wymagane ubezpieczenie, bywa tańszy w całości — i pokazanie tego jest dokładnie tym, za co klient przychodzi do brokera zamiast do salonu.

---

## 6. Gdzie ta metodologia obowiązuje

Lista jest zamknięta i wyczerpująca. Każdy punkt czyta te same pola kanoniczne.

| Miejsce | Co pokazuje |
|---|---|
| Karta oferty | `rataPrezentowana` + pełny zakres usług + podstawa wariantu |
| Kafelek na listingu | `rataPrezentowana` + skrócony zakres + jednostka |
| Strona marki i modelu | jw. |
| Filtr budżetowy | filtruje po `rataPorownawczaNetto`, progi w jednostce prezentacji |
| Przełącznik wariantu | zmienia wiersz matrycy, przelicza wszystkie cztery pola |
| Porównywarka ofert | wyłącznie `rataPorownawczaNetto`, z jawną adnotacją o różnicach zakresu |
| Lead do Thulium | `rataPorownawczaNetto`, jednostka prezentacji, wariant, zakres usług, partner |
| Materiały follow-up | te same kwoty co na stronie, z tą samą podstawą |
| Skrypt call center | doradca podaje kwotę w tej samej jednostce, w której klient ją widział |
| Poradniki i treści | każda kwota z podaną jednostką i zakresem; żadnych „rat od" bez podstawy |
| Kampanie i kreacje | jw.; „rata od X" wymaga przypisu z wariantem i zakresem |

---

## 7. Przypadki brzegowe

**Brak komponentu ubezpieczenia w danych przy trybie `23%` lub `0%`.** Nie zgadujemy i nie zerujemy po cichu. Oferta nie wchodzi do filtra budżetowego i na karcie ma komunikat „wycena ubezpieczenia na zapytanie". Pokazanie raty bez składki z etykietą „all-in" jest gorsze niż niepokazanie nic.

**Brak wybranego wariantu w matrycy.** Wracamy do wariantu domyślnego firmy i podajemy jego parametry przy kwocie.

**Zmiana konfiguracji firmy.** Przeliczenie pól kanonicznych dla wszystkich pojazdów tej firmy plus wpis w logu, kto i kiedy zmienił. To ustawienie zmienia kwoty widoczne dla klientów — musi być audytowalne.

**Limit kilometrów.** Do czasu potwierdzenia, czy `kmLimit` u Masterlease jest roczny czy całkowity, wyświetlamy go tak, jak przychodzi, i **nie filtrujemy po nim ani nie sortujemy**.

---

## 8. Walidacja przy zapisie konfiguracji

Konfiguracji firmy nie da się zapisać, jeśli:

- tryb doliczania i zaznaczone usługi są sprzeczne (patrz sekcja 2),
- wybrano tryb `23%` lub `0%`, a w matrycy tej firmy brakuje komponentu ubezpieczenia dla części pojazdów — wtedy ostrzeżenie z liczbą pojazdów i wymagane potwierdzenie,
- nie wskazano wariantu domyślnego.

Po zapisie: podgląd „tak zobaczy to klient firmowy / tak zobaczy to konsument" na jednym przykładowym pojeździe tej firmy. Pięć minut pracy, a wychwytuje większość błędów konfiguracji zanim zobaczy je klient.

---

## 9. Co z tego wynika dla treści i sprzedaży

Zdanie „u nas rata zawiera serwis, ubezpieczenie i opony" jest prawdziwe dla części partnerów i fałszywe dla innych. **W treściach nie wolno stawiać go jako ogólnej obietnicy Motolii.** Poprawna forma: „przy tej ofercie w racie są: …", generowana z zakresu usług konkretnej oferty.

To samo dotyczy skryptów call center: doradca podaje zakres z karty oferty, a nie z pamięci o tym, jak działa najem.

Materiał „co jest w racie, a za co dopłacisz" z warstwy 2 strategii musi być napisany jako **wyjaśnienie modelu**, a nie jako lista obowiązująca u wszystkich partnerów, i kończyć się odesłaniem do konkretnej oferty.
