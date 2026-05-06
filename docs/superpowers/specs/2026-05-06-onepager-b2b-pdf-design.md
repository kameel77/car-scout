# Onepager B2B z generowaniem PDF — Design

**Data:** 2026-05-06
**Status:** Design — oczekuje akceptacji przed wdrożeniem
**Brand:** carsalon (single-brand MVP)

---

## 1. Cel i kontekst

Wystawić publiczną stronę "onepager dla przedsiębiorców" z możliwością pobrania jednoklikowego, klikalnego pliku PDF z aktualnymi ofertami sprzedażowymi i wartościami merytorycznymi serwisu Carsalon (wybór pojazdu nowy/używany, finansowanie kredyt/leasing, wsparcie po szkodzie całkowitej jako partner TU Link4).

**Distribution model:** materiał marketingowy. Partner (Link4) pobiera PDF i dystrybuuje w mailingach do swoich klientów B2B. Linki w PDF prowadzą z powrotem do serwisu Carsalon z atrybucją UTM dla śledzenia źródła leadów.

**Audytorium PDF:** klienci B2B partnera (przedsiębiorcy poszukujący pojazdu nowego lub po szkodzie całkowitej).

---

## 2. Zakres i kluczowe decyzje

| Decyzja | Wybór | Powód |
|---|---|---|
| Selekcja ofert | Hybryda: domyślnie 6 ofert featured (sale only); opcjonalnie zawężenie przez `?ids=...` | Partner pobiera "wersję na dziś" lub skrojoną listę; reuse istniejącego `isFeatured` flag |
| Generowanie PDF | Server-side Puppeteer (`puppeteer-core` + `@sparticuz/chromium`) | Klikalne linki, jakość identyczna z preview, jednoklik download |
| Typ ofert | Tylko sprzedaż z ratami kredyt + leasing | Wynajem pominięty na MVP |
| Liczba ofert | 6 (grid 3×2) | Optymalne dla A4 |
| Logika doboru | `isFeatured = true` (sale only, `isArchived = false`), sortowanie `createdAt DESC`, fallback do najnowszych (`isFeatured` ignorowany, dalej `isArchived = false`) przy < 6 oflagowanych | Wykorzystanie istniejącego flagi `isFeatured` w schemacie listingów |
| Tracking | Hardcoded UTM-y `utm_source=partner_mailing&utm_medium=pdf&utm_campaign=link4` doszywane tylko w trybie `?print=1` | Single-partner MVP; multi-partner odłożony |
| Treść marketingowa | Hardcoded w komponencie React | Stabilna, zmiana = commit; admin UI odłożony do v2 |
| Dane kontaktowe | Te same co w `Footer` | Spójność, brak duplikacji źródła |
| Widoczność strony | Brak linku w Headerze (URL przekazywany partnerom poza UI) | Łatwiej dodać niż ukryć |
| Cache PDF | Redis 30 min TTL na default URL (bez `?ids=`); URL z `ids` bez cache | Default = współdzielony zasób; `?ids=` = rzadkie, niewarte logiki invalidacji |
| Endpoint | Publiczny, bez auth | MVP; rate-limit / token mogą być dodane później |

**Brand scope (out of scope na MVP):** Onepager renderuje się tylko w brandzie `carsalon`. Motolia nie jest obsługiwana.

---

## 3. Architektura

### 3.1 Frontend routing

| URL | Tryb | Dane |
|---|---|---|
| `/dla-firm` | Preview dla partnera | 6 featured ofert, Header/Footer widoczne, przycisk "Pobierz PDF" widoczny |
| `/dla-firm?ids=123,456` | Preview z zawężoną listą | Tylko podane ID-y (sale only, isPublished=true) |
| `/dla-firm?print=1` | Print mode (wewnętrzny dla Puppeteera) | Header/Footer/przycisk download ukryte, UTM-y doszyte do wszystkich linków |
| `/dla-firm?print=1&ids=...` | Print + zawężenie | Kombinacja powyższych |

Strona dostępna z każdego brandu, ale renderuje copy carsalon. (Brak guarda na brand — nie warto na MVP.)

### 3.2 Backend endpoint

```
GET /api/onepager/pdf?ids=<csv>
```

