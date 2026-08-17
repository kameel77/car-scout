# Blog na Ghost dla motolia.pl — architektura URL, SEO i plan wdrożenia

Data analizy: 2026-08-10. Kontekst wejściowy: `SEO_LINKING_STRATEGY_MOTOLIA.md`,
`STRATEGIA_LINKI_I_CONTENT_2026-H2.md`, `AUDYT_SEO_2026-07-30_WERYFIKACJA_I_DZIALANIA.md`,
`nginx.conf`, `src/App.tsx`, `backend/src/routes/seo.ts`.

---

## 0. Podział ról: `seo-content` vs Ghost

Decyzja (2026-08-10, Kamil): **dwa CMS-y z rozłącznym zakresem.**

| | `seo-content` (własny CMS) | Ghost (`/blog/`) |
|---|---|---|
| Zakres | produkt i pojazdy — nic więcej | redakcja: porady, porównania, testy, wywiady |
| Typy stron | marka, model, oferta, filary, FAQ | artykuły |
| Rola SEO | **money pages** — przechwytują intencję transakcyjną | zasilają filary i strony modeli mocą oraz kontekstem |
| Autor | system / dane | człowiek z nazwiskiem i bio |

Podział jest sensowny i rozwiązuje wcześniejszą wątpliwość „po co drugi stack".
Ghost dowozi tu trzy rzeczy, których własny CMS nie ma i których nie warto pisać:
edytor dla nietechnicznej redakcji, natywny newsletter (wywiady i Barometr rat mają
naturalny kanał dystrybucji) i workflow publikacji z rolami.

**Cena tej decyzji, świadomie akceptowana:** treści Ghosta nie dziedziczą prerenderu,
JSON-LD ani `llms.txt` z `seo-meta.ts`. Trzeba je odtworzyć w motywie Ghosta (§3)
albo dopiąć feed z Ghost Content API do generatora `llms-full.txt`. Przegląd po
6 miesiącach: czy blog dowozi domeny odsyłające, czy tylko koszt utrzymania.

**Największe ryzyko tego podziału nie jest techniczne, tylko contentowe** — patrz §4.

---

## 1. Subdomena czy podkatalog — rekomendacja: **motolia.pl/blog/**

To nie jest bliska decyzja. Przy DR 3,2 podkatalog wygrywa jednoznacznie.

### Dlaczego

| Kryterium | `motolia.pl/blog/` | `blog.motolia.pl` |
|---|---|---|
| Autorytet startowy | dziedziczy domenę | de facto od zera |
| Linki zewnętrzne z bloga (Barometr rat, PR) | zasilają **całą** domenę, w tym filary | zasilają subdomenę; przepływ do motolia.pl jest niepewny i częściowy |
| Linkowanie wewnętrzne blog → `/leasing` | wewnętrzne, pełna moc | cross-site, traktowane słabiej |
| GSC / GA4 | jedna właściwość | osobna właściwość, rozbite raportowanie |
| Koszt techniczny | jedna reguła nginx | osobny cert, DNS, CORS |
| Odwracalność | trudniej odpiąć | łatwiej odpiąć |

Jedyny argument za subdomeną to izolacja techniczna i odwracalność. Przy waszym profilu
— domena, która **dopiero zaczyna zbierać autorytet niebrandowy** — celowe rozdzielanie
sygnałów jest strzałem w kolano. Cały sens bloga w waszej strategii (`STRATEGIA_LINKI...`,
pkt 2) to zdobywanie linków redakcyjnych. Te linki muszą trafić na motolia.pl.

> **Uczciwe zastrzeżenie:** Google oficjalnie twierdzi, że radzi sobie z obiema
> architekturami. To jednak stwierdzenie o *zdolności indeksowania*, nie o *konsolidacji
> autorytetu*. Duże serwisy prowadzą blogi na subdomenach bez szkody, bo mają autorytet
> w nadmiarze. Wy nie macie. Poziom pewności: wysoki, ale to heurystyka branżowa
> poparta obserwacją, nie prawo.

---

## 2. Struktura URL

### Rekomendacja

```
/blog/                                  ← indeks bloga
/blog/leasing-czy-kredyt-na-auto/       ← artykuł (płaski slug pod prefiksem)
/blog/tag/leasing/                      ← archiwum tagu (tylko wybrane, patrz §4)
/blog/ghost/                            ← panel admina (zablokowany, noindex)
```

**Prefiks: `/blog/`.** Alternatywy `/poradniki/`, `/baza-wiedzy/` brzmią lepiej
semantycznie, ale segment katalogu ma znikomy bezpośredni wpływ na ranking. `/blog/`
jest rozpoznawalny, konwencjonalny i nie wymaga tłumaczenia dziennikarzom, którym
będziecie podsyłać materiały.

