# P3 - bezpieczne planowanie GTM po pierwszym katalogu

## Zmiana

`SeoManager` nadal inicjalizuje domyślną zgodę Consent Mode przed każdą próbą wstrzyknięcia GTM. Zachowuje istniejący `dataLayer`, a więc zdarzenia analityczne zakolejkowane przed załadowaniem kontenera pozostają do odczytu przez GTM.

Na trasach katalogu kontener czeka, aż `ProgressiveListingGrid` zgłosi co najmniej jedną zamontowaną ofertę (`data-progressive-grid` i dodatnie `data-mounted-count`) oraz miną dwa kolejne kadry animacji. Daje to szansę na namalowanie kart, ale nie potwierdza zakończenia pobierania zdjęcia LCP. Wczesna interakcja (`pointerdown`, `keydown`, `touchstart`) wstrzykuje GTM od razu. Limit oczekiwania wynosi 3,5 s. Strony bez katalogu korzystają z eventu load i dwóch klatek, zamiast czekać na nieistniejącą listę.

Tag Assistant pozostaje wyjątkiem: `gtm_debug` albo referrer Tag Assistant uruchamia GTM natychmiast, ale dopiero po ustawieniu domyślnej zgody.

Scheduler usuwa wszystkie listenery interakcji, `MutationObserver`, timeout fallbacku i uchwyty `requestAnimationFrame` zarówno po wykonaniu, jak i po odmontowaniu komponentu. Wywołanie wstrzyknięcia oraz sam GTM są jednokrotne w obrębie dokumentu.

## Thulium - potwierdzony zakres

Test Chrome lokalnego buildu Motolii z publicznym API dev potwierdził przez CDP Network.requestWillBeSent: inicjatorem `cdn.thulium.com/apps/chat-widget/chat-loader.js` jest `googletagmanager.com/gtm.js`. Nie dodano osobnego iniektora ani nie zmieniono konfiguracji kontenera.

W pojedynczej próbie widoku 390x844 na `/samochody`: zamontowane karty 333 ms, start GTM 346,3 ms, start loadera Thulium 518,1 ms; dokładnie jeden skrypt GTM. Są to czasy lokalnego testu bez throttlingu, nie LCP ani wynik produkcyjny. Pełny zapis: `/tmp/p123-tracking-browser.json`. Warunki wyzwalania tagu i zgody nadal kontroluje istniejący kontener GTM.

## Testy regresji

`src/components/seo/trackingScheduler.test.tsx` obejmuje gotowość katalogu, homepage, interakcję, fallback, cleanup, jednokrotne wykonanie, kolejność zgody i tryb Tag Assistant.
