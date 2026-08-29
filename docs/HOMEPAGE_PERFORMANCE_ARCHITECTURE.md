# Architektura wydajności strony głównej Motolia

## Cel

Strona główna ma utrzymywać wynik Lighthouse mobile powyżej 90 bez migania hero, zerwania hydratacji ani opóźnienia obrazu LCP.

## Niezmienniki implementacyjne

1. `HomePage` pozostaje importowany statycznie w `src/App.tsx`.
2. Trasa `/` nie może opakowywać `HomePage` ani komponentu hero w osobny `React.lazy` lub `Suspense` z pustym albo innym wizualnie fallbackiem.
3. Statyczny shell strony głównej w `vite.config.ts` musi zachowywać strukturę, tekst i wymiary zgodne z pierwszym renderem Reacta.
4. Backend usuwa shell strony głównej na wszystkich trasach poza `/`. Dla `/` może podmienić go na shell pierwszego aktywnego bannera CMS.
5. Obraz LCP musi być obecny w danych HTML SSR i otrzymać pasujący preload w `<head>`.
6. `href`, `imagesrcset`, `imagesizes` i `type` preloadu muszą odpowiadać wariantowi wybieranemu przez element `<img>` lub `<picture>`.
7. Obraz LCP używa `loading="eager"` i `fetchpriority="high"`. Placeholder LCP pozostaje wyłączony, jeśli właściwy obraz jest już znany podczas SSR.
8. Tylko jeden zasób obrazu otrzymuje priorytet LCP. Nie należy preloadować kilku konkurencyjnych obrazów nad foldem.
9. Sekcje poniżej foldu mogą i powinny być dzielone na osobne chunki przez `React.lazy`.
10. Kolejność globalnych providerów oraz położenie `BrowserRouter` nie mogą być zmieniane bez testu nawigacji bezpośredniej, przejścia SPA i przycisku Wstecz.

## Pliki powiązane

- `src/App.tsx` - statyczny import `HomePage` i stabilne drzewo providerów.
- `src/pages/HomePage.tsx` oraz `src/pages/MotoliaHomePage.tsx` - właściwy widok i podział sekcji poniżej foldu.
- `src/components/HeroBannerCarousel.tsx` - obraz LCP i zgodność z preloadem.
- `vite.config.ts` - statyczny shell oraz krytyczny CSS i fonty.
- `backend/src/routes/render.ts` - wybór shellu dla ścieżki i dane pierwszego bannera.
- `backend/src/services/seo-meta.ts` - preload obrazu LCP i meta SSR.

## Zabronione regresje

- Zmiana `HomePage` na lazy tylko po to, aby zmniejszyć wspólny bundle.
- Jednoczesny import statyczny i lazy tego samego `HomePage`.
- Pusty `Suspense` nad całym widokiem `/`.
- Preload formatu, którego nie ma na serwerze.
- Preload innego wariantu niż ten pobierany przez przeglądarkę.
- Ponowne dodanie placeholdera hero widocznego między shellem SSR a renderem Reacta.

## Weryfikacja przed commitem

1. Uruchomić `bun run test`, `bun run lint` i `bun run build`.
2. Sprawdzić `/` bezpośrednio na mobile oraz po nawigacji Wstecz.
3. Potwierdzić w Network, że właściwy obraz LCP zaczyna pobieranie z dokumentu HTML, bez wcześniejszego 404.
4. Potwierdzić brak podwójnego pobrania WebP/AVIF tego samego bannera.
5. Uruchomić Lighthouse mobile co najmniej trzy razy i porównać medianę.
6. Przekazać diff do przeglądu przez najmocniejszy dostępny model przed utworzeniem commita.