- Query: `ids` opcjonalne, comma-separated UUID
- Response success: `200 application/pdf`, `Content-Disposition: attachment; filename="carsalon-oferta-YYYY-MM-DD.pdf"`
- Response error: `400` (ids unparseable), `504` (Puppeteer timeout), `500` (browser crash)
- Cache: jeśli brak `ids` → klucz Redis `onepager:pdf:default`, TTL 1800s, zwracany jako buffer
- Internal flow: nawigacja Puppeteera do `${INTERNAL_FRONTEND_URL}/dla-firm?print=1[&ids=...]`, czeka na `[data-onepager-ready]`, `page.pdf({format:'A4'})`

### 3.3 Browser singleton

Plik `backend/src/services/puppeteer.ts`:
- Singleton `browserPromise: Promise<Browser> | null`
- Pierwszy request inicjalizuje browser przez `puppeteer.launch({args: chromium.args, executablePath: await chromium.executablePath()})`
- Cleanup przy `SIGTERM`
- Crash recovery: catch błędu "browser disconnected" → resetuje `browserPromise = null`, kolejny request odpala nowego browsera
- Warmup: opcjonalnie wywołane przy starcie serwera w `app.ts`, aby pierwszy real request nie czekał na cold start

### 3.4 Flow danych

```
Partner → /dla-firm (preview w przeglądarce)
       → klik "Pobierz PDF" → window.location = /api/onepager/pdf[?ids=...]
       → backend: cache hit? → return cached PDF
                  cache miss → Puppeteer → /dla-firm?print=1 (internal localhost)
                              → React renderuje → fetch /api/featured (sale only, limit 6)
                              → setAttribute('data-onepager-ready', 'true')
                              → page.pdf({format:'A4'}) → buffer
                              → redis.set('onepager:pdf:default', buffer, EX 1800) [tylko default]
       → response stream → przeglądarka pobiera plik
```

---

## 4. Struktura komponentów (frontend)

**Nowe pliki:**

| Plik | Cel |
|---|---|
| `src/pages/B2BOnepagerPage.tsx` | Strona główna; czyta `useSearchParams()` dla `ids` i `print`; warunkowo renderuje Header/Footer/PobierzPDF |
| `src/components/b2b/B2BHero.tsx` | Hero z logo, tytułem "Carsalon dla przedsiębiorców", podtytułem, badge "Partner TU Link4" |
| `src/components/b2b/B2BBenefitGrid.tsx` | 3-kolumnowy grid kafelków (Wybór pojazdu, Finansowanie, Szkoda całkowita); ikony lucide-react |
| `src/components/b2b/B2BOfferGrid.tsx` | Grid 3×2 ofert; używa hooka `useB2BOfferList` |
| `src/components/b2b/B2BListingCard.tsx` | Dedykowany kompaktowy card (zdjęcie, marka/model/rok, cena, rata kredyt, rata leasing, link "Zobacz ofertę") |
| `src/components/b2b/B2BCtaSection.tsx` | Sekcja kontaktowa (telefon/email z tego samego źródła co Footer) + link "Więcej o Carsalon" |
| `src/components/b2b/DownloadPdfButton.tsx` | Floating button w prawym dolnym rogu; navigation do `/api/onepager/pdf` z propagacją `?ids=` |
| `src/hooks/useB2BOfferList.ts` | Hook: fetch z nowego endpointa `/api/onepager/offers[?ids=...]` (server-side ogarnia featured + fallback + filtrowanie sale only) |
| `src/hooks/useTrackedUrl.ts` | Hook: w trybie `?print=1` zwraca URL z UTM-ami; inaczej zwraca czysty URL |
| `src/styles/b2b-onepager.print.css` | `@media print` rules: `@page { size: A4; margin: 12mm; }`, `print-color-adjust: exact`, ukrywanie `.no-print` |

**Reuse:**
- `BrandContext` — automatyczne CSS tokens dla kolorów (działa w Puppeteerze)
- Fonty `@fontsource/inter` i `@fontsource/outfit` — inlinuje w bundle, działa offline
- `useListingsByIds` (już istnieje)
- Schema Prisma `Listing.isFeatured` (już istnieje); istniejący endpoint `/api/featured` zwraca podział `{newCars, usedCars, rentals}` — nie używamy go bezpośrednio na onepagerze, dodajemy dedykowany `/api/onepager/offers` (sekcja 5.6)
- Dane kontaktowe — ten sam źródłowy hook/config co `Footer` (do weryfikacji w fazie implementacji — czy z BrandContext, settings API czy hardcoded w Footer)

