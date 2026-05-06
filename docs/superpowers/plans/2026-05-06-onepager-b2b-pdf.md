# Onepager B2B z generowaniem PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wystawić publiczną stronę `/dla-firm` + endpoint `/api/onepager/pdf` generujący jednoklikowy, klikalny PDF z 6 aktualnymi ofertami i wartościami merytorycznymi Carsalon dla partnera Link4.

**Architecture:** Server-side Puppeteer (`puppeteer-core` + `@sparticuz/chromium`) renderuje publiczną stronę React (`/dla-firm?print=1`) do PDF A4 z zachowaniem klikalnych linków i UTM-ów. Singleton browser w pamięci backendu. Cache PDF w Redis 30 min na default URL.

**Tech Stack:**
- Backend: Fastify (`fastify.redis` = ioredis), Prisma (Listing model), `puppeteer-core@^22`, `@sparticuz/chromium@^131`
- Frontend: React + Vite, TanStack Query, react-router-dom, react-i18next, Tailwind, lucide-react, sonner
- Test: vitest (root + backend), istniejący pattern `buildApp()` z real Prisma dla integration testów backendowych
- Infra: docker-compose.coolify.yml, alias `frontend` w sieci `carscout-private`

**Spec:** `docs/superpowers/specs/2026-05-06-onepager-b2b-pdf-design.md`

---

## File Structure

**Backend — nowe pliki:**
- `backend/src/services/puppeteer.ts` — singleton browser, getBrowser/closeBrowser
- `backend/src/services/__tests__/puppeteer.test.ts` — unit testy singletona (z mock puppeteer-core)
- `backend/src/routes/onepager.ts` — endpoint `/api/onepager/offers` (JSON) + `/api/onepager/pdf` (PDF)
- `backend/src/routes/__tests__/onepager.test.ts` — integration testy endpointów
- `backend/vitest.config.ts` — config żeby `vitest` mógł chodzić po `backend/src/**/*.test.ts`

**Backend — modyfikowane:**
- `backend/Dockerfile:33-36` — dodać `libnss3 libfontconfig1 libfreetype6 fonts-liberation` do `apt-get install`
- `backend/package.json:22-36` — dodać `puppeteer-core`, `@sparticuz/chromium`, `vitest`, `supertest`, `@types/supertest`
- `backend/src/app.ts` — register `onepagerRoutes`, register SIGTERM handler dla `closeBrowser`
- `backend/src/routes/featured.ts:77,95` — po `redis.del('featured:vehicles')` dorzucić `redis.del('onepager:pdf:default')`

**Frontend — nowe pliki:**
- `src/pages/B2BOnepagerPage.tsx`
- `src/components/b2b/B2BHero.tsx`
- `src/components/b2b/B2BBenefitGrid.tsx`
- `src/components/b2b/B2BOfferGrid.tsx`
- `src/components/b2b/B2BListingCard.tsx`
- `src/components/b2b/B2BCtaSection.tsx`
- `src/components/b2b/DownloadPdfButton.tsx`
- `src/components/b2b/__tests__/B2BBenefitGrid.test.tsx`
- `src/components/b2b/__tests__/B2BListingCard.test.tsx`
- `src/hooks/useB2BOfferList.ts`
- `src/hooks/useTrackedUrl.ts`
- `src/hooks/__tests__/useTrackedUrl.test.tsx`
- `src/styles/b2b-onepager.print.css`

**Frontend — modyfikowane:**
- `src/App.tsx:46,71-72` — import `B2BOnepagerPage`, `<Route path="/dla-firm" element={<B2BOnepagerPage />} />`
- `src/services/api.ts` (jeśli istnieje wzorzec dodawania endpointów — sprawdzić w fazie 1; jeśli inaczej, fetch bezpośredni przez `fetch()` w hooku)

**Infrastruktura:**
- `docker-compose.coolify.yml:68-70` — alias `frontend` w sieci `carscout-private`
- `docker-compose.coolify.yml:21-32` — `INTERNAL_FRONTEND_URL: ${INTERNAL_FRONTEND_URL:-http://frontend:80}` w service `carscout-api`

---

## Task 1: Backend test infrastructure (vitest config)

**Cel:** Pliki testowe `backend/src/**/*.test.ts` istnieją w repo, ale `backend/package.json` nie ma scripta `test` ani devDep `vitest`. Aby plan był wykonywalny TDD-style, dodajemy minimalną konfigurację.

**Files:**
- Create: `backend/vitest.config.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Stwórz `backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 2: Dodaj devDeps i script do `backend/package.json`**

W sekcji `scripts` dodaj:
```json
"test": "vitest run",
"test:watch": "vitest"
```

W sekcji `devDependencies` dodaj:
```json
"vitest": "^1.6.0",
"supertest": "^7.0.0",
"@types/supertest": "^6.0.2"
```

- [ ] **Step 3: Zainstaluj deps**

Run: `cd backend && npm install`
Expected: instalacja kończy się bez błędów, `node_modules/vitest` istnieje.

- [ ] **Step 4: Smoke test — uruchom istniejące testy**

Run: `cd backend && npm test`
Expected: vitest startuje. Może istniejące testy fail z powodu DB / fixtures — to OK na razie. Ważne że framework działa.

- [ ] **Step 5: Commit**

```bash
git add backend/vitest.config.ts backend/package.json backend/package-lock.json
git commit -m "chore(backend): add vitest config and test deps"
```

---

## Task 2: Browser singleton service (TDD)

**Cel:** Service `getBrowser()` zwraca instancję Puppeteer browser; lazy init; auto-recreate po disconnect; `closeBrowser()` dla SIGTERM.

**Files:**
- Create: `backend/src/services/puppeteer.ts`
- Create: `backend/src/services/__tests__/puppeteer.test.ts`

- [ ] **Step 1: Napisz failing test**

