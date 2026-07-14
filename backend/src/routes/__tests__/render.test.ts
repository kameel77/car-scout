import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { __resetRenderCache } from '../render';
import { generateListingSlug } from '../../utils/url-utils.js';
import { __resetBrandCatalogCache } from '../../services/brand-pages.service.js';
import { __resetSeoContentCache } from '../../services/seo-content.js';

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
        __resetBrandCatalogCache();
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
        const res = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('<link rel="modulepreload" href="/assets/ConditionPage-abc.js" />');
        expect(res.body).toContain('<link rel="modulepreload" href="/assets/shared-xyz.js" />');
        // Główny bundle jest już w <script> szablonu — nie może być dublowany preloadem
        expect(res.body).not.toContain('index-main.js');
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
        expect(res.body).toContain('test-render-md.webp 1200w');
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

        __resetRenderCache();
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
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'Test Brand Page' } });
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        __resetRenderCache();
        __resetBrandCatalogCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
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
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/samochody/test-brand-page"');
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
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/samochody/test-brand-page/test-model-one"');
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
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/samochody/test-brand-page"');
    });

    it('/samochody?make=X&model=Y canonicalizes to the model page', async () => {
        await createListing();
        const url = '/api/render?path=/samochody' + encodeURIComponent('?make=Test Brand Page&model=Test Model One');
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/samochody/test-brand-page/test-model-one"');
    });

    it('/samochody?make=X&make=Y (multiple brands) canonical stays on /samochody', async () => {
        await createListing();
        const url = '/api/render?path=/samochody' + encodeURIComponent('?make=Test Brand Page,BMW');
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('rel="canonical" href="https://dev.motolia.pl/samochody"');
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
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'Test CMS Brand' } });
        await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { in: [BRAND_URL_PATH, MODEL_URL_PATH] } } });
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        __resetRenderCache();
        __resetBrandCatalogCache();
        __resetSeoContentCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
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
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        __resetRenderCache();
        __resetBrandCatalogCache();
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
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
            __resetRenderCache();
            const res3 = await app.inject({ method: 'GET', url: '/api/render?path=/nowe' });
            expect(res3.body).toContain('xl:grid-cols-3');

            await app.prisma.appSettings.update({ where: { id: 'default' }, data: { searchGridColumns: 4 } });
            __resetRenderCache();
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
});
