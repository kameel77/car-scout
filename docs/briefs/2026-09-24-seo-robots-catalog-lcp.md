# Brief: robots.txt (duplikaty ofert najmu) + LCP katalogów motolia

Data: 2026-09-24 · Brand: motolia · Gałąź robocza: `dev` · Autor briefu: Claude (weryfikuje wynik)

Przed czytaniem kodu użyj `graphify query/explain/path` (graf w `graphify-out/`), grep/Read dopiero do konkretnych linii. Po zmianach `graphify update .`.

**Zakres = zadania 1–3.** Nie ruszaj niczego poza nimi (patrz „Poza zakresem”). Nie wdrażaj na `main` — kończysz na `dev` (+ ewentualnie `staging` jeśli Kamil zleci), raport wg sekcji „Co oddajesz”.

---

## Zadanie 1 (KRYTYCZNE, SEO): robots.txt blokuje API szczegółu najmu

### Stan / dowód
- GSC URL Inspection (2026-09-24): 9/12 sprawdzonych ofert `/wynajem-dlugoterminowy/<slug>` ma „Duplicate, Google chose different canonical than user”, a `googleCanonical` = zawsze `.../mercedes-benz-cla-200-amg-advanced-plus-2026-coupe-benzyna-cmotqhi4t0001nmvg2b1drneg`. Surowe JSON: scratchpad sesji Claude (`gsc/01..12.json`).
- Przyczyna: `backend/src/routes/seo.ts` (generator robots.txt, ok. l. 270–340) ma `Disallow: /api/` + listę `Allow`. Wpis `Allow: /api/rental-public` to **nazwa pliku**, nie ścieżka — moduł `backend/src/routes/rental-public.ts` wystawia `/api/rental/vehicles`, `/api/rental/vehicles/:slug`, `/api/rental/vehicles/:slug/calculate`. Wpis wszedł w `d7920df` (2026-07-02).
- Skutek: Googlebot (WRS renderuje JS) nie może pobrać `/api/rental/vehicles/<slug>` → `src/pages/RentalDetailPage.tsx` (`useQuery` l. ~59, gałąź `if (!vehicle)` l. ~217) renderuje „Pojazd nie został znaleziony”; frontend używa `createRoot` (`src/main.tsx`), więc nadpisuje poprawny HTML z SSR. Każda oferta najmu = identyczny soft-404 → klaster duplikatów.

### Do zrobienia
1. W każdej sekcji robots.txt, która ma listę `Allow: /api/...` (Googlebot, Bingbot, SemrushBot, `*`): zastąp `Allow: /api/rental-public` wpisem `Allow: /api/rental/vehicles`.
   - Sprawdź, czy ktokolwiek inny polega na `/api/rental-public` (grep po repo, testy robots). Jeśli nie — usuń stary wpis, nie zostawiaj obu.
   - Endpointy `.../operator-financials` i `.../operator-info` wymagają auth — to, że formalnie wpadają pod Allow, jest OK (bez tokenu zwracają 401). Nie dodawaj dla nich osobnych Disallow.
2. Jeśli istnieje test robots.txt — zaktualizuj; jeśli nie ma, dodaj test asercji, że body zawiera `Allow: /api/rental/vehicles` i NIE zawiera `Allow: /api/rental-public`.
3. **Zadanie 1b (defensywne, mała zmiana):** w `RentalDetailPage.tsx` rozróżnij „pojazd nie istnieje (404)” od „błąd sieci/zablokowany fetch”. Dla błędu innego niż 404 nie renderuj komunikatu „Pojazd nie został znaleziony” (np. pokaż stan ładowania/skeleton lub ogólny komunikat błędu). `rentalPublicApi.getVehicle` w `src/services/rental-api.ts` (l. ~440) rzuca dziś ten sam `Error('Vehicle not found')` dla każdego `!response.ok` — potrzebny status. Minimalna zmiana, bez refaktoru strony.

### Kryteria akceptacji
- `curl -s https://<dev-host>/robots.txt` zawiera `Allow: /api/rental/vehicles` w każdej sekcji z listą Allow API, brak `rental-public`.
- Walidacja zasady: dla UA Googlebot ścieżka `/api/rental/vehicles/<slug>` jest dozwolona (najdłuższe dopasowanie wygrywa nad `Disallow: /api/`) — opisz w raporcie, jak sprawdziłeś (np. parser robots w teście).
- Test(y) zielone.

---

## Zadanie 2 (PERF + spójność SEO): SSR katalogu pokazuje inne oferty niż klient