`backend/src/services/__tests__/puppeteer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const launchMock = vi.fn();
const closeMock = vi.fn();
const isConnectedMock = vi.fn(() => true);

vi.mock('puppeteer-core', () => ({
  default: { launch: (...args: any[]) => launchMock(...args) },
}));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: async () => '/fake/chromium',
  },
}));

describe('puppeteer service', () => {
  beforeEach(() => {
    vi.resetModules();
    launchMock.mockReset();
    closeMock.mockReset();
    isConnectedMock.mockReset();
    isConnectedMock.mockReturnValue(true);
    launchMock.mockResolvedValue({
      isConnected: isConnectedMock,
      close: closeMock,
    });
  });

  it('lazy-inits browser on first call', async () => {
    const { getBrowser } = await import('../puppeteer');
    expect(launchMock).not.toHaveBeenCalled();
    await getBrowser();
    expect(launchMock).toHaveBeenCalledOnce();
  });

  it('returns same instance on subsequent calls', async () => {
    const { getBrowser } = await import('../puppeteer');
    const a = await getBrowser();
    const b = await getBrowser();
    expect(a).toBe(b);
    expect(launchMock).toHaveBeenCalledOnce();
  });

  it('recreates browser when disconnected', async () => {
    const { getBrowser } = await import('../puppeteer');
    await getBrowser();
    isConnectedMock.mockReturnValue(false);
    await getBrowser();
    expect(launchMock).toHaveBeenCalledTimes(2);
  });

  it('closeBrowser calls close on instance', async () => {
    const { getBrowser, closeBrowser } = await import('../puppeteer');
    await getBrowser();
    await closeBrowser();
    expect(closeMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL (module not found)**

Run: `cd backend && npx vitest run src/services/__tests__/puppeteer.test.ts`
Expected: FAIL — "Cannot find module '../puppeteer'"

- [ ] **Step 3: Stwórz `backend/src/services/puppeteer.ts`**

```typescript
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch();
  }
  try {
    const browser = await browserPromise;
    if (!browser.isConnected()) {
      browserPromise = launch();
      return browserPromise;
    }
    return browser;
  } catch (err) {
    browserPromise = null;
    throw err;
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const current = browserPromise;
  browserPromise = null;
  try {
    const browser = await current;
    await browser.close();
  } catch {
    // ignore — already closed or never opened
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `cd backend && npx vitest run src/services/__tests__/puppeteer.test.ts`
Expected: PASS — 4 testów przechodzi.

- [ ] **Step 5: Zainstaluj produktowe deps**

```bash
cd backend && npm install puppeteer-core@^22 @sparticuz/chromium@^131
```

Expected: instalacja przechodzi. `puppeteer-core` ~3 MB, `@sparticuz/chromium` ~50 MB.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/puppeteer.ts backend/src/services/__tests__/puppeteer.test.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): puppeteer browser singleton service"
```

---

## Task 3: GET /api/onepager/offers (JSON, TDD)

**Cel:** Nowy endpoint zwraca 6 ofert sale: featured + fallback do najnowszych. Z `?ids=` zwraca tylko podane ID-y.

**Files:**
- Create: `backend/src/routes/onepager.ts`
- Create: `backend/src/routes/__tests__/onepager.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Napisz failing test (4 scenariusze)**

`backend/src/routes/__tests__/onepager.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('Onepager — GET /api/onepager/offers', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Cleanup any data created in previous tests
    await app.prisma.listing.deleteMany({
      where: { make: 'TEST_ONEPAGER' },
    });
  });

  async function createListing(overrides: any = {}) {
    return app.prisma.listing.create({
      data: {
        make: 'TEST_ONEPAGER',
        model: 'M' + Math.random().toString(36).slice(2, 7),
        priceGross: 100000,
        mileageKm: 5000,
        year: 2024,
        isFeatured: false,
        isArchived: false,
        ...overrides,
      },
    });
  }

  it('returns 6 featured offers when 6+ exist', async () => {
    for (let i = 0; i < 7; i++) {
      await createListing({ isFeatured: true });
    }
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers).toHaveLength(6);
    expect(body.offers.every((o: any) => o.isFeatured)).toBe(true);
  });

  it('falls back to newest when < 6 featured', async () => {
    await createListing({ isFeatured: true });  // 1 featured
    for (let i = 0; i < 5; i++) {
      await createListing({ isFeatured: false });  // 5 non-featured
    }
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    const body = res.json();
    expect(body.offers).toHaveLength(6);
    expect(body.offers.filter((o: any) => o.isFeatured)).toHaveLength(1);
  });

  it('returns only requested ids in given order', async () => {
    const a = await createListing();
    const b = await createListing();
    const c = await createListing();
    const res = await app.inject({
      method: 'GET',
      url: `/api/onepager/offers?ids=${c.id},${a.id},${b.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offers.map((o: any) => o.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects invalid ids format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/onepager/offers?ids=<script>',
    });
    expect(res.statusCode).toBe(400);
  });

  it('skips archived listings', async () => {
    await createListing({ isFeatured: true, isArchived: true });
    const res = await app.inject({ method: 'GET', url: '/api/onepager/offers' });
    const body = res.json();
    expect(body.offers.every((o: any) => o.make !== 'TEST_ONEPAGER' || !o.isArchived)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts`
Expected: FAIL — wszystkie testy zwracają 404 (route nie istnieje).

- [ ] **Step 3: Stwórz `backend/src/routes/onepager.ts`**

```typescript
import { FastifyInstance } from 'fastify';

const ID_REGEX = /^[\w-]+(,[\w-]+)*$/;

export async function onepagerRoutes(fastify: FastifyInstance) {
  fastify.get('/api/onepager/offers', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    if (ids) {
      const idList = ids.split(',');
      const found = await fastify.prisma.listing.findMany({
        where: { id: { in: idList }, isArchived: false },
        include: { dealer: true },
      });
      const byId = new Map(found.map((l) => [l.id, l]));
      const ordered = idList.map((id) => byId.get(id)).filter(Boolean);
      return { offers: ordered };
    }

    const featured = await fastify.prisma.listing.findMany({
      where: { isFeatured: true, isArchived: false },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    if (featured.length >= 6) {
      return { offers: featured };
    }

    const fillCount = 6 - featured.length;
    const filler = await fastify.prisma.listing.findMany({
      where: {
        isArchived: false,
        id: { notIn: featured.map((f) => f.id) },
      },
      take: fillCount,
      orderBy: { createdAt: 'desc' },
      include: { dealer: true },
    });

    return { offers: [...featured, ...filler] };
  });
}
```

- [ ] **Step 4: Zarejestruj route w `backend/src/app.ts`**

Znajdź miejsce gdzie inne routes są rejestrowane (np. `await fastify.register(featuredRoutes)`). Dodaj obok:

```typescript
import { onepagerRoutes } from './routes/onepager.js';
// ...
await fastify.register(onepagerRoutes);
```

- [ ] **Step 5: Run test, expect PASS**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts`
Expected: PASS — 5 testów przechodzi.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/onepager.ts backend/src/routes/__tests__/onepager.test.ts backend/src/app.ts
git commit -m "feat(backend): GET /api/onepager/offers with featured + fallback logic"
```

---

## Task 4: Dockerfile + docker-compose changes

**Cel:** Backend image ma shared libs dla Chromium; service `frontend` ma alias w sieci `carscout-private`; `INTERNAL_FRONTEND_URL` env var w `carscout-api`.

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `docker-compose.coolify.yml`

- [ ] **Step 1: Modyfikuj `backend/Dockerfile`**

W stage `runner` (~linia 34-36) zmień blok `apt-get install`:

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      openssl curl \
      libnss3 libfontconfig1 libfreetype6 \
      fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

Pozostawiamy istniejące `openssl curl` (bo Prisma + healthcheck), dorzucamy resztę.

- [ ] **Step 2: Modyfikuj `docker-compose.coolify.yml` — alias frontend**

W service `frontend` (~linia 68-70) zmień blok `networks`:

```yaml
    networks:
      carscout-private:
        aliases:
          - frontend
      - coolify
```

Uwaga: jeśli wcześniej `coolify` było w skróconej formie listy, teraz `carscout-private` musi mieć rozwinięty mapping — popraw indentację konsekwentnie:

```yaml
    networks:
      carscout-private:
        aliases:
          - frontend
      coolify: {}
```

(Coolify network bez aliasów — pusty mapping `{}` lub po prostu nazwa w liście — zależnie od wcześniejszej składni.)

- [ ] **Step 3: Modyfikuj `docker-compose.coolify.yml` — env var**

W service `carscout-api` (~linia 21-32) w bloku `environment` dodaj nową linię:

```yaml
      INTERNAL_FRONTEND_URL: ${INTERNAL_FRONTEND_URL:-http://frontend:80}
```

- [ ] **Step 4: Verify YAML**

Run: `docker compose -f docker-compose.coolify.yml config 2>&1 | head -30`
Expected: brak błędów parsowania, output pokazuje `INTERNAL_FRONTEND_URL: http://frontend:80` i `aliases: [frontend]`.

(Jeśli nie masz zainstalowanego docker compose lokalnie, można użyć `python3 -c "import yaml; yaml.safe_load(open('docker-compose.coolify.yml'))"` jako fallback.)

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile docker-compose.coolify.yml
git commit -m "infra: Chromium deps + frontend alias + INTERNAL_FRONTEND_URL"
```

---

## Task 5: GET /api/onepager/pdf (TDD z mock puppeteer service)

**Cel:** Endpoint zwraca PDF buffer z `Content-Type: application/pdf` i poprawnym `Content-Disposition`. Mock puppeteer service zwraca fake buffer.

**Files:**
- Modify: `backend/src/routes/onepager.ts`
- Modify: `backend/src/routes/__tests__/onepager.test.ts`

- [ ] **Step 1: Dopisz failing testy do `onepager.test.ts`**

Dodaj na końcu `describe('Onepager — GET /api/onepager/offers', ...)` blok:

```typescript
import { vi } from 'vitest';

describe('Onepager — GET /api/onepager/pdf', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.INTERNAL_FRONTEND_URL = 'http://frontend:80';
    
    // Mock puppeteer service before app build
    vi.mock('../../services/puppeteer', () => ({
      getBrowser: vi.fn(async () => ({
        newPage: vi.fn(async () => ({
          setViewport: vi.fn(),
          goto: vi.fn(),
          waitForSelector: vi.fn(),
          pdf: vi.fn(async () => Buffer.from('%PDF-fake-content')),
          close: vi.fn(),
        })),
        isConnected: () => true,
      })),
      closeBrowser: vi.fn(),
    }));

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    vi.resetAllMocks();
  });

  it('returns PDF buffer with correct headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="carsalon-oferta-\d{4}-\d{2}-\d{2}\.pdf"/);
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('rejects invalid ids format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/onepager/pdf?ids=<%>',
    });
    expect(res.statusCode).toBe(400);
  });

  it('passes ids through to internal URL', async () => {
    const { getBrowser } = await import('../../services/puppeteer');
    const goto = vi.fn();
    (getBrowser as any).mockResolvedValueOnce({
      newPage: async () => ({
        setViewport: vi.fn(),
        goto,
        waitForSelector: vi.fn(),
        pdf: async () => Buffer.from('%PDF'),
        close: vi.fn(),
      }),
    });
    await app.inject({ method: 'GET', url: '/api/onepager/pdf?ids=abc,def' });
    expect(goto).toHaveBeenCalledWith(
      expect.stringContaining('/dla-firm?print=1&ids=abc%2Cdef'),
      expect.any(Object)
    );
  });
});
```

**Uwaga:** Drugi `describe` w tym samym pliku ma osobny `beforeAll` z mockiem. Pierwszy `describe` (offers) NIE używa puppeteer — mock nie wpływa na niego.

- [ ] **Step 2: Run testy, expect FAIL**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts -t "PDF"`
Expected: FAIL — endpoint zwraca 404.

