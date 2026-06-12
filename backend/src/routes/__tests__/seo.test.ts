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
        await app.prisma.listing.deleteMany({ where: { make: 'TEST_SITEMAP' } });
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
        expect(res.body).toContain('<loc>https://dev.motolia.pl/oferta/testsitemap-x-2024-');
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
