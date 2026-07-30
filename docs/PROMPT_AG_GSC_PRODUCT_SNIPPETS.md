# Prompt dla agenta — diagnoza raportu „Opisy produktów" w GSC (motolia.pl)

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Kontekst

Google Search Console, właściwość `sc-domain:motolia.pl`, raport **Zakupy → Opisy produktów**
(Product snippets), stan na 29.07.2026:

- **Prawidłowe: 9**, Nieprawidłowe: 0
- Wykres: liczba prawidłowych elementów rosła przez lipiec do **szczytu ~143 (20.07.2026)**,
  a następnie spadła do ~9 w ciągu kilku dni (21–29.07).
- Sporadycznie pojedyncze elementy nieprawidłowe (1–2).

W serwisie jest istotnie więcej ofert samochodów niż 9, więc albo Google gubi elementy,
albo przenosi je do innego raportu, albo nasze dane strukturalne nie kwalifikują się jako produkt.

Twoim zadaniem jest **ustalić przyczynę na podstawie dowodów, nie hipotez**, a potem
zaproponować (jeszcze NIE wdrażać) minimalną poprawkę. Wdrożenie nastąpi po akceptacji.

## Zasady

- Nie zgaduj. Każdy wniosek musi mieć oparcie w danych z GSC, w kodzie albo w oficjalnej
  dokumentacji Google (`developers.google.com/search/docs`). Cytuj konkrety: plik + linia, URL dokumentacji.
- Wyraźnie rozdziel: **fakt / hipoteza / rekomendacja / ryzyko**.
- Jeśli któraś z hipotez poniżej jest błędna, napisz to wprost i uzasadnij. Nie dopasowuj wniosków do nich.
- Nie zmieniaj kodu w tej iteracji. Wyjątek: skrypt diagnostyczny w `backend/src/scripts/`,
  jeśli potrzebujesz policzyć coś na danych.

## Krok 1 — najpierw sprawdź, czy elementy nie zostały tylko przeniesione (najtańszy test)

Google przenosi elementy między raportami, gdy zmienia się ich kwalifikacja. Strona z `price`
i `availability` może zostać zaklasyfikowana jako **merchant listing**, a nie **product snippet** —
wtedy licznik w jednym raporcie spada, a w drugim rośnie, mimo że w kodzie nic się nie zmieniło.

Kamil jest zalogowany do GSC w Chrome. Użyj MCP `claude-in-chrome`, żeby odczytać (tylko czytać,
nic nie klikać poza nawigacją i rozwinięciem raportów):

1. **Zakupy → Informacje o sprzedawcy** (Merchant listings) — liczba prawidłowych/nieprawidłowych
   i kształt wykresu w tym samym okresie. Czy wzrost tam pokrywa się w czasie ze spadkiem
   w „Opisach produktów"?
2. **Zakupy → Możliwości dla sprzedawcy**.
3. Sprawdź, czy na liście raportów jest **„Ogłoszenia pojazdów" / Vehicle listings**. Jeśli tak — jego stan.
4. **Ulepszenia / Dane strukturalne** — czy pojawiły się nowe typy elementów.
5. W „Opisach produktów" wejdź w **„Wyświetl dane na temat prawidłowych elementów"** i wypisz
   **konkretne 9 URL-i**, które Google uznaje za prawidłowe. To najważniejsza dana w całym zadaniu —
   pokaże, czy to np. wyłącznie oferty najmu, wyłącznie `/oferta/...`, czy coś jeszcze innego.
6. **Indeksowanie → Strony**: liczba stron zaindeksowanych vs. wykluczonych, a szczególnie kategorie
   „Nie znaleziono (404)" i „Strona z przekierowaniem" — zanotuj liczby i trend w lipcu.

Jeśli którykolwiek raport jest niedostępny, napisz to i idź dalej — nie kombinuj obejściami.

## Krok 2 — hipotezy do zweryfikowania w kodzie

### H1 (wiodąca): rotacja stanu magazynowego zamienia oferty w 404

Fakty ustalone w kodzie:

- Import CSFlow (`backend/src/services/csflow.service.ts:388-400`) **archiwizuje** oferty, których
  nie ma już w feedzie (`isArchived: true`), zachowując `id` (czyli slug jest stabilny — to dobrze).
- SSR ofert (`backend/src/routes/render.ts:389-412`) szuka `where: { id, isArchived: false }`,
  a przy braku wyniku zwraca **404 + noindex**.

Czyli każda zarchiwizowana oferta natychmiast staje się 404, a Google usuwa jej element Product.
Przy szybkiej rotacji feedu to samo w sobie wyjaśniałoby spadek 143 → 9.

Do sprawdzenia na danych (skrypt w `backend/src/scripts/`, uruchamiany lokalnie przez
`npx tsx src/scripts/<name>.ts` z katalogu `backend/` — patrz CLAUDE.md sekcja 6):

- ile jest ofert `isArchived: false` (czyli ile URL-i **powinno** mieć schema Product),
- ile ofert zarchiwizowano dziennie w lipcu (rozkład `archivedAt` po dniach) — czy jest skok 20–22.07,
- ile ofert ma `pricePln` równe null / 0 / wartość absurdalnie niską (oferta bez ceny nie kwalifikuje się),
- średni czas życia oferty od `createdAt` do `archivedAt`.

