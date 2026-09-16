# Strategia: pełny katalog pracowniczy z kalkulatorem

**Od:** Opus 5 (architektura)
**Data:** 2026-09-16
**Dotyczy:** punktów 2–6 — listing z filtrami, masowe dodawanie ofert, wyposażenie i kalkulacja, opis benefitu i procesu zamawiania, zarządzanie kalkulatorami

---

## 1. Stan faktyczny — zmierzony, nie założony

Zanim cokolwiek zaplanujemy, liczby z żywych baz:

| | dev | **produkcja** |
|---|---|---|
| aktywne pojazdy | 1893 | **2393** |
| `/nowe` (condition = NEW) | 33 | **68** |
| przypisania najmu długoterminowego | 10 | **94** |
| oferty pracownicze | 3 | — |

Rozmiar istniejącej warstwy prezentacji w głównym froncie:

| plik | linie |
|---|---|
| `src/pages/ListingDetailPage.tsx` | 1633 |
| `src/pages/RentalSearchPage.tsx` | 879 |
| `src/pages/SearchPage.tsx` | 875 |
| **razem, bez komponentów pomocniczych** | **3387** |

Co już jest w bazie i nie wymaga dobudowania:
- **Wyposażenie** — `equipmentSafety`, `equipmentComfortExtras`, `equipmentAudioMultimedia`, `equipmentOther` (tablice), `specsJson`, relacja `VehicleSpecification`. Punkt 4 nie ma żadnej pracy po stronie danych.
- **Kalkulator** — `FinancingProduct` to **już** globalny, zarządzany w backoffice model: `referenceRate`, `margin`, `commission`, `minInstallments`/`maxInstallments`, `maxInitialPayment`, `maxFinalPayment`, `provider` (OWN/INBANK/VEHIS), **`isDefault`**, `priority`.
- **Dobór kalkulatora per program** — `EmployeeProductOverride` już wiąże `FinancingProduct` z `EmployeeProgram` i niesie `allowedPeriods`, `minDownPaymentPct`, `maxDownPaymentPct`, `allowedContractParties`, `b2cStatus`.
- **Silnik obliczeń** — `backend/src/services/financing-calc.service.ts` (662 linie): `calcOwnInstallment`, `calcInbankInstallment`, `calcVehisInstallment`.

**Wniosek: punkt 6 jest w jakichś 80% zamodelowany.** Brakuje UI w panelu do doboru produktów per firma, logiki fallbacku i endpointu dla portalu. To nie jest nowa architektura, to okablowanie istniejącej.

---

## 2. Trzy rozstrzygnięcia, które trzeba podjąć przed kodowaniem

### 2.1 Masowe dodawanie ofert — problemem nie jest skala, tylko starzenie się

Intuicja mówi „2393 auta × 10 firm = 24 tysiące wierszy, to się nie uda". **Nieprawda** — zakres, o który prosisz (`/nowe` + najem długoterminowy), to na produkcji **68 + 94 = 162 pojazdy**. Sto sześćdziesiąt dwa wiersze na firmę to dla Postgresa nic. Obecny model `EmployeeProgramOffer` z wierszem na pojazd **uniesie to bez zmian**.

Prawdziwy problem jest inny: **`EmployeeProgramOffer` to fotografia, a stok to film.** Nowe auta wjeżdżają do `/nowe` na bieżąco. Jednorazowy import utworzy 162 wiersze, a za dwa tygodnie w katalogu firmy nie będzie pięciu nowych aut, bo nikt nie kliknął importu ponownie. Nikt tego nie zauważy — po prostu pracownik ich nie zobaczy.