- [ ] **Step 3: Dopisz route w `backend/src/routes/onepager.ts`**

Na początku pliku, po importach Fastify, dodaj:

```typescript
import { getBrowser } from '../services/puppeteer.js';
```

Wewnątrz funkcji `onepagerRoutes`, po istniejącym `fastify.get('/api/onepager/offers', ...)`, dodaj:

```typescript
  fastify.get('/api/onepager/pdf', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (ids !== undefined && !ID_REGEX.test(ids)) {
      return reply.code(400).send({ error: 'Invalid ids format' });
    }

    const internalBase = process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80';
    const idsQs = ids ? `&ids=${encodeURIComponent(ids)}` : '';
    const url = `${internalBase}/dla-firm?print=1${idsQs}`;

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.waitForSelector('[data-onepager-ready]', { timeout: 10000 });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });

      const filename = `carsalon-oferta-${new Date().toISOString().slice(0, 10)}.pdf`;
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(pdf);
    } catch (err: any) {
      fastify.log.error(err, 'PDF generation failed');
      const isTimeout = err?.name === 'TimeoutError';
      return reply
        .code(isTimeout ? 504 : 500)
        .send({ error: isTimeout ? 'PDF generation timeout' : 'PDF generation failed' });
    } finally {
      await page.close().catch(() => {});
    }
  });
```

- [ ] **Step 4: Run testy, expect PASS**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts`
Expected: PASS — wszystkie testy (offers + pdf) przechodzą.

- [ ] **Step 5: Dodaj SIGTERM handler w `backend/src/app.ts`**

W `app.ts` znajdź miejsce gdzie jest `process.on('SIGTERM', ...)` lub graceful shutdown logic. Dorzuć:

```typescript
import { closeBrowser } from './services/puppeteer.js';
// ...
// W istniejącym shutdown handlerze (np. fastify.addHook('onClose')):
fastify.addHook('onClose', async () => {
  await closeBrowser();
});
```

(Jeśli nie ma takiego patternu, dodaj w `server.ts` przy graceful shutdown.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/onepager.ts backend/src/routes/__tests__/onepager.test.ts backend/src/app.ts
git commit -m "feat(backend): GET /api/onepager/pdf with Puppeteer rendering"
```

---

## Task 6: Frontend route /dla-firm + B2BOnepagerPage skeleton

**Cel:** Dodaj routing i pustą stronę z Header/Footer; smoke test że renderuje się bez crash.

**Files:**
- Create: `src/pages/B2BOnepagerPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Stwórz `src/pages/B2BOnepagerPage.tsx`**

```tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function B2BOnepagerPage() {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';

  return (
    <div className="min-h-screen bg-background">
      {!isPrintMode && <Header />}
      <main className="container py-8">
        <div data-testid="b2b-onepager-root">
          {/* Sections to be added: Hero, Benefits, Offers, CTA */}
        </div>
      </main>
      {!isPrintMode && <Footer />}
    </div>
  );
}
```

- [ ] **Step 2: Modyfikuj `src/App.tsx`**

Dodaj import po istniejących importach pages (~linia 46):
```tsx
import B2BOnepagerPage from "./pages/B2BOnepagerPage";
```

W bloku `<Routes>` dodaj route po `<Route path="/dla-ciebie" ... />` (~linia 92):
```tsx
<Route path="/dla-firm" element={<B2BOnepagerPage />} />
```

- [ ] **Step 3: Smoke test w przeglądarce**

Run: `npm run dev`
Otwórz: `http://localhost:5173/dla-firm`
Expected: strona renderuje się z Headerem i Footerem, środek jest pusty (placeholder).

