# SEO Meta-Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surowy HTML każdej strony (bez JS) zawiera unikalny title/description/canonical/JSON-LD; warianty finansowania kanonizują do /oferta; sitemap i robots.txt poprawne per brand; nieistniejące ogłoszenia zwracają 404.

**Architecture:** Backend (Fastify) dostaje endpoint `GET /api/render?path=...`, który pobiera `index.html` z kontenera frontendu (cache 5 min), wstrzykuje per-URL tagi do `<head>` i zwraca HTML z właściwym statusem. Nginx kieruje fallback SPA do tego endpointu z awaryjnym statycznym `index.html`. Sitemap traci warianty /leasing//kredyt, robots.txt przechodzi do backendu (brand-aware).

**Tech Stack:** Fastify + Prisma (backend, vitest + app.inject z realną DB z `backend/.env`), React/Vite (frontend), nginx (template z envsubst, zmienna `${BACKEND_URL}`), Coolify/docker-compose.

**Spec:** `docs/superpowers/specs/2026-06-12-seo-meta-injection-design.md` (decyzje zatwierdzone 2026-06-12).

**Repo:** `/Users/kamiltonkowicz/Documents/Coding/github/car-scout`, branch `dev`. Commity na dev; PUSH dopiero po zgodzie użytkownika (Task 6).

**Konwencje:** backend importuje lokalne moduły z rozszerzeniem `.js` (ESM, np. `from '../utils/url-utils.js'`). Testy backendu: `cd backend && npm test` (vitest, globalSetup ładuje `backend/.env`).

---

## File structure

- Create: `backend/src/services/seo-meta.ts` — czyste buildery meta + injekcja do szablonu (zero I/O)
- Create: `backend/src/services/__tests__/seo-meta.test.ts`
- Create: `backend/src/routes/render.ts` — endpoint `/api/render` (cache szablonu, dispatch, lookupy Prisma)
- Create: `backend/src/routes/__tests__/render.test.ts`
- Modify: `backend/src/app.ts` — rejestracja `renderRoutes`
- Modify: `backend/src/routes/seo.ts` — sitemap bez wariantów + nowe statyczne + endpoint `/api/robots.txt`
- Create: `backend/src/routes/__tests__/seo.test.ts`
- Modify: `src/pages/ListingDetailPage.tsx` — canonical zawsze `/oferta` (`'gotowka'`)
- Delete: `public/robots.txt` (źródłem zostaje backend)
- Modify: `nginx.conf` — `@render`/`@spa_fallback`, proxy robots.txt, scope'owana blokada curl
- Modify: `docker-compose.coolify.yml` — env `BRAND` dla backendu

---

### Task 1: Buildery meta (`seo-meta.ts`)

