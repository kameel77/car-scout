# Wytyczne wdrożenia — landing page'y, iteracja 2

Data: 2026-07-30. Zakres: pięć uzupełnień systemu LP (`/promo/:slug`) zgłoszonych po pierwszym
produkcyjnym użyciu (kampania `mecz-rakow-valetta`).

**Źródła (przeczytaj przed startem):**
- [LANDING_PAGES_WYTYCZNE_WDROZENIA.md](LANDING_PAGES_WYTYCZNE_WDROZENIA.md) — decyzje z iteracji 1, nadal obowiązują.
- `CLAUDE.md` repo — Simplicity First, Surgical Changes, uruchamianie skryptów w kontenerze.

> Zasada nadrzędna: **minimalny kod, chirurgiczne zmiany, żadnych spekulacyjnych abstrakcji.**
> Każda zmieniona linia ma wynikać wprost z tego dokumentu.

**Zanim zaczniesz:** upewnij się, że pracujesz na aktualnym `dev` (commity `0fcb0ff`, `9cc6d4f`,
`92857f7`). Jeśli ich nie widzisz w historii — zatrzymaj się i zgłoś.

---

## Stan zastany (zweryfikowany w kodzie)

- **Sekcje LP:** typ `LpSections` i `sanitizeSections` w `backend/src/routes/landing-pages.ts`
  (~linia 45). Sloty: `callback`, `listings`, `trustBar`, `howItWorks` (limit **3** kroków,
  `.slice(0, 3)`), `faq` (limit 6), `urgency`.
- **Panel, zakładka „Sekcje":** `src/pages/admin/LandingPagesPage.tsx`, `TabsContent value="sections"`.
  Zawiera wyłącznie callback, trustBar i urgency — **nie ma edytora FAQ ani „Jak to działa"**,
  mimo że `DEFAULT_FORM` zapisuje dla nich treści domyślne. To źródło zgłoszenia nr 4.
- **Upload hero:** `POST /api/landing-pages/:id/hero-image` (~linia 477) + helper
  `unlinkLandingPageHeroImage` (~linia 100). **Brak endpointu usuwającego zdjęcie.**
- **Render LP:** `src/pages/CampaignLandingPage.tsx` — sekcje jako zmienne `heroSection`
  i `listingsSection`, kolejność sterowana `lp.heroPosition`. Motyw przez mapę `THEMES`;
  każdy nowy element UI musi używać klas z `theme`, nie hardkodowanych kolorów.
- **Stopka LP:** minimalna, na końcu `CampaignLandingPage.tsx` — dane spółki i klauzula o kontakcie.

---

## Decyzje produktowe (zatwierdzone przez Kamila)

1. Przycisk „Sprawdź całą ofertę" pod listą pojazdów to **celowy wyjątek** od zasady zero
   conversion leak z iteracji 1 — jedyny link wyprowadzający z landingu. Nie dodawaj innych.
2. Regulamin promocji to **plik PDF** wgrywany per LP. Jeśli nie wgrano pliku, sekcja
   w stopce w ogóle się nie pojawia.
3. Czwarty kafel w „Jak to działa" jest **opcjonalny i niezależny** — pokazuje się tylko wtedy,
   gdy jest włączony i ma uzupełniony tytuł.
4. Nadal **żadnego page-buildera**: edytory FAQ i kroków to listy pól tekstowych z przyciskami
   dodaj/usuń, bez drag&drop i bez WYSIWYG.

---

## 1. Usuwanie zdjęcia hero

**Backend** — nowy endpoint w `backend/src/routes/landing-pages.ts`, obok uploadu:

```
DELETE /api/landing-pages/:id/hero-image
preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
```

Wywołaj istniejący `unlinkLandingPageHeroImage(lp.heroImageUrl)` i ustaw `heroImageUrl: null`.
404, gdy LP nie istnieje. Gdy `heroImageUrl` jest już puste — zwróć 200, operacja idempotentna.

