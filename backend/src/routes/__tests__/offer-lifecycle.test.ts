import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { __resetRenderCache } from '../render.js';
import { __resetSitemapCache } from '../seo.js';
import { __resetBrandCatalogCache } from '../../services/brand-pages.service.js';
import { generateListingSlug } from '../../utils/url-utils.js';

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('Offer Lifecycle & Sitemap Hygiene (SEO P0)', () => {
    let app: FastifyInstance;
    let prevBrand: string | undefined;
    let prevFrontendUrl: string | undefined;

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
        __resetRenderCache();
        __resetSitemapCache();
        __resetBrandCatalogCache();
        prevBrand = process.env.BRAND;
        prevFrontendUrl = process.env.FRONTEND_URL;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(TEMPLATE, { status: 200 }))
        );
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_LIFECYCLE' } });
    });

    afterEach(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_LIFECYCLE' } });
        if (prevBrand === undefined) delete process.env.BRAND;
        else process.env.BRAND = prevBrand;
        if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = prevFrontendUrl;
    });

    async function createTestListing(data: Partial<any> = {}) {
        return app.prisma.listing.create({
            data: {
                make: 'TEST_LIFECYCLE',
                model: 'Corolla',
                version: 'Comfort 1.8 Hybrid',
                productionYear: 2023,
                pricePln: 95000,
                mileageKm: 25000,
                fuelType: 'Hybrid',
                bodyType: 'Kombi',
                isArchived: false,
                ...data,
            },
        });
    }

    it('1. Active offer returns 200, indexable, and appears in sitemap with lastmod', async () => {
        const listing = await createTestListing();
        const slug = generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            listing.id
        );

        // SSR render check
        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('TEST_LIFECYCLE Corolla');
        expect(res.body).not.toContain('noindex');
        expect(res.body).not.toContain('Oferta archiwalna');

        // Sitemap check
        const sitemapRes = await app.inject({
            method: 'GET',
            url: '/api/sitemap.xml',
        });

        expect(sitemapRes.statusCode).toBe(200);
        expect(sitemapRes.body).toContain(`/oferta/${slug}`);
        expect(sitemapRes.body).toContain('<lastmod>');
    });

    it('2. Recently sold offer (<= 90 days) returns 200 + noindex, not in sitemap, displays archival banner and similar cars', async () => {
        // Create an active sibling listing to act as a similar available car
        const sibling = await createTestListing({
            model: 'Corolla',
            version: 'Executive 2.0 Hybrid',
            pricePln: 110000,
        });

        // Archived 30 days ago
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const soldListing = await createTestListing({
            isArchived: true,
            archivedAt: thirtyDaysAgo,
            archivedReason: 'Sold by partner dealer',
        });

        const slug = generateListingSlug(
            soldListing.make,
            soldListing.model,
            soldListing.version,
            soldListing.productionYear,
            soldListing.bodyType,
            soldListing.fuelType,
            soldListing.id
        );

        // SSR render check
        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });

        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('noindex');
        expect(res.body).toContain('Oferta archiwalna');
        expect(res.body).toContain('Podobne dostępne samochody');
        expect(res.body).toContain('110 000 zł'); // sibling price present
        expect(res.body).toContain('/samochody/testlifecycle/corolla'); // CTA link present
        expect(res.body).toContain('/kalkulator-rat');

        // API check
        const apiRes = await app.inject({
            method: 'GET',
            url: `/api/listings/${soldListing.id}`,
        });
        expect(apiRes.statusCode).toBe(200);
        const apiData = JSON.parse(apiRes.body);
        expect(apiData.isRecentlySold).toBe(true);
        expect(apiData.similarListings.length).toBeGreaterThanOrEqual(1);

        // Sitemap check - MUST NOT BE IN SITEMAP
        __resetSitemapCache();
        const sitemapRes = await app.inject({
            method: 'GET',
            url: '/api/sitemap.xml',
        });
        expect(sitemapRes.body).not.toContain(`/oferta/${slug}`);
    });

    it('3. Long-gone offer (> 90 days) 301 redirects to valid model page, NEVER to homepage', async () => {
        // Create 2 active siblings so model catalog has count >= 2
        await createTestListing({
            model: 'Corolla',
            pricePln: 99000,
        });
        await createTestListing({
            model: 'Corolla',
            pricePln: 105000,
        });

        // Archived 120 days ago (> 90 days)
        const oneHundredTwentyDaysAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
        const oldListing = await createTestListing({
            isArchived: true,
            archivedAt: oneHundredTwentyDaysAgo,
        });

        const slug = generateListingSlug(
            oldListing.make,
            oldListing.model,
            oldListing.version,
            oldListing.productionYear,
            oldListing.bodyType,
            oldListing.fuelType,
            oldListing.id
        );

        // SSR render check
        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });

        expect(res.statusCode).toBe(301);
        expect(res.headers.location).toBe('/samochody/testlifecycle/corolla');
        expect(res.headers.location).not.toBe('/'); // NEVER redirect to homepage

        // API check
        const apiRes = await app.inject({
            method: 'GET',
            url: `/api/listings/${oldListing.id}`,
        });
        expect(apiRes.statusCode).toBe(200);
        const apiData = JSON.parse(apiRes.body);
        expect(apiData.redirectUrl).toBe('/samochody/testlifecycle/corolla');
        expect(apiData.isLongGone).toBe(true);
    });

    it('4. Long-gone offer (> 90 days) with no active model but active brand 301 redirects to brand page', async () => {
        // Create active car with different model under same brand
        await createTestListing({
            model: 'Yaris',
            pricePln: 65000,
        });

        // Archived 120 days ago with model "RAV4" (no active RAV4)
        const oldListing = await createTestListing({
            model: 'RAV4',
            isArchived: true,
            archivedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        });

        const slug = generateListingSlug(
            oldListing.make,
            oldListing.model,
            oldListing.version,
            oldListing.productionYear,
            oldListing.bodyType,
            oldListing.fuelType,
            oldListing.id
        );

        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });

        expect(res.statusCode).toBe(301);
        expect(res.headers.location).toBe('/samochody/testlifecycle');
        expect(res.headers.location).not.toBe('/');
    });

    it('5. Long-gone offer (> 90 days) with no active brand/model returns 410 Gone', async () => {
        // No active listings created for this brand
        const oldListing = await createTestListing({
            make: 'TEST_LIFECYCLE',
            model: 'ObsoleteModel',
            isArchived: true,
            archivedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
        });

        const slug = generateListingSlug(
            oldListing.make,
            oldListing.model,
            oldListing.version,
            oldListing.productionYear,
            oldListing.bodyType,
            oldListing.fuelType,
            oldListing.id
        );

        const res = await app.inject({
            method: 'GET',
            url: `/api/render?path=/oferta/${slug}`,
        });

        expect(res.statusCode).toBe(410);
        expect(res.headers.location).toBeUndefined();
    });

    it('6. Unknown offer slug returns 404', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/render?path=/oferta/non-existent-make-model-2024-kombi-hybrid-cmr9999999999999999999999',
        });

        expect(res.statusCode).toBe(404);
        expect(res.headers.location).toBeUndefined();
    });

    it('7. Sitemap contains accurate lastmod on listings and omits fake lastmod on static pages', async () => {
        const activeListing = await createTestListing({ pricePln: 80000 });
        const archivedListing = await createTestListing({ isArchived: true, archivedAt: new Date() });

        __resetSitemapCache();
        const res = await app.inject({
            method: 'GET',
            url: '/api/sitemap.xml',
        });

        expect(res.statusCode).toBe(200);
        const xml = res.body;

        // Active listing is in sitemap, archived listing is NOT
        expect(xml).toContain(activeListing.id);
        expect(xml).not.toContain(archivedListing.id);

        const urlBlocks = xml.split('<url>').slice(1);
        expect(urlBlocks.length).toBeGreaterThan(0);

        // Find active listing block: MUST have accurate <lastmod>
        const listingBlock = urlBlocks.find(b => b.includes(activeListing.id));
        expect(listingBlock).toBeDefined();
        expect(listingBlock).toContain('<lastmod>');
        expect(listingBlock).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);

        // Find static homepage block: MUST NOT have synthetic <lastmod>
        const homepageBlock = urlBlocks.find(b => b.includes('<loc>https://motolia.pl/</loc>'));
        expect(homepageBlock).toBeDefined();
        expect(homepageBlock).not.toContain('<lastmod>');
    });
});