**Files:**
- Create: `backend/src/services/seo-meta.ts`
- Test: `backend/src/services/__tests__/seo-meta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/__tests__/seo-meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    buildListingMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
} from '../seo-meta';

const ctx: BrandCtx = {
    baseUrl: 'https://dev.motolia.pl',
    brandName: 'Motolia',
    defaultTitle: 'Motolia - leasing, kredyt i wynajem samochodów',
    defaultDescription: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
};

const LISTING = {
    make: 'Ford',
    model: 'Puma',
    version: '1.0 EcoBoost',
    productionYear: 2024,
    pricePln: 99900,
    mileageKm: 10,
    fuelType: 'benzyna',
    bodyType: 'suv',
};

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /><meta property="og:title" content="OLD" /><meta property="og:description" content="OLDD" /><meta property="og:url" content="https://old.example" /><meta name="twitter:title" content="OLD" /><meta name="twitter:description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('resolveBrandCtx', () => {
    it('resolves motolia brand from env', () => {
        const prev = { BRAND: process.env.BRAND, FRONTEND_URL: process.env.FRONTEND_URL };
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl/';
        const c = resolveBrandCtx();
        expect(c.brandName).toBe('Motolia');
        expect(c.baseUrl).toBe('https://dev.motolia.pl'); // trailing slash stripped
        if (prev.BRAND === undefined) delete process.env.BRAND; else process.env.BRAND = prev.BRAND;
        if (prev.FRONTEND_URL === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev.FRONTEND_URL;
    });

    it('defaults to carsalon', () => {
        const prev = process.env.BRAND;
        delete process.env.BRAND;
        expect(resolveBrandCtx().brandName).toBe('CarSalon');
        if (prev === undefined) delete process.env.BRAND; else process.env.BRAND = prev;
    });
});

describe('buildListingMeta', () => {
    it('oferta: self-canonical, Vehicle JSON-LD, price in title', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.title).toContain('Ford Puma 1.0 EcoBoost 2024');
        expect(m.title).toContain('| Motolia');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.status).toBe(200);
        expect((m.jsonLd as any)['@type']).toBe('Vehicle');
        expect((m.jsonLd as any).offers.price).toBe(99900);
    });

    it('leasing variant: canonical points to /oferta, variant in title, no JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'leasing', ctx);
        expect(m.title).toContain('— leasing');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.jsonLd).toBeUndefined();
    });
});

describe('buildRentalMeta', () => {
    it('self-canonical under /wynajem-dlugoterminowy', () => {
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Corolla', version: null, productionYear: 2024 },
            'toyota-corolla-x1',
            ctx
        );
        expect(m.title).toContain('najem długoterminowy');
        expect(m.canonical).toBe('https://dev.motolia.pl/wynajem-dlugoterminowy/toyota-corolla-x1');
    });
});

describe('buildStaticMeta', () => {
    it('known route gets unique title and self-canonical', () => {
        const m = buildStaticMeta('/uzywane', ctx)!;
        expect(m.title).toContain('używane');
        expect(m.canonical).toBe('https://dev.motolia.pl/uzywane');
    });

    it('/search canonicalizes to /samochody', () => {
        expect(buildStaticMeta('/search', ctx)!.canonical).toBe('https://dev.motolia.pl/samochody');
    });

    it('home uses brand defaults and Organization JSON-LD', () => {
        const m = buildStaticMeta('/', ctx)!;
        expect(m.title).toBe(ctx.defaultTitle);
        expect((m.jsonLd as any)['@type']).toBe('Organization');
    });

    it('unknown route returns null', () => {
        expect(buildStaticMeta('/nie-ma-takiej-strony', ctx)).toBeNull();
    });
});

describe('defaultMeta', () => {
    it('carries noindex and status', () => {
        const m = defaultMeta(ctx, { noindex: true, status: 404 });
        expect(m.noindex).toBe(true);
        expect(m.status).toBe(404);
        expect(m.title).toBe(ctx.defaultTitle);
    });
});

describe('injectHead', () => {
    it('replaces title/description/og/twitter and appends canonical + JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('<title>OLD</title>');
        expect(html).toContain('Ford Puma');
        expect(html).toContain('<link rel="canonical" href="https://dev.motolia.pl/oferta/ford-puma-abc123" />');
        expect(html).toContain('application/ld+json');
        expect(html).toContain('og:url" content="https://dev.motolia.pl/oferta/ford-puma-abc123"');
        expect(html).not.toContain('noindex');
    });

    it('adds robots noindex when meta.noindex', () => {
        const html = injectHead(TEMPLATE, defaultMeta(ctx, { noindex: true, status: 404 }));
        expect(html).toContain('<meta name="robots" content="noindex" />');
    });

    it('escapes </script> in JSON-LD', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('</script><b>');
    });

    it('does not interpret $-patterns in vehicle data', () => {
        const m = buildListingMeta({ ...LISTING, version: 'GT $& $1 $$' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('GT $&amp; $1 $$');
        expect(html).not.toContain('OLDD');
    });

    it('keeps escaped JSON-LD when data contains </script>', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('\\u003c/script>');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/services/__tests__/seo-meta.test.ts`
Expected: FAIL — `Cannot find module '../seo-meta'` (lub equivalent resolve error)

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/seo-meta.ts`:

```ts
export interface PageMeta {
    title: string;
    description: string;
    canonical?: string; // absolute URL
    jsonLd?: object;
    noindex?: boolean;
    status: number;
}

export interface BrandCtx {
    baseUrl: string;
    brandName: string;
    defaultTitle: string;
    defaultDescription: string;
}

export type ListingVariant = 'oferta' | 'leasing' | 'kredyt';

const BRAND_DEFAULTS: Record<string, { name: string; title: string; description: string }> = {
    carsalon: {
        name: 'CarSalon',
        title: 'CarSalon - auta nowe i używane z gwarancją',
        description: 'Setki ofert od sprawdzonych dealerów. Nowe i używane samochody z gwarancją.',
    },
    motolia: {
        name: 'Motolia',
        title: 'Motolia - leasing, kredyt i wynajem samochodów',
        description: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
    },
};

export function resolveBrandCtx(): BrandCtx {
    const brand = process.env.BRAND === 'motolia' ? 'motolia' : 'carsalon';
    const d = BRAND_DEFAULTS[brand];
    return {
        baseUrl: (process.env.FRONTEND_URL || 'https://carsalon.pl').replace(/\/$/, ''),
        brandName: d.name,
        defaultTitle: d.title,
        defaultDescription: d.description,
    };
}

export interface ListingMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    pricePln: number;
    mileageKm: number;
    fuelType: string | null;
    bodyType: string | null;
}

