# Motolia - audyt mobile: stan częściowy

## Zakres i status

Główny przegląd: GPT-6-Astra w bieżącej rozmowie (openai-codex). Próba niezależnego uruchomienia GPT-6-Astra przez Codex CLI zakończyła się HTTP 400: model nieobsługiwany dla konta ChatGPT. Dwaj pomocniczy agenci Flash zakończyli się HTTP 429; nie dostarczyli akceptacji. Brak niezależnego audytu wymaganego przed dostarczeniem. Brak deploymentu, commitu i push. To nie jest zakończona optymalizacja pięciu tras.

## Pomiary produkcji

Pierwsza seria Lighthouse: po jednym uruchomieniu mobile i desktop dla każdej trasy. Symulacja Lighthouse, nie realny telefon ani CrUX. Wyniki nie są medianami. Pełne JSON-y: /tmp/carscout-live-audit/; podsumowanie: summary.json. Pomiar poprzedza lokalne korekty. Zależności npm Lighthouse instalowane przez npx poza manifestem projektu.

| Trasa | Mobile | Desktop | LCP mobile | LCP desktop |
|---|---:|---:|---:|---:|
| / | 68 | 100 | 9,3 s | 0,7 s |
| /nowe | 76 | 100 | 4,7 s | 0,7 s |
| /uzywane | 78 | 96 | 4,8 s | 1,3 s |
| /wynajem-dlugoterminowy | 79 | 97 | 4,9 s | 1,3 s |
| /samochody | 71 | 99 | 7,6 s | 0,8 s |

Czas odpowiedzi dokumentu raportowany przez server-response-time to 18-123 ms dla prób mobile. Nie należy utożsamiać go z pełnym TTFB (DNS/TLS/sieć), LCP ani średnią crawlowania GSC 538 ms. 200-250 ms może być budżetem TTFB; nie ma dowodu osiągnięcia takiego pełnego czasu ładowania na mobile.

## Dowody i priorytety

### P1 - zgodność pierwszej karty i preloadu we wszystkich katalogach

Lighthouse oznacza requestDiscoverable=false dla LCP wszystkich czterech listingów. Osobny późniejszy odczyt HTML pokazuje: /nowe preloaduje zdjęcie specyfikacji, /uzywane i /samochody placeholder, /wynajem-dlugoterminowy nie ma image preload. W pomiarze LCP /nowe jest placeholderem JAC J7 Plus, /uzywane i /samochody zdjęciem Chevroleta Spark, a najmu zdjęciem Mercedes-Benz CLA. Odczyty nie były jednoczesne, więc przed zmianą selektora trzeba wykluczyć cache i zmianę danych.

Renderer ma własne sortowanie w backend/src/routes/render.ts:110 i fetch-ahead tylko dla /nowe i /uzywane przy stronie 1 (około linii 1045). Frontend useListings (src/hooks/useListings.ts:26-87) czeka na settings, ale sort strony jest osobnym stanem synchronizowanym efektem w ConditionPage. Wymagana kontrola zgodności filtrowania, sortowania, pierwszego rekordu, placeholdera i rozmiaru obrazów w jednym przebiegu przeglądarki. Nie włączano globalnego modulepreload - wcześniejszy eksperyment repo wykazywał regresję FCP.

### P1 - homepage: opóźnione wyświetlenie, nie wykrywanie obrazu

Obraz LCP jest wykrywalny w HTML i ma high/eager. Trzeba sprawdzić przejście shell -> React, karuzelę, fonty i koszt skryptów. src/main.tsx:10 używa createRoot, nie hydrateRoot. Dodane uprzednio lazy całego HomePage i fallback=null nie gwarantowało zachowania shellu. Cofnięto ten eksperyment. Nie przełączano na hydrateRoot: zgodność drzewa HTML z React nie została udowodniona.

### P1 - wspólne zasoby i skrypty analityczne

Największe transfery każdej trasy obejmują produkcyjny entry JS około 210 KB, GTM około 162 KB i gtag około 184 KB. Są to transfery sieciowe z raportu, nie rozmiary źródeł. Sama obecność GTM i gtag nie dowodzi podwójnej instalacji. Sprawdzić inicjator, consent, start przed LCP i koszt CPU. Nie wyłączano analityki ani zgód w celu sztucznego poprawienia wyniku.

### P2 - granice zależności tras

SearchPage importował rental API i RentalListingCard pomimo stałego hideRentals=true. Usunięto query i martwą gałąź UI, pozostawiając sortowanie/deduplikację filtrów sprzedażowych. Usuwa to także możliwość zanieczyszczenia filtrów danymi istniejącego cache najmu przy wyłączonym zapytaniu. ConditionPage już wcześniej nie importował tego stosu.

### P2 - obrazy poniżej folda i fonty

Homepage pobiera m.in. kafel Toyota/Lexus około 99 KB poniżej folda; Lighthouse szacuje nadmiar rozmiaru. Kolejne slajdy karuzeli także są pobierane. Najpierw sprawdzić moment żądania i budżet przed LCP; nie usuwano treści SEO i nie reklamowano nieistniejących wariantów AVIF. Nie zastosowano automatycznego zmniejszania zdjęć bez weryfikacji jakości na DPR telefonu.

## Lokalna korekta i kontrolowany build

Oba buildy z VITE_BRAND=motolia, te same lokalne zależności. Before zawiera wcześniejszy eksperyment lazy HomePage, nie stan produkcji. After przywraca synchroniczny HomePage i usuwa martwy stos najmu SearchPage. Suma gzip statycznego domknięcia entry+trasa według manifestu (bez dynamicznych sekcji, CSS, danych i obrazów), obliczana identycznie Python gzip:

| Trasa/moduł | Before gzip B | After gzip B |
|---|---:|---:|
| HomePage | 193083 | 181992 |
| SearchPage | 284543 | 293427 |
| ConditionPage | 200407 | 212653 |
| RentalSearchPage | 192612 | 204108 |

To korekta ryzyka homepage, nie dowód poprawy katalogów. Domknięcie katalogów rośnie względem lazy eksperymentu. Potrzebne rozdzielenie niekrytycznych zależności wewnątrz homepage oraz A/B na zgodnych buildach z tym samym backendem. Bez pomiarów po zmianie nie przypisujemy oszczędności milisekund.

## Weryfikacja i ograniczenia

VITE_BRAND=motolia npm run build: sukces, ostrzeżenie entry >500 KB. npm test -- --run przed dodaniem testu granic: 64/64. npm run lint: 0 błędów, 55 ostrzeżeń. Nowy catalog-performance.test.ts sprawdza granice importów, nie zastępuje testów przeglądarkowych. Nie uruchamiano pełnych testów backendu bez izolowanej bazy. Zachowano cudze zmiany dealers-admin/stock-sync/pewneauto i dokumentację sekcji 65.

Końcowe uruchomienie po dodaniu testów granic: 17 plików testowych, 67/67 testów zakończonych sukcesem. git diff --check bez błędów.

## Warunki zakończenia

- Jednoczesny capture HTML, API i pierwszej karty dla wszystkich pięciu tras.
- Powtarzalne minimum pięć prób na wariant i mediany mobile/desktop z kontrolą cache.
- Poprawki selekcji preloadu dopiero po potwierdzeniu przyczyny rozbieżności i wersji produkcyjnych artefaktów.
- Testy funkcjonalne filtrów/paginacji/nawigacji/zgód/leadów oraz niezależna akceptacja właściwym modelem.
- Osobny, jawny deployment i odczyt powdrożeniowy; obecnie brak.