**Rekomendacja: reguła zasięgu zamiast importu.** Program dostaje regułę („obejmuje wszystkie pojazdy `condition = NEW` oraz wszystkie przypisania najmu, rabat domyślny 8%"), a `EmployeeProgramOffer` zostaje **wyłącznie mechanizmem wyjątków**: własna cena, własny pakiet benefitów, albo jawne wykluczenie pojazdu z programu.

Zyski: katalog aktualizuje się sam wraz ze stokiem; liczba wierszy spada ze 162 do kilku na firmę; znika cała klasa błędów „dlaczego tego auta nie widać".

Koszt: zapytanie katalogu robi się bardziej złożone (reguła ∪ wyjątki − wykluczenia), a ustalanie ceny musi mieć jasny priorytet. Rozszerzenie istniejącej hierarchii jest naturalne:

```
wyjątek.customPricePln > wyjątek.discountPct > reguła.discountPct > program.defaultDiscountPct > cena katalogowa
```

Jeśli mimo wszystko wolisz jednorazowy import — da się, jest szybszy o jeden etap, ale wtedy **trzeba zaplanować cykliczne odświeżanie** i pogodzić się z tym, że między odświeżeniami katalog firmowy jest nieaktualny.

### 2.2 Nie przepisujmy katalogu po raz drugi — ale też nie róbmy wielkiej ekstrakcji z góry

Punkty 2, 4 i 5 to, mówiąc wprost, **odtworzenie publicznego katalogu Motolii za loginem**: filtry, karta pojazdu, wyposażenie, galeria, kalkulator. W głównym froncie to ponad 3400 linii w samych trzech stronach, plus `FilterPanel`, `ListingCard`, `SpecsGrid`, `ImageSwiper` i komponenty finansowania.

Trzy drogi:

| | Na czym polega | Ocena |
|---|---|---|
| **A. Skopiować do portalu** | Przepisać komponenty w `apps/employee-portal` | Najszybsze na pierwszym etapie, **najdroższe od drugiego**. Dwie kopie karty pojazdu rozjadą się w ciągu miesiąca. Odradzam. |
| **B. Wydzielić `packages/vehicle-ui` od razu** | Monorepo z npm workspaces, przeniesienie komponentów, refaktor głównego frontu | Docelowo słuszne, ale **dziś przedwczesne** — portal ma dwa ekrany, więc nie wiemy jeszcze, co naprawdę jest wspólne. Ekstrakcja na podstawie zgadywania daje złe API pakietu. |
| **C. Ekstrakcja przy drugim użyciu** | Budujemy kartę szczegółów w portalu; każdy komponent, który realnie okazuje się wspólny, **przenosimy** (nie kopiujemy) do pakietu współdzielonego w momencie drugiego użycia | **Rekomendacja.** Koszt rozłożony, API pakietu wynika z faktów, brak wielkiego refaktoru na starcie. |

Warunek techniczny dla C: root `package.json` **nie ma dziś `workspaces`**, a `apps/employee-portal` ma własny `package-lock.json` i jest poza CI. Pierwszy etap, który dotknie współdzielenia, musi to uporządkować — inaczej pakiet nie zbuduje się ani lokalnie, ani w Dockerze.

### 2.3 Kalkulator wolno liczyć tylko na karcie szczegółów

`financing-calc.service.ts` zawiera `calcInbankInstallment` i `calcVehisInstallment`, które **wychodzą do zewnętrznych API** (Inbank, Vehis) po token i wycenę, z `fetchWithTimeout` 15 s.

Policzenie raty dla każdego kafelka na liście oznaczałoby przy 24 kaflach **24 wywołania do zewnętrznego dostawcy na jedno wejście na stronę**. To się skończy limitami po ich stronie, timeoutami po naszej i listą, która ładuje się pół minuty.

**Reguła: na liście pokazujemy wyłącznie cenę pracowniczą i rabat (dane z bazy, zero wywołań zewnętrznych). Ratę liczymy dopiero na karcie szczegółów, na żądanie.** Jeśli rata na kaflu jest wymagana biznesowo, jedyna bezpieczna droga to rata orientacyjna z `calcOwnInstallment` (czysta arytmetyka, bez zewnętrznych wywołań), wyraźnie oznaczona jako szacunkowa.

---

## 3. Pytanie, które warto zadać przed etapem 4

Punkty 2–5 razem sprowadzają się do: „pracownik ma widzieć katalog Motolii, tylko ze swoimi cenami". Jeśli tak jest naprawdę, istnieje prostsza odpowiedź produktowa niż budowanie drugiego katalogu:

**Pokazać zwykły katalog Motolii, a zalogowanemu pracownikowi nałożyć warstwę cen pracowniczych.** Jedna baza kodu, zero rozjazdu, wyposażenie i filtry działają od pierwszego dnia.

Czego by to kosztowało: portal jest dziś **świadomie odseparowany** — własna domena, ciasteczka `__Host-`, osobny nginx z rate-limitem, brak jakichkolwiek tras administracyjnych w bundlu. To była decyzja bezpieczeństwa, nie przypadek. Scalenie z publicznym serwisem tę separację znosi i wprowadza ryzyko, że błąd w publicznym katalogu odsłoni ceny partnerskie.

Nie rozstrzygam tego za Ciebie, bo to decyzja biznesowa o tym, jak bardzo program pracowniczy ma być oddzielony od publicznej Motolii. **Ale warto ją podjąć świadomie teraz**, a nie odkryć za trzy etapy, że zbudowaliśmy drugi serwis. Moja rekomendacja: zostać przy osobnym portalu (separacja ma realną wartość przy danych partnerskich i cenach nieujawnianych publicznie) i współdzielić kod przez pakiet, czyli wariant C z §2.2.

---

## 4. Proponowana kolejność etapów

Kolejność wynika z zależności, nie z ważności. Każdy etap kończy się czymś, co widać w portalu.

### E1 — Reguła zasięgu programu *(punkt 3)*
Model reguły na programie (kategorie: `NEW`, najem; rabat domyślny), UI w panelu firmy, katalog czyta regułę ∪ wyjątki. Migracja trzech istniejących ofert do roli wyjątków.
**Dlaczego pierwszy:** bez tego każdy kolejny etap pracuje na katalogu, który starzeje się od dnia importu. Dopiero po E1 wiadomo, ile ofert realnie ma firma — a od tego zależy priorytet filtrów.
**Widać:** katalog firmy wypełnia się automatycznie, nowe auta pojawiają się same.

### E2 — Karta szczegółów oferty + wyposażenie *(punkt 4, część 1)*
Trasa `/oferta/:id` w portalu, `GET /api/employee/offers/:offerId` (endpoint **już istnieje**, brakuje konsumenta), galeria, dane techniczne, cztery grupy wyposażenia.
**Tu zapada decyzja o współdzieleniu** — to pierwszy moment, gdy dotykamy prezentacji pojazdu. Ustawiamy workspaces i przenosimy pierwsze komponenty.
**Widać:** pracownik klika auto i widzi pełną specyfikację.

### E3 — Kalkulator *(punkty 4 część 2 i 6)*
Dobór produktów finansowych per firma w panelu (`EmployeeProductOverride`), fallback na `FinancingProduct.isDefault` gdy nic nie wybrano, endpoint kalkulacji dla portalu wołający **istniejący** `financing-calc.service`, UI kalkulatora na karcie szczegółów.
**Widać:** pracownik ustawia wkład własny i okres, dostaje ratę; administrator wybiera, które produkty widzi dana firma.

### E4 — Listing z filtrami *(punkt 2)*
Filtry analogiczne do `brand=motolia`. Backend ma już `parseListingsQuery` z filtrami ceny, rocznika, przebiegu, mocy i pojemności — do zaadaptowania pod zasięg programu.
**Dlaczego dopiero teraz:** wartość filtrów rośnie z liczbą ofert. Przy 40 autach to wygoda, przy 500 konieczność. Po E1 będziemy wiedzieć, który to przypadek — **jeśli programy wyjdą powyżej stu ofert, przesuń ten etap przed E2**.

### E5 — Benefit i proces zamawiania na karcie *(punkt 5)*
`EmployeeBenefitPolicy.termsText` już istnieje. Opis procesu zamawiania wymaga nowego pola na programie albo treści z CMS — do rozstrzygnięcia na starcie etapu.
**Widać:** pracownik wie dokładnie, co dostaje i co się stanie po wysłaniu zapytania.

---

## 5. Dług, który urośnie, jeśli go teraz nie spłacimy

Te pozycje są tanie dziś, a z każdym etapem drożeją:

1. **`apps/employee-portal` jest poza CI**, a job backendowy nie uruchamia testów. Wchodzimy w etap, w którym portal przestaje być szkieletem na dwa ekrany. Bez CI każda kolejna warstwa jest niechroniona — a mamy już 192 testy, które nic nie pilnuje.
2. **Brak `workspaces` w root `package.json`** — blokada dla wariantu C. Do zrobienia najpóźniej w E2.
3. **Brak odzyskiwania hasła** — nadal nie ma modelu tokenu ani endpointu. `next-steps.md` §1 oznacza to jako wymagane **przed pilotażem**. Im więcej funkcji, tym więcej pracowników w systemie i tym dotkliwszy brak.
4. **`check_offer_source_integrity` nie istnieje na środowiskach stawianych `db push`** — przy wchodzeniu w oferty RENTAL to zaczyna mieć znaczenie, bo pojawia się drugi wariant `sourceType`.
5. **Generator `referenceNumber`** oparty na ośmiu ostatnich cyfrach znacznika czasu — kolizje przy zgłoszeniach w tej samej milisekundzie. Obejście jest w module zgłoszeń, źródło problemu zostaje.

---

## 6. Czego nie rekomenduję

- **Kalkulatora na kaflach listy** — patrz §2.3.
- **Jednorazowego masowego importu bez reguły zasięgu** — patrz §2.1; to rozwiązanie, które psuje się po cichu.
- **Wielkiej ekstrakcji pakietu wspólnego na starcie** — patrz §2.2 wariant B.
- **Robienia E4 przed E1** — filtrowanie katalogu, który nie wie, co powinien zawierać, to praca do wyrzucenia.