export function buildListingMeta(
    l: ListingMetaInput,
    slug: string,
    variant: ListingVariant,
    ctx: BrandCtx
): PageMeta {
    const name = [l.make, l.model, l.version, String(l.productionYear)].filter(Boolean).join(' ');
    const price = l.pricePln.toLocaleString('pl-PL');
    const variantLabel = variant === 'leasing' ? ' — leasing' : variant === 'kredyt' ? ' — kredyt' : '';
    const canonical = `${ctx.baseUrl}/oferta/${slug}`;
    const detale = [
        `cena ${price} zł`,
        `przebieg ${l.mileageKm.toLocaleString('pl-PL')} km`,
        l.fuelType,
        l.bodyType,
    ]
        .filter(Boolean)
        .join(', ');

    return {
        title: `${name}${variantLabel} — ${price} zł | ${ctx.brandName}`,
        description: `${name}: ${detale}. Samochód dostępny od ręki u dealera — sprawdź finansowanie: leasing, kredyt lub najem.`,
        canonical,
        jsonLd:
            variant === 'oferta'
                ? {
                      '@context': 'https://schema.org',
                      '@type': 'Vehicle',
                      name,
                      brand: { '@type': 'Brand', name: l.make },
                      model: l.model,
                      vehicleModelDate: String(l.productionYear),
                      mileageFromOdometer: {
                          '@type': 'QuantitativeValue',
                          value: l.mileageKm,
                          unitCode: 'KMT',
                      },
                      ...(l.fuelType ? { fuelType: l.fuelType } : {}),
                      ...(l.bodyType ? { bodyType: l.bodyType } : {}),
                      offers: {
                          '@type': 'Offer',
                          price: l.pricePln,
                          priceCurrency: 'PLN',
                          availability: 'https://schema.org/InStock',
                          url: canonical,
                      },
                  }
                : undefined,
        status: 200,
    };
}

export interface RentalMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    sellingPrice?: number | null;
}

export function buildRentalMeta(r: RentalMetaInput, slug: string, ctx: BrandCtx): PageMeta {
    const name = [r.make, r.model, r.version, r.productionYear ? String(r.productionYear) : null]
        .filter(Boolean)
        .join(' ');
    const canonical = `${ctx.baseUrl}/wynajem-dlugoterminowy/${slug}`;
    return {
        title: `${name} — najem długoterminowy | ${ctx.brandName}`,
        description: `${name} w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.`,
        canonical,
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Vehicle',
            name,
            brand: { '@type': 'Brand', name: r.make },
            model: r.model,
            ...(r.sellingPrice
                ? {
                      offers: {
                          '@type': 'Offer',
                          price: r.sellingPrice,
                          priceCurrency: 'PLN',
                          availability: 'https://schema.org/InStock',
                          url: canonical,
                      },
                  }
                : {}),
        },
        status: 200,
    };
}

interface StaticRoute {
    title: (brand: string) => string;
    description: string;
    canonicalPath?: string; // default: own path
}

const STATIC_ROUTES: Record<string, StaticRoute> = {
    '/samochody': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
    },
    '/search': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
        canonicalPath: '/samochody',
    },
    '/nowe': {
        title: b => `Nowe samochody z rabatem dostępne u dealerów | ${b}`,
        description:
            'Nowe samochody z rabatem, dostępne od ręki u dealerów. Sprawdź dostępność i dopasowane finansowanie.',
    },
    '/uzywane': {
        title: b => `Samochody używane od dealera z gwarancją | ${b}`,
        description:
            'Samochody używane od dealerów — sprawdzone auta z finansowaniem: leasing, kredyt lub najem.',
    },
    '/leasing': {
        title: b => `Leasing samochodu — auta dostępne od ręki | ${b}`,
        description:
            'Samochody dostępne od ręki w leasingu. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/kredyt': {
        title: b => `Kredyt samochodowy — auta dostępne od ręki | ${b}`,
        description:
            'Samochody dostępne od ręki na kredyt. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/wynajem-dlugoterminowy': {
        title: b => `Najem długoterminowy samochodów | ${b}`,
        description:
            'Auta w najmie długoterminowym — stała rata, bez wkładu własnego. Sprawdź dostępne samochody.',
    },
    '/dla-ciebie': {
        title: b => `Oferta dopasowana do Ciebie | ${b}`,
        description:
            'Samochód z dopasowanym finansowaniem — leasing, kredyt lub najem. Zostaw kontakt, dobierzemy ofertę.',
    },
    '/dla-firm': {
        title: b => `Samochody i finansowanie dla firm | ${b}`,
        description:
            'Auta dla firm — leasing, kredyt lub najem długoterminowy. Złóż wniosek o finansowanie.',
    },
    '/faq': {
        title: b => `Najczęstsze pytania | ${b}`,
        description:
            'Odpowiedzi na najczęstsze pytania o zakup samochodu, finansowanie i proces zamówienia.',
    },
    '/kontakt': {
        title: b => `Kontakt | ${b}`,
        description: 'Skontaktuj się z nami — pomożemy dobrać samochód i finansowanie.',
    },
};

export function buildStaticMeta(path: string, ctx: BrandCtx): PageMeta | null {
    if (path === '/') {
        return {
            title: ctx.defaultTitle,
            description: ctx.defaultDescription,
            canonical: `${ctx.baseUrl}/`,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: ctx.brandName,
                url: `${ctx.baseUrl}/`,
            },
            status: 200,
        };
    }
    const route = STATIC_ROUTES[path];
    if (!route) return null;
    return {
        title: route.title(ctx.brandName),
        description: route.description,
        canonical: `${ctx.baseUrl}${route.canonicalPath ?? path}`,
        status: 200,
    };
}

