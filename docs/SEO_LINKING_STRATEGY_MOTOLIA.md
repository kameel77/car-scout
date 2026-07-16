# Strategia linkowania wewnętrznego — motolia.pl (sSEO)

Obowiązuje przy tworzeniu KAŻDEJ treści w serwisie (artykuły CMS marek/modeli, filary
finansowania, przyszły blog). Zatwierdzona 2026-07-12. Powiązany spec:
[2026-07-11-brand-model-pages-design.md](superpowers/specs/2026-07-11-brand-model-pages-design.md).

## Dwa piony architektury

**Pion 1 — hierarchia encji (katalog):**

```
oferta (/oferta/slug) ← model (/samochody/marka/model) ← marka (/samochody/marka) ← hub (/samochody)
```

**Pion 2 — oś finansowania (kontekst):** `/leasing`, `/kredyt`, `/wynajem-dlugoterminowy`.

Zasada: **linki w dół hierarchii przenoszą moc, linki w poprzek przenoszą kontekst.**
Oferty (liście) dostają autorytet z góry — najmocniejszym dawcą jest strona modelu
(pełna zgodność tematyczna).

## Reguły per typ strony

### Strona modelu (np. /samochody/skoda/octavia)
- **W dół:** listing ofert = główny transfer mocy. Link do oferty otoczony zdaniem
  z kontekstem finansowania („dostępna od ręki w leasingu i kredycie") — Google czyta
  otoczenie linku, nie tylko anchor.
- **W górę:** 1 link do strony marki + breadcrumb.
- **Do filarów:** po 1 linku do `/leasing` (ew. `/kredyt`, `/wynajem-dlugoterminowy`)
  z anchorem zawierającym encję: „leasing Škody Octavii", nie goły „leasing".
- **Rodzeństwo:** 2–3 modele tej samej marki.

### Strona marki (np. /samochody/skoda)
- W dół: modele + top oferty.
- W poprzek: max 1 inna marka w treści (blok „Popularne marki" robi resztę).
- Do filarów: 1 link per produkt finansowy, anchor markowy („leasing Škody dla firm").

### Filary (/leasing, /kredyt, /wynajem-dlugoterminowy)
- Kierunek zwrotny: moduł/zdania linkujące **top 3–5 marek** z anchorami „leasing [marki]".
  Tylko marki z treścią CMS — nie wszystkie.

### Blog/poradniki (przyszłe)
- Linkują w dół do filarów i stron modeli (money pages), nie tylko do strony głównej.

## Zakazy

1. **NIE linkować wariantów `/leasing/:slug`, `/kredyt/:slug`** — kanonikalizują do
   `/oferta`; kontekst finansowania budować tekstem wokół linku do `/oferta/:slug`.
2. **NIE linkować stron noindex** (modele <2 ofert bez treści CMS).
3. **NIE powtarzać identycznego anchora** w serwisie — wariantować naturalnie
   („Škoda w leasingu" / „leasing aut Škody" / „finansowanie Škody").
4. **FAQ bez linków** (max 1) — odpowiedzi idą do FAQPage JSON-LD i muszą być
   samowystarczalne (LLM cytują bez kontekstu strony).
5. Nagłówki sekcji w markdown CMS **nie mogą kończyć się `?`** (parser wciąga je do
   FAQPage) — pytajnik tylko w celowych pytaniach FAQ.

## Konwencje treści CMS (przypomnienie)

- Artykuł zaczyna się od unikalnego H2 (bez H1 — H1 generuje strona), 500–800 słów,
  akapit definicyjny z encją w pierwszym zdaniu (cytowalność LLM).
- Fakty liczbowe tylko z danych (podaż/ceny z bazy; liczby ofert wyświetlają się
  dynamicznie obok — w treści formułować trwale: „ceny zaczynają się od ok. X").
- FAQ redakcyjne unikalne per strona — zero pytań ogólnych powtarzanych między stronami.
