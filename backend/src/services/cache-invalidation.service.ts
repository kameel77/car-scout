import { FastifyInstance } from 'fastify';
import { __resetRenderCache, __resetComponentCaches } from '../routes/render.js';
import { __resetSitemapCache } from '../routes/seo.js';
import { evictSsrCacheKeys } from './ssr-cache.js';
import { clearApiCache, evictApiCacheKeys, evictListingOptionsCache } from './api-cache.js';

export const LISTING_AGGREGATE_URLS = [
    '/', '/nowe', '/uzywane', '/samochody',
    '/leasing', '/kredyt',
] as const;

export const RENTAL_AGGREGATE_URLS = [
    '/', '/wynajem-dlugoterminowy',
] as const;

export interface PurgeOptions {
    urls?: string[];
    apiPatterns?: string[];
    purgeSitemap?: boolean;
    purgeAll?: boolean;
    purgeEverything?: boolean;
}

const CLOUDFLARE_MAX_BATCH_SIZE = 30;
const CLOUDFLARE_MAX_URLS_BEFORE_AGGREGATE_PURGE = 200;

const LISTING_PREFIX_EXACT_URLS = ['/samochody', '/nowe', '/uzywane', '/leasing', '/kredyt'];
const LISTING_PREFIX_URL_STARTS = ['/oferta/', '/leasing/', '/kredyt/', '/listing/'];

/**
 * Prefiksy Cloudflare (host + ścieżka, bez schematu i query) do purge'u odpowiedzi API,
 * których URL-e mają dowolne query stringi i nie da się ich wyczyścić po dokładnym URL-u.
 */
export function getApiPurgePrefixes(opts: PurgeOptions, host: string): string[] {
    const urls = opts.urls || [];
    const prefixes: string[] = [];

    const touchesListings = !!opts.purgeAll || urls.some(u =>
        LISTING_PREFIX_EXACT_URLS.includes(u) || LISTING_PREFIX_URL_STARTS.some(s => u.startsWith(s))
    );
    if (touchesListings) prefixes.push(`${host}/api/listings`);

    const touchesRental = !!opts.purgeAll
        || urls.some(u => u === '/wynajem-dlugoterminowy' || u.startsWith('/wynajem-dlugoterminowy/'))
        || (opts.apiPatterns || []).some(p => p.startsWith('rental:'));
    if (touchesRental) prefixes.push(`${host}/api/rental`);

    return prefixes;
}

/**
 * Purges Cloudflare edge cache and local in-memory/Redis SSR, API and sitemap caches.
 */
export async function invalidateOfferCache(
    fastify?: FastifyInstance,
    opts: PurgeOptions = {}
): Promise<{ success: boolean; purgedUrls: string[] }> {
    // 0. Always refresh in-memory component caches (banners, grid columns, per-page)
    __resetComponentCaches();

    // 1. Invalidate internal in-memory and Redis caches
    if (opts.purgeAll) {
        await __resetRenderCache();
        __resetSitemapCache();
        await clearApiCache();
    } else {
        const apiTargets = [
            ...(opts.urls || []),
            ...(opts.apiPatterns || []),
        ];
        if (opts.urls && opts.urls.length > 0) {
            await evictSsrCacheKeys(opts.urls);
        }
        if (apiTargets.length > 0) {
            await evictApiCacheKeys(apiTargets);
        }
        if (opts.purgeSitemap) {
            __resetSitemapCache();
        }
    }
    if (getApiPurgePrefixes(opts, '').includes('/api/listings')) {
        await evictListingOptionsCache();
    }

    const baseUrl = (process.env.FRONTEND_URL || 'https://motolia.pl').replace(/\/$/, '');
    const urlsToPurge: string[] = [];

    if (opts.urls && opts.urls.length > 0) {
        for (const u of opts.urls) {
            // Only valid URL paths (skip Redis keys/patterns like 'rental:vehicles:*' or anything containing '*')
            if (u.includes('*') || (!u.startsWith('/') && !u.startsWith('http'))) continue;
            const fullUrl = u.startsWith('http') ? u : `${baseUrl}${u.startsWith('/') ? '' : '/'}${u}`;
            urlsToPurge.push(fullUrl);
        }
    }

    if (opts.purgeSitemap) {
        urlsToPurge.push(`${baseUrl}/sitemap.xml`);
        urlsToPurge.push(`${baseUrl}/api/sitemap.xml`);
    }

    const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;

    if (!apiToken || !zoneId) {
        // Cloudflare credentials not set (e.g. local dev / staging) - internal cache reset is sufficient
        return { success: true, purgedUrls: urlsToPurge };
    }

    const uniqueUrls = [...new Set(urlsToPurge)];
    const apiPrefixes = getApiPurgePrefixes(opts, baseUrl.replace(/^https?:\/\//, ''));

    if (uniqueUrls.length === 0 && apiPrefixes.length === 0 && !opts.purgeAll && !opts.purgeEverything) {
        return { success: true, purgedUrls: [] };
    }

    try {
        if (opts.purgeEverything) {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ purge_everything: true }),
            });
            const data: any = await res.json();
            return { success: !!data.success, purgedUrls: [] };
        }

        // When exceeding batch limit or on purgeAll, purge aggregates + sitemap instead of global purge_everything
        let finalUrls = uniqueUrls;
        if (opts.purgeAll || uniqueUrls.length > CLOUDFLARE_MAX_URLS_BEFORE_AGGREGATE_PURGE) {
            finalUrls = [
                ...LISTING_AGGREGATE_URLS.map(u => `${baseUrl}${u}`),
                ...RENTAL_AGGREGATE_URLS.map(u => `${baseUrl}${u}`),
                `${baseUrl}/sitemap.xml`,
                `${baseUrl}/api/sitemap.xml`
            ];
            finalUrls = [...new Set(finalUrls)];
        }

        // Chunk Cloudflare purge requests in batches of <= 30
        let allSuccess = true;
        for (let i = 0; i < finalUrls.length; i += CLOUDFLARE_MAX_BATCH_SIZE) {
            const chunk = finalUrls.slice(i, i + CLOUDFLARE_MAX_BATCH_SIZE);
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ files: chunk }),
            });

            const data: any = await res.json();
            if (!res.ok || !data.success) {
                allSuccess = false;
                if (fastify) {
                    fastify.log.warn({ err: data.errors, chunk }, 'Cloudflare cache purge batch failed');
                } else {
                    console.warn('Cloudflare cache purge batch failed', data.errors);
                }
            }
        }

        // Purge po prefiksie dla /api/listings* i /api/rental* (dowolne query stringi) — jedno żądanie
        if (apiPrefixes.length > 0) {
            const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prefixes: apiPrefixes }),
            });
            const data: any = await res.json();
            if (!res.ok || !data.success) {
                allSuccess = false;
                if (fastify) {
                    fastify.log.warn({ err: data.errors, prefixes: apiPrefixes }, 'Cloudflare cache prefix purge failed');
                } else {
                    console.warn('Cloudflare cache prefix purge failed', data.errors);
                }
            }
        }

        if (fastify) {
            fastify.log.info({ count: finalUrls.length }, 'Cloudflare cache purged successfully');
        }
        return { success: allSuccess, purgedUrls: finalUrls };
    } catch (err: any) {
        if (fastify) {
            fastify.log.warn({ err: err.message }, 'Error calling Cloudflare purge cache API');
        } else {
            console.warn('Error calling Cloudflare purge cache API:', err.message);
        }
        return { success: false, purgedUrls: uniqueUrls };
    }
}