export function defaultMeta(ctx: BrandCtx, opts: { noindex?: boolean; status?: number } = {}): PageMeta {
    return {
        title: ctx.defaultTitle,
        description: ctx.defaultDescription,
        noindex: opts.noindex,
        status: opts.status ?? 200,
    };
}

function escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function injectHead(template: string, meta: PageMeta): string {
    const title = escapeAttr(meta.title);
    const description = escapeAttr(meta.description);
    let html = template
        .replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`)
        .replace(/(<meta name="description" content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`)
        .replace(/(<meta property="og:title"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${title}${p2}`)
        .replace(/(<meta property="og:description"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`)
        .replace(/(<meta name="twitter:title"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${title}${p2}`)
        .replace(/(<meta name="twitter:description"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`);

    if (meta.canonical) {
        const canonical = escapeAttr(meta.canonical);
        html = html.replace(
            /(<meta property="og:url"[^>]*content=").*?(")/,
            (_m, p1, p2) => `${p1}${canonical}${p2}`
        );
    }

    const extra: string[] = [];
    if (meta.canonical) extra.push(`<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
    if (meta.noindex) extra.push(`<meta name="robots" content="noindex" />`);
    if (meta.jsonLd) {
        // < prevents </script> breakout from data-derived strings
        const json = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
        extra.push(`<script type="application/ld+json">${json}</script>`);
    }
    if (extra.length) {
        html = html.replace('</head>', () => `${extra.join('\n')}\n</head>`);
    }
    return html;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/services/__tests__/seo-meta.test.ts`
Expected: PASS (wszystkie testy)

- [ ] **Step 5: Commit**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git add backend/src/services/seo-meta.ts backend/src/services/__tests__/seo-meta.test.ts
git commit -m "feat(seo): add per-URL meta builders and head injection service"
```

---

### Task 2: Endpoint `/api/render`

**Files:**
- Create: `backend/src/routes/render.ts`
- Modify: `backend/src/app.ts` (import ~linia 24, rejestracja ~linia 268)
- Test: `backend/src/routes/__tests__/render.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/routes/__tests__/render.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { __resetRenderCache } from '../render';
import { generateListingSlug } from '../../utils/url-utils.js';

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /><meta property="og:title" content="OLD" /><meta property="og:description" content="OLDD" /><meta property="og:url" content="https://old.example" /><meta name="twitter:title" content="OLD" /><meta name="twitter:description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('GET /api/render', () => {
    let app: FastifyInstance;
    let prevBrand: string | undefined;
    let prevFrontendUrl: string | undefined;
    let prevInternalFrontendUrl: string | undefined;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        __resetRenderCache();
        prevBrand = process.env.BRAND;
        prevFrontendUrl = process.env.FRONTEND_URL;
        prevInternalFrontendUrl = process.env.INTERNAL_FRONTEND_URL;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(TEMPLATE, { status: 200 }))
        );
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_RENDER' } });
    });

    afterEach(async () => {
        if (prevBrand === undefined) delete process.env.BRAND;
        else process.env.BRAND = prevBrand;
        if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = prevFrontendUrl;
        if (prevInternalFrontendUrl === undefined) delete process.env.INTERNAL_FRONTEND_URL;
        else process.env.INTERNAL_FRONTEND_URL = prevInternalFrontendUrl;
    });

    async function createListing() {
        return app.prisma.listing.create({
            data: {
                make: 'TEST_RENDER',
                model: 'Modelo',
                version: '1.0',
                pricePln: 123456,
                mileageKm: 5,
                productionYear: 2024,
                fuelType: 'benzyna',
                bodyType: 'suv',
                isArchived: false,
            },
        });
    }

    it('oferta: 200 with vehicle title, self-canonical and JSON-LD', async () => {
        const l = await createListing();
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({ method: 'GET', url: `/api/render?path=/oferta/${slug}` });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        expect(res.body).toContain('TEST_RENDER Modelo');
        expect(res.body).toContain(`rel="canonical" href="https://dev.motolia.pl/oferta/${slug}"`);
        expect(res.body).toContain('application/ld+json');
    });

    it('leasing variant canonicalizes to /oferta', async () => {
        const l = await createListing();
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({ method: 'GET', url: `/api/render?path=/leasing/${slug}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain(`rel="canonical" href="https://dev.motolia.pl/oferta/${slug}"`);
        expect(res.body).toContain('— leasing');
    });

    it('missing listing returns 404 + noindex', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/render?path=/oferta/cos-cos-2024-aaaaaaaaaaaaaaaaaaaaaaaaa',
        });
        expect(res.statusCode).toBe(404);
        expect(res.body).toContain('noindex');
    });

    it('archived listing returns 404', async () => {
        const l = await createListing();
        await app.prisma.listing.update({ where: { id: l.id }, data: { isArchived: true } });
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });
        expect(res.statusCode).toBe(404);
    });

    it('static route gets unique title', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('używane');
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/uzywane"');
    });

    it('unknown path: 200 + noindex + brand default title', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/xyz-nie-istnieje' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('noindex');
        expect(res.body).toContain('Motolia');
    });

    it('lead subpage is noindex', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/oferta/abc/lead' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('noindex');
    });

    it('503 when template unavailable and no cache', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(res.statusCode).toBe(503);
    });

    it('bogus slug canonicalizes to true slug', async () => {
        const l = await createListing();
        const trueSlug = generateListingSlug(
            l.make,
            l.model,
            l.version,
            l.productionYear,
            l.bodyType,
            l.fuelType,
            l.id
        );
        const bogusSlug = `totally-fake-slug-${l.id}`;
        const res = await app.inject({ method: 'GET', url: `/api/render?path=/oferta/${bogusSlug}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain(`rel="canonical" href="https://dev.motolia.pl/oferta/${trueSlug}"`);
        expect(res.body).not.toContain('totally-fake-slug');
    });

    it('duplicate path params do not crash', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane&path=/faq' });
        expect(res.statusCode).toBe(200);
    });

    it('trailing slash normalization', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane/' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('używane');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/__tests__/render.test.ts`
Expected: FAIL — `Cannot find module '../render'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/routes/render.ts`:

```ts
import { FastifyInstance } from 'fastify';
import { extractListingIdFromSlug, generateListingSlug } from '../utils/url-utils.js';
import {
    buildListingMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
    ListingVariant,
    PageMeta,
} from '../services/seo-meta.js';

const TEMPLATE_TTL_MS = 5 * 60 * 1000;
const PAGE_TTL_MS = 60 * 1000;
const PAGE_CACHE_MAX = 5000;

// Klucze cache nie zawierają brandu — każdy proces backendu obsługuje jeden brand (env BRAND).
let templateCache: { html: string; fetchedAt: number } | null = null;
const pageCache = new Map<string, { html: string; status: number; at: number }>();

export function __resetRenderCache() {
    templateCache = null;
    pageCache.clear();
}

async function getTemplate(): Promise<string | null> {
    if (templateCache && Date.now() - templateCache.fetchedAt < TEMPLATE_TTL_MS) {
        return templateCache.html;
    }
    try {
        const base = (process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80').replace(/\/$/, '');
        const res = await fetch(`${base}/index.html`);
        if (!res.ok) throw new Error(`template fetch status ${res.status}`);
        const html = await res.text();
        templateCache = { html, fetchedAt: Date.now() };
        return html;
    } catch {
        // stale-if-error: lepszy stary szablon niż brak strony
        return templateCache?.html ?? null;
    }
}

const LISTING_RE = /^\/(oferta|leasing|kredyt)\/([^/]+)$/;
const RENTAL_RE = /^\/wynajem-dlugoterminowy\/([^/]+)$/;
const NOINDEX_RE = /^\/(admin|login|embed)(\/|$)|\/(lead|negotiate|zapytanie)$/;

async function resolveMeta(fastify: FastifyInstance, path: string, ctx: BrandCtx): Promise<PageMeta> {
    if (NOINDEX_RE.test(path)) {
        return defaultMeta(ctx, { noindex: true, status: 200 });
    }

    const lm = path.match(LISTING_RE);
    if (lm) {
        const id = extractListingIdFromSlug(lm[2]);
        const listing = id
            ? await fastify.prisma.listing.findFirst({
                  where: { id, isArchived: false },
                  select: {
                      make: true,
                      model: true,
                      version: true,
                      productionYear: true,
                      pricePln: true,
                      mileageKm: true,
                      fuelType: true,
                      bodyType: true,
                  },
              })
            : null;
        if (!id || !listing) return defaultMeta(ctx, { noindex: true, status: 404 });
        // Slug z URL bywa zmanipulowany — canonical liczymy z danych, nie z requestu
        const canonicalSlug = generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            id
        );
        return buildListingMeta(listing, canonicalSlug, lm[1] as ListingVariant, ctx);
    }

    const rm = path.match(RENTAL_RE);
    if (rm) {
        const rental = await fastify.prisma.rentalVehicle.findFirst({
            where: { slug: rm[1], isActive: true },
            select: {
                make: true,
                model: true,
                version: true,
                productionYear: true,
                sellingPrice: true,
            },
        });
        if (!rental) return defaultMeta(ctx, { noindex: true, status: 404 });
        return buildRentalMeta(rental, rm[1], ctx);
    }

    return buildStaticMeta(path, ctx) ?? defaultMeta(ctx, { noindex: true, status: 200 });
}

export async function renderRoutes(fastify: FastifyInstance) {
    fastify.get('/api/render', async (request, reply) => {
        const q = (request.query as { path?: unknown }).path;
        const rawPath = typeof q === 'string' && q ? q : '/';
        let path = rawPath.split('?')[0];
        if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';

        const cached = pageCache.get(path);
        if (cached && Date.now() - cached.at < PAGE_TTL_MS) {
            return reply
                .code(cached.status)
                .header('Content-Type', 'text/html; charset=utf-8')
                .send(cached.html);
        }

        const template = await getTemplate();
        if (!template) {
            return reply.code(503).send({ error: 'template unavailable' });
        }

        const ctx = resolveBrandCtx();
        const meta = await resolveMeta(fastify, path, ctx);
        const html = injectHead(template, meta);

        if (pageCache.size >= PAGE_CACHE_MAX) pageCache.clear();
        pageCache.set(path, { html, status: meta.status, at: Date.now() });

        return reply
            .code(meta.status)
            .header('Content-Type', 'text/html; charset=utf-8')
            .send(html);
    });
}
```

Modify `backend/src/app.ts` — dopisz import obok `seoRoutes` (linia ~24):

```ts
import { renderRoutes } from './routes/render.js';
```

i rejestrację po `await fastify.register(seoRoutes);` (linia ~268):

```ts
    await fastify.register(renderRoutes);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/routes/__tests__/render.test.ts`
Expected: PASS

Uwaga: jeśli test `503` przecieka szablonem z poprzedniego testu — sprawdź, czy `__resetRenderCache()` jest w `beforeEach` (jest w kodzie testu powyżej).

- [ ] **Step 5: Commit**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git add backend/src/routes/render.ts backend/src/routes/__tests__/render.test.ts backend/src/app.ts
git commit -m "feat(seo): add /api/render endpoint injecting per-URL head tags into SPA shell"
```

---

### Task 3: Sitemap bez wariantów + `/api/robots.txt`

**Files:**
- Modify: `backend/src/routes/seo.ts:140-153` (pętla wariantów) i `:74-81` (staticPages)
- Test: `backend/src/routes/__tests__/seo.test.ts` (create)
- Delete: `public/robots.txt`

- [ ] **Step 1: Write the failing test**

Create `backend/src/routes/__tests__/seo.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

describe('SEO routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_SITEMAP' } });
    });

    it('sitemap has /oferta only (no financing variants) and new static pages', async () => {
        await app.prisma.listing.create({
            data: {
                make: 'TEST_SITEMAP',
                model: 'X',
                pricePln: 1000,
                mileageKm: 1,
                productionYear: 2024,
                isArchived: false,
            },
        });
        const res = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
        expect(res.statusCode).toBe(200);
        // sanitizeForSlug strips '_' → 'TEST_SITEMAP' becomes 'testsitemap'
        expect(res.body).toContain('/oferta/testsitemap-x-2024-');
        expect(res.body).not.toContain('<loc>https://dev.motolia.pl/leasing/');
        expect(res.body).not.toContain('<loc>https://dev.motolia.pl/kredyt/');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/uzywane</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/nowe</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/dla-firm</loc>');
    });

    it('robots.txt declares brand-aware sitemap', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/robots.txt' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.body).toContain('Sitemap: https://dev.motolia.pl/sitemap.xml');
        expect(res.body).toContain('User-agent: *');
        expect(res.body).toContain('Disallow: /api/');
        expect(res.body).not.toContain('carsalon.pl');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/routes/__tests__/seo.test.ts`
Expected: FAIL — sitemap zawiera `<loc>.../leasing/`, brak `/uzywane`; `/api/robots.txt` zwraca 404

- [ ] **Step 3: Modify `backend/src/routes/seo.ts`**

(a) W `staticPages` (linia ~74) dopisz trzy wpisy — cała tablica po zmianie:

```ts
        const staticPages = [
            { path: '', priority: '1.0' },
            { path: '/samochody', priority: '0.9' },
            { path: '/nowe', priority: '0.8' },
            { path: '/uzywane', priority: '0.8' },
            { path: '/wynajem-dlugoterminowy', priority: '0.9' },
            { path: '/dla-ciebie', priority: '0.8' },
            { path: '/dla-firm', priority: '0.6' },
            { path: '/faq', priority: '0.5' },
            { path: '/kontakt', priority: '0.5' }
        ];
```

(b) Pętlę wariantów (linie ~140-153, blok z komentarzem "For each listing, generate 3 URLs") zastąp:

```ts
        listings.forEach(listing => {
            const slug = generateListingSlug(listing);
            urls.push({
                loc: `${baseUrl}/oferta/${slug}`,
                lastmod: formatDate(listing.updatedAt),
                changefreq: 'weekly',
                priority: '0.8'
            });
        });
```

(c) Na końcu funkcji `seoRoutes` (po endpointzie sitemapy, przed zamykającym `}`) dodaj endpoint robots:

```ts
    // robots.txt — served via nginx proxy at /robots.txt (brand-aware Sitemap line)
    fastify.get('/api/robots.txt', async (_request, reply) => {
        const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'https://carsalon.pl';
        const body = `User-agent: Googlebot
Allow: /
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: Bingbot
Allow: /
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: YandexBot
Disallow: /

User-agent: SemrushBot
Crawl-delay: 10
Allow: /
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/

User-agent: *
Allow: /
Allow: /api/sitemap.xml
Disallow: /login
Disallow: /api/
Disallow: /nowy/podglad/
Disallow: /storage/
Disallow: /wordpress/
Disallow: /backup/
Disallow: /wp/
Disallow: /old/
Disallow: /new/

Sitemap: ${baseUrl}/sitemap.xml
`;
        return reply.header('Content-Type', 'text/plain; charset=utf-8').send(body);
    });
