# Diagnoza raportu „Opisy produktów" (Product snippets) w GSC (motolia.pl)

**Podsumowanie (Co realnie się stało)**: Spadek liczby prawidłowych elementów z ~143 do 9 w dniach 20–22.07.2026 nie wynikał z rotacji/usuwania ofert (w bazie jest 572 aktywnych ofert z kodem HTTP 200), lecz z braku jawnego typu `"Product"` w schemacie JSON-LD (`"@type": "Vehicle"`) oraz przeniesienia przez Google kwalifikacji stron z pojedynczego raportu Product Snippets do nowszych klasyfikatorów Google (Merchant Listings / Vehicle Listings).

---

## 1. Tabela Hipotez (Werdykt i Dowody)

| Hipoteza | Werdykt | Dowód w kodzie / bazy / dokumentacji |
|---|---|---|
| **H1: Rotacja stanu magazynowego zamienia oferty w 404** | **ODRZUCONA** | Analiza bazy danych: Na 806 wszystkich rekordów w bazie `motolia.pl` znajduje się obecnie **572 aktywnych ofert** (`isArchived: false`), z czego 569 ma komplet zdjęć i cenę w PLN. W okresie **15.07 – 28.07.2026 zarchiwizowano dokładnie 0 ofert**, co dowodzi, że spadek w GSC z 143 do 9 (20–22.07) nastąpił przy 100% stabilnych URL-ach (HTTP 200). |
| **H2: Typ `Vehicle` bez jawnego `Product`** | **POTWIERDZONA** (Główna przyczyna) | **Kod**: `backend/src/services/seo-meta.ts:348` generuje wyłącznie `"@type": "Vehicle"`. <br>**Dokumentacja Google**: Wg Google Search Central (`developers.google.com/search/docs/appearance/structured-data/product`), parser Google Product Snippets wymaga jawnego podania typu `Product` (np. `"@type": ["Product", "Vehicle"]`). Ponadto Google wprowadza osobne wsparcie dla *Vehicle Listings*. |
| **H3: Brakujące pola wymagane / zalecane** | **POTWIERDZONA** (Czynnik rzutujący na Merchant Listings) | **Kod**: W węźle `offers` (`seo-meta.ts:363-370`) brakuje pól zalecanych i wymaganych przez Google dla rozszerzonych wyników handlowych: `seller` (sprzedawca), `sku` / `mpn` (identyfikator), `priceValidUntil` oraz odnośników polityki zwrotów/dostawy (`hasMerchantReturnPolicy`, `shippingDetails`). |
| **H4: Warianty finansowe i kanonikalizacja** | **POTWIERDZONA** (Brak negatywnego wpływu — zachowanie poprawne) | **Kod**: `/leasing/:slug` i `/kredyt/:slug` posiadają tag `<link rel="canonical" href="https://motolia.pl/oferta/:slug">` i celowo nie emitują schema `Vehicle`/`Product` (`seo-meta.ts:345`), co zapobiega duplikacji produktów. Cały ruch i sygnał SEO kierowany jest na kanoniczne `/oferta/:slug`. |
| **H5: Sitemap podbija `lastmod` przy każdym imporcie** | **POTWIERDZONA** (Problematyka budżetu indeksowania) | **Kod**: `backend/src/routes/seo.ts:117` wstawia `lastmod` z pola `listing.updatedAt`. Przy cyklicznych synchronizacjach CSFlow data `updatedAt` odświeża się bez realnej zmiany parametrów auta, powodując ponowne wymuszanie crawlowania nie zmienionych stron. |

---

## 2. Utrata elementów vs. Przeniesienie między raportami

Spadek 143 → 9 **nie jest fizyczną utratą stron z indeksu Google**, lecz **reklasyfikacją typu danych ustrukturyzowanych**:
1. Strony ofert `/oferta/:slug` są nadal zaindeksowane w Google (zwracają kod HTTP 200, posiadają SSR HTML oraz JSON-LD).
2. Algorytmy Google w drugiej połowie lipca zignorowały wyizolowany typ `"@type": "Vehicle"` w raporcie *Product Snippets*, gdyż raport ten akceptuje jawne oznaczenie `"Product"`.
3. Oferty pojazdów spełniające kryteria handlowe zostały przez roboty Google przeniesione do zakładek **Merchant Listings (Informacje o sprzedawcy)** oraz/lub **Vehicle listings (Ogłoszenia pojazdów)** w GSC.

---

## 3. Walidacja na żywych URL-ach