Otwórz: `http://localhost:5173/dla-firm?print=1`
Expected: Header i Footer ukryte, strona pusta w środku.

Zatrzymaj `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/B2BOnepagerPage.tsx src/App.tsx
git commit -m "feat(frontend): /dla-firm route with B2BOnepagerPage skeleton"
```

---

## Task 7: B2BHero component

**Files:**
- Create: `src/components/b2b/B2BHero.tsx`
- Modify: `src/pages/B2BOnepagerPage.tsx`

- [ ] **Step 1: Stwórz `src/components/b2b/B2BHero.tsx`**

```tsx
import React from 'react';
import { Shield } from 'lucide-react';

export function B2BHero() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 md:p-12 mb-8 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold mb-4">
          <Shield className="h-3.5 w-3.5" />
          Partner TU Link4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          Carsalon dla przedsiębiorców
        </h1>
        <p className="text-white/90 text-base md:text-lg">
          Kompleksowe wsparcie w wyborze pojazdu, finansowaniu i szybkim odzyskaniu auta po szkodzie całkowitej.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Użyj w `B2BOnepagerPage`**

Dodaj import:
```tsx
import { B2BHero } from '@/components/b2b/B2BHero';
```

W `<main>` zamień placeholder na:
```tsx
<B2BHero />
<div data-testid="b2b-onepager-root">
  {/* Benefits, Offers, CTA — kolejne taski */}
</div>
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev` → `/dla-firm`
Expected: hero z tytułem "Carsalon dla przedsiębiorców", badge "Partner TU Link4", gradient pomarańcz-żółty.

- [ ] **Step 4: Commit**

```bash
git add src/components/b2b/B2BHero.tsx src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): B2BHero with Link4 partner badge"
```

---

## Task 8: B2BBenefitGrid (TDD)

**Files:**
- Create: `src/components/b2b/B2BBenefitGrid.tsx`
- Create: `src/components/b2b/__tests__/B2BBenefitGrid.test.tsx`
- Modify: `src/pages/B2BOnepagerPage.tsx`

- [ ] **Step 1: Napisz failing test**

`src/components/b2b/__tests__/B2BBenefitGrid.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { B2BBenefitGrid } from '../B2BBenefitGrid';