```

(d) Usuń statyczny plik (źródłem jest teraz backend):

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git rm public/robots.txt
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/routes/__tests__/seo.test.ts`
Expected: PASS

- [ ] **Step 5: Run full backend suite (regresje)**

Run: `cd backend && npm test`
Expected: PASS (wszystkie istniejące testy nadal zielone)

- [ ] **Step 6: Commit**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git add backend/src/routes/seo.ts backend/src/routes/__tests__/seo.test.ts
git commit -m "feat(seo): drop financing variants from sitemap, add missing static pages and brand-aware robots.txt endpoint"
```

---

### Task 4: Frontend — canonical zawsze `/oferta`

**Files:**
- Modify: `src/pages/ListingDetailPage.tsx:356-365`

- [ ] **Step 1: Edit the canonical block**

W `src/pages/ListingDetailPage.tsx` zastąp blok (linie ~356-365):

```ts
  // Self-canonical: each financing variant (/kredyt/, /leasing/, /oferta/) is its own canonical
  // All 3 variants are in the sitemap — Google should index each as a distinct page
  const canonicalPath = getListingUrlPath({
    id: listing.listing_id,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    productionYear: listing.production_year,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type
  }, financingType);
```

na:

```ts
  // Financing variants (/kredyt/, /leasing/) canonicalize to /oferta/ ('gotowka' prefix)
  const canonicalPath = getListingUrlPath({
    id: listing.listing_id,
    make: listing.make,
    model: listing.model,
    version: listing.version,
    productionYear: listing.production_year,
    bodyType: listing.body_type,
    fuelType: listing.fuel_type
  }, 'gotowka');
