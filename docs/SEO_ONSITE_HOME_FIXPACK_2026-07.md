# Fixpack SEO on-site — strona główna motolia.pl (2026-07-30)

Wejście: audyt on-site strony głównej z 2026-07-29. Ten dokument to **brief wdrożeniowy dla agenta** —
zawiera zweryfikowaną w kodzie diagnozę (root cause), zakres zmian i kryteria akceptacji.
Nie wdrażaj niczego poza tym zakresem.

Weryfikacja audytu w repo (2026-07-30):

| Ustalenie audytu | Status po weryfikacji w kodzie |
|---|---|
| Brak H1 na `/` | **Potwierdzone**, root cause znaleziony (P0) |
| Meta description 81 zn. | Potwierdzone, źródło: `BRAND_DEFAULTS.motolia` + DB SEO config (P1) |
| Title 46 zn. | Potwierdzone, to samo źródło (P1) |
| Tylko `Organization` w JSON-LD na `/` | Potwierdzone; **ale** brakuje przede wszystkim `FAQPage` (P2) |
| `HowTo` dla „procesu zakupu" | **Nieaktualne** — takiej sekcji nie ma na stronie. Zamiast tego: martwy anchor (P3) |
| Sitemap `https://motolia.pl` bez ukośnika | Potwierdzone (P3) |
| Brak `BreadcrumbList` | Częściowo — breadcrumbs są na ofertach/markach/najmie; na `/` są bezcelowe (pomijamy) |

---

## P0 — Przywrócić H1 na stronie głównej (Critical)

### Root cause (zweryfikowany)

Strona główna ma dwa warianty hero, przełączane przez `hasHeroBanners`:

- `src/pages/MotoliaHomePage.tsx:219` — `hasHeroBanners ? (banner carousel) : (layout z H1)`.
  **H1 istnieje tylko w gałęzi `else`** (`MotoliaHomePage.tsx:267`).
- SSR shell: `vite.config.ts:52` (blok `<!--home-shell-->`) zawiera `<h1>`, **ale** gdy w CMS jest
  aktywny baner, `backend/src/routes/render.ts:942-944` podmienia ten shell na
  `homeHeroShellHtml()` (`backend/src/services/seo-meta.ts:1399-1429`), który **H1 nie zawiera**.
- Prerender dla botów (`buildStaticMeta`, `seo-meta.ts:1190-1203`) świadomie **nie** wstawia `<h1>`,
  z komentarzem „h1 jest na stronie już w statycznym home-shell" — to założenie przestało być prawdziwe
  po wprowadzeniu banerów CMS.

Efekt: na produkcji (baner aktywny) `/` nie ma H1 ani w surowym HTML, ani po hydracji.

### Zakres zmiany

1. **`src/pages/MotoliaHomePage.tsx`** — w gałęzi `hasHeroBanners` dodać jeden `<h1>`.
   Wymogi:
   - dokładnie jeden H1 w obu gałęziach (nigdy zero, nigdy dwa),
   - treść z konfiguracji marki, nie hardkod — nowe pole `config.homePage.hero.seoH1`
     w `src/brands/motolia/config.ts`, fallback do `hero.title` (strip HTML) gdy pole puste,
   - proponowany tekst: **„Leasing, kredyt i wynajem samochodów — nowe i używane auta w Motolia"**,
   - baner jest elementem LCP — H1 **nie może** wypchnąć banera poniżej pierwszego ekranu na mobile.
     Umieścić H1 **pod** banerem/kartą wyszukiwarki jako nagłówek sekcji tekstowej hero
     (widoczny, normalna typografia, np. `text-2xl lg:text-3xl`, `mt-8`). Zakaz `sr-only`,
     `display:none`, `text-indent:-9999px` i klas ukrywających — H1 musi być widoczny dla użytkownika.
2. **`backend/src/services/seo-meta.ts` → `homeHeroShellHtml()`** — dodać ten sam `<h1>`
   z identycznym tekstem i klasami co w React, w tym samym miejscu w drzewie.
   Uzasadnienie: shell i pierwsza klatka Reacta muszą być identyczne, inaczej rośnie CLS
   (patrz komentarze przy `home-shell` i `HeroBannerCarousel`).
   Tekst H1 przekazać do `homeHeroShellHtml` argumentem (`ctx`/parametr), nie duplikować literału.
3. **`vite.config.ts:52`** — H1 w statycznym shellu zostaje bez zmian (to gałąź bez banerów),
   ale zweryfikować, czy tekst nie rozjeżdża się z gałęzią React.