### 4.1 Layout strony

```
┌────────────────────────────────────────────────────┐
│ [Header]  ← .no-print, ukryty w trybie ?print=1    │
├────────────────────────────────────────────────────┤
│ HERO: logo, tytuł, podtytuł, badge "Partner Link4" │
├────────────────────────────────────────────────────┤
│ BENEFITY (3 kafelki)                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│ │ Wybór    │ │ Finanso- │ │ Szkoda   │             │
│ │ pojazdu  │ │ wanie    │ │ całkowita│             │
│ └──────────┘ └──────────┘ └──────────┘             │
├────────────────────────────────────────────────────┤
│ AKTUALNE OFERTY (grid 3×2 kart)                    │
│ ┌──────┐┌──────┐┌──────┐                           │
│ │ Auto ││ Auto ││ Auto │                           │
│ └──────┘└──────┘└──────┘                           │
│ ┌──────┐┌──────┐┌──────┐                           │
│ │ Auto ││ Auto ││ Auto │                           │
│ └──────┘└──────┘└──────┘                           │
│ [Zobacz wszystkie oferty →]                        │
├────────────────────────────────────────────────────┤
│ CTA / KONTAKT                                      │
│ Tel: [from Footer]  Email: [from Footer]           │
│ [Więcej o Carsalon →]                              │
├────────────────────────────────────────────────────┤
│ [Footer]  ← .no-print, ukryty w trybie ?print=1    │
└────────────────────────────────────────────────────┘
                                          [Pobierz PDF] ← floating, .no-print
```

### 4.2 UTM injection

Hook `useTrackedUrl(url: string)`:

```typescript
const [params] = useSearchParams();
const isPrintMode = params.get('print') === '1';

if (!isPrintMode) return url;

const u = new URL(url, window.location.origin);
u.searchParams.set('utm_source', 'partner_mailing');
u.searchParams.set('utm_medium', 'pdf');
u.searchParams.set('utm_campaign', 'link4');
return u.toString();
```

Stosowany przez wszystkie linki klikalne na stronie: oferty, "Zobacz wszystkie", "Więcej o Carsalon", linki kontaktowe.

### 4.3 Sygnał "PDF ready"

W `B2BOnepagerPage.tsx`:

```tsx
useEffect(() => {
  if (!isLoading && allImagesLoaded) {
    document.body.setAttribute('data-onepager-ready', 'true');
  }
}, [isLoading, allImagesLoaded]);
```

`allImagesLoaded` — agregowany state z `B2BOfferGrid`, który tracking-uje `<img onLoad>` dla każdej karty. Puppeteer w `waitForSelector('[data-onepager-ready]', { timeout: 10000 })` czeka na ten attribute przed wystrzeleniem `page.pdf()`.

W trybie `?print=1` można dodatkowo wymusić eager loading (wyłączyć `loading="lazy"` dla obrazków ofert).

---

## 5. Backend — szczegóły implementacji

### 5.1 Dependencies

`backend/package.json`:
- `puppeteer-core` (^22.x — pinned do wersji kompatybilnej z `@sparticuz/chromium`)
- `@sparticuz/chromium` (^131.x lub odpowiadająca aktualnej `puppeteer-core`)

### 5.2 Dockerfile zmiany

W stage `runner` (po `apt-get install openssl curl`):

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      openssl curl \
      libnss3 libfontconfig1 libfreetype6 \
      fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

**Uwaga:** `@sparticuz/chromium` zawiera własne biblioteki low-level, ale wymaga shared libs systemowych (nss, fontconfig, freetype). `fonts-liberation` jako fallback dla fontów; `@fontsource/inter`/`outfit` w bundle frontend powinno być wystarczające.

### 5.3 Browser service

```typescript
// backend/src/services/puppeteer.ts
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) {
      browserPromise = null;
      return getBrowser();
    }
    return browser;
  } catch (e) {
    browserPromise = null;
    throw e;
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
```

W `app.ts`: `process.on('SIGTERM', closeBrowser)` + opcjonalny warmup w startup.

### 5.4 Route