**Płaski slug, bez zagnieżdżeń.** Świadomie odrzucone:

- `/blog/2026/08/slug/` — data w URL sugeruje przeterminowanie treści evergreen
- `/blog/leasing/slug/` — przekategoryzowanie artykułu łamie URL i wymusza 301
- `/slug/` w korzeniu — maksymalna moc, ale kolizja z trasami SPA (`/leasing`,
  `/nowe`, `/oferta/...`) i ryzyko przyszłych konfliktów. **Nie robić.**

**Slug: 3–5 słów, fraza docelowa, bez stop-wordów.**
`leasing-czy-kredyt-na-auto` ✅ · `jak-to-zrobic-poradnik-2026-czesc-1` ❌

**Trailing slash:** Ghost wymusza `/` na końcu. Serwis główny działa bez. To dopuszczalne
— ważna jest spójność wewnątrz każdego pionu i poprawny canonical, nie jednolitość
w całej domenie.

---

## 3. Warunki techniczne — bez tego blog zaszkodzi, nie pomoże

### 3.1 Nginx — pułapka priorytetu lokalizacji

`nginx.conf` ma kilka lokalizacji **regex** (`location ~* ^/(webhook|form|upload|...)`,
`~* \.php$`), a regex w nginx jest sprawdzany **przed** dopasowaniem prefiksowym.
Zwykłe `location /blog/` może zostać wyprzedzone.

```nginx
# ^~ wyłącza sprawdzanie regexów — konieczne przy obecnym nginx.conf
location ^~ /blog/ {
    proxy_pass http://ghost:2368;          # BEZ ścieżki — prefiks /blog/ leci do Ghosta
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # UWAGA: nie kopiować `limit_except GET HEAD` z location / —
    # panel Ghosta wymaga POST/PUT/DELETE
}

location = /blog { return 301 /blog/; }
```

Ghost musi mieć `url: https://motolia.pl/blog` — wtedy sam generuje poprawne canonical,
OG i linki wewnętrzne. Bez tego dostaniecie pętle przekierowań i canonical na localhost.

### 3.2 Sitemap

Backend serwuje `/sitemap.xml` (`seo.ts:82`). Ghost generuje własny
`/blog/sitemap.xml`. Dwie opcje:

- **(a) Tanio, 15 min:** dopisać `Sitemap: https://motolia.pl/blog/sitemap.xml`
  do `robots.txt` (`seo.ts:343`) i zgłosić osobno w GSC.
- **(b) Czysto, ~2h:** zamienić `/sitemap.xml` na sitemap index wskazujący na
  sitemapę serwisu i sitemapę Ghosta.

Rekomendacja: (a) na start, (b) gdy blog przekroczy ~50 wpisów.

### 3.3 robots.txt

Liczy się **wyłącznie** plik w korzeniu domeny — `/blog/robots.txt` Ghosta zostanie
zignorowany. Do `seo.ts` dopisać:

```
Disallow: /blog/ghost/      # panel
Disallow: /blog/p/          # podglądy nieopublikowanych wpisów
Disallow: /blog/*/amp/      # AMP Ghosta — duplikat, wyłączyć też w Ghost Labs
```

Panel `/blog/ghost/` dodatkowo za restrykcją IP lub przynajmniej 2FA.

### 3.4 Czego zablokować z domyślnego Ghosta

Ghost generuje sporo cienkich stron, które rozmywają temat domeny:

- **strony autorów** — jeśli autor jest jeden: `noindex`
- **archiwa tagów** — `index` tylko dla tagów z ≥5 wpisami (stają się hubami),
  reszta `noindex`
- **paginacja `/blog/page/N/`** — `noindex, follow`
- **AMP** — wyłączyć w Ghost Labs

### 3.5 Pozostałe

- **Motyw:** ten sam header/footer co motolia.pl. Blog wyglądający jak inny serwis
  psuje zaufanie i ścieżkę do konwersji. Casper jest wystarczająco szybki, ale
  wymaga brandingu.
- **GA4 / GTM / Consent Mode v2:** wstrzyknąć przez Ghost Code Injection. Bez tego
  blog będzie ślepą plamą w lejku (por. `audyt-ga-analytics-lejek-2026-08.md`).
- **`llms.txt` / `llms-full.txt`:** macie je już (`seo.ts`). Treści bloga powinny
  do nich trafiać — to realna przewaga w GEO, którą już opłaciliście.
