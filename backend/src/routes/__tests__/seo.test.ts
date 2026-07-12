import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { __resetBrandCatalogCache } from '../../services/brand-pages.service.js';

describe('SEO routes', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_SITEMAP' } });
        await app.close();
    });

    beforeEach(async () => {
        process.env.FRONTEND_URL = 'https://dev.motolia.pl';
        __resetBrandCatalogCache();
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
        expect(res.body).toContain('<loc>https://dev.motolia.pl/oferta/testsitemap-x-2024-');
        expect(res.body).not.toContain('<loc>https://dev.motolia.pl/leasing/');
        expect(res.body).not.toContain('<loc>https://dev.motolia.pl/kredyt/');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/uzywane</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/nowe</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/dla-firm</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/leasing</loc>');
        expect(res.body).toContain('<loc>https://dev.motolia.pl/kredyt</loc>');
    });

    it('sitemap always includes the brand page, and the model page only at >=2 active offers', async () => {
        await app.prisma.listing.create({
            data: {
                make: 'TEST_SITEMAP', model: 'ModelSingle', pricePln: 1000, mileageKm: 1,
                productionYear: 2024, isArchived: false,
            },
        });
        const oneOffer = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
        expect(oneOffer.body).toContain('<loc>https://dev.motolia.pl/samochody/testsitemap</loc>');
        expect(oneOffer.body).not.toContain('<loc>https://dev.motolia.pl/samochody/testsitemap/modelsingle</loc>');

        await app.prisma.listing.create({
            data: {
                make: 'TEST_SITEMAP', model: 'ModelSingle', pricePln: 2000, mileageKm: 1,
                productionYear: 2024, isArchived: false,
            },
        });
        __resetBrandCatalogCache();
        const twoOffers = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
        expect(twoOffers.body).toContain('<loc>https://dev.motolia.pl/samochody/testsitemap/modelsingle</loc>');
    });

    it('llms.txt lists brands under "## Marki"', async () => {
        await app.prisma.listing.create({
            data: {
                make: 'TEST_SITEMAP', model: 'X', pricePln: 1000, mileageKm: 1,
                productionYear: 2024, isArchived: false,
            },
        });
        const res = await app.inject({ method: 'GET', url: '/api/llms.txt' });
        expect(res.statusCode).toBe(200);
        expect(res.body).toContain('## Marki');
        expect(res.body).toContain('https://dev.motolia.pl/samochody/testsitemap');
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

    it('robots.txt allows /api/seo-content for bots (SPA fetches CMS content client-side)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/robots.txt' });
        expect(res.body).toContain('Allow: /api/seo-content');
    });

    describe('sitemap: CMS content pages (F2)', () => {
        afterEach(async () => {
            await app.prisma.seoContentPage.deleteMany({ where: { urlPath: { startsWith: '/samochody/testsitemap' } } });
        });

        it('model below the 2-offer threshold is included in the sitemap when it has published CMS content', async () => {
            await app.prisma.listing.create({
                data: {
                    make: 'TEST_SITEMAP', model: 'ModelCms', pricePln: 1000, mileageKm: 1,
                    productionYear: 2024, isArchived: false,
                },
            });
            await app.prisma.seoContentPage.create({
                data: { urlPath: '/samochody/testsitemap/modelcms', contentMd: 'Treść.', isPublished: true },
            });
            const res = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
            expect(res.body).toContain('<loc>https://dev.motolia.pl/samochody/testsitemap/modelcms</loc>');
        });

        it('unpublished CMS content does not force a below-threshold model into the sitemap', async () => {
            await app.prisma.listing.create({
                data: {
                    make: 'TEST_SITEMAP', model: 'ModelDraft', pricePln: 1000, mileageKm: 1,
                    productionYear: 2024, isArchived: false,
                },
            });
            await app.prisma.seoContentPage.create({
                data: { urlPath: '/samochody/testsitemap/modeldraft', contentMd: 'Szkic.', isPublished: false },
            });
            const res = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
            expect(res.body).not.toContain('<loc>https://dev.motolia.pl/samochody/testsitemap/modeldraft</loc>');
        });

        it('a brand/model with published CMS content but zero active offers still appears in the sitemap', async () => {
            const l = await app.prisma.listing.create({
                data: {
                    make: 'TEST_SITEMAP_ZERO', model: 'ModelZero', pricePln: 1000, mileageKm: 1,
                    productionYear: 2024, isArchived: false,
                },
            });
            await app.prisma.listing.update({ where: { id: l.id }, data: { isArchived: true } });
            await app.prisma.seoContentPage.create({
                data: { urlPath: '/samochody/testsitemapzero/modelzero', contentMd: 'Treść.', isPublished: true },
            });
            const res = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
            expect(res.body).toContain('<loc>https://dev.motolia.pl/samochody/testsitemapzero/modelzero</loc>');
            await app.prisma.listing.deleteMany({ where: { make: 'TEST_SITEMAP_ZERO' } });
        });

        it('lastmod for a CMS-backed model is the later of the offer lastmod and the CMS updatedAt', async () => {
            await app.prisma.listing.create({
                data: {
                    make: 'TEST_SITEMAP', model: 'ModelLastmod', pricePln: 1000, mileageKm: 1,
                    productionYear: 2024, isArchived: false,
                },
            });
            const cms = await app.prisma.seoContentPage.create({
                data: { urlPath: '/samochody/testsitemap/modellastmod', contentMd: 'Treść.', isPublished: true },
            });
            const res = await app.inject({ method: 'GET', url: '/api/sitemap.xml' });
            const match = res.body.match(
                /<loc>https:\/\/dev\.motolia\.pl\/samochody\/testsitemap\/modellastmod<\/loc>\s*<lastmod>([\d-]+)<\/lastmod>/
            );
            expect(match).toBeTruthy();
            expect(match![1]).toBe(cms.updatedAt.toISOString().split('T')[0]);
        });
    });
});