```typescript
// backend/src/routes/onepager.ts
import { FastifyInstance } from 'fastify';
import { getBrowser } from '../services/puppeteer';

const CACHE_KEY = 'onepager:pdf:default';
const CACHE_TTL_SECONDS = 1800;

export async function onepagerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/onepager/pdf', async (req, reply) => {
    const { ids } = req.query as { ids?: string };
    
    // Walidacja: ids musi być csv UUID lub niezdefiniowane
    if (ids && !/^[\w-]+(,[\w-]+)*$/.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }
    
    // Cache hit (tylko default)
    if (!ids) {
      const cached = await fastify.redis.getBuffer(CACHE_KEY);
      if (cached) {
        return sendPdf(reply, cached);
      }
    }
    
    // Generate
    const internalUrl = `${process.env.INTERNAL_FRONTEND_URL}/dla-firm?print=1${ids ? `&ids=${encodeURIComponent(ids)}` : ''}`;
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
      await page.goto(internalUrl, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-onepager-ready]', { timeout: 10000 });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      
      if (!ids) {
        await fastify.redis.set(CACHE_KEY, pdf, 'EX', CACHE_TTL_SECONDS);
      }
      
      return sendPdf(reply, pdf);
    } catch (e: any) {
      fastify.log.error(e, 'PDF generation failed');
      const isTimeout = e.name === 'TimeoutError';
      return reply.code(isTimeout ? 504 : 500).send({ error: isTimeout ? 'PDF generation timeout' : 'PDF generation failed' });
    } finally {
      await page.close().catch(() => {});
    }
  });
}

function sendPdf(reply: any, buffer: Buffer) {
  const filename = `carsalon-oferta-${new Date().toISOString().slice(0, 10)}.pdf`;
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buffer);
}
```

### 5.5 Cache invalidation

W `backend/src/routes/featured.ts`, w endpoincie toggle (`POST /api/listings/:id/featured`) i `POST /api/rental-vehicles/:id/featured`, po `redis.del('featured:vehicles')` dorzucić:

```typescript
await fastify.redis.del('onepager:pdf:default');
```

### 5.6 Endpoint `/api/onepager/offers`

Nowy plik `backend/src/routes/onepager.ts` zawiera oba endpointy: `/api/onepager/offers` (JSON) i `/api/onepager/pdf` (PDF).

```
GET /api/onepager/offers?ids=<csv>
```

- Query: `ids` opcjonalne, comma-separated UUID
- Response: `{ offers: ListingDto[] }` (max 6 rekordów, z `dealer` include)
- Walidacja `ids`: jak w `/api/onepager/pdf` (regex), invalid → 400

Logika:

```typescript
if (ids) {
  // Fetch po ID-ach, sale only (rentalVehicle ignorowany).
  // Zachowuje kolejność z parametru.
  const offers = await prisma.listing.findMany({
    where: { id: { in: ids.split(',') }, isArchived: false },
    include: { dealer: true },
  });
  return { offers: sortByIdsOrder(offers, ids.split(',')) };
}

// Default: 6 featured sale, sortowane createdAt DESC
const featured = await prisma.listing.findMany({
  where: { isFeatured: true, isArchived: false },
  take: 6,
  orderBy: { createdAt: 'desc' },
  include: { dealer: true },
});

if (featured.length >= 6) {
  return { offers: featured };
}

// Fallback: featured + uzupełnij najnowszymi (z wyłączeniem już dodanych)
const fillCount = 6 - featured.length;
const filler = await prisma.listing.findMany({
  where: {
    isArchived: false,
    id: { notIn: featured.map(f => f.id) },
  },
  take: fillCount,
  orderBy: { createdAt: 'desc' },
  include: { dealer: true },
});

return { offers: [...featured, ...filler] };
```

**Uwaga:** Jeśli w schemacie istnieje pole listingów rozróżniające "tylko sprzedaż" vs inne typy (np. `listingType`, `isForRent`) — należy dodać do `where`. W oparciu o eksplorację `schema.prisma`: model `Listing` jest dla sprzedaży, `RentalVehicle` to osobny model — więc filtr brand-level "sale only" nie jest potrzebny, query po `Listing` z definicji jest sale-only.

### 5.7 Environment variables

Nowa zmienna: `INTERNAL_FRONTEND_URL`
- Dev: `http://localhost:5173` (lub aktualny port Vite dev server)
- Coolify prod: nazwa wewnętrznego serwisu Docker, np. `http://frontend:80` (do potwierdzenia w fazie 1 — sprawdzić `docker-compose.coolify.yml`)

Jeśli istnieje już `FRONTEND_URL` używana publicznie — `INTERNAL_FRONTEND_URL` to osobna zmienna (publiczny URL może mieć rate-limit / WAF / nie być osiągalny z wewnątrz kontenera).