**Front** — `landingPagesApi.deleteHeroImage(id)` w `src/services/api.ts` (wzorzec pozostałych
metod modułu; token z klucza `auth_token`). W panelu, w zakładce „Hero & CTA", obok podglądu
`Obecny obraz:` dodaj przycisk „Usuń zdjęcie" z potwierdzeniem. Po sukcesie wyczyść
`heroImageUrl` w stanie formularza i odśwież listę LP.

**Kryterium akceptacji:** po usunięciu plik znika z `uploads/landing-pages/`, a landing renderuje
się poprawnie bez bloku obrazu.

---

## 2. Przycisk „Sprawdź całą ofertę" pod listą pojazdów

Rozszerz slot `listings` w `LpSections` (backend + `sanitizeSections` + typ
`LpSectionsData` w `src/hooks/useLandingPage.ts`):

```ts
listings?: {
  enabled: boolean;
  title?: string;
  ctaEnabled?: boolean;   // domyślnie true
  ctaLabel?: string;      // domyślnie 'Sprawdź całą ofertę'
  ctaUrl?: string;        // domyślnie '/samochody'
};
```

`ctaUrl` waliduj jako **ścieżkę względną zaczynającą się od `/`** — nie dopuszczaj adresów
zewnętrznych ani `javascript:`. Wartość spoza tego wzorca zastąp domyślną.

**Front** — w `listingsSection` w `CampaignLandingPage.tsx`, pod siatką pojazdów, wyśrodkowany
przycisk w kolorze akcentu (`#F5C518`, czarny tekst). Renderuj tylko gdy są jakieś pojazdy.
Kliknięcie wysyła do `dataLayer` event `lp_offer_cta` z `landing_page_slug` i `traffic_source`
— inaczej nie odróżnisz w GA4 wyjścia do katalogu od porzucenia strony.

**Panel** — pola w zakładce „Sekcje", w bloku sekcji ofert: przełącznik, etykieta, ścieżka.
Podpowiedz w helperze, że dla landingów o wynajmie sensowne jest `/wynajem-dlugoterminowy`.

**Kryterium akceptacji:** przycisk prowadzi pod wskazaną ścieżkę, a event pojawia się
w GA4 DebugView z poprawnymi parametrami.

---

## 3. Regulamin promocji (PDF)

**Model** — `backend/prisma/schema.prisma`, model `LandingPage`:

```prisma
  /// Regulamin promocji (PDF) — link pojawia się w stopce landingu tylko gdy plik jest wgrany
  termsFileUrl   String?  @map("terms_file_url")
  termsLabel     String?  @map("terms_label")
```

Nowa migracja (nie edytuj istniejących!): `backend/prisma/migrations/<timestamp>_landing_page_terms/migration.sql`.
Po dodaniu uruchom `npx prisma generate`.

**Backend** — endpointy obok hero-image:

```
POST   /api/landing-pages/:id/terms-file
DELETE /api/landing-pages/:id/terms-file
```

Wyłącznie `application/pdf`, limit 8 MB, katalog `uploads/landing-pages/terms`. PDF **nie
przechodzi** przez `optimizeAndSaveImage` — zapisz bufor bezpośrednio, nazwa pliku wg wzorca
z uploadu hero (`${id}-terms-${Date.now()}-${losowy hex}.pdf`). Przy podmianie i usunięciu
kasuj poprzedni plik. Waliduj także nagłówek pliku (`%PDF` na starcie bufora) — sam `mimetype`
z multiparta pochodzi od klienta i można go podrobić.

Dodaj `termsFileUrl` i `termsLabel` do odpowiedzi publicznego endpointu oraz do CRUD
(`normalizePhone`-podobna sanityzacja dla `termsLabel`, max 120 znaków).

**Front** — w stopce `CampaignLandingPage.tsx`, nad klauzulą o kontakcie, renderuj tylko gdy
`lp.termsFileUrl`:

```
<a href={lp.termsFileUrl} target="_blank" rel="noopener noreferrer">
  {lp.termsLabel || 'Regulamin promocji (PDF)'}
</a>
```

Link musi być czytelny w obu motywach — użyj klas z `theme`, z podkreśleniem.