### Stan / dowód
- `backend/src/routes/render.ts` l. ~833–863: SSR dla `/samochody`, `/nowe`, `/uzywane` pobiera oferty z `where = { isArchived: false, condition? }`.
- Publiczne API `backend/src/routes/listings.ts` (runQuery, l. ~490–526) dla niezalogowanych dodatkowo filtruje: `pricePln: { gt: 0 }`, warunek `OR` na `specification.displayMode` (`ALL` / `GROUPED` + `isRepresentative`) oraz `...dealerFilter` (sprawdź, czy dla anonimowego ruchu jest niepusty).
- Efekt na prod (2026-09-24): SSR `/uzywane` i `/samochody` mają jako 1. kartę `peugeot-3008-e-mr23-gt-73kwh-2024-suv-elektryczny-cmqgr2q6w00hf9667lo35s0ez` (brak zdjęcia) — klient jej nie pokazuje (1. karta klienta: Chevrolet Spark `cmtuemqwf013cknf351fvmhqc`). `cardPreloads()` (`backend/src/services/seo-meta.ts` l. ~130) preloaduje więc `motolia-placeholder.webp` z `fetchpriority=high`, a prawdziwy obraz LCP startuje dopiero po JS+API.
- Dodatkowo HTML dla botów (linki + ItemList JSON-LD) zawiera oferty niewidoczne dla użytkownika.

### Do zrobienia
1. Wyodrębnij warunek publicznej widoczności ofert (to, co anonimowy użytkownik widzi w `/api/listings`: `isArchived`, `pricePln > 0`, `displayMode OR`, ewentualny filtr dealera dla anonimów) do **jednej wspólnej funkcji** (np. w `backend/src/services/` albo `backend/src/lib/`) i użyj jej w obu miejscach: `listings.ts` (gałąź nieuwierzytelniona) i `render.ts` (SSR katalogu). Nie zmieniaj semantyki API dla zalogowanych.
2. Zweryfikuj sortowanie: SSR używa `getCarsOrderBy()` (`render.ts` l. ~138, mapa `CARS_ORDER_BY`, domyślnie `brokerPricePln asc`), klient wysyła `sortBy=price_asc` → API sortuje po `priceField` (`brokerPricePln` dla PLN). Upewnij się, że dla domyślnego widoku kolejność jest identyczna; jeśli różni się tie-breakiem (np. brak drugiego klucza sortowania → niedeterministyczna kolejność przy równych cenach), dodaj ten sam stabilny drugi klucz (np. `id`) w obu miejscach.
3. Sprawdź `/nowe` (dziś preload trafia w obraz specyfikacji, a LCP Lighthouse to placeholder oferty „JAC J7 Plus”) — po zmianie 1. karta SSR ma = 1. karta klienta na mobile.

### Kryteria akceptacji
- Dla każdej z `/samochody`, `/nowe`, `/uzywane` na dev: pierwsze 12 slugów z SSR HTML (`href="/oferta/..."`, w kolejności) == pierwsze 12 slugów z odpowiedzi `/api/listings` z parametrami, które wysyła klient (weź je z DevTools/Network; np. `?status=USED&rateType=credit&rateBasis=gross&sortBy=price_asc&currency=PLN&page=1&perPage=32`). Wklej porównanie do raportu.
- `<link rel="preload" as="image">` w SSR wskazuje obraz 1. karty klienta (ten sam wariant, który pobiera `<img>` — nie powinno być podwójnego pobrania; patrz komentarz przy `buildImagePreload`).
- Testy SSR/seo-meta i listings zielone; dopisz test na wspólną funkcję warunku.

---

## Zadanie 3 (PERF): `/wynajem-dlugoterminowy` bez preloadu LCP i z inną kolejnością

### Stan / dowód
- SSR (`render.ts` l. ~808–830): `rentalVehicle.findMany({ where: { isActive: true, slug: { not: null } }, orderBy: { createdAt: 'desc' } })`, bez zdjęcia w `select`. Ścieżka nie jest w `LIST_FIRST_PATHS` (`seo-meta.ts` l. ~1407) → brak preloadu obrazu.
- Klient: `GET /api/rental/vehicles?...limit=12&sortBy=minMonthlyRateNet&sortOrder=asc&offerType=b2b` — sortowanie po racie liczonej w `rental-public.ts` (l. ~176 `isRateSort`, rata liczona per pojazd, l. ~398), czyli nie prostym `orderBy` Prismy.
- Lighthouse mobile: LCP 5,4 s, opóźnienie startu obrazu LCP ~4,0 s.

