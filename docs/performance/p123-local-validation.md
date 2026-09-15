# Pakiet 1-2-3: weryfikacja lokalna

## Zakres
- P1: fetch-ahead publicznego katalogu z HTML, zgodność parametrów i originu, brak użycia publicznej odpowiedzi do zapytań z tokenem; fallback po błędzie.
- P2: warunkowe importy sekcji finansowania, kalkulatora i WaitlistForm w SearchPage; osobne lekkie moduły hooka artykułu i podziału leadu.
- P3: GTM po kartach + dwóch klatkach, interakcji lub limicie 3,5 s; pozostałe strony po load. Zachowane Consent Mode, dataLayer i Tag Assistant. Inicjator Thulium potwierdzony w CDP jako GTM.

## Statyczne zależności JS
Porównanie HEAD b1940cb i roboczego pakietu, identyczne node_modules, oba buildy `VITE_BRAND=motolia`. Suma gzip unikalnych plików JS w domknięciu imports entry + danej strony z manifestu. Bez CSS, obrazów, danych i dynamicznych importów. Zmiana dotyczy całego pakietu, nie wyłącznie P2.

| Trasa | Przed (B gzip) | Po (B gzip) |
| --- | ---: | ---: |
| / | 182027 | 182403 |
| /samochody | 294543 | 257166 |
| /nowe | 213754 | 214113 |
| /uzywane | 213754 | 214113 |
| /wynajem-dlugoterminowy | 205213 | 205818 |

`/samochody`: mniej o 37377 B gzip. Pozostałe trasy mają niewielki wzrost kodu pomocniczego. Nie jest to dowód poprawy LCP/TBT.

## Weryfikacja
- Frontend: 101 testów w 22 plikach, wszystkie przechodzą.
- Lint i build Motolii: przechodzą; build nadal ostrzega o dużych chunkach.
- Backend TypeScript: przechodzi; testy renderera P1: 49/49.
- Chrome, lokalny build z API dev, viewport 390x844: /, /samochody, /nowe, /uzywane, /wynajem-dlugoterminowy, /leasing, /kredyt bez pageerror; katalogi mają zamontowaną siatkę.
- /samochody nie zażądało chunków kalkulatora, sekcji finansowania i formularza; /leasing i /kredyt pobrały kalkulator i sekcję finansowania.
- Dodatkowy test katalogu: grid 333 ms, GTM 346,3 ms, Thulium 518,1 ms, jeden skrypt GTM. Bez throttlingu; nie traktować jako pomiaru LCP.
- Preview Vite nie wykonuje backendowego SSR. Prefetch HTML zweryfikowano oddzielnie testami renderera i konsumenta API.

## Pozostałe bramki
P1 ma APPROVED od gpt-5.6-terra. Końcowy audyt P2-P3 został zablokowany limitem konta Codex, więc nie jest zatwierdzony. Nie wykonano commit/push/deploymentu ani powtarzanych pomiarów Lighthouse na docelowym środowisku. Nie potwierdzono celu 200-250 ms.

Artefakty lokalne: /tmp/p123-bundle-comparison.json, /tmp/p123-browser-results.json, /tmp/p123-tracking-browser.json, /tmp/p123-all-tests.log, /tmp/p123-build.log.
