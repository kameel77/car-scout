# Brandbook Motolia v1.0 — wdrożenie w car-scout

Branch: `feat/brandbook-motolia`
Źródło: `motolia-brandbook.html` (wersja 1.0, 15.08.2026)

## Gdzie mieszka system

| Warstwa | Plik | Rola |
|---|---|---|
| Paleta (źródło prawdy) | `src/index.css` → `:root` → `--mt-*` | Wszystkie kolory brandbooka w HSL |
| Role semantyczne | `src/index.css` → `--background`, `--muted-foreground`, `--subtle-foreground`… | Mapowanie palety na system shadcn |
| Klasy Tailwind | `tailwind.config.ts` → `colors.brand.*`, `colors.subtle`, `fontSize`, `minHeight` | `bg-brand-navy-deep`, `text-subtle`, `min-h-touch`, `h-btn` |
| Kolory marki | `src/brands/<brand>/config.ts` → `colors`, `fonts` | Wstrzykiwane do `:root` przez `applyBrandTokens()` |
| Wstrzyknięcie | `src/contexts/BrandContext.tsx` + `src/main.tsx` | Synchronicznie przed pierwszym renderem |

## Zasady, których trzeba pilnować

1. **Zakaz wartości bezpośrednich.** Kolor zapisujemy wyłącznie przez `--mt-*`
   albo klasę Tailwind, która się do niego odwołuje. Żadnych `text-[#1A1A1A]`.
2. **Żółć jest kolorem powierzchni, nie liter.** `#FFBE00` wolno użyć jako tło
   (przycisk, plakietka, tint) i jako tekst wyłącznie na granacie. Na jasnym tle
   litery idą w granacie `--mt-navy-700` (12,75:1).
3. **13 px to podłoga.** `text-xs` = 13 px, `text-sm` = 14 px (minimum dla UI).
   Jedyny wyjątek to `.text-overline` (12 px, wersaliki, waga 700).
4. **44 × 44 px pola dotyku.** Klasy `min-h-touch` / `min-w-touch`. Pole
   powiększamy przyciskiem lub paddingiem, nie samą grafiką.
5. **Najjaśniejszy dopuszczalny tekst** to `text-subtle` (Neutral 500, 5,94:1).
   Poniżej tej wartości tekst nie istnieje.
6. **Jedno wyróżnienie, jedna etykieta.** Wyróżniony wyraz w nagłówku dostaje
   klasę `.hl` (żółty marker pod tekstem, litery bez zmiany koloru). Etykieta
   nad nagłówkiem to `.text-overline` bez tła. Pigułka z tłem jest zarezerwowana
   dla plakietek przy ofertach, które niosą informację.

## Trzy sygnały, trzy znaczenia

Po ostatniej zmianie każdy sygnał wizualny znaczy dokładnie jedną rzecz —
i to jest właściwość, którą trzeba chronić przy każdej kolejnej zmianie:

| Sygnał | Znaczenie |
|---|---|
| Granat + pogrubienie + podkreślenie | link, coś klikalnego |
| Żółty marker pod wyrazem (`.hl`) | wyróżnienie w nagłówku, nieklikalne |
| Pełna żółta powierzchnia | przycisk główny, jeden na widok |

Wcześniej granat pełnił rolę linku i wyróżnienia jednocześnie, więc wyróżnione
wyrazy w nagłówkach wyglądały na klikalne. Żółć jako litery dawała 1,63:1
i wypadała z ekranu.

### Dlaczego nie granat jako wyróżnienie
Granat `#082D76` i Ink 900 `#111827` różnią się między sobą o **1,39:1**.
WCAG nie reguluje pary tekst–tekst, ale próg, przy którym oko czyta różnicę
jako zamierzoną, to około 3:1. Poniżej tego wyróżnienie działa na samym
odcieniu, nie na jasności.

### Pułapka, która to przepuściła
`PurchaseProcessStepper.css` kolorował wyróżnienie przez `hsl(var(--accent))` —
ani wartość bezpośrednia, ani klasa `text-accent`, więc przegląd oparty na
grepie po jednym i drugim tego nie widział. **Przy audytach kolorystycznych
trzeba szukać także użyć zmiennych CSS jako `color:`**, nie tylko literałów.

## Kroje

- Nagłówki: **Archivo Variable**, self-hosted w `public/fonts/` (SIL OFL,
  licencja w `public/fonts/ARCHIVO-OFL.txt`), podpięta przez `--font-heading`.
- Interfejs i treść: **Inter** (fontsource), `--font-body`.
- Krój przełącza się per marka w `src/brands/<brand>/config.ts` → `fonts`.
  CarSalon zostaje na Outfit.

## Co zostało do zrobienia

- [ ] QA wizualne na `/`, `/samochody`, `/wynajem-dlugoterminowy`, `/oferta/:id`,
      `/dla-firm`, `/faq` — build lokalny, nie był uruchomiony w tej sesji.
- [ ] Panel admina dziedziczy nową skalę typografii i wysokości przycisków.
      Sprawdzić gęste widoki (LeadList, LandingPagesPage) — tam zostały jeszcze
      rozmiary 10–11 px, świadomie nietknięte.
- [ ] Reguła lintera na `color: hsl(var(--accent))` w CSS — akcent wolno użyć
      jako `background`, nie jako `color` (poza ciemnymi powierzchniami).
- [ ] Reguły lintera z rozdz. 05 brandbooka (zakaz wartości bezpośrednich,
      zakaz `font-size` < 13 px) — nie wdrożone, warte dodania do CI.
- [ ] Automatyczny test kontrastu (axe-core / Pa11y) na sześciu kluczowych widokach.
- [ ] Strony FOTON (`/foton`) mają własną, ciemną identyfikację partnera —
      poza zakresem tego brandbooka, poprawione tylko rozmiary tekstu.
