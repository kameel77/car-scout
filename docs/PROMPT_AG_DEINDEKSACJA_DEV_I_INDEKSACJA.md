# Prompt dla agenta — deindeksacja dev.motolia.pl + porządki w indeksacji

Skopiuj wszystko poniżej linii jako zadanie dla agenta.

---

## Kontekst i ustalone FAKTY (nie podważaj ich bez dowodu, ale zgłoś jeśli znajdziesz sprzeczność)

Poprzednia diagnoza (`docs/GSC_PRODUCT_SNIPPETS_DIAGNOZA.md`) postawiła błędną tezę, że spadek
w raporcie „Opisy produktów" wynika z braku typu `Product` w JSON-LD. Nowe dowody to wykluczają:

1. **Rich Results Test na dwóch żywych ofertach produkcyjnych** (`/oferta/hyundai-bayon-...`,
   `/oferta/ford-focus-silver-x-...`, test z 30.07.2026) → **„Product snippets" wykryte poprawnie**,
   `type: Vehicle`, tylko 2 uwagi niekrytyczne (brak opcjonalnych `review` i `aggregateRating`).
   Czyli Google **akceptuje** nasz obecny `@type: "Vehicle"` w tej funkcji. Typ nie jest blokerem.
2. **GSC → Indeksowanie → Strony, właściwość domenowa `sc-domain:motolia.pl`**: 4,78 tys.
   zaindeksowanych, **6,26 tys. niezaindeksowanych**. Główne przyczyny: `noindex` — 3 755,
   **„Alternatywna strona z prawidłowym tagiem canonical" — 1 656**, „Nie znaleziono (404)" — 332.
3. **Ta sama data, właściwość prefiksowa `https://motolia.pl/` (czyli sama produkcja)**:
   **3,19 tys. zaindeksowanych, 4,75 tys. niezaindeksowanych**. Różnica wobec właściwości domenowej
   to **~1,59 tys. zaindeksowanych stron, które NIE są produkcją** (właściwość domenowa obejmuje
   wszystkie subdomeny — to nie błąd GSC, tylko jej definicja).
4. **Eksport zaindeksowanych URL-i z właściwości domenowej (próbka 1000)**: 736 to `/oferta/...`,
   **287 to `dev.motolia.pl`**, 135 to warianty `/leasing/...` i `/kredyt/...`.
   287/1000 przeskalowane na 4,78 tys. daje **~1,37 tys. stron dev w indeksie** — co niezależnie
   potwierdza różnicę ~1,59 tys. z punktu 3. Dwie metody zgadzają się co do rzędu wielkości.
5. **`https://dev.motolia.pl/robots.txt`** zwraca `Allow: /` dla wszystkich botów i deklaruje
   `Sitemap: https://dev.motolia.pl/sitemap.xml`.
6. **`https://dev.motolia.pl/oferta/...`** ma **self-referencing canonical na dev**, pełny prerender
   treści i **brak** `noindex`.
7. **Dev ma własną bazę, nie kopię produkcyjnej.** Oferta `...cmrqkx1m70005aqff9lza7bxb` istnieje na
   dev, a na produkcji ten sam adres nie zwraca treści. Wniosek: strony dev **nie są duplikatami 1:1**
   konkretnych stron produkcyjnych, więc **nie tłumaczą** 1 656 stron „alternatywnych z canonicalem".
   Nie powtarzaj tej hipotezy — została sprawdzona i odrzucona.
8. Slug dla marki Škoda generuje się jako `koda-octavia-...` — `Š` nie ma w mapie `POLISH_CHARS`
   (`src/utils/url-utils.ts:48-53` oraz **zduplikowana kopia** w `backend/src/routes/seo.ts`).

**Uzasadnienie P0:** ~1,4 tys. zaindeksowanych stron środowiska developerskiego to marnowany budżet
crawlowania, zaśmiecone raporty i publicznie widoczne niegotowe dane — a nie (jak wcześniej błędnie
zakładano) przyczyna problemów z atrybucją elementów Product. Robimy to z powodu higieny i skali,
nie na podstawie hipotezy o duplikatach.

## Zasady

- Fakt / hipoteza / rekomendacja / ryzyko — rozdzielaj wyraźnie. Nie przedstawiaj hipotez jako wniosków.
- **Nie wolno wpisywać do raportu danych, których nie zmierzyłeś.** Poprzednia diagnoza zawierała
  tabelę „walidacji" z URL-ami-placeholderami (`zarchiwizowana-oferta-...`) i liczby z bazy bez
  żadnego skryptu — to dyskwalifikuje raport. Jeśli czegoś nie da się sprawdzić, napisz „nie sprawdzono i dlaczego".
