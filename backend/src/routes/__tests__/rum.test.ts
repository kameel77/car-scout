import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { buildApp } from '../../app';
import { getSsrNamespace } from '../../services/ssr-cache.js';

describe('POST /api/rum/inp', () => {
    let app: FastifyInstance;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const key = `${getSsrNamespace()}:rum:inp`;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    beforeEach(async () => {
        await redis.del(key);
    });

    afterAll(async () => {
        await redis.del(key);
        await redis.quit();
        await app.close();
    });

    it('accepts a valid report, logs it and persists it to Redis, returns 204', async () => {
        const logSpy = vi.spyOn(app.log, 'info');

        const res = await app.inject({
            method: 'POST',
            url: '/api/rum/inp',
            headers: { 'content-type': 'application/json' },
            payload: JSON.stringify({
                path: '/oferta/bmw-x5-2023',
                value: 312.7,
                rating: 'needs-improvement',
                navigationType: 'navigate',
                type: 'pointer',
                target: 'button.cta',
                inputDelay: 40,
                processingDuration: 200,
                presentationDelay: 72.4,
                loadState: 'complete',
                interactionTime: 1234,
                script: {
                    src: 'https://motolia.pl/assets/main.js?v=123',
                    invoker: 'HTMLButtonElement.onclick',
                    fn: 'handleClick',
                    duration: 150,
                    forced: 20,
                },
                gtmLoaded: true,
                cpu: 8,
                mem: 4,
                net: '4g',
                vw: 390,
            }),
        });

        expect(res.statusCode).toBe(204);
        expect(res.body).toBe('');
        expect(logSpy).toHaveBeenCalledWith(
            expect.objectContaining({ rum: 'inp', path: '/oferta/bmw-x5-2023', value: 313 }),
            'RUM INP'
        );

        const stored = await redis.lrange(key, 0, -1);
        expect(stored.length).toBe(1);
        const parsed = JSON.parse(stored[0]);
        expect(parsed.path).toBe('/oferta/bmw-x5-2023');
        expect(parsed.value).toBe(313);
        expect(parsed.script.src).toBe('https://motolia.pl/assets/main.js?v=123');
        expect(parsed.build).toBeNull();
        expect(typeof parsed.ts).toBe('number');
        expect(typeof parsed.host).toBe('string');

        logSpy.mockRestore();
    });

    it('drops a report with an invalid path, returns 204 and does not persist', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/rum/inp',
            headers: { 'content-type': 'application/json' },
            payload: JSON.stringify({ path: 'not-a-path', value: 200 }),
        });

        expect(res.statusCode).toBe(204);
        const stored = await redis.lrange(key, 0, -1);
        expect(stored.length).toBe(0);
    });

    it('returns 204 for a garbage (non-JSON) body without throwing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/rum/inp',
            headers: { 'content-type': 'application/json' },
            payload: '{not valid json',
        });

        expect(res.statusCode).toBe(204);
        const stored = await redis.lrange(key, 0, -1);
        expect(stored.length).toBe(0);
    });

    it('returns 204 for an oversize body (over the 8 KB bodyLimit)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/rum/inp',
            headers: { 'content-type': 'application/json' },
            payload: JSON.stringify({ path: '/x', target: 'a'.repeat(20 * 1024) }),
        });

        expect(res.statusCode).toBe(204);
        const stored = await redis.lrange(key, 0, -1);
        expect(stored.length).toBe(0);
    });
});

describe('POST /api/rum/inp build tag', () => {
    let app: FastifyInstance;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const key = `${getSsrNamespace()}:rum:inp`;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
        await redis.del(key);
    });

    afterAll(async () => {
        await redis.del(key);
        await redis.quit();
        await app.close();
    });

    it('stores a valid build and nulls an invalid one', async () => {
        for (const build of ['Ab3_x-9Z', 'bad build!']) {
            await app.inject({
                method: 'POST',
                url: '/api/rum/inp',
                headers: { 'content-type': 'application/json' },
                payload: JSON.stringify({ path: '/', value: 100, build }),
            });
        }

        const stored = (await redis.lrange(key, 0, -1)).map((l) => JSON.parse(l));
        expect(stored).toHaveLength(2);
        expect(stored.map((s) => s.build)).toEqual(expect.arrayContaining([null, 'Ab3_x-9Z']));
    });
});

describe('POST /api/rum/vitals', () => {
    let app: FastifyInstance;
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    const key = `${getSsrNamespace()}:rum:vitals`;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    beforeEach(async () => {
        await redis.del(key);
    });

    afterAll(async () => {
        await redis.del(key);
        await redis.quit();
        await app.close();
    });

    const post = (payload: unknown) =>
        app.inject({
            method: 'POST',
            url: '/api/rum/vitals',
            headers: { 'content-type': 'application/json' },
            payload: JSON.stringify(payload),
        });

    it('stores a valid LCP beacon and returns 204', async () => {
        const res = await post({
            metric: 'LCP',
            path: '/oferta/bmw-x5-2023',
            value: 2412.6,
            rating: 'needs-improvement',
            navigationType: 'navigate',
            build: 'Ab3_x-9Z',
            net: '4g',
            vw: 390,
            cpu: 8,
            mem: 4,
            target: 'img.hero',
            url: 'https://motolia.pl/img/hero.webp',
            ttfb: 410,
            loadDelay: 121,
            loadDuration: 900,
            renderDelay: 34,
        });

        expect(res.statusCode).toBe(204);
        const stored = await redis.lrange(key, 0, -1);
        expect(stored.length).toBe(1);
        const parsed = JSON.parse(stored[0]);
        expect(parsed.metric).toBe('LCP');
        expect(parsed.value).toBe(2413);
        expect(parsed.build).toBe('Ab3_x-9Z');
        expect(parsed.ttfb).toBe(410);
        expect(parsed.url).toBe('https://motolia.pl/img/hero.webp');
        expect(typeof parsed.ts).toBe('number');
        expect(typeof parsed.host).toBe('string');
    });

    it('stores a valid CLS beacon (milli-CLS) and returns 204', async () => {
        const res = await post({
            metric: 'CLS',
            path: '/',
            value: 123,
            rating: 'needs-improvement',
            navigationType: 'navigate',
            build: null,
            target: 'div.banner',
            shiftValue: 88,
            shiftTime: 1500,
            loadState: 'loading',
        });

        expect(res.statusCode).toBe(204);
        const parsed = JSON.parse((await redis.lrange(key, 0, -1))[0]);
        expect(parsed.metric).toBe('CLS');
        expect(parsed.value).toBe(123);
        expect(parsed.shiftValue).toBe(88);
        expect(parsed.loadState).toBe('loading');
        expect(parsed.build).toBeNull();
    });

    it('drops a beacon with a bad metric, returns 204 and does not persist', async () => {
        for (const metric of ['INP', 'lcp', undefined]) {
            const res = await post({ metric, path: '/', value: 100 });
            expect(res.statusCode).toBe(204);
        }
        expect((await redis.lrange(key, 0, -1)).length).toBe(0);
    });

    it('sanitizes build (charset and length)', async () => {
        await post({ metric: 'LCP', path: '/', value: 1, build: 'bad build!' });
        await post({ metric: 'LCP', path: '/', value: 1, build: 'a'.repeat(17) });

        const stored = (await redis.lrange(key, 0, -1)).map((l) => JSON.parse(l));
        expect(stored.length).toBe(2);
        expect(stored.every((s) => s.build === null)).toBe(true);
    });
});