### Do zrobienia
1. Ustal, jak uzyskać w SSR **tę samą pierwszą stronę** co klient dla domyślnego widoku. Preferowane: wyodrębnić z `rental-public.ts` funkcję zwracającą listę dla danych parametrów i wywołać ją z SSR z domyślnymi parametrami klienta (sprawdź w `src/pages/RentalSearchPage.tsx`/hookach, jakie są domyślne: `sortBy`, `sortOrder`, `offerType`, `limit`). Uważaj na koszt — SSR jest cache'owany (`ssr-cache`), ale pierwszy render nie może być wyraźnie wolniejszy; zmierz czas `/api/render?path=/wynajem-dlugoterminowy` przed/po (bez cache).
2. Dodaj zdjęcie do danych SSR i podepnij `cardPreloads()` dla `/wynajem-dlugoterminowy` (z tą samą drabinką wariantów co `<img>` w karcie najmu — sprawdź komponent karty, np. `RentalListingCard`, czy używa tych samych `sizes`/srcset co `CARD_IMAGE_SIZES`; jeśli inne — preload musi odzwierciedlać to, co pobiera `<img>`).
3. Jeżeli pełne wyrównanie kolejności okaże się zbyt kosztowne/ryzykowne — **zatrzymaj się i opisz w raporcie opcje**, nie wdrażaj obejścia na własną rękę.

### Kryteria akceptacji
- Pierwsze 12 slugów SSR == pierwsze 12 z `/api/rental/vehicles` z domyślnymi parametrami klienta (porównanie w raporcie).
- Preload obrazu = obraz 1. karty, ten sam wariant co `<img>`.
- Czas renderu SSR (miss) nie gorszy o więcej niż ~100 ms — podaj liczby.

---

## Pomiar wydajności (przed / po)

Baseline (Claude, 2026-09-24, prod, Lighthouse 12 lokalnie, mobile, 1 przebieg):

| Strona | Score | FCP | LCP | TBT | LCP load delay |
|---|---|---|---|---|---|
| /samochody | 65 | 3,7 s | 9,1 s | 170 ms | 2,9 s (+5,6 s render delay) |
| /nowe | 86 | 2,3 s | 3,3 s | 220 ms | 0,2 s |
| /uzywane | 77 | 2,3 s | 5,1 s | 120 ms | 4,2 s |
| /wynajem-dlugoterminowy | 76 | 2,4 s | 5,4 s | 130 ms | 4,0 s |

Po wdrożeniu na dev (lub staging) uruchom dla każdej strony **3 przebiegi** i podaj medianę + LCP phases:
```
npx -y lighthouse@12 "<URL>" --only-categories=performance --form-factor=mobile --output=json --output-path=<plik> --chrome-flags="--headless=new" --quiet
```
Uwaga: dev/staging mają inne dane niż prod — pokaż też baseline dev sprzed zmian (3 przebiegi), żeby porównanie było uczciwe.

## Poza zakresem (nie ruszać)
- Zmiana `createRoot` → hydracja / pełne SSR Reacta.
- GTM/GA, bundle splitting, fonty, modulepreload (był testowany i wycofany — patrz komentarze w `render.ts` ~l. 386 i ~1059).
- Render delay 5,6 s na `/samochody` (osobne profilowanie później) — jeśli przy okazji coś zauważysz, opisz, nie naprawiaj.
- Podwójne `<link rel="canonical">` / dwa `meta description` po hydracji (znany, osobny temat).
- Inne marki (brand ≠ motolia) — jeśli wspólna funkcja wpływa na inne brandy, zaznacz to w raporcie.

## Konwencje
- Schemat Prisma: jeśli cokolwiek w schemacie — `prisma db push`, nie `migrate dev` (i raczej nie powinno być potrzebne).
- Skrypty: lokalnie `npx tsx src/scripts/...`, w kontenerze `node dist/scripts/...`.
- Commity małe, per zadanie, konwencja `fix(seo): ...` / `perf(catalog): ...`.

## Co oddajesz (raport)
1. Lista commitów (hash + opis) na `dev`.
2. Dla każdego zadania: co zmieniono (pliki), wynik kryteriów akceptacji z wklejonymi dowodami (curl/porównania slugów/testy).
3. Tabela Lighthouse przed/po (mediana z 3, dev lub staging).
4. Otwarte kwestie / decyzje, które zostawiłeś do rozstrzygnięcia.

Claude zweryfikuje: diff, testy, robots.txt na hoście, porównanie slugów SSR vs API, Lighthouse. Po akceptacji — deploy na main i zgłoszenie ponownej indeksacji ofert najmu w GSC.