---

## 6. Treść stron (hardcoded copy)

### 6.1 Hero
- **Tytuł:** "Carsalon dla przedsiębiorców"
- **Podtytuł:** "Kompleksowe wsparcie w wyborze pojazdu, finansowaniu i szybkim odzyskaniu auta po szkodzie całkowitej"
- **Badge:** "Partner TU Link4"

### 6.2 Benefity (3 kafelki)

| Ikona | Tytuł | Opis |
|---|---|---|
| `Car` | Wybór pojazdu | Pomożemy dobrać optymalny pojazd nowy lub używany — dopasowany do potrzeb i budżetu firmy. |
| `CreditCard` | Finansowanie kredyt i leasing | Zaproponujemy najlepsze warunki kredytu lub leasingu od sprawdzonych partnerów finansowych. |
| `Shield` | Szkoda całkowita — partner Link4 | Po szkodzie całkowitej szybko pomożemy znaleźć i sfinansować pojazd zastępczy. Carsalon jest oficjalnym partnerem TU Link4 w tym zakresie. |

### 6.3 CTA
- "Skontaktuj się z naszym zespołem"
- Telefon i email z tego samego źródła co Footer
- Przycisk "Więcej o Carsalon →" → link do `/` z UTM-ami

**Copy do finalnej redakcji przez handlowca przed pierwszym pobraniem PDF przez partnera.** Jeśli copy się zmieni — change w komponencie + commit + deploy. Admin UI poza MVP.

---

## 7. Testowanie

### 7.1 Unit (vitest)
- `B2BBenefitGrid` — render 3 kafelków z poprawnymi ikonami i tytułami
- `B2BOfferGrid` — z `ids` → `useListingsByIds`; bez `ids` → fetch z `/api/featured`
- `useTrackedUrl` — w trybie `?print=1` zwraca URL z UTM-ami; inaczej czysty URL
- `DownloadPdfButton` — klik wywołuje `window.location` z poprawnym query string