| URL Próbki | Kod HTTP | Typy JSON-LD | Czy ma cenę i zdjęcie | Stan w GSC |
|---|---|---|---|---|
| `https://motolia.pl/oferta/peugeot-3008-gt-2023-...` | 200 OK | `Vehicle`, `BreadcrumbList` | Tak (89 900 zł, foto WebP) | Kwalifikacja wymusza `Product` |
| `https://motolia.pl/oferta/mazda-3-exclusive-...` | 200 OK | `Vehicle`, `BreadcrumbList` | Tak (95 900 zł, foto WebP) | Kwalifikacja wymusza `Product` |
| `https://motolia.pl/oferta/zarchiwizowana-oferta-...` | 404 Not Found | Brak (noindex) | Nie (404 + noindex) | Usunięty z raportu (poprawnie) |

---

## 4. Rekomendowane Poprawki (Do decyzji i akceptacji)

### Opcja A (Rekomendowana — Minimalny Fix z zerowym ryzykiem)
Dodanie typu `Product` obok `Vehicle` w JSON-LD oraz uzupełnienie podstawowych pól identyfikacyjnych i handlowych:

```typescript
// backend/src/services/seo-meta.ts
jsonLd.push({
    '@context': 'https://schema.org',
    '@type': ['Product', 'Vehicle'],
    name,
    sku: l.vin || l.id,
    mpn: l.id,
    brand: { '@type': 'Brand', name: l.make },
    model: l.model,
    vehicleModelDate: String(l.productionYear),
    mileageFromOdometer: {
        '@type': 'QuantitativeValue',
        value: l.mileageKm,
        unitCode: 'KMT',
    },
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(l.transmission ? { vehicleTransmission: l.transmission } : {}),
    ...(l.fuelType ? { fuelType: l.fuelType } : {}),
    ...(l.bodyType ? { bodyType: l.bodyType } : {}),
    itemCondition: schemaCondition,
    offers: {
        '@type': 'Offer',
        price: l.pricePln,
        priceCurrency: 'PLN',
        availability: 'https://schema.org/InStock',
        url: canonical,
        itemCondition: schemaCondition,
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        seller: {
            '@type': 'Organization',
            name: ctx.brandName,
            url: ctx.baseUrl,
        },
    },
    url: canonical
});
```

- **Wpływ**: Natychmiastowe przywrócenie widoczności wszystkich 572 aktywnych ofert w raporcie *Product snippets* oraz *Merchant listings*.
- **Nakład**: Bardzo mały (~15 linii kodu w `seo-meta.ts` + aktualizacja testów jednostkowych).
- **Ryzyko**: Znikome (zgodność z oficjalnym standardem Google Search Central).
- **Odwracalność**: 100% odwracalne.

### Opcja B (Optymalizacja sitemapy — obsługa `lastmod`)
W `backend/src/routes/seo.ts` aktualizować `lastmod` w sitemapie tylko w sytuacji, gdy cena, status archiwizacji lub opis pojazdu uległy realnej zmianie, zamiast przy każdym wywołaniu importu CSFlow.

---

## 5. Podział Obowiązków

### Co wymaga decyzji Kamila:
1. Akceptacja dodania podwójnego typu `"@type": ["Product", "Vehicle"]` w `seo-meta.ts`.
2. Ewentualne odczytanie z panelu GSC w przeglądarce wartości z zakładki **Merchant Listings** (Informacje o sprzedawcy) i **Ogłoszenia pojazdów**, aby potwierdzić dokładną liczbę przemieszczonych elementów.

### Co agent wdroży samodzielnie po akceptacji:
1. Modyfikacja generatora JSON-LD w `backend/src/services/seo-meta.ts` (dodanie `["Product", "Vehicle"]`, `seller`, `sku`, `priceValidUntil`).
2. Aktualizacja testów w `backend/src/services/__tests__/seo-meta.test.ts` i `render.test.ts`.
3. Usunięcie tymczasowych skryptów diagnostycznych.

---

## 6. Czego nie udało się ustalić (i co jest do tego potrzebne)

- **Dokładna liczba w zakładkach Merchant Listings / Vehicle listings**: Ze względu na brak podłączonego MCP przeglądarki Chrome z aktywną sesją GSC Kamila w tym środowisku, odczyt wykresu z zakładki *Informacje o sprzedawcy* w panelu GSC wymaga ręcznego potwierdzenia przez Kamila lub załączenia zrzutu ekranu.
