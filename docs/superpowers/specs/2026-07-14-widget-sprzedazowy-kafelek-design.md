# Sprzedażowy kafelek w DynamicWidget (home) — design

Data: 2026-07-14
Status: zatwierdzony (Etap 1)

## Problem

Widget `DynamicWidget` (sekcje „Polecane nowe" / „Najnowsze oferty" na stronie głównej)
renderuje uproszczony kafelek: tag nadwozia, tytuł, wersja, kilka pilli i albo rata
(tylko wynajem) albo sama cena. Jest mało sprzedażowy w porównaniu do karty listingu
(`ListingCard`) oraz konkurencji (superauto.pl, automarket.pl), która pokazuje: tagi,
przekreśloną cenę katalogową vs cenę po rabacie, oszczędność i raty finansowania.

## Ograniczenie danych

Backend `/api/widgets/render` (`backend/src/routes/widgets.ts`) dla aut NOWYCH/UŻYWANYCH
mapuje okrojony zestaw pól — brakuje `condition`, `version`, `enginePowerHp`, `mileageKm`,
`catalogPrice`, `motoliaDiscountPln`, `showMotoliaDiscount`. Wszystkie istnieją w modelu
`Listing` — nie były mapowane. Wynajem (`RentalVehicle`) ma już realną ratę z matrycy
(`installment` = min `monthlyRateGross`).

## Decyzja architektoniczna: raty referencyjne (Etap 2, osobno)

Obecne raty na kartach to sztywne przybliżenie (`ListingCard`): `kredyt = cena_brutto × 1,4%`,
`leasing = cena_netto × 1,2%`. Nie zgadzają się z realnym kalkulatorem detalu, który liczy
ratę z produktu finansowego (`referenceRate + margin`, PMT z ratą balonową, widełki kwotowe),
a dla VEHIS/INBANK woła żywe API partnera (`backend/src/routes/financing.ts`). Dlatego
docelowo raty powinny być **przeliczane przy dodaniu/zmianie ceny pojazdu i zapisywane**
(jedyny sposób na realne raty na kartach bez odpalania N zapytań do partnera przy renderze).

To osobny projekt (Etap 2) z własnym specem: pola na `Listing`
(`referenceCreditInstallment`, `referenceLeasingInstallment`, `referenceCalcAt`,
`referenceCalcProductId`), serwis liczący (selekcja produktu + PMT dla OWN + partnerzy),
podpięcie pod create/update/zmianę ceny, skrypt backfill, przeliczanie przy zmianie produktu.
Proponowane założenia referencyjne: 36 mies., wpłata własna 10%, rata balonowa 20% (leasing),
produkt domyślny w kategorii (`isDefault`/`priority`).

## Etap 1 — zakres (to zadanie)

Wizualna przebudowa kafelka + przekazanie istniejących pól. Bez zmian w schemacie, bez backfillu.

### 1. Backend — `backend/src/routes/widgets.ts`
W formaterze listingów (tryby FEATURED i FILTERED) dodać do zwracanego obiektu:
`condition`, `version`, `enginePowerHp`, `mileageKm`, `catalogPrice`, `motoliaDiscountPln`,
`showMotoliaDiscount`. Wynajem bez zmian.

### 2. Wspólny helper — `src/utils/financingRates.ts` (nowy)
Stałe `KREDYT_FACTOR = 0.014`, `LEASING_FACTOR = 0.012`, `VAT = 1.23` + funkcja
`computeMonthlyRates(pricePln): { kredytGross, leasingNet } | null`.
`ListingCard` importuje stąd stałe (jedno źródło prawdy, bez zmiany zachowania).
W Etapie 2 to miejsce, gdzie karta zacznie czytać pola referencyjne zamiast liczyć.

### 3. Kafelek — `src/components/public/DynamicWidget.tsx`
Gałąź listingów (nowe/używane):
- Tagi na zdjęciu: typ nadwozia (jest) + NOWY/UŻYWANY (NOWY = accent). Zielony badge
  rabatu % w lewym-górnym rogu, gdy `showMotoliaDiscount` i `catalogPrice > cena`.
- Pill mocy (KM) + przebieg (przebieg tylko dla używanych, gdy > 0).
- Blok ceny: przy rabacie mały przekreślony `catalogPrice`, większa cena po rabacie,
  linijka „Oszczędzasz X zł". Bez rabatu — sama cena.
- Raty: dwa chipy — kredyt (`… zł/mc brutto`) i leasing (`… zł/mc netto`) z
  `computeMonthlyRates(cena)` + jednolinijkowe zastrzeżenie „Raty poglądowe" (bez
  ciężkiego tooltipa — widget bywa osadzany w iframe partnera / tryb EXTERNAL).

Gałąź wynajmu (RENTAL): zostaje przy realnej racie „od X zł/mc brutto"; dokładamy tylko
wersję i moc (dane już przychodzą). Bez bloku rabatu.

### Pliki
- `backend/src/routes/widgets.ts` — pola w formaterze (2 miejsca)
- `src/utils/financingRates.ts` — nowy helper
- `src/components/ListingCard.tsx` — import stałych z helpera
- `src/components/public/DynamicWidget.tsx` — przebudowa kafelka

Bez migracji / db push.

### Kryteria akceptacji
- Kafelki nowych/używanych pokazują tag NOWY/UŻYWANY.
- Tam, gdzie jest rabat (`showMotoliaDiscount` + `catalogPrice > cena`): przekreślona cena
  katalogowa, cena po rabacie, „Oszczędzasz X zł" oraz zielony badge %.
- Kafelki nowych/używanych pokazują raty kredyt i leasing.
- Kafelki wynajmu pokazują realną ratę najmu (bez regresji).
- Brak błędów w konsoli; działa w trybie HOME i EXTERNAL.

## Reużycie ListingCard — odrzucone

Nie podpinamy `ListingCard` do widgetu: zależy od kontekstów (`PriceSettings`,
`SpecialOffer`, `Brand`, `AppSettings`), których nie ma w trybie EXTERNAL (iframe partnera),
i oczekuje pełnego obiektu `Listing`, a widget ma cieńszy kształt danych. Zamiast tego
rozbudowujemy kafelek widgetu i dzielimy tylko logikę stawek przez helper.
