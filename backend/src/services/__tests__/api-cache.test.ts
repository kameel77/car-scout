import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';
import {
    initApiCache,
    getOrSetJson,
    buildListingsQueryCacheKey,
    buildRentalVehiclesQueryCacheKey,
    buildListingSlugCacheKey,
    buildRentalVehicleSlugCacheKey,
    evictApiCacheKeys,
    clearApiCache
} from '../api-cache.js';

process.env.BRAND = 'testsuite';
process.env.NODE_ENV = 'test';

describe('api-cache service', () => {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    beforeEach(async () => {
        initApiCache(redis);
        await clearApiCache();
    });

    afterAll(async () => {
        await clearApiCache();
        await redis.quit();
    });

    it('builds canonical listings query cache key with sorted keys and clamped pagination', () => {
        const query1 = { page: '2', perPage: '60', make: 'Audi', model: 'A4', rateBasis: 'net', includeArchived: 'true', currency: 'eur', sortBy: 'newest' };
        const query2 = { currency: 'EUR', includeArchived: 'true', rateBasis: 'net', model: 'A4', make: 'Audi', perPage: '60', page: '2', sortBy: 'newest' };
        expect(buildListingsQueryCacheKey(query1)).toBe(buildListingsQueryCacheKey(query2));
        expect(buildListingsQueryCacheKey(query1)).toBe('listings:list:currency=EUR&includearchived=true&make=audi&model=a4&page=2&perpage=60&ratebasis=net&ratetype=lease&sortby=newest');

        // Clamping check: page < 1 becomes 1, unsupported perPage falls back to 30, q clamped to 100 chars
        const query3 = { page: '-5', perPage: '500', q: 'a'.repeat(150) };
        expect(buildListingsQueryCacheKey(query3)).toBe(`listings:list:page=1&perpage=30&q=${'a'.repeat(100)}&ratebasis=gross&ratetype=lease`);
    });

    it('builds canonical rental vehicles query cache key with correct defaults and camelCase sort fields', () => {
        const query1 = { offerType: 'business', page: '1', limit: '12' };
        const query2 = { limit: '12', page: '1', offerType: 'business' };
        expect(buildRentalVehiclesQueryCacheKey(query1)).toBe(buildRentalVehiclesQueryCacheKey(query2));
        expect(buildRentalVehiclesQueryCacheKey(query1)).toBe('rental:vehicles:list:limit=12&offertype=business&page=1&pricebasis=gross&sortby=createdAt&sortorder=desc');

        // Preserves exact camelCase for rate sort fields
        const queryRateSort = { sortBy: 'minMonthlyRateNet', sortOrder: 'asc' };
        expect(buildRentalVehiclesQueryCacheKey(queryRateSort)).toContain('sortby=minMonthlyRateNet&sortorder=asc');
    });

    it('builds slug cache keys', () => {
        expect(buildListingSlugCacheKey('audi-a4-quattro')).toBe('listings:by-slug:audi-a4-quattro');
        expect(buildRentalVehicleSlugCacheKey('bmw-x5-xdrive')).toBe('rental:vehicles:bmw-x5-xdrive');
    });

    it('coalesces concurrent requests to prevent cache stampede (singleflight)', async () => {
        let executionCount = 0;
        const slowFetcher = async () => {
            executionCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
            return { data: 'stampede-safe' };
        };

        // Fire 10 concurrent requests simultaneously for the same un-cached key
        const results = await Promise.all([
            getOrSetJson('test:stampede:key', 60, slowFetcher),
            getOrSetJson('test:stampede:key', 60, slowFetcher),
            getOrSetJson('test:stampede:key', 60, slowFetcher),
            getOrSetJson('test:stampede:key', 60, slowFetcher),
            getOrSetJson('test:stampede:key', 60, slowFetcher),
        ]);

        expect(executionCount).toBe(1); // Fetcher was only called once!
        results.forEach(res => expect(res).toEqual({ data: 'stampede-safe' }));
    });

    it('caches JSON result and reuses it on subsequent calls', async () => {
        let calls = 0;
        const fetcher = async () => {
            calls++;
            return { items: [1, 2, 3], count: 3 };
        };

        const res1 = await getOrSetJson('test:key:1', 60, fetcher);
        expect(res1).toEqual({ items: [1, 2, 3], count: 3 });
        expect(calls).toBe(1);

        const res2 = await getOrSetJson('test:key:1', 60, fetcher);
        expect(res2).toEqual({ items: [1, 2, 3], count: 3 });
        expect(calls).toBe(1); // No second fetcher execution
    });

    it('evicts specific api cache keys and patterns', async () => {
        await getOrSetJson('listings:by-slug:bmw-m3', 60, async () => ({ id: 'bmw-m3' }));
        await getOrSetJson('listings:by-slug:audi-rs6', 60, async () => ({ id: 'audi-rs6' }));
        await getOrSetJson('listings:list:page=1', 60, async () => ({ list: [] }));

        await evictApiCacheKeys(['listings:by-slug:bmw-m3', '/oferta/audi-rs6', 'listings:list:*']);

        let recomputed = 0;
        await getOrSetJson('listings:by-slug:bmw-m3', 60, async () => { recomputed++; return { id: 'bmw-m3' }; });
        await getOrSetJson('listings:by-slug:audi-rs6', 60, async () => { recomputed++; return { id: 'audi-rs6' }; });
        await getOrSetJson('listings:list:page=1', 60, async () => { recomputed++; return { list: [] }; });

        expect(recomputed).toBe(3);
    });

    it('clears all API cache entries via SCAN + DEL', async () => {
        await getOrSetJson('test:a', 60, async () => 'A');
        await getOrSetJson('test:b', 60, async () => 'B');

        await clearApiCache();

        let fetchCount = 0;
        await getOrSetJson('test:a', 60, async () => { fetchCount++; return 'A'; });
        await getOrSetJson('test:b', 60, async () => { fetchCount++; return 'B'; });

        expect(fetchCount).toBe(2);
    });

    it('gracefully degrades to direct execution when Redis is null or throws', async () => {
        initApiCache(null as any);
        let calls = 0;
        const res = await getOrSetJson('test:null', 60, async () => {
            calls++;
            return 'direct';
        });
        expect(res).toBe('direct');
        expect(calls).toBe(1);
        await expect(evictApiCacheKeys(['test:null'])).resolves.not.toThrow();
        await expect(clearApiCache()).resolves.not.toThrow();
    });
});
