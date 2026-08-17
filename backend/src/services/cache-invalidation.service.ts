import { FastifyInstance } from 'fastify';
import { __resetRenderCache, evictPageCacheKeys } from '../routes/render.js';
import { __resetSitemapCache } from '../routes/seo.js';

export interface PurgeOptions {
    urls?: string[];
    purgeSitemap?: boolean;
    purgeAll?: boolean;
}

const CLOUDFLARE_MAX_BATCH_SIZE = 30;

/**
 * Purges Cloudflare edge cache and local in-memory SSR/sitemap caches.
 */
export async function invalidateOfferCache(
    fastify?: FastifyInstance,
    opts: PurgeOptions = {}
): Promise<{ success: boolean; purgedUrls: string[] }> {
    // 1. Invalidate internal in-memory caches
    if (opts.purgeAll) {
        __resetRenderCache();
        __resetSitemapCache();
    } else {
        if (opts.urls && opts.urls.length > 0) {
            evictPageCacheKeys(opts.urls);
        }
        if (opts.purgeSitemap) {
            __resetSitemapCache();
        }
    }

    const baseUrl = (process.env.FRONTEND_URL || 'https://motolia.pl').replace(/\/$/, '');
    const urlsToPurge: string[] = [];

    if (opts.urls && opts.urls.length > 0) {
        for (const u of opts.urls) {
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

    if (urlsToPurge.length === 0 && !opts.purgeAll) {
        return { success: true, purgedUrls: [] };
    }

    try {
        if (opts.purgeAll) {
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

        // Chunk Cloudflare purge requests in batches of <= 30
        let allSuccess = true;
        for (let i = 0; i < urlsToPurge.length; i += CLOUDFLARE_MAX_BATCH_SIZE) {
            const chunk = urlsToPurge.slice(i, i + CLOUDFLARE_MAX_BATCH_SIZE);
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

        if (fastify) {
            fastify.log.info({ count: urlsToPurge.length }, 'Cloudflare cache purged successfully');
        }
        return { success: allSuccess, purgedUrls: urlsToPurge };
    } catch (err: any) {
        if (fastify) {
            fastify.log.warn({ err: err.message }, 'Error calling Cloudflare purge cache API');
        } else {
            console.warn('Error calling Cloudflare purge cache API:', err.message);
        }
        return { success: false, purgedUrls: urlsToPurge };
    }
}
