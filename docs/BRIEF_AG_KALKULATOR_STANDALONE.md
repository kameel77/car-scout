# Brief dla agenta — kalkulator finansowania jako samodzielne narzędzie i widget

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Cel biznesowy

Zbudować kalkulator finansowania **dla osoby, która znalazła samochód gdzie indziej** (OTOMOTO,
u dealera, na Facebooku) i potrzebuje do niego finansowania i/lub ubezpieczenia. Dziś taki
użytkownik nie ma na motolia.pl nic dla siebie: kalkulator istnieje wyłącznie jako element karty
konkretnej oferty z naszej bazy.

Dwa cele naraz:

1. **Pozyskanie leadu spoza naszej oferty** — użytkownik podaje parametry auta, dostaje ratę,
   zostawia kontakt. To nowy strumień leadów, niezależny od stanu magazynowego.
2. **Widoczność na frazy narzędziowe** — „kalkulator leasingu", „kalkulator raty kredytu
   samochodowego", „kalkulator wynajmu długoterminowego". Konkurencyjne porównywarki
   (porownywarkaleasingowa.pl) budują na tym znaczący ruch, a my nie mamy tam nic.

Dodatkowo narzędzie ma dać się osadzać jako komponent na innych stronach serwisu
(strony filarowe `/leasing`, `/kredyt`, `/wynajem-dlugoterminowy`, `/dla-firm`, landing page'e).

## Stan obecny (zweryfikowany w kodzie)

- `src/components/FinancingCalculator.tsx` (669 linii) — liczy ratę, ale jest **związany
  z ofertą**: przyjmuje `listingId`, sprawdza flagi dostępności produktów finansowych dla
  konkretnego auta, a CTA prowadzi do `/listing/${listingId}/lead`.
- Istnieje system widgetów: `backend/src/routes/widgets.ts` z `placement`
  (`HOME | OFFER | RENTAL | STATIC | EXTERNAL`) oraz `src/pages/WidgetEmbedPage.tsx`.
  **Zbadaj go przed projektowaniem czegokolwiek** — być może osadzanie da się oprzeć na tym,
  co już mamy, zamiast budować drugi mechanizm.
- Produkty finansowe i ich parametry: `backend/src/routes/financing.ts`,
  `backend/src/services/financing-calc.service.ts`.

## Zakres do zaprojektowania (najpierw plan, potem kod)

To zadanie zaczyna się od **propozycji rozwiązania, nie od implementacji**. Przedstaw plan
i poczekaj na akceptację Kamila.

### 1. Rozdzielenie logiki od kontekstu oferty

Kalkulator musi działać w dwóch trybach:

- **z ofertą** (dzisiejsze zachowanie na `/oferta/:slug`) — bez regresji,
- **bez oferty** — użytkownik sam podaje parametry: cena auta, rok/stan (nowe/używane),
  ewentualnie marka i model, rodzaj finansowania.

Zaproponuj, jak to rozciąć: wspólny rdzeń obliczeniowy + dwa opakowania, czy jeden komponent
z trybem? Uzasadnij wybór. Ostrzeżenie: `FinancingCalculator.tsx` ma 669 linii i wiele stanów
lokalnych — przepisanie go „przy okazji" to ryzyko regresji na najważniejszej stronie serwisu
(karta oferty). Zaproponuj podejście, które to ryzyko ogranicza i opisz, jak je przetestujemy.

### 2. Kwestia otwarta do rozstrzygnięcia: skąd wziąć ratę bez oferty

Dzisiejsza kalkulacja korzysta z flag i parametrów przypisanych do konkretnego auta w naszej
bazie. Dla auta z zewnątrz tych danych nie ma. Sprawdź w `financing-calc.service.ts`, co dokładnie
jest wymagane, i odpowiedz: czy da się policzyć wiarygodną ratę wyłącznie z ceny, stanu i okresu?
Jeśli nie w pełni — **powiedz to wprost** i zaproponuj, jak komunikować użytkownikowi, że to
szacunek, a nie oferta wiążąca. Nie wolno pokazywać liczby, która sugeruje precyzję, której nie
mamy — to zarówno ryzyko regulacyjne (produkty finansowe), jak i zaufania.

Sprawdź też, czy przy prezentowaniu rat kredytowych nie obowiązują nas wymogi informacyjne
(RRSO, całkowity koszt, reprezentatywny przykład). To pytanie do rozstrzygnięcia z Kamilem,
ale **zgłoś je wyraźnie w planie** — nie pomijaj go.

### 3. Ubezpieczenie

Zakres z briefu obejmuje „finansowanie i/lub ubezpieczenie". Sprawdź, czy w systemie jest
cokolwiek ubezpieczeniowego (szukaj `INSURANCE`, `insurance`, ostatnie commity o
`INSURANCE_INCLUDED`). Jeśli nie ma modelu danych ani partnera, **nie projektuj kalkulatora
ubezpieczeń** — zaproponuj w pierwszej wersji zbieranie zainteresowania (checkbox „chcę też
ofertę ubezpieczenia" w formularzu leada) i opisz, czego wymagałaby pełna funkcja.

### 4. Strona `/kalkulator-rat` (nazwa do potwierdzenia)

- SSR jak pozostałe trasy statyczne: wpis w `STATIC_ROUTES` (`seo-meta.ts`) z tytułem, H1,
  opisem i treścią prerenderu; trasa musi trafić do `sitemap.xml` (`backend/src/routes/seo.ts`)
  i do `PAGINATED_ROUTES` **nie** trafia.
- Strona ma być indeksowalna i self-canonical.
- Treść: sam kalkulator to za mało pod frazy narzędziowe. Zaproponuj minimalny obudowujący
  content (jak liczymy ratę, co wpływa na wysokość, różnice leasing/kredyt/najem) z linkowaniem
  do filarów zgodnie z `docs/SEO_LINKING_STRATEGY_MOTOLIA.md`.
- **Nie dodawaj listy losowych ofert do prerenderu** — trasa ma trafić do
  `LISTINGLESS_STATIC_ROUTES` w `render.ts`.

### 5. Osadzanie na innych stronach

Komponent do wstawienia na `/leasing`, `/kredyt`, `/wynajem-dlugoterminowy`, `/dla-firm`
i na landing page'ach. Ustal, czy idziemy przez istniejący system widgetów (`placement: STATIC`),
czy przez zwykły import komponentu — i uzasadnij. Jeśli widget ma być osadzalny na **obcych**
domenach (`placement: EXTERNAL`), zgłoś to jako osobny zakres, bo dochodzą CORS, iframe
i śledzenie źródła leada.

Wymóg pomiarowy: lead z kalkulatora musi być rozpoznawalny co do miejsca powstania
(strona filarowa vs `/kalkulator-rat` vs landing). Sprawdź, jak dziś działa `formId`
w `CallbackForm` i użyj tej samej konwencji.

## Czego nie robić

- Nie przepisywać `FinancingCalculator.tsx` od zera bez uzgodnienia.
- Nie dodawać zależności do `package.json` bez uzasadnienia.
- Nie wymyślać danych finansowych (przykładowych RRSO, stawek ubezpieczeń) — jeśli czegoś nie ma
  w systemie, to tego nie ma.
- Nie ruszać kalkulatora na kartach ofert inaczej niż w sposób, który da się odwrócić.

## Wynik

1. `docs/KALKULATOR_STANDALONE_PLAN.md`: proponowana architektura, odpowiedź na pytanie
   o wiarygodność wyliczeń bez oferty, zakres v1 vs późniejszy, ryzyka (regresja na karcie oferty,
   wymogi informacyjne dla produktów kredytowych), plan testów, szacunek nakładu.
2. Lista pytań, na które potrzebujesz decyzji Kamila — zebrana w jednym miejscu, nie rozsypana
   po dokumencie.
3. **Kodu nie piszemy w tej iteracji.** Implementacja po akceptacji planu.

Raport w czacie po polsku, zwięźle.
