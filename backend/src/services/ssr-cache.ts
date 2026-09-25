import type { Redis } from 'ioredis';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface SsrCacheEntry {
    html: string;
    status: number;
    noindex?: boolean;
    redirectUrl?: string;
    at: number;
}

let redisClient: Redis | null = null;

export const FRESH_TTL_MS = 6 * 3600 * 1000; // 6 h
export const HARD_TTL_SECONDS = 86400; // 24 h
export const SHORT_TTL_SECONDS = 300; // 5 min (noindex or status != 200)
export const REVALIDATING_TIMEOUT_MS = 60_000; // 60s max lock against stuck background renders

const revalidatingKeys = new Map<string, number>();

export function initSsrCache(redis: Redis): void {
    redisClient = redis;
}

export function getSsrRedisClient(): Redis | null {
    return redisClient;
}

export function getSsrNamespace(): string {
    const brand = (process.env.BRAND || 'motolia').toLowerCase();
    const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
    let host = '';
    try {
        if (process.env.FRONTEND_URL) {
            const parsed = new URL(process.env.FRONTEND_URL).hostname.replace(/\./g, '_');
            if (parsed) host = `:${parsed}`;
        }
    } catch (_err) {
        host = '';
    }
    return `${brand}:${env}${host}`;
}

export function isSsrFresh(entry: SsrCacheEntry): boolean {
    return Date.now() - entry.at < FRESH_TTL_MS;
}

export function isRevalidating(cacheKey: string): boolean {
    const ts = revalidatingKeys.get(cacheKey);
    if (!ts) return false;
    if (Date.now() - ts > REVALIDATING_TIMEOUT_MS) {
        revalidatingKeys.delete(cacheKey);
        return false;
    }
    return true;
}

export function markRevalidating(cacheKey: string): boolean {
    const now = Date.now();
    if (revalidatingKeys.size > 100) {
        for (const [k, v] of revalidatingKeys.entries()) {
            if (now - v > REVALIDATING_TIMEOUT_MS) revalidatingKeys.delete(k);
        }
    }
    const ts = revalidatingKeys.get(cacheKey);
    if (ts && (now - ts < REVALIDATING_TIMEOUT_MS)) {
        return false;
    }
    revalidatingKeys.set(cacheKey, now);
    return true;
}

export function clearRevalidating(cacheKey: string): void {
    revalidatingKeys.delete(cacheKey);
}

// SOURCE_COMMIT (ustawiany przez Coolify w kontenerze backendu) trafia do namespace'u klucza,
// żeby po backendowym deployu, który zmienia renderowanie (np. SSR zaczyna 404-ować coś, co
// wcześniej renderowało 200), stare wpisy z poprzedniej rewizji były po prostu innym kluczem —
// nigdy nie zostaną odczytane i wygasną naturalnie po swoim TTL. Brak SOURCE_COMMIT (np. lokalnie)
// = zachowanie sprzed zmiany (brak segmentu rewizji w kluczu).
export function getBackendRevision(): string {
    const commit = process.env.SOURCE_COMMIT;
    return commit ? commit.slice(0, 8) : '';
}

export function getSsrCacheKeyPrefix(): string {
    const revision = getBackendRevision();
    return `${getSsrNamespace()}:ssr:v1:${revision ? `${revision}:` : ''}`;
}

export function getSsrCacheKey(rawKey: string): string {
    return `${getSsrCacheKeyPrefix()}${rawKey}`;
}

export async function getSsrCache(cacheKey: string): Promise<SsrCacheEntry | null> {
    if (!redisClient) return null;
    try {
        const fullKey = getSsrCacheKey(cacheKey);
        const buf = await redisClient.getBuffer(fullKey);
        if (!buf) return null;
        const decompressed = await gunzipAsync(buf);
        return JSON.parse(decompressed.toString('utf-8')) as SsrCacheEntry;
    } catch (err: any) {
        console.warn(`[SsrCache] Error reading cacheKey "${cacheKey}":`, err?.message);
        return null;
    }
}

export async function setSsrCache(
    cacheKey: string,
    data: { html: string; status: number; noindex?: boolean; redirectUrl?: string; at?: number }
): Promise<void> {
    if (!redisClient) return;
    try {
        const fullKey = getSsrCacheKey(cacheKey);
        const entry: SsrCacheEntry = {
            ...data,
            at: data.at || Date.now()
        };
        const rawJson = JSON.stringify(entry);
        const compressed = await gzipAsync(Buffer.from(rawJson, 'utf-8'));
        const ttl = (entry.noindex || entry.status !== 200) ? SHORT_TTL_SECONDS : HARD_TTL_SECONDS;
        await redisClient.set(fullKey, compressed, 'EX', ttl);
    } catch (err: any) {
        console.warn(`[SsrCache] Error setting cacheKey "${cacheKey}":`, err?.message);
    }
}

export async function evictSsrCacheKeys(urls: string[]): Promise<void> {
    if (!redisClient || urls.length === 0) return;
    try {
        let cursor = '0';
        const prefix = getSsrCacheKeyPrefix();
        const matchPattern = `${prefix}*`;
        const keysToDelete: string[] = [];
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', 200);
            cursor = nextCursor;
            for (const redisKey of keys) {
                const rawKey = redisKey.slice(prefix.length);
                // Strip environment and preload prefixes to inspect path & query
                const pathPart = rawKey.replace(/^(nonprod:)?(preload:)?/, '');
                for (const target of urls) {
                    if (pathPart === target || pathPart.startsWith(`${target}?`) || pathPart.startsWith(`${target}/`)) {
                        keysToDelete.push(redisKey);
                        break;
                    }
                }
            }
        } while (cursor !== '0');

        if (keysToDelete.length > 0) {
            for (let i = 0; i < keysToDelete.length; i += 100) {
                const batch = keysToDelete.slice(i, i + 100);
                await redisClient.del(...batch);
            }
        }
    } catch (err: any) {
        console.warn('[SsrCache] Error evicting keys:', err?.message);
    }
}

export async function resetSsrCache(): Promise<void> {
    if (!redisClient) return;
    try {
        let cursor = '0';
        const matchPattern = `${getSsrCacheKeyPrefix()}*`;
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', matchPattern, 'COUNT', 200);
            cursor = nextCursor;
            if (keys.length > 0) {
                for (let i = 0; i < keys.length; i += 100) {
                    const batch = keys.slice(i, i + 100);
                    await redisClient.del(...batch);
                }
            }
        } while (cursor !== '0');
    } catch (err: any) {
        console.warn('[SsrCache] Error resetting cache:', err?.message);
    }
}
