import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { __resetRenderCache } from '../render';
import { generateListingSlug } from '../../utils/url-utils.js';
import { __resetBrandCatalogCache } from '../../services/brand-pages.service.js';
import { __resetSeoContentCache } from '../../services/seo-content.js';
import { setSsrCache } from '../../services/ssr-cache.js';

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /><meta property="og:title" content="OLD" /><meta property="og:description" content="OLDD" /><meta property="og:url" content="https://old.example" /><meta name="twitter:title" content="OLD" /><meta name="twitter:description" content="OLDD" /></head><body><div id="root"><!--home-shell--><h1>Szeroki wybór aut.<br><span>Proste finansowanie.</span></h1><!--/home-shell--></div></body></html>`;

describe('GET /api/render', () => {
    let app: FastifyInstance;
    let prevBrand: string | undefined;
    let prevFrontendUrl: string | undefined;
    let prevInternalFrontendUrl: string | undefined;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        const originalInject = app.inject.bind(app);
        app.inject = ((opt: any) => {
            const options = typeof opt === 'string' ? { url: opt } : { ...opt };
            options.headers = {
                host: 'motolia.pl',
                ...(options.headers || {}),
            };
            return originalInject(options);
        }) as any;
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        prevBrand = process.env.BRAND;
        prevFrontendUrl = process.env.FRONTEND_URL;
        prevInternalFrontendUrl = process.env.INTERNAL_FRONTEND_URL;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        await __resetRenderCache();
        __resetBrandCatalogCache();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(TEMPLATE, { status: 200 }))
        );
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_RENDER' } });
        await app.prisma.listing.deleteMany({ where: { make: 'Test Brand Page' } });
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
        expect(res.body).toContain(`rel="canonical" href="https://motolia.pl/oferta/${slug}"`);
        expect(res.body).toContain('application/ld+json');
    });

    it('leasing variant canonicalizes to /oferta', async () => {
        const l = await createListing();
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({ method: 'GET', url: `/api/render?path=/leasing/${slug}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain(`rel="canonical" href="https://motolia.pl/oferta/${slug}"`);
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

    it('recently archived listing returns 200 with noindex and banner', async () => {
        const l = await createListing();
        await app.prisma.listing.update({ where: { id: l.id }, data: { isArchived: true, archivedAt: new Date() } });
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('noindex');
        expect(res.body).toContain('Oferta archiwalna');
    });

    it('static route gets unique title', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('używane');
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/uzywane"');
    });

    it('home page SEO (no active hero banner): title, description, exactly 1 h1, and JSON-LD (Organization, WebSite)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(res.statusCode).toBe(200);

        // Title length check (50-65 chars)
        const titleMatch = res.body.match(/<title>(.*?)<\/title>/);
        expect(titleMatch).not.toBeNull();
        const titleText = titleMatch![1];
        expect(titleText.length).toBeGreaterThanOrEqual(50);
        expect(titleText.length).toBeLessThanOrEqual(65);

        // Meta description length check (140-165 chars)
        const descMatch = res.body.match(/<meta name="description" content="(.*?)"/);
        expect(descMatch).not.toBeNull();
        const descText = descMatch![1];
        expect(descText.length).toBeGreaterThanOrEqual(140);
        expect(descText.length).toBeLessThanOrEqual(165);

        // H1 count: exactly 1 <h1...
        const h1Matches = res.body.match(/<h1[\s>]/g) || [];
        expect(h1Matches.length).toBe(1);

        // JSON-LD schemas
        expect(res.body).toContain('"@type":"Organization"');
        expect(res.body).toContain('"@type":"WebSite"');
        expect(res.body).toContain('"SearchAction"');
    });

    it('home page SEO (active hero banner): SSR banner shell replaces the static home-shell, still exactly 1 h1 with the home H1 text', async () => {
        const banner = await app.prisma.heroBanner.create({
            data: {
                imageUrlDesktop: '/uploads/hero-banners/test-render-banner.webp',
                imageUrlMobile: '/uploads/hero-banners/test-render-banner-mobile.webp',
                altText: 'Test render banner',
                isActive: true,
            },
        });
        try {
            const res = await app.inject({ method: 'GET', url: '/api/render?path=/' });
            expect(res.statusCode).toBe(200);

            // Statyczny <!--home-shell--> z TEMPLATE zniknął — podmieniony na SSR bannera
            expect(res.body).not.toContain('Szeroki wybór aut.');
            expect(res.body).toContain('test-render-banner');
            expect(res.body).toContain('<img');

            // H1 count: exactly 1 <h1...
            const h1Matches = res.body.match(/<h1[\s>]/g) || [];
            expect(h1Matches.length).toBe(1);

            const h1Match = res.body.match(/<h1[^>]*>(.*?)<\/h1>/);
            expect(h1Match).not.toBeNull();
            expect(h1Match![1]).toContain('Leasing, kredyt i wynajem samochodów');
        } finally {
            await app.prisma.heroBanner.delete({ where: { id: banner.id } });
        }
    });

    it('injects route chunk modulepreload from vite manifest', async () => {
        const MANIFEST = {
            'src/pages/ConditionPage.tsx': { file: 'assets/ConditionPage-abc.js', imports: ['_shared-xyz.js'] },
            '_shared-xyz.js': { file: 'assets/shared-xyz.js' },
            'index.html': { file: 'assets/index-main.js', isEntry: true },
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: unknown) =>
                String(url).includes('manifest.json')
                    ? new Response(JSON.stringify(MANIFEST), { status: 200 })
                    : new Response(TEMPLATE, { status: 200 })
            )
        );
        // Domyślnie SSR_MODULEPRELOAD jest wyłączony
        const resDefault = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(resDefault.statusCode).toBe(200);
        expect(resDefault.body).not.toContain('<link rel="modulepreload"');

        // Wyjście awaryjne: SSR_MODULEPRELOAD=on
        const prevEnv = process.env.SSR_MODULEPRELOAD;
        try {
            process.env.SSR_MODULEPRELOAD = 'on';
            const resOn = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
            expect(resOn.statusCode).toBe(200);
            expect(resOn.body).toContain('<link rel="modulepreload" href="/assets/ConditionPage-abc.js" />');
            expect(resOn.body).toContain('<link rel="modulepreload" href="/assets/shared-xyz.js" />');
            // Główny bundle jest już w <script> szablonu — nie może być dublowany preloadem
            expect(resOn.body).not.toContain('index-main.js');
        } finally {
            process.env.SSR_MODULEPRELOAD = prevEnv;
        }
    });

    it('preloads only the rental route entry when recursive modulepreload is disabled', async () => {
        const MANIFEST = {
            'src/pages/RentalSearchPage.tsx': { file: 'assets/RentalSearchPage-rental.js', imports: ['_shared-rental.js'] },
            '_shared-rental.js': { file: 'assets/shared-rental.js' },
            'index.html': { file: 'assets/index-main.js', isEntry: true },
        };
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: unknown) =>
                String(url).includes('manifest.json')
                    ? new Response(JSON.stringify(MANIFEST), { status: 200 })
                    : new Response(TEMPLATE, { status: 200 })
            )
        );

        const res = await app.inject({ method: 'GET', url: '/api/render?path=/wynajem-dlugoterminowy' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<link rel="preload" as="script" href="/assets/RentalSearchPage-rental.js" crossorigin />');
        expect(res.body).not.toContain('shared-rental.js');
        expect(res.body).not.toContain('<link rel="modulepreload"');
    });

    it('injects window.__APP_SETTINGS__ and window.__CATALOG_PREFETCH__ correctly', async () => {
        const resHome = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(resHome.statusCode).toBe(200);
        expect(resHome.body).toContain('window.__APP_SETTINGS__=');
        expect(resHome.body).not.toContain('window.__CATALOG_PREFETCH__=');

        const resNowe = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(resNowe.statusCode).toBe(200);
        expect(resNowe.body).toContain('window.__APP_SETTINGS__=');
        expect(resNowe.body).toContain('window.__CATALOG_PREFETCH__=');
        expect(resNowe.body).toContain('status=NEW&rateType=credit&rateBasis=gross');

        const resUzywane = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane' });
        expect(resUzywane.statusCode).toBe(200);
        expect(resUzywane.body).toContain('window.__CATALOG_PREFETCH__=');
        expect(resUzywane.body).toContain('status=USED&rateType=credit&rateBasis=gross');

        const resNowePage2 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe&page=2' });
        expect(resNowePage2.body).not.toContain('window.__CATALOG_PREFETCH__=');

        const resSamochody = await app.inject({ method: 'GET', url: '/api/render?path=/samochody' });
        expect(resSamochody.statusCode).toBe(200);
        expect(resSamochody.body).toContain('window.__CATALOG_PREFETCH__=');
        expect(resSamochody.body).toContain('/api/listings?rateType=credit&rateBasis=gross');
        expect(resSamochody.body).toContain('||location.search)return;');
        const resSamochodyPage2 = await app.inject({ method: 'GET', url: '/api/render?path=/samochody&page=2' });
        expect(resSamochodyPage2.body).not.toContain('window.__CATALOG_PREFETCH__=');
    });

    it('injects browser-segment rental fetch-ahead only on the first rental page', async () => {
        const first = await app.inject({ method: 'GET', url: '/api/render?path=/wynajem-dlugoterminowy' });
        expect(first.statusCode).toBe(200);
        expect(first.body).toContain('window.__RENTAL_PREFETCH__=');
        expect(first.body).not.toContain('href="/api/rental/vehicles?limit=1"');
        expect(first.body).toContain('localStorage.getItem("rentalClientType")');
        const next = await app.inject({ method: 'GET', url: '/api/render?path=/wynajem-dlugoterminowy&page=2' });
        expect(next.body).not.toContain('window.__RENTAL_PREFETCH__=');
        const home = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(home.body).not.toContain('window.__RENTAL_PREFETCH__=');
    });

    it('listing detail gets LCP image preload with srcset variants', async () => {
        const l = await app.prisma.listing.create({
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
                primaryImageUrl: '/uploads/listings/test-render.webp',
            },
        });
        const slug = generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id);
        const res = await app.inject({ method: 'GET', url: `/api/render?path=/oferta/${slug}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="preload" as="image" fetchpriority="high"');
        expect(res.body).toContain('test-render-thumb.webp 600w');
        expect(res.body).toContain('test-render-md.webp 900w');
    });

    it('unknown path: 404 + noindex + brand default title', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/xyz-nie-istnieje' });
        expect(res.statusCode).toBe(404);
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
        expect(res.body).toContain(`rel="canonical" href="https://motolia.pl/oferta/${trueSlug}"`);
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

    it('home-shell zostaje na /, znika na innych trasach', async () => {
        const SHELL_TEMPLATE = TEMPLATE.replace(
            '<div id="root"></div>',
            '<div id="root"><!--home-shell--><h1>Szeroki wybór aut</h1><!--/home-shell--></div>'
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(SHELL_TEMPLATE, { status: 200 }))
        );

        const home = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(home.statusCode).toBe(200);
        expect(home.body).toContain('Szeroki wybór aut');

        await __resetRenderCache();
        const other = await app.inject({ method: 'GET', url: '/api/render?path=/uzywane' });
        expect(other.statusCode).toBe(200);
        expect(other.body).not.toContain('Szeroki wybór aut');
        expect(other.body).not.toContain('home-shell');
    });
});

describe('GET /api/render — brand/model pages', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        const originalInject = app.inject.bind(app);
        app.inject = ((opt: any) => {
            const options = typeof opt === 'string' ? { url: opt } : { ...opt };
            options.headers = {
                host: 'motolia.pl',
                ...(options.headers || {}),
            };
            return originalInject(options);
        }) as any;
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'Test Brand Page' } });
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        await __resetRenderCache();
        __resetBrandCatalogCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        vi.stubGlobal('fetch', vi.fn(async () => new Response(TEMPLATE, { status: 200 })));
        await app.prisma.listing.deleteMany({ where: { make: 'Test Brand Page' } });
    });

    async function createListing(overrides: Partial<Parameters<typeof app.prisma.listing.create>[0]['data']> = {}) {
        return app.prisma.listing.create({
            data: {
                make: 'Test Brand Page',
                model: 'Test Model One',
                version: null,
                pricePln: 100000,
                mileageKm: 10,
                productionYear: 2024,
                fuelType: 'benzyna',
                bodyType: 'suv',
                isArchived: false,
                ...overrides,
            },
        });
    }

    it('brand page: 200, self-canonical, offer count in title, breadcrumb links', async () => {
        await createListing();
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/test-brand-page' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/samochody/test-brand-page"');
        expect(res.body).not.toContain('noindex');
        expect(res.body).toContain('Test Brand Page (1 oferta)');
        expect(res.body).toContain('<h1>Samochody Test Brand Page dostępne od ręki — nowe i używane</h1>');
    });

    it('brand page: unknown slug is 404 + noindex', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/nie-ma-takiej-marki-xyz' });
        expect(res.statusCode).toBe(404);
        expect(res.body).toContain('noindex');
    });

    it('model page: below threshold (1 offer) is 200 + noindex, self-canonical', async () => {
        await createListing();
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/test-brand-page/test-model-one' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('noindex');
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/samochody/test-brand-page/test-model-one"');
        expect(res.body).toContain('Test Brand Page Test Model One');
    });

    it('model page: at threshold (2 offers) is indexable', async () => {
        await createListing();
        await createListing({ version: 'v2' });
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/test-brand-page/test-model-one' });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('noindex');
        expect(res.body).toContain('Test Brand Page Test Model One (2 oferty)');
    });

    it('model page: unknown model under a known brand is 404 + noindex', async () => {
        await createListing();
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/test-brand-page/nie-taki-model' });
        expect(res.statusCode).toBe(404);
        expect(res.body).toContain('noindex');
    });

    it('/samochody?make=X (single brand) canonicalizes to the brand page', async () => {
        await createListing();
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody' + encodeURIComponent('?make=Test Brand Page') });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/samochody/test-brand-page"');
    });

    it('/samochody?make=X&model=Y canonicalizes to the model page', async () => {
        await createListing();
        const url = '/api/render?path=/samochody' + encodeURIComponent('?make=Test Brand Page&model=Test Model One');
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/samochody/test-brand-page/test-model-one"');
    });

    it('/samochody?make=X&make=Y (multiple brands) canonical stays on /samochody', async () => {
        await createListing();
        const url = '/api/render?path=/samochody' + encodeURIComponent('?make=Test Brand Page,BMW');
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://motolia.pl/samochody"');
    });

    it('/samochody shows a "Popularne marki" internal-linking block linking to brand pages', async () => {
        await createListing();
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<h2>Popularne marki</h2>');
        // top brands by count (real seed data dominates the tiny test fixture) — just assert
        // the block links to *some* real brand page, proving it's wired to the live catalog.
        expect(res.body).toMatch(/<a href="\/samochody\/[a-z0-9-]+">[^<]+<\/a> \(\d+\)/);
    });
});

describe('GET /api/render — brand/model pages with CMS content (F2)', () => {
    let app: FastifyInstance;
    const BRAND_URL_PATH = '/samochody/test-cms-brand';
    const MODEL_URL_PATH = '/samochody/test-cms-brand/test-cms-model';

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        const originalInject = app.inject.bind(app);
        app.inject = ((opt: any) => {
            const options = typeof opt === 'string' ? { url: opt } : { ...opt };
            options.headers = {
                host: 'motolia.pl',
                ...(options.headers || {}),
            };
            return originalInject(options);
        }) as any;
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'Test CMS Brand' } });
        await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { in: [BRAND_URL_PATH, MODEL_URL_PATH] } } });
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        await __resetRenderCache();
        __resetBrandCatalogCache();
        __resetSeoContentCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        vi.stubGlobal('fetch', vi.fn(async () => new Response(TEMPLATE, { status: 200 })));
        await app.prisma.listing.deleteMany({ where: { make: 'Test CMS Brand' } });
        await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { in: [BRAND_URL_PATH, MODEL_URL_PATH] } } });
    });

    // Trwałość (spec §1/F2 pkt 4e) wymaga, żeby marka/model kiedykolwiek miały choć jedną
    // ofertę (nawet zarchiwizowaną) — tylko wtedy jest z czego odtworzyć kanoniczną nazwę.
    async function createArchivedListing(overrides: Partial<Parameters<typeof app.prisma.listing.create>[0]['data']> = {}) {
        const l = await app.prisma.listing.create({
            data: {
                make: 'Test CMS Brand',
                model: 'Test CMS Model',
                version: null,
                pricePln: 100000,
                mileageKm: 10,
                productionYear: 2024,
                fuelType: 'benzyna',
                bodyType: 'suv',
                isArchived: false,
                ...overrides,
            },
        });
        await app.prisma.listing.update({ where: { id: l.id }, data: { isArchived: true } });
        return l;
    }

    it('without CMS content: brand/model with 0 active offers still 404s (unchanged F1 limitation)', async () => {
        await createArchivedListing();
        const brandRes = await app.inject({ method: 'GET', url: `/api/render?path=${BRAND_URL_PATH}` });
        expect(brandRes.statusCode).toBe(404);
        const modelRes = await app.inject({ method: 'GET', url: `/api/render?path=${MODEL_URL_PATH}` });
        expect(modelRes.statusCode).toBe(404);
    });

    it('brand page persists at 0 active offers when CMS content is published: 200, indexable, content rendered', async () => {
        await createArchivedListing();
        await app.prisma.seoContentPage.create({
            data: {
                urlPath: BRAND_URL_PATH,
                contentMd: '## Historia marki\n\nOpis redakcyjny testowej marki.',
                metaTitle: 'CMS Brand — tytuł',
                isPublished: true,
            },
        });
        const res = await app.inject({ method: 'GET', url: `/api/render?path=${BRAND_URL_PATH}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('noindex');
        expect(res.body).toContain('<title>CMS Brand — tytuł</title>');
        expect(res.body).toContain('<div class="cms-content"><h2>Historia marki</h2>');
        expect(res.body).toContain('Opis redakcyjny testowej marki.');
        // Brak ofert (F3): komunikat waitlist + linki "podobne auta" (Popularne marki, dane realnego seeda)
        expect(res.body).toContain('Aktualnie brak ofert Test CMS Brand — zostaw kontakt, powiadomimy o nowej ofercie.');
        expect(res.body).toMatch(/<h2>Popularne marki<\/h2>[\s\S]*<a href="\/samochody\/[a-z0-9-]+">[^<]+<\/a> \(\d+\)/);
    });

    it('model page persists at 0 active offers when CMS content is published: 200, indexable (noindex overridden), content + editorial FAQ rendered', async () => {
        await createArchivedListing();
        await app.prisma.seoContentPage.create({
            data: {
                urlPath: MODEL_URL_PATH,
                contentMd: '## Opis modelu\n\nTreść o testowym modelu.\n\n## Czy model jest dostępny?\n\nSprawdź u dealera.',
                isPublished: true,
            },
        });
        const res = await app.inject({ method: 'GET', url: `/api/render?path=${MODEL_URL_PATH}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('noindex');
        expect(res.body).toContain('<div class="cms-content"><h2>Opis modelu</h2>');
        expect(res.body).toContain('<h3>Czy model jest dostępny?</h3>');
        expect(res.body).toContain('application/ld+json');
        expect(res.body).toContain('FAQPage');
    });

    it('model page at exactly 1 active offer is indexable when CMS content is published (below the normal >=2 threshold)', async () => {
        const l = await createArchivedListing();
        await app.prisma.listing.update({ where: { id: l.id }, data: { isArchived: false } }); // 1 active offer
        await app.prisma.seoContentPage.create({
            data: { urlPath: MODEL_URL_PATH, contentMd: 'Treść dla modelu z jedną ofertą.', isPublished: true },
        });
        __resetBrandCatalogCache();
        const res = await app.inject({ method: 'GET', url: `/api/render?path=${MODEL_URL_PATH}` });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('noindex');
        expect(res.body).toContain('Treść dla modelu z jedną ofertą.');
    });

    it('unpublished CMS content does not persist the page (still 404 at 0 offers)', async () => {
        await createArchivedListing();
        await app.prisma.seoContentPage.create({
            data: { urlPath: MODEL_URL_PATH, contentMd: 'Szkic, niepublikowany.', isPublished: false },
        });
        const res = await app.inject({ method: 'GET', url: `/api/render?path=${MODEL_URL_PATH}` });
        expect(res.statusCode).toBe(404);
    });
});

describe('GET /api/render — catalog skeleton (SSR-lite)', () => {
    let app: FastifyInstance;
    // Szablon z blokiem home-shell w #root — jak w realnym zbudowanym index.html (vite.config.ts)
    const SHELL_TEMPLATE = TEMPLATE.replace(
        '<div id="root"></div>',
        '<div id="root"><!--home-shell--><h1>Szeroki wybór aut</h1><!--/home-shell--></div>'
    );

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        const originalInject = app.inject.bind(app);
        app.inject = ((opt: any) => {
            const options = typeof opt === 'string' ? { url: opt } : { ...opt };
            options.headers = {
                host: 'motolia.pl',
                ...(options.headers || {}),
            };
            return originalInject(options);
        }) as any;
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        await __resetRenderCache();
        __resetBrandCatalogCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        vi.stubGlobal('fetch', vi.fn(async () => new Response(SHELL_TEMPLATE, { status: 200 })));
    });

    it('/nowe: skeleton katalogowy zamiast home-shell', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<!--catalog-shell-->');
        expect(res.body).toContain('skeleton-shimmer');
        expect(res.body).not.toContain('<!--home-shell-->');
    });

    it('/: home-shell zostaje, brak skeletonu katalogowego', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<!--home-shell-->');
        expect(res.body).not.toContain('<!--catalog-shell-->');
    });

    it('home-preload: zostaje na /, wycinany poza /', async () => {
        const PRELOAD_TEMPLATE = SHELL_TEMPLATE.replace(
            '<head>',
            '<head><!--home-preload--><link rel="preload" href="/api/hero-banners/public" as="fetch" /><!--/home-preload-->'
        );
        vi.stubGlobal('fetch', vi.fn(async () => new Response(PRELOAD_TEMPLATE, { status: 200 })));
        const home = await app.inject({ method: 'GET', url: '/api/render?path=/' });
        expect(home.body).toContain('<!--home-preload-->');
        expect(home.body).toContain('/api/hero-banners/public');
        const other = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(other.body).not.toContain('<!--home-preload-->');
        expect(other.body).not.toContain('/api/hero-banners/public');
    });

    it('/oferta/:slug: skeleton detalu (galeria+sidebar), nie katalogowy ani home-shell', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/oferta/audi-a4-2024-aaaaaaaaaaaaaaaaaaaaaaaaa' });
        expect(res.body).toContain('<!--detail-shell-->');
        expect(res.body).toContain('skeleton-shimmer');
        expect(res.body).not.toContain('<!--catalog-shell-->');
        expect(res.body).not.toContain('<!--home-shell-->');
    });

    it('/wynajem-dlugoterminowy/:slug: ten sam skeleton detalu', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/wynajem-dlugoterminowy/bmw-x3-2024' });
        expect(res.body).toContain('<!--detail-shell-->');
        expect(res.body).not.toContain('<!--catalog-shell-->');
    });

    it('/leasing: artykuł filarowy — bez skeletonu katalogowego i bez home-shell', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/leasing' });
        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('<!--catalog-shell-->');
        expect(res.body).not.toContain('<!--home-shell-->');
    });

    it('/oferta/:slug: strona detalu — bez skeletonu katalogowego i bez home-shell', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/oferta/cokolwiek' });
        expect(res.body).not.toContain('<!--catalog-shell-->');
        expect(res.body).not.toContain('<!--home-shell-->');
    });

    it('/samochody/:marka: skeleton katalogowy (trasa z dynamicznym segmentem)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/samochody/bmw' });
        expect(res.body).toContain('<!--catalog-shell-->');
    });

    it('grid: xl:grid-cols-3 przy searchGridColumns=3, domyślnie xl:grid-cols-4', async () => {
        const original = await app.prisma.appSettings.findUnique({ where: { id: 'default' } });
        try {
            await app.prisma.appSettings.update({ where: { id: 'default' }, data: { searchGridColumns: 3 } });
            await __resetRenderCache();
            const res3 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
            expect(res3.body).toContain('xl:grid-cols-3');

            await app.prisma.appSettings.update({ where: { id: 'default' }, data: { searchGridColumns: 4 } });
            await __resetRenderCache();
            const res4 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
            expect(res4.body).toContain('xl:grid-cols-4');
        } finally {
            if (original) {
                await app.prisma.appSettings.update({
                    where: { id: 'default' },
                    data: { searchGridColumns: original.searchGridColumns },
                });
            }
        }
    });

    it('/promo/:slug returns noindex by default and respects isIndexable=true', async () => {
        const lpDefault = await app.prisma.landingPage.create({
            data: {
                slug: 'test-promo-noindex',
                name: 'Test Promo NoIndex',
                heroTitle: 'Nagłówek NoIndex',
                isIndexable: false,
            },
        });
        const lpIndexable = await app.prisma.landingPage.create({
            data: {
                slug: 'test-promo-indexable',
                name: 'Test Promo Indexable',
                heroTitle: 'Nagłówek Indexable',
                isIndexable: true,
            },
        });

        try {
            const resNoIndex = await app.inject({ method: 'GET', url: '/api/render?path=/promo/test-promo-noindex' });
            expect(resNoIndex.statusCode).toBe(200);
            expect(resNoIndex.body).toContain('<meta name="robots" content="noindex" />');

            const resIndexable = await app.inject({ method: 'GET', url: '/api/render?path=/promo/test-promo-indexable' });
            expect(resIndexable.statusCode).toBe(200);
            expect(resIndexable.body).not.toContain('<meta name="robots" content="noindex" />');
        } finally {
            await app.prisma.landingPage.deleteMany({
                where: { id: { in: [lpDefault.id, lpIndexable.id] } },
            });
        }
    });

    it('caches rendered page in Redis SSR cache and serves repeated requests', async () => {
        const fetchSpy = vi.fn(async () => new Response(TEMPLATE, { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        await __resetRenderCache();

        // 1. First request fills Redis SSR cache
        const res1 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res1.statusCode).toBe(200);
        const fetchCallsCountInitial = fetchSpy.mock.calls.length;

        // 2. Second request within TTL uses cached page (no new template/manifest fetch calls)
        const res2 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res2.statusCode).toBe(200);
        expect(fetchSpy.mock.calls.length).toBe(fetchCallsCountInitial);

        // 3. Resetting cache forces a new render
        await __resetRenderCache();
        const res3 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res3.statusCode).toBe(200);
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(fetchCallsCountInitial);
    });

    it('does not serve cached HTML from a previous frontend build', async () => {
        const currentTemplate = TEMPLATE.replace(
            '</body>',
            '<script type="module" src="/assets/index-current.js"></script></body>'
        );
        const fetchSpy = vi.fn(async () => new Response(currentTemplate, { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        await setSsrCache('/faq', {
            html: '<!doctype html><html><body>OLD BUILD<script type="module" src="/assets/index-old.js"></script></body></html>',
            status: 200,
            noindex: false,
            at: Date.now()
        });

        const res = await app.inject({ method: 'GET', url: '/api/render?path=/faq' });

        expect(res.statusCode).toBe(200);
        expect(res.body).not.toContain('OLD BUILD');
        expect(res.body).toContain('/assets/index-current.js');
        expect(fetchSpy).toHaveBeenCalled();
    });

    it('serves stale cached HTML immediately and triggers background revalidation', async () => {
        const fetchSpy = vi.fn(async () => new Response(TEMPLATE, { status: 200 }));
        vi.stubGlobal('fetch', fetchSpy);

        const staleAt = Date.now() - (8 * 3600 * 1000); // 8 hours old (stale > 6h)
        await setSsrCache('/nowe', {
            html: '<!doctype html><html><body>STALE CONTENT</body></html>',
            status: 200,
            noindex: false,
            at: staleAt
        });

        // Request should return the STALE content immediately with 200
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('STALE CONTENT');

        // Wait for background async render to execute (polling with 1s timeout to prevent CI flakes)
        const start = Date.now();
        while (fetchSpy.mock.calls.length === 0 && Date.now() - start < 1000) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('serves cached 301 redirect directly from Redis SSR cache', async () => {
        await setSsrCache('/oferta/old-slug', {
            html: '',
            status: 301,
            redirectUrl: '/oferta/new-slug',
            noindex: false,
            at: Date.now()
        });

        const res = await app.inject({ method: 'GET', url: '/api/render?path=/oferta/old-slug' });
        expect(res.statusCode).toBe(301);
        expect(res.headers['location']).toBe('/oferta/new-slug');
        expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    describe('Cache-Control headers for Edge Caching', () => {
        it('requires edge revalidation for anonymous 200 GET and HEAD requests (fresh & cached)', async () => {
            const res1 = await app.inject({ method: 'GET', url: '/api/render?path=/' });
            expect(res1.statusCode).toBe(200);
            expect(res1.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
            expect(res1.headers['vary']).toBe('Accept-Encoding');

            // Repeated request (cache hit)
            const res2 = await app.inject({ method: 'GET', url: '/api/render?path=/' });
            expect(res2.statusCode).toBe(200);
            expect(res2.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
            expect(res2.headers['vary']).toBe('Accept-Encoding');

            // HEAD request
            const resHead = await app.inject({ method: 'HEAD', url: '/api/render?path=/' });
            expect(resHead.statusCode).toBe(200);
            expect(resHead.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
        });

        it('emits private no-store for requests with Authorization header', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/',
                headers: { authorization: 'Bearer test-token' },
            });
            expect(res.headers['cache-control']).toBe('private, no-store');
        });

        it('remains cacheable for requests with an analytics cookie', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/',
                headers: { cookie: '_ga=GA1.1.123.456; _clsk=abc123sid456' },
            });
            expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
        });

        it('emits private no-store for /admin routes', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/admin',
            });
            expect(res.headers['cache-control']).toBe('private, no-store');
        });

        it('emits private no-store for 404 responses', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/oferta/non-existent-listing-111111111111111111111111',
            });
            expect(res.statusCode).toBe(404);
            expect(res.headers['cache-control']).toBe('private, no-store');
        });
    });
});