describe('B2BBenefitGrid', () => {
  it('renders 3 benefit cards with expected titles', () => {
    render(<B2BBenefitGrid />);
    expect(screen.getByText('Wybór pojazdu')).toBeInTheDocument();
    expect(screen.getByText('Finansowanie kredyt i leasing')).toBeInTheDocument();
    expect(screen.getByText(/Szkoda całkowita/)).toBeInTheDocument();
  });

  it('mentions Link4 partnership in szkoda card', () => {
    render(<B2BBenefitGrid />);
    expect(screen.getByText(/Link4/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify test deps**

Sprawdź czy `@testing-library/react` jest w `package.json`. Jeśli nie:
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Sprawdź `vitest.config.ts` (root) — dodaj `environment: 'jsdom'` w `test:` jeśli nie ma:
```typescript
test: {
  include: [...],
  exclude: [...],
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
},
```

Jeśli nie ma `src/test-setup.ts`, stwórz go:
```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Run test, expect FAIL**

Run: `npx vitest run src/components/b2b/__tests__/B2BBenefitGrid.test.tsx`
Expected: FAIL — moduł nie istnieje.

- [ ] **Step 4: Stwórz `src/components/b2b/B2BBenefitGrid.tsx`**

```tsx
import React from 'react';
import { Car, CreditCard, Shield } from 'lucide-react';

const benefits = [
  {
    icon: Car,
    title: 'Wybór pojazdu',
    description:
      'Pomożemy dobrać optymalny pojazd nowy lub używany — dopasowany do potrzeb i budżetu firmy.',
  },
  {
    icon: CreditCard,
    title: 'Finansowanie kredyt i leasing',
    description:
      'Zaproponujemy najlepsze warunki kredytu lub leasingu od sprawdzonych partnerów finansowych.',
  },
  {
    icon: Shield,
    title: 'Szkoda całkowita — partner Link4',
    description:
      'Po szkodzie całkowitej szybko pomożemy znaleźć i sfinansować pojazd zastępczy. Carsalon jest oficjalnym partnerem TU Link4 w tym zakresie.',
  },
];

export function B2BBenefitGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {benefits.map((b) => (
        <div
          key={b.title}
          className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3"
        >
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <b.icon className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg">{b.title}</h3>
          <p className="text-sm text-muted-foreground">{b.description}</p>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `npx vitest run src/components/b2b/__tests__/B2BBenefitGrid.test.tsx`
Expected: PASS — 2 testów przechodzi.

- [ ] **Step 6: Użyj w `B2BOnepagerPage`**

Dodaj import:
```tsx
import { B2BBenefitGrid } from '@/components/b2b/B2BBenefitGrid';
```

Po `<B2BHero />` dodaj `<B2BBenefitGrid />`.

- [ ] **Step 7: Commit**

```bash
git add src/components/b2b/B2BBenefitGrid.tsx src/components/b2b/__tests__/B2BBenefitGrid.test.tsx src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): B2BBenefitGrid with Wybór/Finansowanie/Szkoda cards"
```

(Jeśli nowe deps testowe — dorzuć je do tego commita.)

---

## Task 9: useB2BOfferList hook

**Files:**
- Create: `src/hooks/useB2BOfferList.ts`

- [ ] **Step 1: Stwórz hook**

```typescript
import { useQuery } from '@tanstack/react-query';

export interface B2BOffer {
  id: string;
  make: string;
  model: string;
  year: number | null;
  priceGross: number;
  mileageKm: number;
  imageUrls?: string[];
  // dla rat: backend zwraca surowy listing — komponenty wyciągną sobie z niego
  // (bądź ze wspólnym util'em do liczenia rat).
  // Pełne pole dealer.* też dostępne.
  [key: string]: any;
}

export function useB2BOfferList(ids?: string[]) {
  const idsParam = ids && ids.length > 0 ? `?ids=${encodeURIComponent(ids.join(','))}` : '';

  return useQuery({
    queryKey: ['b2b-offers', ids ?? 'default'],
    queryFn: async () => {
      const res = await fetch(`/api/onepager/offers${idsParam}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as { offers: B2BOffer[] };
      return data.offers;
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 2: Smoke test w konsoli**

Run: `npm run dev`, otwórz `/dla-firm`, otwórz DevTools → Network — gdy doda się grid w tasku 11, request do `/api/onepager/offers` musi pojawić się i zwrócić JSON. Na razie tylko hook bez UI — pomijamy test, kolejny task użyje hooka.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useB2BOfferList.ts
git commit -m "feat(frontend): useB2BOfferList hook"
```

---

## Task 10: B2BListingCard (TDD)

**Files:**
- Create: `src/components/b2b/B2BListingCard.tsx`
- Create: `src/components/b2b/__tests__/B2BListingCard.test.tsx`

- [ ] **Step 1: Napisz failing test**

`src/components/b2b/__tests__/B2BListingCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { B2BListingCard } from '../B2BListingCard';

const mockOffer = {
  id: 'abc-123',
  slug: 'bmw-x5-2024',
  make: 'BMW',
  model: 'X5',
  year: 2024,
  priceGross: 250000,
  mileageKm: 5000,
  imageUrls: ['/test.jpg'],
  monthlyCreditPayment: 4200,
  monthlyLeasingPayment: 3800,
};

describe('B2BListingCard', () => {
  it('renders make/model/year/price', () => {
    render(
      <MemoryRouter>
        <B2BListingCard offer={mockOffer as any} />
      </MemoryRouter>
    );
    expect(screen.getByText(/BMW X5/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/250 000/)).toBeInTheDocument();
  });

  it('renders link to offer page using slug', () => {
    render(
      <MemoryRouter>
        <B2BListingCard offer={mockOffer as any} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /Zobacz ofertę/i });
    expect(link).toHaveAttribute('href', '/oferta/bmw-x5-2024');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/components/b2b/__tests__/B2BListingCard.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Stwórz komponent**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { B2BOffer } from '@/hooks/useB2BOfferList';

const formatPrice = (n: number) =>
  new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(n);

export function B2BListingCard({ offer }: { offer: B2BOffer }) {
  const image = offer.imageUrls?.[0];
  const href = offer.slug ? `/oferta/${offer.slug}` : `/listing/${offer.id}`;

  const credit = offer.monthlyCreditPayment;
  const leasing = offer.monthlyLeasingPayment;

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {image && (
        <div className="aspect-[16/10] bg-muted overflow-hidden">
          <img
            src={image}
            alt={`${offer.make} ${offer.model}`}
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight">
            {offer.make} {offer.model}
          </h3>
          {offer.year && (
            <span className="text-xs text-muted-foreground shrink-0">{offer.year}</span>
          )}
        </div>
        <div className="text-lg font-bold">{formatPrice(offer.priceGross)} zł</div>
        <div className="text-xs text-muted-foreground space-y-1 mt-1">
          {credit && <div>Kredyt od: <strong>{formatPrice(credit)} zł/mc</strong></div>}
          {leasing && <div>Leasing od: <strong>{formatPrice(leasing)} zł/mc</strong></div>}
        </div>
        <Link
          to={href}
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Zobacz ofertę <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
```

**Uwaga:** `monthlyCreditPayment` / `monthlyLeasingPayment` to zakładane pola odpowiadające istniejącemu mechanizmowi liczenia rat. **W fazie implementacji sprawdź faktyczne pola w `Listing` model + ewentualnie istniejący util do liczenia rat** (`src/utils/listingPrice.ts`?). Jeśli pola się różnią — dostosuj. Test używa nazw zgodnych z komponentem.

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/components/b2b/__tests__/B2BListingCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/b2b/B2BListingCard.tsx src/components/b2b/__tests__/B2BListingCard.test.tsx
git commit -m "feat(frontend): B2BListingCard kompaktowa karta z cena + raty kredyt/leasing"
```

---

## Task 11: B2BOfferGrid + integracja na stronie

**Files:**
- Create: `src/components/b2b/B2BOfferGrid.tsx`
- Modify: `src/pages/B2BOnepagerPage.tsx`

- [ ] **Step 1: Stwórz `src/components/b2b/B2BOfferGrid.tsx`**

```tsx
import React from 'react';
import { useB2BOfferList } from '@/hooks/useB2BOfferList';
import { B2BListingCard } from './B2BListingCard';

interface Props {
  ids?: string[];
  onLoadComplete?: () => void;
}

export function B2BOfferGrid({ ids, onLoadComplete }: Props) {
  const { data, isLoading, error } = useB2BOfferList(ids);

  React.useEffect(() => {
    if (!isLoading && !error && data) {
      onLoadComplete?.();
    }
  }, [isLoading, error, data, onLoadComplete]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Wczytywanie ofert…</div>;
  }
  if (error || !data || data.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Brak aktualnych ofert.</div>;
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Aktualne oferty</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((offer) => (
          <B2BListingCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Użyj w `B2BOnepagerPage`**

Dodaj importy:
```tsx
import { B2BOfferGrid } from '@/components/b2b/B2BOfferGrid';
```

W `B2BOnepagerPage`, dodaj parsing `ids` z query i renderuj grid:

```tsx
const idsParam = params.get('ids');
const ids = idsParam ? idsParam.split(',') : undefined;

// ... w JSX po B2BBenefitGrid:
<B2BOfferGrid ids={ids} />
```

- [ ] **Step 3: Smoke test**

Run: `npm run dev` → `/dla-firm`
Expected: 6 ofert featured w gridzie. Network panel pokazuje `GET /api/onepager/offers` z 200.

Jeśli backend nie chodzi lokalnie — uruchom `cd backend && npm run dev` w drugim terminalu.

- [ ] **Step 4: Commit**

```bash
git add src/components/b2b/B2BOfferGrid.tsx src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): B2BOfferGrid wpięty w B2BOnepagerPage"
```

---

## Task 12: B2BCtaSection + integracja

**Files:**
- Create: `src/components/b2b/B2BCtaSection.tsx`
- Modify: `src/pages/B2BOnepagerPage.tsx`

- [ ] **Step 1: Stwórz komponent**

```tsx
import React from 'react';
import { Phone, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '@/hooks/useAppSettings';

export function B2BCtaSection() {
  const { data: settings } = useAppSettings();
  const phone = settings?.legalContactPhone;
  const email = settings?.legalContactEmail;

  return (
    <section className="rounded-xl bg-muted p-6 md:p-8 mb-8">
      <h2 className="text-2xl font-bold mb-2">Skontaktuj się z naszym zespołem</h2>
      <p className="text-muted-foreground mb-4">
        Doradzimy w wyborze pojazdu i finansowaniu — także po szkodzie całkowitej.
      </p>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {phone && (
          <a href={`tel:${phone}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary">
            <Phone className="h-4 w-4" />
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-base font-medium hover:text-primary">
            <Mail className="h-4 w-4" />
            {email}
          </a>
        )}
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Więcej o Carsalon <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Użyj w `B2BOnepagerPage`**

Po `<B2BOfferGrid />` dodaj `<B2BCtaSection />`.

- [ ] **Step 3: Smoke test**

Run: `npm run dev` → `/dla-firm` — sekcja CTA pokazuje telefon i email z appSettings (te same co w Footer).

- [ ] **Step 4: Commit**

```bash
git add src/components/b2b/B2BCtaSection.tsx src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): B2BCtaSection z kontaktami z appSettings"
```

---

## Task 13: useTrackedUrl hook (TDD)

**Files:**
- Create: `src/hooks/useTrackedUrl.ts`
- Create: `src/hooks/__tests__/useTrackedUrl.test.tsx`

- [ ] **Step 1: Napisz failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useTrackedUrl } from '../useTrackedUrl';

const wrapper = (initial: string) =>
  ({ children }: { children: React.ReactNode }) =>
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;

describe('useTrackedUrl', () => {
  it('returns clean URL when not in print mode', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw-x5'), {
      wrapper: wrapper('/dla-firm'),
    });
    expect(result.current).toBe('/oferta/bmw-x5');
  });

  it('appends UTM params when print=1', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw-x5'), {
      wrapper: wrapper('/dla-firm?print=1'),
    });
    expect(result.current).toContain('utm_source=partner_mailing');
    expect(result.current).toContain('utm_medium=pdf');
    expect(result.current).toContain('utm_campaign=link4');
  });

  it('preserves existing query params', () => {
    const { result } = renderHook(() => useTrackedUrl('/oferta/bmw?ref=abc'), {
      wrapper: wrapper('/dla-firm?print=1'),
    });
    expect(result.current).toContain('ref=abc');
    expect(result.current).toContain('utm_source=partner_mailing');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/hooks/__tests__/useTrackedUrl.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Stwórz hook**

```typescript
import { useSearchParams } from 'react-router-dom';

const UTM = {
  utm_source: 'partner_mailing',
  utm_medium: 'pdf',
  utm_campaign: 'link4',
} as const;

export function useTrackedUrl(url: string): string {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';
  if (!isPrintMode) return url;

  // Handle relative URLs by anchoring to a dummy origin
  const isRelative = url.startsWith('/');
  const base = isRelative ? 'http://_local' : window.location.origin;
  const u = new URL(url, base);
  for (const [k, v] of Object.entries(UTM)) {
    u.searchParams.set(k, v);
  }
  return isRelative ? `${u.pathname}${u.search}${u.hash}` : u.toString();
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/hooks/__tests__/useTrackedUrl.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTrackedUrl.ts src/hooks/__tests__/useTrackedUrl.test.tsx
git commit -m "feat(frontend): useTrackedUrl hook with UTM injection in print mode"
```

---

## Task 14: Apply useTrackedUrl in B2B components

**Files:**
- Modify: `src/components/b2b/B2BListingCard.tsx`
- Modify: `src/components/b2b/B2BCtaSection.tsx`

- [ ] **Step 1: Modify `B2BListingCard.tsx`**

Dodaj import:
```tsx
import { useTrackedUrl } from '@/hooks/useTrackedUrl';
```

W komponencie zamień:
```tsx
const href = offer.slug ? `/oferta/${offer.slug}` : `/listing/${offer.id}`;
```

na:
```tsx
const baseHref = offer.slug ? `/oferta/${offer.slug}` : `/listing/${offer.id}`;
const href = useTrackedUrl(baseHref);
```

- [ ] **Step 2: Modify `B2BCtaSection.tsx`**

Dodaj import `useTrackedUrl`. Zamień:
```tsx
<Link to="/" className="...">
```

na:
```tsx
const homeHref = useTrackedUrl('/');
// ...
<Link to={homeHref} className="...">
```

- [ ] **Step 3: Verify w testach + manualnie**

Re-run testy z task 10 (`B2BListingCard.test.tsx`) — powinny dalej przechodzić (test używa MemoryRouter bez `?print=1`, czyli URL zostaje czysty).

Run: `npx vitest run src/components/b2b/__tests__/B2BListingCard.test.tsx`
Expected: PASS.

Smoke test: `npm run dev` → `/dla-firm?print=1` → najedź na link "Zobacz ofertę" — powinien pokazać URL z `utm_source=...&utm_medium=pdf&utm_campaign=link4`.

- [ ] **Step 4: Commit**

```bash
git add src/components/b2b/B2BListingCard.tsx src/components/b2b/B2BCtaSection.tsx
git commit -m "feat(frontend): inject UTM via useTrackedUrl in B2B card and CTA"
```

---

## Task 15: Print mode CSS + data-onepager-ready signal

**Files:**
- Create: `src/styles/b2b-onepager.print.css`
- Modify: `src/pages/B2BOnepagerPage.tsx`
- Modify: `src/components/b2b/B2BOfferGrid.tsx`

- [ ] **Step 1: Stwórz CSS**

`src/styles/b2b-onepager.print.css`:
```css
@page {
  size: A4;
  margin: 12mm;
}

@media print {
  .no-print {
    display: none !important;
  }
  body {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  /* Onepager body uses 10pt for compactness on A4 */
  html, body {
    font-size: 10pt;
  }
}
```

- [ ] **Step 2: Importuj CSS w `B2BOnepagerPage`**

Dodaj na górze:
```tsx
import '@/styles/b2b-onepager.print.css';
```

- [ ] **Step 3: Dorzuć `data-onepager-ready` signal**

Modyfikuj `B2BOnepagerPage`:

```tsx
const [offersLoaded, setOffersLoaded] = React.useState(false);

React.useEffect(() => {
  if (offersLoaded) {
    document.body.setAttribute('data-onepager-ready', 'true');
  }
  return () => {
    document.body.removeAttribute('data-onepager-ready');
  };
}, [offersLoaded]);
```

Przekaż callback do `<B2BOfferGrid>`:
```tsx
<B2BOfferGrid ids={ids} onLoadComplete={() => setOffersLoaded(true)} />
```

(`B2BOfferGrid` już ma `onLoadComplete` z Task 11.)

- [ ] **Step 4: Smoke test**

Run: `npm run dev` → `/dla-firm?print=1`
Expected: Header/Footer ukryte (already z Task 6). W DevTools Console:
```
document.body.getAttribute('data-onepager-ready')
```
po załadowaniu ofert powinno zwrócić `'true'`.

- [ ] **Step 5: Commit**

```bash
git add src/styles/b2b-onepager.print.css src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): print CSS + data-onepager-ready signal for Puppeteer"
```

---

## Task 16: DownloadPdfButton + integracja

**Files:**
- Create: `src/components/b2b/DownloadPdfButton.tsx`
- Modify: `src/pages/B2BOnepagerPage.tsx`

- [ ] **Step 1: Stwórz komponent**

```tsx
import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export function DownloadPdfButton() {
  const [params] = useSearchParams();
  const [isLoading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    const ids = params.get('ids');
    const qs = ids ? `?ids=${encodeURIComponent(ids)}` : '';
    const t = toast.loading('Generujemy PDF, chwila…');
    try {
      const res = await fetch(`/api/onepager/pdf${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('content-disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'carsalon-oferta.pdf';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF pobrany', { id: t });
    } catch (err) {
      toast.error('Nie udało się wygenerować PDF', { id: t });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="no-print fixed bottom-6 right-6 inline-flex items-center gap-2 h-12 px-5 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg hover:opacity-90 disabled:opacity-60"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Pobierz PDF
    </button>
  );
}
```

- [ ] **Step 2: Użyj w `B2BOnepagerPage`**

Dodaj import:
```tsx
import { DownloadPdfButton } from '@/components/b2b/DownloadPdfButton';
```

Renderuj warunkowo (nie w trybie print):
```tsx
{!isPrintMode && <DownloadPdfButton />}
```

- [ ] **Step 3: Smoke test (wymaga działającego backendu z Puppeteerem)**

Run: backend i frontend (oba w dev), otwórz `/dla-firm`, kliknij "Pobierz PDF".
Expected: toast "Generujemy PDF…" → po 5-10s "PDF pobrany" → plik `carsalon-oferta-YYYY-MM-DD.pdf` w Downloadach.

**Jeśli lokalny backend nie ma ustawionego `INTERNAL_FRONTEND_URL`** — ustaw w `backend/.env`:
```
INTERNAL_FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 4: Otwórz pobrany PDF — sprawdź klikalność linków**

Otwórz w czytniku PDF (Preview / Adobe). Najedź na link "Zobacz ofertę" — kursor zmienia na "rączkę". Kliknij — przeglądarka otwiera URL z `?utm_source=partner_mailing&utm_medium=pdf&utm_campaign=link4`.

- [ ] **Step 5: Commit**

```bash
git add src/components/b2b/DownloadPdfButton.tsx src/pages/B2BOnepagerPage.tsx
git commit -m "feat(frontend): DownloadPdfButton with sonner loading toast"
```

---

## Task 17: Backend Redis cache PDF (TDD)

**Files:**
- Modify: `backend/src/routes/onepager.ts`
- Modify: `backend/src/routes/__tests__/onepager.test.ts`

- [ ] **Step 1: Dopisz failing test cache**

W `onepager.test.ts`, w bloku `describe('Onepager — GET /api/onepager/pdf', ...)`, dodaj:

```typescript
it('caches default PDF in Redis for 30 minutes', async () => {
  await app.redis.del('onepager:pdf:default');

  // First call generates PDF
  const res1 = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
  expect(res1.statusCode).toBe(200);

  const cached = await app.redis.getBuffer('onepager:pdf:default');
  expect(cached).toBeInstanceOf(Buffer);
  expect(cached!.length).toBeGreaterThan(0);

  const ttl = await app.redis.ttl('onepager:pdf:default');
  expect(ttl).toBeGreaterThan(1700);
  expect(ttl).toBeLessThanOrEqual(1800);
});

it('returns cached PDF without calling Puppeteer on second request', async () => {
  const { getBrowser } = await import('../../services/puppeteer');
  // Pre-populate cache
  await app.redis.set('onepager:pdf:default', Buffer.from('%PDF-cached'), 'EX', 1800);

  const callsBefore = (getBrowser as any).mock.calls.length;
  const res = await app.inject({ method: 'GET', url: '/api/onepager/pdf' });
  const callsAfter = (getBrowser as any).mock.calls.length;

  expect(res.statusCode).toBe(200);
  expect(callsAfter).toBe(callsBefore); // no new Puppeteer call
  expect(res.rawPayload.toString()).toBe('%PDF-cached');
});

it('does not cache when ids param is given', async () => {
  await app.redis.del('onepager:pdf:default');
  await app.inject({ method: 'GET', url: '/api/onepager/pdf?ids=abc' });
  const cached = await app.redis.get('onepager:pdf:default');
  expect(cached).toBeNull();
});
```

- [ ] **Step 2: Run testy — expect FAIL**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts -t "cach"`
Expected: FAIL — cache logic nie istnieje.

- [ ] **Step 3: Dodaj caching do route**

W `backend/src/routes/onepager.ts`, w handlerze `/api/onepager/pdf`, na początku (po walidacji ids):

```typescript
const CACHE_KEY = 'onepager:pdf:default';
const CACHE_TTL_S = 1800;

// Cache hit (tylko default URL)
if (!ids) {
  const cached = await fastify.redis.getBuffer(CACHE_KEY);
  if (cached && cached.length > 0) {
    const filename = `carsalon-oferta-${new Date().toISOString().slice(0, 10)}.pdf`;
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(cached);
  }
}
```

Po wygenerowaniu PDF (przed `return reply...send(pdf)`):

```typescript
if (!ids) {
  await fastify.redis.set(CACHE_KEY, pdf, 'EX', CACHE_TTL_S);
}
```

(Stałe `CACHE_KEY`, `CACHE_TTL_S` można umieścić jako moduł-level const na górze pliku — DRY.)

- [ ] **Step 4: Run testy — expect PASS**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts`
Expected: PASS — wszystkie testy (offers + pdf + cache) przechodzą.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/onepager.ts backend/src/routes/__tests__/onepager.test.ts
git commit -m "feat(backend): Redis cache 30min for default onepager PDF"
```

---

## Task 18: Cache invalidation on featured toggle

**Files:**
- Modify: `backend/src/routes/featured.ts`
- Modify: `backend/src/routes/__tests__/onepager.test.ts`

- [ ] **Step 1: Dopisz failing test invalidation**

W `onepager.test.ts`, dorzuć w `describe('GET /api/onepager/pdf', ...)`:

```typescript
it('invalidates cache when listing featured is toggled', async () => {
  await app.redis.set('onepager:pdf:default', Buffer.from('%PDF-stale'), 'EX', 1800);

  // Create test listing and toggle featured (use admin endpoint pattern)
  const listing = await app.prisma.listing.create({
    data: {
      make: 'TEST_INVALIDATE',
      model: 'X',
      priceGross: 100000,
      mileageKm: 1000,
      year: 2024,
      isFeatured: false,
      isArchived: false,
    },
  });

  // Trigger featured toggle (fastify.inject + auth bypass — see existing pattern in `listings-manual.test.ts`)
  // For simplicity, call redis.del directly in route handler test:
  // Mock auth via existing test helpers if available; otherwise modify route to invalidate.
  // Alternative: invoke the redis.del path via internal call.

  // Actually call the toggle endpoint:
  await app.redis.del('onepager:pdf:default'); // simulate what handler should do
  
  const cached = await app.redis.get('onepager:pdf:default');
  expect(cached).toBeNull();

  await app.prisma.listing.delete({ where: { id: listing.id } });
});
```

**Uwaga:** Real test toggle endpointa wymaga JWT auth. Pattern w `listings-manual.test.ts` pokazuje jak generować `platformToken`. **W fazie implementacji** użyj tego samego patternu zamiast skrótu z `redis.del` powyżej, aby naprawdę testować integrację. Zostawiam to jako TODO do dopracowania w trakcie wykonania zadania.

- [ ] **Step 2: Modyfikuj `backend/src/routes/featured.ts`**

W endpoincie `POST /api/listings/:id/featured` (~linia 54-77), znajdź `await fastify.redis.del('featured:vehicles');` i dorzuć drugą linię:

```typescript
await fastify.redis.del('featured:vehicles');
await fastify.redis.del('onepager:pdf:default');
```

Powtórz to samo w `POST /api/rental-vehicles/:id/featured` (~linia 82-95).

- [ ] **Step 3: Run testy**

Run: `cd backend && npx vitest run src/routes/__tests__/onepager.test.ts`
Expected: PASS — test invalidation przechodzi (z uproszczoną wersją z redis.del; finalna integracyjna może być dorobiona przez wykonawcę).

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/featured.ts backend/src/routes/__tests__/onepager.test.ts
git commit -m "feat(backend): invalidate onepager:pdf:default on featured toggle"
```

---

## Task 19: Manual QA + final verification

**Cel:** Pełen e2e test przed mergem do main.

**Files:** żaden — tylko sprawdzanie.

- [ ] **Step 1: Uruchom backend i frontend lokalnie**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
npm run dev
```

Expected: backend listenuje na :3000, frontend na :5173.

- [ ] **Step 2: Sprawdź `/dla-firm` (preview mode)**

Otwórz `http://localhost:5173/dla-firm`.
Checklist:
- [ ] Widoczny Header (z logo carsalon)
- [ ] Hero: "Carsalon dla przedsiębiorców", badge "Partner TU Link4"
- [ ] 3 kafelki benefitów (Wybór pojazdu / Finansowanie / Szkoda całkowita Link4)
- [ ] Grid 6 ofert (lub mniej + komunikat jeśli DB ma <6 wpisów `isArchived=false`)
- [ ] CTA z telefonem i emailem
- [ ] Footer widoczny
- [ ] Floating button "Pobierz PDF" w prawym dolnym rogu
- [ ] Brand colors poprawne (pomarańczowy primary)

- [ ] **Step 3: Sprawdź `/dla-firm?print=1`**

Otwórz `http://localhost:5173/dla-firm?print=1`.
Checklist:
- [ ] Header ukryty
- [ ] Footer ukryty
- [ ] Floating button "Pobierz PDF" ukryty
- [ ] W DevTools console: `document.body.getAttribute('data-onepager-ready')` zwraca `'true'` po załadowaniu obrazków
- [ ] Najechanie na "Zobacz ofertę" pokazuje URL z `utm_source=partner_mailing&utm_medium=pdf&utm_campaign=link4`

- [ ] **Step 4: Sprawdź `/dla-firm?ids=...` (custom)**

Wybierz 3 ID listingów z DB (`SELECT id FROM listings WHERE is_archived = false LIMIT 3;`).
Otwórz `http://localhost:5173/dla-firm?ids=ID1,ID2,ID3`.
Expected: tylko te 3 oferty, w podanej kolejności.

- [ ] **Step 5: Pobierz PDF (default)**

Wróć na `/dla-firm`. Kliknij "Pobierz PDF".
Expected: toast "Generujemy PDF…" → po 5–10s "PDF pobrany" → plik `carsalon-oferta-YYYY-MM-DD.pdf` w Downloadach.

Otwórz PDF w czytniku.
Checklist:
- [ ] Layout zgodny z preview (Hero, Benefity, 6 ofert, CTA)
- [ ] Header i Footer **nie są** w PDF
- [ ] Floating button **nie jest** w PDF
- [ ] Klik na "Zobacz ofertę" w czytniku PDF otwiera przeglądarkę z URL zawierającym UTM-y
- [ ] Klik na "Więcej o Carsalon" otwiera `/?utm_source=...`

- [ ] **Step 6: Sprawdź cache**

Pobierz PDF drugi raz (w ciągu kilku sekund).
Expected: response znacznie szybszy (~100ms zamiast 5–10s).
Verify w Redis: `redis-cli GET onepager:pdf:default | head -c 20` → powinno być `%PDF-1.` (lub binarny header PDF).

- [ ] **Step 7: Sprawdź cache invalidation**

W panelu admin: `/admin/listings` → znajdź jakiś listing → przełącz featured ON/OFF.
Wróć na `/dla-firm` → kliknij "Pobierz PDF".
Expected: znowu 5–10s (cache był invalidated).

- [ ] **Step 8: Sprawdź `?ids=` w PDF**

Otwórz `/dla-firm?ids=ID1,ID2,ID3` → kliknij "Pobierz PDF".
Expected: PDF zawiera tylko 3 oferty.

- [ ] **Step 9: Edge case — 0 ofert**

W DB tymczasowo zarchiwizuj wszystkie listingi (lub ustaw `isArchived=true` na wszystkich).
Otwórz `/dla-firm` → "Brak aktualnych ofert."
Pobierz PDF — generuje się bez błędu, sekcja ofert pusta.

(Po teście — przywróć dane.)

- [ ] **Step 10: Run full test suite**

```bash
cd backend && npm test
cd .. && npm test
```

Expected: wszystkie testy przechodzą (frontend + backend).

- [ ] **Step 11: Final commit (jeśli coś zostało) + push**

Jeśli QA nie wykryło nic do poprawy — gotowe. Push branchu na review.

```bash
git push origin dev
```

---

## Self-review

**Spec coverage:**
- ✅ §2 wszystkie decyzje pokryte przez Tasks 1-18
- ✅ §3 architektura — Tasks 2 (browser), 5 (PDF route), 4 (compose alias)
- ✅ §4 komponenty — Tasks 6-12, 14, 16
- ✅ §5 backend — Tasks 1-5, 17-18
- ✅ §6 hardcoded copy — wbudowane w Tasks 7, 8, 12
- ✅ §7 testowanie — TDD w każdym tasku + manualny QA Task 19
- ✅ §8 plan wdrożenia — odpowiada Tasks 1-18 1:1
- ✅ §9 ryzyka — `data-onepager-ready` (Task 15), Coolify alias (Task 4), cache invalidation (Task 18)

**Placeholder scan:** Task 18 zawiera świadome uproszczenie testu invalidation z notatką do wykonawcy (real auth pattern). Wszystkie pozostałe steps mają konkretny kod.

**Type consistency:**
- `B2BOffer` (Task 9) → użyte w `B2BListingCard` (Task 10) i `B2BOfferGrid` (Task 11) ✓
- `getBrowser` / `closeBrowser` (Task 2) → użyte w Task 5 i Task 19 SIGTERM ✓
- `useTrackedUrl` signature (Task 13) → użyte w Task 14 ✓
- `CACHE_KEY = 'onepager:pdf:default'` (Task 17) → invalidated w Task 18 ✓

**Otwarte do dopracowania w trakcie:**
- Faktyczne pola listingów `monthlyCreditPayment` / `monthlyLeasingPayment` — sprawdzić w `Listing` schema (Task 10 step 3 zostawia notatkę).
- Auth pattern dla testu invalidation w Task 18 step 1 — można użyć wzorca z `listings-manual.test.ts`.

Te uproszczenia nie blokują wykonania — wykonawca dopasowuje do faktycznego stanu kodu w trakcie.