- **Schema:** `BlogPosting` + `author` + `publisher`. Autor musi być realną osobą
  z bio i kompetencjami — treści finansowe to YMYL, anonimowy blog o kredytach
  ma pod górkę.

---

## 4. Granica treści: co wolno blogowi, a czego nie

### Zasada nadrzędna

Filary i strony marek/modeli zostają **money pages** na frazach transakcyjnych.
Blog przejmuje intencję **informacyjną i porównawczą**. Twarda reguła:
**jedno zapytanie docelowe → jeden URL.** Mapa fraz powstaje *przed* pisaniem.

### Przepływ mocy

```
blog (spoke) ──anchor z encją──▶ filar / marka / model (hub) ──▶ oferta
```

Zgodnie z `SEO_LINKING_STRATEGY_MOTOLIA.md`:

- każdy artykuł: **2–4 linki** do filarów i/lub stron marek i modeli, anchor zawsze
  z encją („leasing operacyjny dla firm", nie „tutaj", nie gołe „leasing")
- **nie linkować** `/leasing/:slug` ani `/kredyt/:slug` (kanonikalizują do `/oferta`)
- **nie linkować stron modeli z <2 ofertami** — są `noindex`
- z filarów do bloga **maksymalnie 1–2 linki** — filar oddaje moc w dół hierarchii
- anchor nie może się powtarzać w serwisie — wariantować

### Macierz kolizji — to jest realne ryzyko tego podziału

Trzy z pięciu planowanych typów treści nachodzą na `seo-content`. Granica przebiega
po **intencji zapytania**, nie po encji.

| Typ treści | Kolizja | Granica |
|---|---|---|
| Porady | brak | intencja informacyjna, filary jej nie obsługują |
| Porównania produktów | niska | filar = „leasing samochodu"; blog = „leasing czy kredyt" |
| **Testy modeli** | **wysoka** | `/samochody/skoda/octavia` bierze „octavia leasing", „octavia raty". Blog bierze „octavia 2026 opinie", „octavia spalanie" |
| **Porównania marek** | **wysoka** | `/samochody/skoda` bierze „skoda leasing". Blog bierze „skoda czy volkswagen" |
| Wywiady | brak | zerowy wolumen wyszukiwania — to nie jest kanał SEO |

**Tagi Ghosta = druga oś kolizji.** Domyślnie Ghost tworzy `/blog/tag/skoda/`, które
konkuruje z `/samochody/skoda`. Rekomendacja: **wszystkie archiwa tagów `noindex`**,
tagi wyłącznie do nawigacji wewnątrz bloga. Jedna encja = jeden indeksowany URL.

### Uczciwa ocena ROI planowanych typów treści

Twoja lista jest z grubsza odwrotnie uszeregowana względem zwrotu. W kolejności
wartości przy DR 3,2:

1. **Porównania produktów** (leasing vs kredyt vs najem, konsumencki vs operacyjny,
   wykup, limit 150 tys., VAT 50/100). Najwyższy zwrot. Intencja komercyjna,
   konkurencja to głównie serwisy finansowe — nie moto-portale. Tu możecie wygrać.
2. **Porady.** Dobry zwrot, tanie w produkcji, budują topical authority filarów
   i są najlepiej cytowalne przez LLM.
3. **Wywiady.** Zerowy zwrot SEO z wyszukiwarki, ale realny jako **link bait** —
   rozmówca linkuje i udostępnia. Budżetować jako PR, nie jako SEO.
4. **Testy modeli i porównania marek.** Najgorszy stosunek nakładu do zwrotu.
   Powód: „test Škody Octavia" i „Škoda czy Volkswagen" to najbardziej wysycone
   frazy w polskim internecie — Auto Świat, Autokult, Moto.pl, WP Moto mają
   DR 70–85 i dekady treści. Domena z DR 3,2 nie wejdzie tam na pierwszą stronę
   w horyzoncie tego roku, niezależnie od jakości tekstu. Do tego test wymaga
   dostępu do auta, zdjęć i jazdy — to najdroższy format na liście.

### Reframe testów i porównań marek — jak je uratować

Nie rezygnować z formatu, tylko przesunąć frazę docelową tam, gdzie macie przewagę,
której moto-portale nie mają: **realne raty z bazy 2 147 ofert**.

| Zamiast | Napisać |
|---|---|
| Test Škody Octavia 2026 | Škoda Octavia w leasingu — ile realnie kosztuje rata w 2026 |
| Škoda vs Volkswagen — porównanie | Škoda czy Volkswagen — porównanie kosztów finansowania |
| Test Toyoty Corolla Hybrid | Hybryda w najmie długoterminowym — Corolla na liczbach |

Te frazy mają mniejszy wolumen, ale **zerową konkurencję redakcyjną** i intencję
bliższą konwersji. Dodatkowo naturalnie linkują w dół do `/samochody/marka/model`
i do filaru — czyli robią dokładnie to, po co blog powstaje.

### Lifestyle — jedyna pozycja, którą odradzam

Treść lifestyle'owa na domenie finansowej rozmywa jej temat. Wasz własny dokument
(`STRATEGIA_LINKI...`, „Czego świadomie nie robimy") ostrzega przed rozmywaniem
tematu serwisu i ma rację. Przy DR 3,2 każdy artykuł, który nie wzmacnia skojarzenia
„motolia = finansowanie aut", jest kosztem netto.

Jeśli lifestyle ma zostać: limit do ~10% wolumenu publikacji i wyłącznie tematy
stykające się z posiadaniem auta (koszty eksploatacji, ubezpieczenie, sprzedaż
auta poleasingowego) — nie ogólna motoryzacja.

### Pierwsze 8 tekstów

| Artykuł | Typ | Linkuje do |
|---|---|---|
| Leasing czy kredyt na auto — co się bardziej opłaca | porównanie | `/leasing` + `/kredyt` |
| Najem długoterminowy a leasing — co obejmuje rata | porównanie | `/wynajem-dlugoterminowy` |
| Wykup auta z leasingu — podatki i terminy | porada | `/leasing` |
| Limit 150 tys. zł i VAT 50/100 — auto w firmie | porada | `/leasing` + `/dla-firm` |
| Leasing konsumencki — dla kogo ma sens | porada | `/leasing` |
| Czy leasing obniża zdolność kredytową | porada | `/kredyt` |
| Kredyt samochodowy a historia w BIK | porada | `/kredyt` |
| Škoda Octavia w leasingu — ile realnie kosztuje rata | test/dane | `/samochody/skoda/octavia` + `/leasing` |

Ósmy tekst jest pilotem reframe'u z sekcji wyżej — po 3 miesiącach sprawdzić
w GSC, czy format się broni, zanim zainwestujecie w serię testów.

### Aktywo linkowe — właściwy powód, dla którego blog powstaje

„Barometr rat Motolia" (kwartalne dane z bazy) ma tu swój dom. DR 3,2 jest wąskim
gardłem, nie brak treści — a to jedyny materiał na liście, który realnie generuje
domeny odsyłające.

---

## 5. Plan wdrożenia

| Faza | Zakres | Nakład |
|---|---|---|
| 0 | Decyzja Ghost vs rozszerzenie własnego CMS | rozmowa |
| 1 | Kontener Ghost w Coolify, `location ^~ /blog/`, `url`, motyw z brandingiem, GTM, robots + sitemap, GSC | 1–2 dni dev |
| 2 | 8 tekstów fundamentowych + linkowanie wg `SEO_LINKING_STRATEGY` | 4–6 tyg. redakcji |
| 3 | Barometr rat — wydanie 1 + wysyłka do redakcji | 0,5 dnia/kwartał |

**Wdrożenie nginx najpierw na staging** (`docker-compose.coolify.staging.yml`).
Błąd w kolejności lokalizacji może przechwycić trasy SPA — to najpoważniejsze
ryzyko techniczne tego projektu.

## 6. Ryzyka

- **Kolizja nginx** → przechwycenie tras SPA. Mitygacja: `^~`, test na staging,
  smoke test kluczowych URL po deployu.
- **Kanibalizacja filarów** przez artykuły. Mitygacja: mapa fraza→URL prowadzona
  przed pisaniem, nie po.
- **Drugi stack w utrzymaniu** — aktualizacje Ghosta, backupy bazy, motyw
  rozjeżdżający się z designem serwisu. Świadomie akceptowany dług; przegląd po
  6 miesiącach: czy blog dowozi linki, czy tylko generuje pracę.
- **Rozmycie tematu domeny** cienkimi wpisami. Mitygacja: mniej i lepiej.

## 7. Jak mierzyć (kwartalnie, GSC + Ahrefs)

- kliknięcia z zapytań **niebrandowych** — główny KPI
- liczba domen odsyłających i DR (punkt odniesienia 30.07.2026: DR 3,2)
- średnia pozycja koszyka: „wynajem długoterminowy samochodów", „kredyt samochodowy",
  „leasing samochodu"
- ruch blog → filary (GA4, ścieżki) i leady z tej ścieżki

**Blog nie ma być mierzony liczbą odsłon.** Ma być mierzony liczbą zdobytych domen
odsyłających i wpływem na pozycje filarów.
