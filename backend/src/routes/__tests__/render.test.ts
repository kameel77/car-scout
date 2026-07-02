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
});