4. **`buildStaticMeta` (`seo-meta.ts:1190-1203`)** — zaktualizować komentarz i pozostawić `bodyHtml`
   **bez** `<h1>` (H1 jest w `#root`, dublowanie dałoby dwa H1 w HTML dla botów).
   Kryterium: dokładnie jedno `<h1>` w całym zwróconym dokumencie.

### Kryteria akceptacji P0

- `curl -s https://<env>/ | grep -c '<h1'` → `1`, dla obu stanów: baner aktywny i baner nieaktywny.
- Po hydracji (Chrome, `document.querySelectorAll('h1').length`) → `1`.
- H1 widoczny (`getBoundingClientRect().height > 0`, brak `sr-only`).
- Lighthouse mobile LCP nie pogarsza się o więcej niż 5% vs. baseline (`lighthouse-new-mobile.json`),
  CLS ≤ dotychczasowy.

---

## P1 — Title i meta description strony głównej (High)

### Ustalenie: dwa źródła prawdy

- SSR: `BRAND_DEFAULTS.motolia` w `backend/src/services/seo-meta.ts:47-49`
  (`title`, `description`) → wstrzykiwane przez `injectHead`.
- Po hydracji: `SeoManager` (`src/components/seo/SeoManager.tsx`) nadpisuje `<title>`
  i `<meta name="description">` wartościami `homeTitle` / `homeDescription` z DB (`/api/seo`).

To znaczy, że zmiana tylko w kodzie **nie zmieni** tego, co widzi część crawlerów renderujących JS,
a zmiana tylko w adminie nie zmieni surowego HTML. **Trzeba zmienić oba** i wyrównać treść.

### Zakres zmiany

1. `BRAND_DEFAULTS.motolia.title` → **„Motolia — leasing, kredyt i wynajem samochodów bez formalności"** (~62 zn.)
2. `BRAND_DEFAULTS.motolia.description` → **„Nowe i używane auta z finansowaniem dopasowanym do Twojej sytuacji — leasing, kredyt, wynajem długoterminowy. Sprawdź oferty i policz ratę online w 2 minuty."** (~178 zn. — skrócić do 150–160 zn. przy wdrożeniu, licząc dokładnie)
3. Zaktualizować te same wartości w adminie (`/api/seo`: `homeTitle`, `homeDescription`) — **rekomendacja: osobny krok manualny przez Kamila po deployu, agent tylko przygotowuje finalne teksty i to zgłasza.**
4. Dodać test jednostkowy (`backend/src/routes/__tests__/render.test.ts`) pilnujący długości:
   title ≤ 65 zn., description w zakresie 140–165 zn. Zabezpiecza przed regresją.

### Kryteria akceptacji P1

- `<title>` w surowym HTML `/`: 50–65 znaków.
- `<meta name="description">` w surowym HTML `/`: 140–165 znaków, zawiera CTA.
- Po hydracji title/description **identyczne** z SSR (brak migotania/rozjazdu) — sprawdzić w Chrome.
- Testy `render.test.ts` przechodzą.

---

## P2 — Dane strukturalne na `/` (Medium)

Na `/` jest dziś tylko `Organization` (`seo-meta.ts:1205-1231`). Kolejność wg zwrotu:

1. **`FAQPage`** — najwyższy priorytet, **pominięty w audycie**. Strona główna renderuje widoczne FAQ
   z CMS (`MotoliaHomePage.tsx:629`, `/api/faq?page=home`), a `/` jest self-canonical, więc schema jest
   w pełni zasadna (dokładnie ta sama logika co strony najmu, `seo-meta.ts:728-737`).
   Wymóg: do JSON-LD trafiają **tylko** pytania faktycznie wyrenderowane na stronie; tekst przez `stripTags`.
   `buildStaticMeta` musi w tym celu dostać FAQ dla `page=home` (dziś `render.ts` pobiera FAQ tylko dla
   `/leasing`, `/kredyt`, `/wynajem-dlugoterminowy` — patrz `FINANCING_FAQ_TYPE`).
2. **`WebSite` + `SearchAction`** — `potentialAction` wskazujący na realny endpoint wyszukiwania
   (`/samochody?search={search_term_string}` — **zweryfikować parametr w `SearchPage.tsx`**, nie zgadywać).
   Uwaga: sitelinks searchbox Google w praktyce prawie nie występuje — traktować jako porządkowanie
   grafu encji, nie jako źródło ruchu.
