import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { __resetSitemapCache } from '../seo.js';
import { __resetBrandCatalogCache } from '../../services/brand-pages.service.js';
import { __resetRenderCache } from '../render.js';

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /></head><body><div id="root"><!--home-shell--><h1>Hero</h1><!--/home-shell--></div></body></html>`;

describe('De-indexing non-production environments guard', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        vi.unstubAllGlobals();
    });

    beforeEach(async () => {
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        __resetSitemapCache();
        __resetBrandCatalogCache();
        await __resetRenderCache();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(TEMPLATE, { status: 200 }))
        );
    });

    describe('Criterion 1 & 2: X-Robots-Tag and Cache-Control headers on non-production hosts', () => {
        it('sets X-Robots-Tag and private no-store on non-prod host for API routes', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/health',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
            expect(res.headers['cache-control']).toBe('private, no-store');
        });

        it('does not allow header poisoning via X-Forwarded-Host when Host is production', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/health',
                headers: {
                    host: 'motolia.pl',
                    'x-forwarded-host': 'dev.motolia.pl',
                },
            });
            expect(res.headers['x-robots-tag']).toBeUndefined();
        });

        it('sets X-Robots-Tag and private no-store on 404 responses on non-prod hosts', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/unknown-route-12345',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.statusCode).toBe(404);
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
            expect(res.headers['cache-control']).toBe('private, no-store');
        });

        it('sets X-Robots-Tag and private no-store on SSR HTML render responses on non-prod hosts', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/samochody',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
            expect(res.headers['cache-control']).toBe('private, no-store');
        });
    });

    describe('Criterion 3: SSR meta robots tag on non-production hosts', () => {
        it('injects <meta name="robots" content="noindex" /> into HTML on non-prod host', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.body).toContain('<meta name="robots" content="noindex" />');
        });
    });

    // Pierwotnie było tu celowo "Allow: /", bo żeby Google USUNĄŁ z indeksu już zaindeksowane
    // strony, musi móc je pobrać i zobaczyć nagłówek noindex; "Disallow" by to zablokował i
    // adresy zostałyby w indeksie jako puste wpisy. Ta de-indeksacja się zakończyła: stan Search
    // Console na 2026-09-03 pokazuje, że z dev.motolia.pl nie jest zaindeksowana ani jedna strona
    // (albo pojedyncze sztuki). Wobec tego priorytet się zmienił: liczy się już nie
    // de-indeksacja, tylko budżet indeksowania — dev.motolia.pl zebrał 49 730 z 208 000 żądań
    // Googlebota, czyli blisko 24%. X-Robots-Tag: noindex z hooka w app.ts zostaje jako druga
    // warstwa zabezpieczenia.
    describe('Criterion 4: robots.txt on non-production hosts', () => {
        it('serves Disallow: / with NO Sitemap: line on non-prod', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/robots.txt',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/plain');
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
            expect(res.headers['cache-control']).toBe('private, no-store');
            expect(res.body).toContain('User-agent: *');
            expect(res.body).toContain('Disallow: /');
            expect(res.body).not.toContain('Sitemap:');
        });
    });

    describe('Criterion 5: sitemap.xml on non-production hosts (testable with noindex & private no-store)', () => {
        it('returns 200 with XML content protected by noindex and private no-store on non-production host', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/sitemap.xml',
                headers: { host: 'dev.motolia.pl' },
            });
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/xml');
            expect(res.headers['x-robots-tag']).toBe('noindex, nofollow, noarchive');
            expect(res.headers['cache-control']).toBe('private, no-store');
            expect(res.body).toContain('<urlset');
        });
    });

    describe('Criterion 6: No X-Robots-Tag on canonical production hosts', () => {
        it('does NOT set X-Robots-Tag on apex motolia.pl', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/health',
                headers: { host: 'motolia.pl' },
            });
            expect(res.headers['x-robots-tag']).toBeUndefined();
        });

        it('does NOT set X-Robots-Tag on www.motolia.pl', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/health',
                headers: { host: 'www.motolia.pl' },
            });
            expect(res.headers['x-robots-tag']).toBeUndefined();
        });

        it('does NOT set X-Robots-Tag on SSR HTML render for production host', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/render?path=/samochody',
                headers: { host: 'motolia.pl' },
            });
            expect(res.headers['x-robots-tag']).toBeUndefined();
            expect(res.body).not.toContain('<meta name="robots" content="noindex" />');
        });
    });

    describe('Criterion 7: robots.txt on production hosts', () => {
        it('serves full brand-aware robots.txt with Sitemap: line on motolia.pl', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/robots.txt',
                headers: { host: 'motolia.pl' },
            });
            expect(res.statusCode).toBe(200);
            expect(res.body).toContain('User-agent: Googlebot');
            expect(res.body).toContain('Disallow: /api/');
            expect(res.body).toContain('Sitemap: https://motolia.pl/sitemap.xml');
        });

        it('blocks crawling of form pages (/lead) to protect crawl budget', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/robots.txt',
                headers: { host: 'motolia.pl' },
            });
            expect(res.statusCode).toBe(200);
            expect(res.body).toContain('Disallow: /*/lead$');
        });
    });

    describe('Criterion 8: sitemap.xml on production hosts', () => {
        it('returns 200 with XML and <loc> entries on motolia.pl', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/sitemap.xml',
                headers: { host: 'motolia.pl' },
            });
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/xml');
            expect(res.body).toContain('<urlset');
            expect(res.body).toContain('<loc>https://motolia.pl/</loc>');
        });
    });
});
