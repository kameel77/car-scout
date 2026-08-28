import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';
import {
    initSsrCache,
    getSsrCache,
    setSsrCache,
    getSsrCacheKey,
    isSsrFresh,
    markRevalidating,
    clearRevalidating,
    evictSsrCacheKeys,
    resetSsrCache
} from '../ssr-cache.js';

process.env.BRAND = 'testsuite';
process.env.NODE_ENV = 'test';

describe('ssr-cache service', () => {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    beforeEach(async () => {
        initSsrCache(redis);
        await resetSsrCache();
    });

    afterAll(async () => {
        await resetSsrCache();
        await redis.quit();
    });

    it('sets and gets compressed SSR cache entry with full metadata', async () => {
        const key = '/test-page';
        const payload = {
            html: '<html><body><h1>Hello Test</h1></body></html>',
            status: 200,
            noindex: false,
            at: Date.now()
        };

        await setSsrCache(key, payload);

        const cached = await getSsrCache(key);
        expect(cached).not.toBeNull();
        expect(cached?.html).toBe(payload.html);
        expect(cached?.status).toBe(200);
        expect(cached?.noindex).toBe(false);
        expect(cached?.at).toBe(payload.at);

        // Verify standard hard TTL in Redis (close to 86400s)
        const ttl = await redis.ttl(getSsrCacheKey('/test-page'));
        expect(ttl).toBeGreaterThan(86000);
        expect(ttl).toBeLessThanOrEqual(86400);
    });

    it('sets short TTL (300s) for error status and noindex pages', async () => {
        await setSsrCache('/error-page', {
            html: '<html>404 Not Found</html>',
            status: 404,
            noindex: false,
            at: Date.now()
        });
        const errorTtl = await redis.ttl(getSsrCacheKey('/error-page'));
        expect(errorTtl).toBeGreaterThan(0);
        expect(errorTtl).toBeLessThanOrEqual(300);

        await setSsrCache('/noindex-page', {
            html: '<html>Noindex Page</html>',
            status: 200,
            noindex: true,
            at: Date.now()
        });
        const noindexTtl = await redis.ttl(getSsrCacheKey('/noindex-page'));
        expect(noindexTtl).toBeGreaterThan(0);
        expect(noindexTtl).toBeLessThanOrEqual(300);
    });

    it('correctly assesses freshness (6 hours fresh threshold)', () => {
        const now = Date.now();
        const freshEntry = { html: '', status: 200, at: now - (5 * 60 * 60 * 1000) }; // 5 hours ago
        const staleEntry = { html: '', status: 200, at: now - (7 * 60 * 60 * 1000) }; // 7 hours ago

        expect(isSsrFresh(freshEntry)).toBe(true);
        expect(isSsrFresh(staleEntry)).toBe(false);
    });

    it('handles SWR background revalidation lock and stale delivery flow', async () => {
        const key = '/swr-stale-page';
        const staleAt = Date.now() - (8 * 3600 * 1000); // 8 hours ago (stale, within 24h hard TTL)

        await setSsrCache(key, {
            html: '<div>Old Stale Content</div>',
            status: 200,
            noindex: false,
            at: staleAt
        });

        const cached = await getSsrCache(key);
        expect(cached).not.toBeNull();
        expect(cached?.html).toBe('<div>Old Stale Content</div>');
        expect(isSsrFresh(cached!)).toBe(false);

        // Lock acquisition for background revalidation
        expect(markRevalidating(key)).toBe(true);
        // Concurrent requests cannot acquire lock
        expect(markRevalidating(key)).toBe(false);

        // Simulate background render completing and updating cache
        await setSsrCache(key, {
            html: '<div>Fresh New Content</div>',
            status: 200,
            noindex: false,
            at: Date.now()
        });
        clearRevalidating(key);

        const updated = await getSsrCache(key);
        expect(updated?.html).toBe('<div>Fresh New Content</div>');
        expect(isSsrFresh(updated!)).toBe(true);
    });

    it('manages stampede revalidation lock lifecycle', () => {
        const key = '/revalidating-page';
        expect(markRevalidating(key)).toBe(true);
        // Second attempt while lock active returns false
        expect(markRevalidating(key)).toBe(false);

        clearRevalidating(key);
        // After clearing, revalidating lock can be acquired again
        expect(markRevalidating(key)).toBe(true);
        clearRevalidating(key);
    });

    it('evicts specific SSR cache keys and patterns', async () => {
        await setSsrCache('/oferta/audi-a4-1', { html: 'Audi 1', status: 200, at: Date.now() });
        await setSsrCache('/oferta/audi-a4-2', { html: 'Audi 2', status: 200, at: Date.now() });
        await setSsrCache('/samochody/bmw', { html: 'BMW List', status: 200, at: Date.now() });

        await evictSsrCacheKeys(['/oferta/audi-a4-1', '/samochody/bmw']);

        expect(await getSsrCache('/oferta/audi-a4-1')).toBeNull();
        expect(await getSsrCache('/samochody/bmw')).toBeNull();
        expect(await getSsrCache('/oferta/audi-a4-2')).not.toBeNull();
    });

    it('resets all SSR cache entries via SCAN + DEL', async () => {
        await setSsrCache('/page-1', { html: '1', status: 200, at: Date.now() });
        await setSsrCache('/page-2', { html: '2', status: 200, at: Date.now() });

        await resetSsrCache();

        expect(await getSsrCache('/page-1')).toBeNull();
        expect(await getSsrCache('/page-2')).toBeNull();
    });

    it('gracefully degrades when Redis is null or throws', async () => {
        initSsrCache(null as any);
        expect(await getSsrCache('/any')).toBeNull();
        await expect(setSsrCache('/any', { html: 'test', status: 200, at: Date.now() })).resolves.not.toThrow();
        await expect(evictSsrCacheKeys(['/any'])).resolves.not.toThrow();
        await expect(resetSsrCache()).resolves.not.toThrow();
    });
});
