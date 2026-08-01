# Audyt SEO z 30.07.2026 — weryfikacja i lista działań

Wejście: `audyt_seo_motolia.md` (zakres: `/`, `/nowe`, `/uzywane`, `/wynajem-dlugoterminowy?offerType=b2b`,
`/dla-firm`, `/faq`). Każde ustalenie audytu sprawdziłem w kodzie i na żywych stronach.

## Ustalenie nadrzędne: audyt analizował prerender dla botów, nie wyrenderowaną stronę

Serwis wstawia do `#root` blok `<div class="seo-prerender" style="display:none">` z uproszczoną
treścią dla crawlerów bez JS (`injectHead`, `backend/src/services/seo-meta.ts`). Narzędzie audytu
najwyraźniej czytało **wyłącznie ten blok** i pomijało `<script type="application/ld+json">`.

Dowody:

- „`/` ma tylko jeden H2 (Najnowsze oferty)" — `Najnowsze oferty` to dosłownie jedyny H2
  w bloku prerenderu strony głównej (`seo-meta.ts`, gałąź `path === '/'`). Realny komponent
  (`MotoliaHomePage.tsx`) ma 5 nagłówków H2 i 3 H3.
- „`/dla-firm` ma ~85 słów unikalnej treści" — `MotoliaB2BPage.tsx` ma 773 linie i 15 nagłówków
  H2/H3. 85 słów to objętość prerenderu.
- To samo dotyczy „~180 słów na `/nowe`" i „~200 słów na `/uzywane`".

**Skutek:** sekcje 3 i 5 audytu są w dużej części niemiarodajne. Googlebot renderuje JavaScript,
więc widzi pełną stronę, a nie ten skrót.

## Tabela weryfikacji

| Ustalenie audytu | Werdykt | Dowód |
|---|---|---|
| Brak JSON-LD na wszystkich 6 stronach | **Błędne** | `/` emituje `Organization` + `WebSite` + `FAQPage`; `/faq` i `/wynajem-dlugoterminowy` emitują `FAQPage` (`seo-meta.ts:1343-1356`, `buildStaticMeta`); oferty mają `Vehicle` + `BreadcrumbList`. Fetcher audytu nie czytał tagów `<script>` |
| Brak `FAQPage` na `/faq` — „krytyczne" | **Błędne** | `render.ts:785-789` pobiera wszystkie opublikowane FAQ dla `/faq`, `buildStaticMeta` emituje z nich `FAQPage` |
| `/` ma jeden H2 | **Błędne** | Patrz wyżej — 5× H2 w komponencie |
| `/dla-firm` ma ~85 słów | **Błędne** | 773 linie komponentu, 15 nagłówków |
| `/dla-firm`: title 79 zn., meta 177 zn. | **Częściowo** | Realnie 66 i 174 znaki. Kierunek dobry (oba za długie), liczby nie |
| `/faq`: CTR 0,22% przy 10 551 wyświetleniach | **Prawdziwe** | Dane GSC. Ale przyczyna wskazana błędnie (patrz niżej) |
| `?offerType=b2b` niezaindeksowany, canonical → wersja bazowa | **Prawdziwe** | Zachowanie zamierzone |
| DR 3,2 — główna bariera poza brandem | **Prawdziwe i najważniejsze** | Dane Ahrefs |
| Ruch niemal wyłącznie brandowy | **Prawdziwe i najważniejsze** | Dane GSC |
| Sitemap „wrócił jako dane binarne" | **Do sprawdzenia** | Ja też to widzę przy pobraniu — najprawdopodobniej gzip, nie błąd. Rozstrzyga raport Sitemaps w GSC |
| Site Audit: 148 błędów / 1783 ostrzeżenia | **Nieznane** | Lista niedostępna (limit API). Bez niej ta liczba nic nie znaczy |

## Korekta merytoryczna: FAQPage nie podniesie CTR

Audyt stawia `FAQPage` jako „szybką wygraną nr 1" dla `/faq`. Dwa problemy: schema **już jest**,
a od sierpnia 2023 Google ograniczył rich results dla FAQ do serwisów rządowych i zdrowotnych
o uznanym autorytecie. Dla serwisu komercyjnego ten wynik rozszerzony po prostu się nie pokazuje.

Realna przyczyna CTR 0,22% na `/faq` jest inna: **tytuł `Najczęstsze pytania | Motolia` (29 znaków)
nie odpowiada zapytaniu**. Strona wyświetla się 10,5 tys. razy na pytania w rodzaju „czy można
spłacić kredyt samochodowy wcześniej", a w wynikach pokazuje generyczny nagłówek bez żadnej z tych fraz.

## Znalezisko własne: `/faq` w prerenderze wygląda jak strona z listą aut

Prerender `/faq` zawiera sekcję `## Oferty` z 20 losowymi samochodami **przed** sekcją FAQ
(`buildStaticMeta` dokleja `listings` do każdej trasy statycznej). Dla crawlera strona z pytaniami
o kredyt zaczyna się od listy Fordów i Citroënów. To rozmywa jej temat i jest prawdopodobnie
współodpowiedzialne za słabe pozycje. Tego audyt nie zauważył.

