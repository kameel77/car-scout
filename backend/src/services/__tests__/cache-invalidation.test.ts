import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiPurgePrefixes, invalidateOfferCache } from '../cache-invalidation.service.js';

const HOST = 'motolia.pl';

describe('getApiPurgePrefixes', () => {
    it('listing aggregate and detail URLs -> listings prefix', () => {
        expect(getApiPurgePrefixes({ urls: ['/samochody'] }, HOST)).toEqual(['motolia.pl/api/listings']);
        expect(getApiPurgePrefixes({ urls: ['/oferta/bmw-x5'] }, HOST)).toEqual(['motolia.pl/api/listings']);
        expect(getApiPurgePrefixes({ urls: ['/leasing/bmw-x5'] }, HOST)).toEqual(['motolia.pl/api/listings']);
    });

    it('rental URLs and rental: patterns -> rental prefix', () => {
        expect(getApiPurgePrefixes({ urls: ['/wynajem-dlugoterminowy'] }, HOST)).toEqual(['motolia.pl/api/rental']);
        expect(getApiPurgePrefixes({ urls: ['/wynajem-dlugoterminowy/volvo-xc60'] }, HOST)).toEqual(['motolia.pl/api/rental']);
        expect(getApiPurgePrefixes({ apiPatterns: ['rental:vehicles:*'] }, HOST)).toEqual(['motolia.pl/api/rental']);
    });

    it('purgeAll -> both prefixes', () => {
        expect(getApiPurgePrefixes({ purgeAll: true }, HOST)).toEqual(['motolia.pl/api/listings', 'motolia.pl/api/rental']);
    });

    it("hero-banner ['/'] only -> none", () => {
        expect(getApiPurgePrefixes({ urls: ['/'] }, HOST)).toEqual([]);
    });

    it('landing /promo/x -> none', () => {
        expect(getApiPurgePrefixes({ urls: ['/promo/x'] }, HOST)).toEqual([]);
    });
});

describe('invalidateOfferCache Cloudflare prefix purge', () => {
    const env = { ...process.env };
    const fetchMock = vi.fn();

    beforeEach(() => {
        process.env.CLOUDFLARE_API_TOKEN = 'test-token';
        process.env.CLOUDFLARE_ZONE_ID = 'test-zone';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env = { ...env };
    });

    it('sends one extra prefixes request after per-URL purge', async () => {
        const res = await invalidateOfferCache(undefined, { urls: ['/oferta/x'], purgeSitemap: false });
        const bodies = fetchMock.mock.calls.map(c => JSON.parse(c[1].body));
        expect(bodies).toEqual([
            { files: ['https://motolia.pl/oferta/x'] },
            { prefixes: ['motolia.pl/api/listings'] },
        ]);
        expect(res.success).toBe(true);
    });

    it('sends no prefixes request when no prefix applies', async () => {
        await invalidateOfferCache(undefined, { urls: ['/'], purgeSitemap: false });
        const bodies = fetchMock.mock.calls.map(c => JSON.parse(c[1].body));
        expect(bodies).toEqual([{ files: ['https://motolia.pl/'] }]);
    });

    it('reports failure without throwing when prefix purge fails', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
            .mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, errors: [{ code: 1 }] }) });
        const res = await invalidateOfferCache(undefined, { urls: ['/oferta/x'], purgeSitemap: false });
        expect(res.success).toBe(false);
    });
});