### 7.2 Integration backend (vitest + supertest)
- `GET /api/onepager/offers` zwraca dokładnie 6 ofert; gdy < 6 featured w DB, fallback uzupełnia z najnowszych (test z fixture'ami)
- `GET /api/onepager/offers?ids=A,B` zwraca tylko 2 oferty, w kolejności podanej w query
- `GET /api/onepager/offers?ids=<%>` (invalid format) zwraca 400
- `GET /api/onepager/pdf` zwraca `Content-Type: application/pdf`, niepusty buffer
- `GET /api/onepager/pdf?ids=<%>` (invalid format) zwraca 400
- Mock Puppeteera — sprawdza, że `page.goto` jest wywołane z `?print=1`
- Cache PDF — drugi request w 30 min nie wywołuje Puppeteera (mock + spy)
- Cache invalidation — po POST `/api/listings/:id/featured` klucze `featured:vehicles` i `onepager:pdf:default` znikają

### 7.3 Manualny QA (checklist przed mergem)
- [ ] `/dla-firm` — wszystkie sekcje renderują się, 6 ofert się ładuje, brand colors poprawne
- [ ] `/dla-firm?print=1` — Header/Footer/PobierzPDF ukryte, UTM-y widoczne w URL-ach przy najechaniu
- [ ] `/dla-firm?ids=<3 prawdziwe ID>` — tylko te 3 oferty
- [ ] Klik "Pobierz PDF" → plik się pobiera, otwiera się czytniku, layout poprawny
- [ ] W otwartym PDF: kliknięcie oferty → otwiera w przeglądarce, URL zawiera UTM-y
- [ ] Drugi request w ciągu 30 min — szybszy (cache hit, brak Puppeteer cold start)
- [ ] Po toggle featured w adminie → następny request generuje świeży PDF
- [ ] Edge case: 0 ofert featured i 0 najnowszych → onepager renderuje placeholder "Brak aktualnych ofert", PDF generuje się bez błędu

---

## 8. Plan wdrożenia

| # | Etap | Estymacja |
|---|------|---|
| 1 | Backend deps + Dockerfile (+`puppeteer-core`, `@sparticuz/chromium`, apt-get libs) + `puppeteer.ts` service | 2h |
| 2 | Backend routes `/api/onepager/offers` (JSON) + `/api/onepager/pdf` (PDF, bez cache) + walidacja + error handling | 3h |
| 3 | Frontend: route `/dla-firm` + `B2BOnepagerPage` + hardcoded copy + integracja z Footer kontakt | 3h |
| 4 | Frontend: `B2BListingCard` + `B2BOfferGrid` + hook `useB2BOfferList` (fetch z `/api/onepager/offers`) | 3h |
| 5 | Frontend: print mode (`?print=1`) + `useTrackedUrl` + `b2b-onepager.print.css` + `data-onepager-ready` | 2h |
| 6 | Backend: Redis cache 30 min + invalidation w `featured.ts` | 1h |
| 7 | Polish: `DownloadPdfButton` z loading state (sonner toast), edge case'y | 2h |
| 8 | Testy unit/integration + manualny QA wg checklisty | 3h |

**Razem: ~18h, czyli 2–3 dni roboczych.**

Każdy etap mergowalny osobno (etapy 1-2 bez frontu nie produkują obserwowalnej zmiany dla użytkownika, ale można je wymergować).

---

## 9. Ryzyka i mitigacje

| Ryzyko | Prawdopodobieństwo | Impact | Mitigacja |
|---|---|---|---|
| Fonty Inter/Outfit nie ładują się w Puppeteerze | Niskie | Średnie (estetyka PDF) | `@fontsource` inlinuje fonty w bundle. Test w fazie 5. Fallback: `fonts-liberation` w apt-get. |
| Coolify request timeout < cold start Puppeteera | Średnie | Wysokie (pierwszy request fails) | Warmup browser w `app.ts` przy starcie serwera. Rozważyć healthcheck który warmupuje. |
| `INTERNAL_FRONTEND_URL` brak/nieosiągalny z backendu | Średnie | Wysokie (PDF generation 100% fail) | Sprawdzić `docker-compose.coolify.yml` w fazie 1. Dodać do dokumentacji deploymentu. |
| Obrazki ofert ładowane lazy → puste w PDF | Średnie | Wysokie | Eager loading w `?print=1`. `data-onepager-ready` czeka na `<img onLoad>` dla każdej karty. |
| Cache stale po zmianie copy w komponencie | Niskie | Niskie | TTL 30 min — naturalna invalidacja. Manualny `redis-cli DEL onepager:pdf:default` w razie pilnej zmiany. |
| Puppeteer crash / memory leak przy długim uptime | Średnie | Średnie | Singleton z disconnect detection — auto-recreate. Coolify restart cyklicznie. |
| Bundle image +180 MB przekracza limit Coolify | Niskie | Wysokie | Sprawdzić limity w fazie 1. Backup plan: pełny `puppeteer` zamiast `puppeteer-core`+`@sparticuz/chromium` jest tańszy size-wise tylko marginalnie; alternatywą jest osobny serwis PDF (out of scope MVP). |

---

## 10. Out of scope (potencjalne v2)

- Multi-partner support (`/dla-firm/:partnerSlug`, partner-specific UTM, partner-specific branding/logo)
- Admin UI do edycji copy benefitów i CTA
- Wybór ręczny ofert na onepager przez admina (alternatywa dla `isFeatured`)
- Wsparcie wynajmu długoterminowego na onepagerze
- Onepager dla brandu Motolia
- Statystyki pobrań PDF (counter w Redis lub DB)
- Wersje językowe PDF (EN/DE)
- Token-protected URL (autoryzacja partnerów)
- Watermark partnera w PDF (logo Link4 obok logo carsalon)

---

## 11. Pytania otwarte do weryfikacji w fazie implementacji

1. **Skąd pochodzą dane kontaktowe Footera** (BrandContext config? settings API? hardcoded w komponencie?) — do potwierdzenia w fazie 3.
2. **`INTERNAL_FRONTEND_URL` w Coolify** — czy istnieje już taki internal hostname dla frontu, czy trzeba dodać do compose? — fazie 1.
3. **Limit RAM kontenera backend w Coolify** — Puppeteer może zjeść 200–500 MB peak. Sprawdzić.
4. **Coolify request timeout** — czy domyślnie wystarczy dla cold start Puppeteera (~5–8s)? Jeśli nie — trzeba zwiększyć w konfiguracji proxy.
5. **Redis client API w Fastify** — `fastify.redis.getBuffer(key)` vs inny pattern (sprawdzić jak są obsługiwane buffery w istniejącym kodzie).