- Każdą liczbę z bazy popieraj skryptem w `backend/src/scripts/` (uruchamianym lokalnie
  `npx tsx src/scripts/<name>.ts` z katalogu `backend/` — CLAUDE.md sekcja 6). Skrypt zostaje w repo.

## Zadanie 1 (P0) — deindeksacja dev.motolia.pl. Kolejność ma znaczenie

Uwaga na typowy błąd: **`Disallow` w robots.txt NIE usuwa stron z indeksu**. Zablokowany crawl
oznacza, że Google nie zobaczy `noindex` i URL-e mogą zostać w indeksie na długo. Właściwa kolejność:

1. **Najpierw `noindex`, crawl zostaje otwarty.** Dodaj nagłówek `X-Robots-Tag: noindex, nofollow`
   dla **wszystkich** odpowiedzi na środowisku dev. Zaproponuj, gdzie to wdrożyć — nginx
   (`nginx.conf`) czy backend (`render.ts` / hook Fastify) — i uzasadnij wybór. Warunek MUSI zależeć
   od środowiska (np. `FRONTEND_URL` zawiera `dev.` albo dedykowana zmienna), nigdy od hardkodu,
   który mógłby przypadkiem trafić na produkcję. **To jest zmiana, która przy błędzie wyłącza
   produkcję z Google — potraktuj ją z maksymalną ostrożnością i wyraźnie opisz zabezpieczenie.**
2. **Usuń sitemapę z dev** (albo zwróć 404 dla `/sitemap.xml` na dev) i usuń linię `Sitemap:`
   z robots.txt na dev. Sprawdź, czy `sitemapRoutes` i `robots.txt` da się warunkować środowiskiem.
3. **Dopiero po potwierdzeniu deindeksacji** (kilka tygodni, weryfikacja w GSC) rozważ pełne
   `Disallow: /` lub basic auth na dev. Zapisz to jako zadanie odłożone, nie rób teraz.
4. Sprawdź, czy `dev` nie jest wypchnięty w sitemapie produkcyjnej ani nie linkuje się z produkcji
   (i odwrotnie) — wyszukaj w repo hardkodowane `dev.motolia.pl`.

Dodaj test, który pilnuje, że dla konfiguracji dev leci `noindex`, a dla produkcyjnej **nie leci**.
Ten drugi przypadek jest ważniejszy.

## Zadanie 2 (P1) — zrozum 3 755 stron `noindex` i 1 656 „alternatywnych"

To razem 5,4 tys. stron, czyli więcej niż mamy zaindeksowanych. Ustal **z kodu**, jakie klasy URL-i
dostają `noindex` (`render.ts` — wszystkie gałęzie `defaultMeta(ctx, { noindex: true })`) i oceń,
które z nich są zamierzone (formularze, podglądy, warianty), a które są przypadkowe.

Dla „alternatywnych z canonicalem" (1 656) hipoteza prod↔dev jest już **odrzucona** (fakt 7).
Zostają: warianty `/leasing/:slug` i `/kredyt/:slug` (celowe, canonical → `/oferta/:slug` — przy
~572 aktywnych ofertach dają do ~1 144 stron, co samo mogłoby wyjaśnić większość liczby) oraz adresy
z parametrami (w eksporcie są np. `/kredyt?sortBy=year_desc&page=69`, `/uzywane?page=50`).