---

## Działania — priorytety

### P1. Tytuły i opisy pod realne zapytania (ten tydzień, <2h)

- `/faq`: `Najczęstsze pytania | Motolia` → tytuł z frazami, na które strona realnie zbiera
  wyświetlenia, np. `Kredyt, leasing i wynajem auta - najczęstsze pytania | Motolia`.
  Meta description z konkretem zamiast ogólnika.
- `/dla-firm`: title 66 → ~55 zn., description 174 → ~155 zn.
- Weryfikacja: długości w surowym HTML + wzrost CTR w GSC po 2-3 tygodniach.

### P2. Usunąć listę ofert z prerenderu `/faq` (ten tydzień, <1h)

Sekcja `## Oferty` ma sens na `/nowe`, `/uzywane`, `/samochody` — nie na stronie z pytaniami.
Warunkować doklejanie `listings` ścieżką.

### P3. Decyzja o `?offerType=b2b` (decyzja, potem 0 lub kilka dni)

Trzy opcje: (a) zostawić jako filtr bez ambicji SEO i skierować B2B na `/dla-firm`,
(b) zbudować osobny URL `/wynajem-dlugoterminowy/dla-firm`, (c) rozbudować `/dla-firm` o najem.
**Rekomendacja: (a) lub (c)** — mamy już rozbudowaną stronę `/dla-firm`, budowanie drugiej
konkurencyjnej strony B2B to kanibalizacja. Decyzja Twoja.

### P4. Linki zwrotne — jedyna realna dźwignia poza brandem (kwartał, ciągłe)

DR 3,2 tłumaczy, dlaczego dobra treść na `/wynajem-dlugoterminowy` (2100 słów) stoi na pozycji 40.
Żadna poprawka on-page tego nie obejdzie. Kierunki z audytu (moneteo.com, rankingpro.pl,
porownywarkaleasingowa.pl) są sensowne. To praca marketingowa, nie deweloperska.

### P5. Kalkulator jako samodzielne narzędzie (kwartał, multi-day)

`FinancingCalculator` istnieje, ale tylko na kartach ofert (`ListingDetailPage`). Konkurencja
buduje ruch na kalkulatorach dostępnych z poziomu osobnego URL-a. Wyciągnięcie istniejącego
komponentu na `/kalkulator-rat` to relatywnie tani sposób na frazy narzędziowe.

### Odrzucone / bez działania

- Dodawanie `FAQPage` — już jest; rich result i tak nie przysługuje serwisom komercyjnym.
- Dodawanie `Organization`/`WebSite` na `/` — wdrożone 30.07.2026 (commit `bf193d8`).
- Rozbudowa treści `/dla-firm`, `/nowe`, `/uzywane` „bo cienka" — treść jest, audyt jej nie widział.
  Jeśli chcemy je wzmacniać, to na podstawie realnych braków, nie tego pomiaru.

## Czego audyt nie objął, a wiemy z własnej analizy (30.07.2026)

- **~1,4 tys. stron `dev.motolia.pl` w indeksie** — audyt patrzył na 6 URL-i, więc tego nie widział.
- **42% wariantów `/leasing/:slug` i `/kredyt/:slug` Google indeksuje osobno**, ignorując canonical
  (inspekcja 65 URL-i przez URL Inspection API).
- **41 zaindeksowanych adresów z `undefined` w slugu**.
- Aktywnych ofert jest **2 147**, a nie ~570 (API `/api/listings`).

Te trzy pierwsze punkty mają większą wagę niż cokolwiek z sekcji on-page audytu.

---

## Status wykonania (30.07.2026)

| Punkt | Status |
|---|---|
| P1 — tytuły i opisy `/faq`, `/dla-firm` | **Wdrożone** w `seo-meta.ts` (STATIC_ROUTES) |
| P2 — lista ofert poza prerenderem `/faq`, `/kontakt`, `/dla-firm`, `/dla-ciebie` | **Wdrożone** (`LISTINGLESS_STATIC_ROUTES` w `render.ts`) |
| P3 — `?offerType=b2b` | **Decyzja: opcja (a)** — parametr zostaje filtrem bez ambicji SEO, ruch B2B kierujemy na `/dla-firm`. Canonical już to realizuje, zmian w kodzie brak |
| P4 — linki i content | `docs/STRATEGIA_LINKI_I_CONTENT_2026-H2.md` |
| P5 — kalkulator | `docs/BRIEF_AG_KALKULATOR_STANDALONE.md` (brief dla agenta) |

Nowe teksty:

- `/faq` title: `Kredyt, leasing i wynajem auta - najczęstsze pytania | Motolia` (62 zn.),
  H1: `Najczęstsze pytania o finansowanie samochodu`, description 149 zn.
- `/dla-firm` title: `Leasing i najem samochodów dla firm od 1 auta | Motolia` (55 zn.),
  description 141 zn.