3. **`AutoDealer` / `LocalBusiness`** — **wstrzymać się.** Motolia jest brokerem/pośrednikiem
   finansowania, nie salonem z placem. `AutoDealer` sugeruje fizyczny punkt sprzedaży aut i bez
   `openingHours` + zweryfikowanego adresu obsługi klienta jest ryzykiem (niespójny sygnał, potencjalnie
   mylące dane). Decyzja biznesowa Kamila, nie agenta.
4. `BreadcrumbList` na `/` — **pomijamy**, strona główna jest korzeniem, breadcrumb byłby jednoelementowy.
5. `HowTo` — **odpada**, brak sekcji procesu (patrz P3). Dodatkowo Google w praktyce wycofał
   rich results dla `HowTo` — zysk bliski zeru.

Implementacja: rozszerzyć `jsonLd` dla `path === '/'` do tablicy (`injectHead` już obsługuje
`meta.jsonLd` jako dowolny obiekt/tablicę — potwierdzić na testach).

### Kryteria akceptacji P2

- Rich Results Test / walidator schema.org: 0 błędów, 0 ostrzeżeń krytycznych.
- `FAQPage` zawiera dokładnie te pytania, które widać na `/` (liczba zgodna).
- Brak `AutoDealer`/`LocalBusiness` w tym wdrożeniu.

---

## P3 — Porządki (Low)

1. **Sitemap: strona główna bez ukośnika.** `backend/src/routes/seo.ts:92` — tablica `staticPages`
   zaczyna się od `''`, co daje `<loc>https://motolia.pl</loc>`, a canonical to `https://motolia.pl/`.
   Fix: `''` → `'/'` (sprawdzić, że nie powstanie `//` przy `baseUrl` z ukośnikiem — `baseUrl` jest
   już trimowany w linii 83).
2. **Martwy anchor `#jak-to-dziala`.** `MotoliaHomePage.tsx:300` linkuje do `#jak-to-dziala`,
   ale na stronie istnieją tylko `id="produkty"`, `id="faq"`, `id="kontakt"`. Kliknięcie nie robi nic.
   Fix minimalny: przekierować anchor na `#produkty`. (Alternatywa — dodać sekcję „Jak to działa"
   i wtedy `HowTo` staje się zasadny — to osobny zakres contentowy, nie ten fixpack.)
3. **H2 z frazami kluczowymi.** Dziś H2 są brandowo-kreatywne („Jeden serwis, cztery produkty",
   „Praktycznie każda marka", „Dlaczego Motolia?"). Propozycja — zmienić **dwa**, nie wszystkie
   (reszta buduje markę):
   - `MotoliaHomePage.tsx:375` → „Leasing, kredyt, wynajem i pożyczka — <span>jeden serwis</span>"
   - `MotoliaHomePage.tsx:445` → „Samochody nowe i używane — <span>praktycznie każda marka</span>"

   Teksty H2 trzymać w `src/brands/motolia/config.ts`, jeśli tam już są analogiczne pola; jeśli nie —
   nie robić refaktoru, edytować w miejscu.

---

## Świadomie NIE w zakresie

- `Product`/`Vehicle` na ofertach — **już istnieje** (`seo-meta.ts:343`, `663`), audyt tego nie sprawdził.
- Core Web Vitals na danych polowych — wymaga dostępu do GSC, zadanie dla Kamila, nie agenta.
- Ujednolicenie źródła prawdy dla meta (kod vs. DB) — realny dług techniczny, ale zmiana
  architektoniczna; osobny ticket. Ryzyko dziś: rozjazd SSR ↔ hydracja przy każdej edycji w adminie.

## Kolejność wdrożenia

```
1. P0 (H1)              → weryfikacja: curl + DOM, 1 × <h1>; Lighthouse mobile bez regresji
2. P1 (title/desc)      → weryfikacja: długości w surowym HTML + test w render.test.ts
3. P3.1 (sitemap)       → weryfikacja: <loc> zgodny z canonical
4. P3.2 (anchor)        → weryfikacja: klik przewija stronę
5. P2 (FAQPage+WebSite) → weryfikacja: Rich Results Test, 0 błędów
6. P3.3 (H2)            → weryfikacja: hierarchia H1→H2 poprawna, brak pominięć poziomów
```

Po P0+P1 (największy zysk, <1 dzień) można deployować i nie czekać na resztę.
