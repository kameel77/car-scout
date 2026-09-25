import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import * as cacheInvalidation from '../../services/cache-invalidation.service.js';
import { generateListingSlug } from '../../utils/url-utils.js';

// Task C: nagłówki Cache-Control publicznych endpointów API konsumowanych przez
// SPA/Googlebota (przygotowanie pod rozszerzenie reguły cache Cloudflare o /api/*).
describe('Public API Cache-Control headers', () => {
    let app: FastifyInstance;
    let dealerId: string;
    let listingId: string;
    let listingSlug: string;

    let prevBrand: string | undefined;
    let prevFrontendUrl: string | undefined;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        // Cache-Control publiczny wymaga hosta produkcyjnego (isProductionHost) — inaczej
        // globalny onSend guard w app.ts (de-indexing na dev/staging) nadpisuje wszystko na
        // 'private, no-store'. Ten sam wzorzec co w render.test.ts.
        prevBrand = process.env.BRAND;
        prevFrontendUrl = process.env.FRONTEND_URL;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        const originalInject = app.inject.bind(app);
        app.inject = ((opt: any) => {
            const options = typeof opt === 'string' ? { url: opt } : { ...opt };
            options.headers = { host: 'motolia.pl', ...(options.headers || {}) };
            return originalInject(options);
        }) as any;

        const dealer = await app.prisma.dealer.create({
            data: { name: 'Cache Headers Test Dealer', addressLine1: 'Addr' },
        });
        dealerId = dealer.id;

        const listing = await app.prisma.listing.create({
            data: {
                make: 'BMW',
                model: '3 Series',
                pricePln: 100000,
                productionYear: 2020,
                mileageKm: 50000,
                dealerId,
            },
        });
        listingId = listing.id;
        listingSlug = generateListingSlug(listing.make, listing.model, listing.version, listing.productionYear, listing.bodyType, listing.fuelType, listing.id);
        await app.prisma.listing.update({ where: { id: listing.id }, data: { slug: listingSlug } });
    });

    afterAll(async () => {
        await app.prisma.listing.deleteMany({ where: { dealerId } });
        await app.prisma.dealer.delete({ where: { id: dealerId } }).catch(() => {});
        if (prevBrand === undefined) delete process.env.BRAND;
        else process.env.BRAND = prevBrand;
        if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = prevFrontendUrl;
        await app.close();
    });

    it('GET /api/seo is public and edge-cacheable', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/seo' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/translations is public and edge-cacheable', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/translations' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/listings/options is public and edge-cacheable', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/listings/options' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/feature-tiles/public is public and edge-cacheable', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/feature-tiles/public' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/faq is public and edge-cacheable for anonymous requests', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/faq' });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/faq is private for requests carrying an Authorization header (response varies by permissions)', async () => {
        const token = app.jwt.sign({ userId: 'faq-viewer', email: 'v@test.com', role: 'viewer' });
        const res = await app.inject({
            method: 'GET',
            url: '/api/faq',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('GET /api/listings/by-slug/:slug is public/edge-cacheable for a real listing', async () => {
        const res = await app.inject({ method: 'GET', url: `/api/listings/by-slug/${listingSlug}` });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    });

    it('GET /api/listings/by-slug/:slug returns a short-lived public 404 for an unknown slug (anti crawl-storm)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/listings/by-slug/bmw-unknown-2020-aaaaaaaaaaaaaaaaaaaaaaaaa' });
        expect(res.statusCode).toBe(404);
        expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=60');
    });

    it('GET /api/listings/by-slug/:slug stays private for an authenticated request', async () => {
        const token = app.jwt.sign({ userId: 'listing-viewer', email: 'v2@test.com', role: 'viewer' });
        const res = await app.inject({
            method: 'GET',
            url: `/api/listings/by-slug/${listingSlug}`,
            headers: { authorization: `Bearer ${token}` },
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('archiving a listing purges its /api/listings/by-slug/:slug edge cache entry', async () => {
        const purgeSpy = vi.spyOn(cacheInvalidation, 'invalidateOfferCache');
        const token = app.jwt.sign({
            userId: 'admin-purge-test',
            email: 'ap@test.com',
            role: 'admin',
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' },
        });
        try {
            const res = await app.inject({
                method: 'POST',
                url: `/api/listings/${listingId}/archive`,
                headers: { authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(200);
            expect(purgeSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                urls: expect.arrayContaining([`/api/listings/by-slug/${listingSlug}`]),
            }));
        } finally {
            purgeSpy.mockRestore();
            await app.prisma.listing.update({ where: { id: listingId }, data: { isArchived: false } });
        }
    });
});
