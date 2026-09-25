import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { maybePurgeCloudflareOnBuildChange, __resetRenderCache } from '../render';
import { getSsrRedisClient, getSsrNamespace } from '../../services/ssr-cache.js';

// Task 1b: podnosimy HTML edge TTL do 24h (getCacheControlHeader), co jest bezpieczne tylko jeśli
// Cloudflare jest purge'owany po każdym deployu frontendu LUB backendu. maybePurgeCloudflareOnBuildChange
// porównuje aktywny entry asset (z <script type="module"> szablonu frontendu) + rewizję backendu
// (SOURCE_COMMIT) z ostatnią zapamiętaną w Redisie i purge'uje purgeEverything TYLKO przy realnej
// zmianie którejkolwiek części.
const TEMPLATE_V1 = `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/assets/index-v1.js"></script></body></html>`;
const TEMPLATE_V2 = `<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/assets/index-v2.js"></script></body></html>`;

describe('maybePurgeCloudflareOnBuildChange', () => {
    let app: FastifyInstance;
    let prevFrontendUrl: string | undefined;
    let prevToken: string | undefined;
    let prevZone: string | undefined;
    let prevSourceCommit: string | undefined;
    let redisKey: string;

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        prevFrontendUrl = process.env.FRONTEND_URL;
        prevToken = process.env.CLOUDFLARE_API_TOKEN;
        prevZone = process.env.CLOUDFLARE_ZONE_ID;
        prevSourceCommit = process.env.SOURCE_COMMIT;
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://motolia.pl';
        process.env.CLOUDFLARE_API_TOKEN = 'test-token';
        process.env.CLOUDFLARE_ZONE_ID = 'test-zone';
        delete process.env.SOURCE_COMMIT;
        await __resetRenderCache();
        redisKey = `${getSsrNamespace()}:active-build`;
        const redis = getSsrRedisClient();
        await redis?.del(redisKey);
        await redis?.del(`${redisKey}:lock`);
    });

    afterEach(async () => {
        if (prevFrontendUrl === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prevFrontendUrl;
        if (prevToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN; else process.env.CLOUDFLARE_API_TOKEN = prevToken;
        if (prevZone === undefined) delete process.env.CLOUDFLARE_ZONE_ID; else process.env.CLOUDFLARE_ZONE_ID = prevZone;
        if (prevSourceCommit === undefined) delete process.env.SOURCE_COMMIT; else process.env.SOURCE_COMMIT = prevSourceCommit;
        vi.unstubAllGlobals();
        const redis = getSsrRedisClient();
        await redis?.del(redisKey);
        await redis?.del(`${redisKey}:lock`);
    });

    function stubFetch(template: () => string, onPurge?: () => void) {
        vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
            const u = String(url);
            if (u.includes('purge_cache')) {
                onPurge?.();
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }
            return new Response(template(), { status: 200 });
        }));
    }

    it('purges once on first sight of a build and stores its entry asset', async () => {
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);

        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(1);
        const redis = getSsrRedisClient();
        expect(await redis?.get(redisKey)).toBe('/assets/index-v1.js');
    });

    it('does not purge again for the same build', async () => {
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);

        await maybePurgeCloudflareOnBuildChange(app);
        await __resetRenderCache(); // clears only the in-memory template cache, forcing a refetch
        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(1);
    });

    it('purges again when the build actually changes', async () => {
        let purgeCalls = 0;
        let current = TEMPLATE_V1;
        stubFetch(() => current, () => purgeCalls++);

        await maybePurgeCloudflareOnBuildChange(app);
        current = TEMPLATE_V2;
        await __resetRenderCache();
        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(2);
        const redis = getSsrRedisClient();
        expect(await redis?.get(redisKey)).toBe('/assets/index-v2.js');
    });

    it('purges on backend revision change with the same frontend entry asset', async () => {
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);
        process.env.SOURCE_COMMIT = 'aaaaaaaaaaaa';

        await maybePurgeCloudflareOnBuildChange(app);
        process.env.SOURCE_COMMIT = 'bbbbbbbbbbbb';
        await __resetRenderCache();
        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(2);
        const redis = getSsrRedisClient();
        expect(await redis?.get(redisKey)).toBe('/assets/index-v1.js|bbbbbbbb');
    });

    it('does not purge when both the frontend entry asset and the backend revision are unchanged', async () => {
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);
        process.env.SOURCE_COMMIT = 'aaaaaaaaaaaa';

        await maybePurgeCloudflareOnBuildChange(app);
        await __resetRenderCache(); // wymusza refetch szablonu, SOURCE_COMMIT bez zmian
        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(1);
    });

    it('falls back to the frontend-only build id when SOURCE_COMMIT is missing', async () => {
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);
        delete process.env.SOURCE_COMMIT;

        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(1);
        const redis = getSsrRedisClient();
        expect(await redis?.get(redisKey)).toBe('/assets/index-v1.js');
    });

    it('does not purge for a non-production host (dev/staging share the same Cloudflare zone)', async () => {
        process.env.FRONTEND_URL = 'https://staging.motolia.pl';
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);

        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(0);
    });

    it('does not purge when another process already holds the build-change lock', async () => {
        const redis = getSsrRedisClient();
        await redis?.set(`${redisKey}:lock`, '1', 'EX', 60, 'NX');
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);

        await maybePurgeCloudflareOnBuildChange(app);

        expect(purgeCalls).toBe(0);
    });

    it('skips (logs, does not throw) when Cloudflare credentials are missing', async () => {
        delete process.env.CLOUDFLARE_API_TOKEN;
        delete process.env.CLOUDFLARE_ZONE_ID;
        let purgeCalls = 0;
        stubFetch(() => TEMPLATE_V1, () => purgeCalls++);

        await expect(maybePurgeCloudflareOnBuildChange(app)).resolves.not.toThrow();

        expect(purgeCalls).toBe(0);
        const redis = getSsrRedisClient();
        expect(await redis?.get(redisKey)).toBeNull();
    });
});