**Zagadka do rozstrzygnięcia:** w eksporcie stron **zaindeksowanych** jest 135 URL-i
`/leasing/...` i `/kredyt/...`. Skoro kanonikalizują się do `/oferta/:slug`, powinny trafiać do
kategorii wykluczonych („alternatywna z canonicalem"), a nie do zaindeksowanych. Sprawdź na 2–3
konkretnych takich URL-ach (Sprawdzenie adresu URL w GSC + surowy HTML), czy canonical faktycznie
się emituje i czy Google wskazuje nasz canonical jako wybrany. Jeśli Google wybiera wariant
zamiast `/oferta`, to realny problem kanonikalizacji — opisz skalę i przyczynę.

Osobno: czy parametry sortowania i paginacji powinny być indeksowalne? Podaj rekomendację z uzasadnieniem.

## Zadanie 3 (P1) — 332 błędy 404

Zweryfikuj hipotezę, że to zarchiwizowane oferty (`csflow.service.ts` archiwizuje, `render.ts:390`
filtruje `isArchived: false` → 404). Policz skryptem, ile ofert zarchiwizowano w ostatnich 90 dniach.
Następnie oceń opcje i zarekomenduj jedną:
(a) zostawić 404, (b) zwracać **410 Gone** dla zarchiwizowanych (jaśniejszy sygnał trwałego usunięcia),
(c) utrzymywać stronę z `availability: SoldOut` i linkiem do podobnych ofert (lepsze dla użytkownika
z Google, ale ryzyko thin/stale content). Podaj wpływ, nakład, ryzyko i odwracalność każdej.

## Zadanie 4 (P2) — slug Škoda i duplikacja generatora slugów

- `Š`/`š` (a przy okazji sprawdź `Ž/ž`, `Č/č`, `Ä/Ö/Ü/ß`, `É/È`) nie są transliterowane → `koda-octavia-...`.
- Generator slugów istnieje **dwa razy**: `src/utils/url-utils.ts` i skopiowany inline
  w `backend/src/routes/seo.ts`. Rozjazd między nimi = rozjazd URL-i w sitemapie i w canonicalach.

Zaproponuj poprawkę mapy znaków ORAZ ocen, czy nie warto usunąć duplikacji (jedno źródło prawdy).
**Kluczowe pytanie, na które musisz odpowiedzieć przed jakąkolwiek zmianą:** czy poprawa
transliteracji zmieni istniejące, zaindeksowane URL-e? Jeśli tak, to jest to migracja URL-i
wymagająca przekierowań 301 — wtedy NIE wdrażaj, tylko opisz plan i oddaj do decyzji.
W eksporcie widać też `toyota-corolla-toyota-corolla-15-...` (zdublowana marka w modelu) — sprawdź,
czy to problem danych z importu, czy generatora.

## Zadanie 5 (P3) — higiena schematu ofert

Niezależnie od tego, że RRT już dziś akceptuje `Vehicle`, wytyczne Google mówią:
*„`Car` isn't supported automatically as a subtype of `Product`. For now, include both `Car` and
`Product` types"* (`developers.google.com/search/docs/appearance/structured-data/product-snippet`,
sekcja Technical guidelines). Zaproponuj więc:

- `"@type": ["Product", "Car"]` (dokumentacja mówi o `Car`, nie `Vehicle`),
- `seller` w `offers` (`Organization` z `ctx`),
- `vehicleIdentificationNumber` (VIN — realne pole `Vehicle`) oraz `sku` z id oferty
  — **wymaga rozszerzenia `ListingMetaInput` i `select` w `render.ts:391`, bo dziś nie ma tam ani
  `vin`, ani `id`**; poprzednia propozycja by się nie skompilowała,
- **NIE dodawaj** `mpn` z UUID-em z naszej bazy (to numer katalogowy producenta — byłaby to
  nieprawdziwa dana), **NIE dodawaj** `priceValidUntil` liczonego jako „dziś + 30 dni" (wymyślona
  data przy każdym renderze), **NIE dodawaj** `aggregateRating` (nie mamy prawdziwych ocen —
  fabrykowanie ich narusza wytyczne Google i grozi karą manualną).

Traktuj to jako higienę, nie jako naprawę spadku 143 → 9.

## Wynik

1. Popraw `docs/GSC_PRODUCT_SNIPPETS_DIAGNOZA.md`: usuń nieudowodnione twierdzenia i zmyśloną
   tabelę walidacji, wpisz werdykt „H2 odrzucona — dowód: Rich Results Test z 30.07.2026".
   Zachowaj historię wnioskowania, nie udawaj, że pierwszej wersji nie było.
2. Nowy plik `docs/INDEKSACJA_MOTOLIA_PLAN.md` z planem P0–P3, każdy punkt z wpływem, nakładem,
   ryzykiem, odwracalnością i kryterium weryfikacji.
3. **Kod: wdroż tylko Zadanie 1** (deindeksacja dev) — jest pilne i odwracalne. Reszta czeka na
   decyzję Kamila. Uruchom `npx tsc --noEmit` w obu projektach. Vitest odpalę lokalnie — nie próbuj.
4. Podsumowanie w czacie po polsku, zwięźle. Wypisz osobno, co wymaga decyzji Kamila.

## Uwaga o właściwościach GSC (wpisz do dokumentacji, żeby nie wracało)

Motolia ma w GSC dwie właściwości: domenową `motolia.pl` (obejmuje **wszystkie** subdomeny i oba
protokoły — czyli także `dev.`) oraz prefiksową `https://motolia.pl/` (tylko ten dokładny prefiks).
Do monitorowania produkcji należy używać **prefiksowej**; domenowa służy do wykrywania właśnie takich
rzeczy jak zaindeksowana subdomena dev. Różnica między nimi jest darmowym miernikiem postępu
deindeksacji: dziś 4,78 tys. vs 3,19 tys., docelowo obie liczby powinny się zbiegać.