```

(`FINANCING_URL_PREFIX.gotowka === '/oferta'` w `src/utils/url-utils.ts:7-12`; `financingType` jest nadal używany niżej w pliku — nie usuwaj go.)

- [ ] **Step 2: Typecheck**

Run: `cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout && npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0, bez nowych błędów (jeśli są istniejące błędy niezwiązane z tą zmianą — odnotuj, nie naprawiaj)

- [ ] **Step 3: Commit**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git add src/pages/ListingDetailPage.tsx
git commit -m "fix(seo): canonicalize financing variants to /oferta on listing page"
```

---

### Task 5: nginx + docker-compose

**Files:**
- Modify: `nginx.conf` (blok skanerów ~linia 30-40; `location /` ~linia 100-110; lokacje `/api/`, `/uploads/`)
- Modify: `docker-compose.coolify.yml` (environment `carscout-api`)

- [ ] **Step 1: Scope'owana blokada curl**

W `nginx.conf` w bloku skanerów usuń `curl/[78]|` z regexa — linia:

```nginx
    if ($http_user_agent ~* (curl/[78]|sqlmap|nikto|dirbuster|nessus|w3af|acunetix|masscan|zgrab|httpx|nuclei)) {
```

zmienia się na:

```nginx
    if ($http_user_agent ~* (sqlmap|nikto|dirbuster|nessus|w3af|acunetix|masscan|zgrab|httpx|nuclei)) {
```

Bezpośrednio PO całym bloku `if ($block_scanner = "1") { return 444; }` dodaj:

```nginx
    # curl is blocked only on /api/ and /uploads/ (see those locations).
    # Pages stay open to curl for SEO verification and legitimate fetchers.
    set $block_curl "0";
    if ($http_user_agent ~* "curl/[78]") {
        set $block_curl "1";
    }
```

- [ ] **Step 2: SPA fallback → backend render**

Zastąp blok `location /` (sekcja "SPA Routing"):

```nginx
    # SPA Routing — only GET/HEAD, rate limited
    location / {
        limit_req zone=general burst=20 nodelay;
        limit_req zone=scanner burst=5 nodelay;

        # Only allow GET and HEAD for SPA routes
        limit_except GET HEAD {
            deny all;
        }

        try_files $uri @render;
    }

    # SEO meta-injection: backend renders index.html with per-URL head tags
    location @render {
        proxy_pass $backend_addr/api/render?path=$uri;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $rate_limit_key;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;

        proxy_intercept_errors on;
        error_page 502 503 504 = @spa_fallback;
    }

    # Static SPA shell when backend is unavailable
    location @spa_fallback {
        try_files /index.html =404;
    }
```

- [ ] **Step 3: robots.txt proxy**

Obok istniejącego bloku `location = /sitemap.xml` dodaj:

```nginx
    # Proxy robots.txt to the backend (brand-aware Sitemap line)
    location = /robots.txt {
        proxy_pass $backend_addr/api/robots.txt;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

- [ ] **Step 4: Blokada curl w /api/ i /uploads/**

Na początku bloku `location /api/` (przed `limit_req`) dodaj:

```nginx
        if ($block_curl = "1") {
            return 444;
        }
```

To samo na początku bloku `location /uploads/`.

- [ ] **Step 5: env BRAND dla backendu**

W `docker-compose.coolify.yml`, w `services.carscout-api.environment`, po linii `INTERNAL_FRONTEND_URL: ...` dodaj:

```yaml
      BRAND: ${BRAND:-carsalon}
```

(Coolify ma już zmienną `BRAND` per środowisko — używa jej obraz frontendu, linia 65.)

- [ ] **Step 6: Verify nginx config syntax (Docker)**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
docker run --rm \
  -v "$PWD/nginx.conf":/etc/nginx/templates/default.conf.template:ro \
  -v "$PWD/nginx-rate-limit.conf":/etc/nginx/conf.d/rate-limit.conf:ro \
  -e BACKEND_URL=http://backend:3000 \
  nginx:alpine sh -c 'envsubst "\$BACKEND_URL" < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -t'
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`
Jeśli Docker nie działa lokalnie: odnotuj i przenieś weryfikację na deploy dev (Task 6) — składnia zostanie sprawdzona przy starcie kontenera.

- [ ] **Step 7: Commit**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout
git add nginx.conf docker-compose.coolify.yml
git commit -m "feat(seo): route SPA fallback through backend render, proxy robots.txt, scope curl block to api/uploads"
```

---

### Task 6: Push (za zgodą użytkownika) i weryfikacja na dev.motolia.pl

**Files:** brak zmian w kodzie — bramka i weryfikacja.

- [ ] **Step 1: Pełny test suite + status**

```bash
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout/backend && npm test
cd /Users/kamiltonkowicz/Documents/Coding/github/car-scout && git log --oneline origin/dev..dev && git status -s
```

Expected: testy PASS; lista commitów z Tasków 1-5; brak nieoczekiwanych plików.

- [ ] **Step 2: STOP — zapytaj użytkownika o zgodę na `git push origin dev`**

To wdraża obraz na dev.carsalon.pl i dev.motolia.pl (CI buduje obrazy backend + frontend per brand; Coolify pulluje `IMAGE_TAG=dev`). Nie pushuj bez wyraźnego OK.

- [ ] **Step 3: Po push — poczekaj na CI i deploy, potem kryteria akceptacji**

```bash
SLUG=$(curl -s https://dev.motolia.pl/sitemap.xml | grep -o '/oferta/[^<]*' | head -1 | sed 's|/oferta/||')
curl -s "https://dev.motolia.pl/oferta/$SLUG" | grep -o '<title>[^<]*</title>'        # tytuł z nazwą pojazdu
curl -s "https://dev.motolia.pl/oferta/$SLUG" | grep -c 'rel="canonical"'             # 1
curl -s "https://dev.motolia.pl/leasing/$SLUG" | grep -o 'canonical[^>]*'             # href .../oferta/...
curl -s -o /dev/null -w "%{http_code}\n" https://dev.motolia.pl/oferta/x-aaaaaaaaaaaaaaaaaaaaaaaaa  # 404
curl -s https://dev.motolia.pl/sitemap.xml | grep -c '<loc>[^<]*/leasing/'            # 0
curl -s https://dev.motolia.pl/sitemap.xml | grep -c '/uzywane'                       # >=1
curl -s https://dev.motolia.pl/robots.txt | grep 'Sitemap:'                           # https://dev.motolia.pl/sitemap.xml
curl -s -o /dev/null -w "%{http_code}\n" https://dev.motolia.pl/api/listings          # 000/brak odpowiedzi (curl nadal blokowany na API)
```

Uwaga: dev.motolia.pl może być za Cloudflare z własnymi blokadami — jeśli czysty curl dostaje 502 na WSZYSTKO (też na sitemap), problemem jest warstwa Cloudflare, nie ten kod; sprawdź wtedy z UA przeglądarkowym i zgłoś użytkownikowi.

- [ ] **Step 4: Raport**

Zbierz wyniki kryteriów 1-8 ze spec i przedstaw użytkownikowi; merge do main wykonuje użytkownik.
