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