Zestaw wynik z liczbą 9 z GSC i z liczbą stron zaindeksowanych. Jeśli aktywnych ofert jest np. 300,
a Google widzi 9 elementów, to rotacja **nie** jest pełnym wyjaśnieniem — szukaj dalej.

### H2: typ `Vehicle` bez `Product`

`buildListingMeta` (`backend/src/services/seo-meta.ts:343-370`) emituje `"@type": "Vehicle"`
z `offers`. `Vehicle` jest w schema.org podtypem `Product`, ale **sprawdź w aktualnej dokumentacji
Google**, czy parser rich results dla product snippets / merchant listings akceptuje podtypy,
czy wymaga jawnego `Product`. Jeśli wymaga — wariantem do rozważenia jest
`"@type": ["Product", "Vehicle"]` (jeden węzeł, dwa typy).
Podaj link do konkretnego fragmentu dokumentacji, na którym opierasz wniosek.
Sprawdź też, czy Google nie ma dziś dedykowanej funkcji **vehicle listing** z własnymi wymaganiami —
jeśli ma, oceń, czy to nie jest właściwszy cel dla ofert samochodowych niż product snippets.

### H3: brakujące pola wymagane/zalecane

Obecny `Offer` ma: `price`, `priceCurrency`, `availability`, `url`, `itemCondition`.
Zweryfikuj wobec dokumentacji, czy dla naszego przypadku brakuje czegoś, co Google traktuje jako
wymagane, oraz co jest tylko zalecane (`sku`, `gtin`/`mpn`, `priceValidUntil`, `seller`,
`hasMerchantReturnPolicy`, `shippingDetails`, `aggregateRating`/`review`).
**Rozdziel wymagane od zalecanych** i nie proponuj dodawania `aggregateRating` — nie mamy prawdziwych
ocen, a fabrykowanie ich to naruszenie wytycznych Google i ryzyko manualnej kary.
Jeśli jakiegoś pola nie mamy w danych (np. VIN → `sku`), napisz, skąd dałoby się je wziąć.

### H4: warianty finansowe i kanonikalizacja

Warianty `/leasing/:slug` i `/kredyt/:slug` kanonikalizują się do `/oferta/:slug` i **celowo** nie
emitują `Vehicle` (`seo-meta.ts:342`). Potwierdź, że to nie tłumi elementów na stronach kanonicznych,
i sprawdź, czy Googlebot nie trafia głównie na warianty (wskazówka: raport „Strony" → przekierowania
i „Strona alternatywna z prawidłowym tagiem canonical").

### H5: sitemap podbija `lastmod` przy każdym imporcie

`backend/src/routes/seo.ts` ustawia `lastmod: formatDate(listing.updatedAt)`, a import aktualizuje
rekordy nawet gdy dane się nie zmieniły. Oceń, czy to marnuje budżet crawlowania (osobny problem
od raportu produktów, ale zgłoś jeśli potwierdzisz).

## Krok 3 — walidacja na żywej stronie

Weź 3 URL-e: jeden z listy 9 „prawidłowych" z GSC, jeden aktywny którego tam nie ma, i jeden
zarchiwizowany. Dla każdego:

- pobierz surowy HTML (`mcp__workspace__web_fetch` lub Chrome MCP) i wyciągnij bloki
  `application/ld+json` — porównaj z tym, co według kodu powinno się wyemitować,
- zanotuj kod odpowiedzi HTTP,
- sprawdź, czy JSON-LD jest w HTML **przed** hydracją (SSR), a nie dostawiany przez Reacta.

Zbuduj tabelę: URL | HTTP | typy JSON-LD | ma ofertę z ceną | jest w GSC jako prawidłowy.
Ta tabela ma rozstrzygnąć spór między H1 i H2 — jeśli aktywne oferty poza dziewiątką mają poprawny
JSON-LD i zwracają 200, problem jest po stronie klasyfikacji/typu, a nie rotacji.

## Oczekiwany rezultat

Plik `docs/GSC_PRODUCT_SNIPPETS_DIAGNOZA.md`:

1. Co realnie się stało (wsparte danymi z Kroku 1 i 3) — jedno zdanie na początku.
2. Tabela hipotez: H1–H5, każda z werdyktem potwierdzona / odrzucona / nierozstrzygnięta + dowód.
3. Czy 143 → 9 to utrata elementów, czy przeniesienie między raportami.
4. Rekomendowana poprawka: opcje z wpływem, nakładem, ryzykiem i odwracalnością.
   Jeśli najlepszą opcją jest „nie robić nic" (np. rotacja stanu jest naturalna dla ofert
   samochodowych), napisz to wprost.
5. Osobno: co wymaga decyzji Kamila, a co możesz wdrożyć samodzielnie.
6. Czego nie udało się ustalić i czego by do tego potrzeba.

Na koniec zgłoś podsumowanie w czacie — po polsku, zwięźle, bez powtarzania całego dokumentu.