**Panel** — w zakładce „Oferta": upload PDF, nazwa linku, podgląd obecnego pliku i przycisk
usunięcia.

**Kryterium akceptacji:** wgrany regulamin otwiera się w nowej karcie; po usunięciu sekcja
znika ze stopki, a plik z dysku.

---

## 4. Edytor FAQ w panelu

W zakładce „Sekcje" dodaj blok „FAQ (max 6)" w konwencji pozostałych slotów: `Switch` dla
`enabled`, a pod nim lista pytań i odpowiedzi.

Każdy wpis: `Input` na pytanie, `textarea` (2 wiersze) na odpowiedź, przycisk usunięcia wpisu.
Pod listą przycisk „Dodaj pytanie", nieaktywny po osiągnięciu sześciu wpisów. Kolejność wpisów
= kolejność renderowania na landingu; nie dodawaj sortowania.

Backend już waliduje ten slot (`sanitizeSections`, limit 6, obcięcia długości) — **nie zmieniaj
tam nic**. Pilnuj tylko, żeby panel nie wysyłał wpisów z pustym `q` lub `a`.

**Kryterium akceptacji:** zmiana treści FAQ w panelu jest widoczna na landingu po zapisie
i przeładowaniu, bez deployu.

---

## 5. Czwarty kafel w „Jak to działa" (odbiór nagrody)

**Backend** — w `sanitizeSections` podnieś limit kroków z `.slice(0, 3)` na `.slice(0, 4)`.
To jedyna zmiana w tym pliku dla tego punktu.

**Panel** — dodaj do zakładki „Sekcje" blok „Jak to działa": `Switch` dla `enabled` oraz edytor
trzech podstawowych kroków (tytuł + opis). Pod nimi osobny, wyraźnie oddzielony blok
**„Kafel odbioru nagrody (opcjonalny)"** z własnym przełącznikiem, polem tytułu i opisu.
Włączony przełącznik dopisuje ten kafel jako czwarty element `steps`; wyłączony — usuwa go
z tablicy. Jeśli tytuł jest pusty, kafel nie trafia do zapisu, nawet przy włączonym przełączniku.

**Front** — `CampaignLandingPage.tsx`, sekcja „Jak to działa": siatka musi obsłużyć zarówno trzy,
jak i cztery kafle. Zmień `md:grid-cols-3` na układ zależny od liczby kroków
(`steps.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'`), żeby przy czterech
kaflach nie powstawał osierocony element w drugim rzędzie.

**Kryterium akceptacji:** LP z czterema krokami renderuje równy rząd na desktopie i kolumnę
na mobile; LP z trzema wygląda jak dotąd.

---

## Czego NIE robić

- Nie dodawaj innych linków wychodzących z landingu poza przyciskiem z punktu 2.
- Nie zmieniaj istniejących migracji — każda zmiana schematu to nowy katalog migracji.
- Nie wprowadzaj edytora WYSIWYG, Markdown ani pola z dowolnym HTML w sekcjach.
- Nie ruszaj logiki `CallbackForm`, `ListingCard` ani `RentalListingCard`.
- Nie hardkoduj kolorów w `CampaignLandingPage.tsx` — wszystko przez mapę `THEMES`
  (poza akcentem `#F5C518`, który jest wspólny dla obu motywów).
- Nie umieszczaj w UI twierdzeń o stanie bazy danych (jak w poprzedniej iteracji przy
  komunikacie o braku nowych aut) — panel działa na wielu środowiskach.

---

## Weryfikacja przed zgłoszeniem gotowości

Uruchom i podaj wyniki: `npx tsc --noEmit` (frontend i backend), `npm run lint`,
testy backendu, `npm run build`.

**Nie raportuj „0 błędów", jeśli nie widziałeś wyjścia polecenia** — w poprzednich dwóch
iteracjach zgłoszenie czystej kompilacji przy niekompilującym się kodzie kosztowało dwie
dodatkowe rundy poprawek.

Dopisz krótką notkę o nowych polach do `features_desc.md` (sekcja 38).
Po wdrożeniu na produkcję zaproponuj wpis devlog do Vault (projekt: motolia).
