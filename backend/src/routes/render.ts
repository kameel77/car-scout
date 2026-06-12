import { FastifyInstance } from 'fastify';
import { extractListingIdFromSlug, generateListingSlug } from '../utils/url-utils.js';
import {
    buildListingMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
    ListingVariant,
    PageMeta,
} from '../services/seo-meta.js';

const TEMPLATE_TTL_MS = 5 * 60 * 1000;
const PAGE_TTL_MS = 60 * 1000;
const PAGE_CACHE_MAX = 5000;

// Klucze cache nie zawierają brandu — każdy proces backendu obsługuje jeden brand (env BRAND).
let templateCache: { html: string; fetchedAt: number } | null = null;
const pageCache = new Map<string, { html: string; status: number; at: number }>();

export function __resetRenderCache() {
    templateCache = null;
    pageCache.clear();
}

async function getTemplate(): Promise<string | null> {
    if (templateCache && Date.now() - templateCache.fetchedAt < TEMPLATE_TTL_MS) {
        return templateCache.html;
    }
    try {
        const base = (process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80').replace(/\/$/, '');
        const res = await fetch(`${base}/index.html`);
        if (!res.ok) throw new Error(`template fetch status ${res.status}`);
        const html = await res.text();
        templateCache = { html, fetchedAt: Date.now() };
        return html;
    } catch {
        // stale-if-error: lepszy stary szablon niż brak strony
        return templateCache?.html ?? null;
    }
}

const LISTING_RE = /^\/(oferta|leasing|kredyt)\/([^/]+)$/;
const RENTAL_RE = /^\/wynajem-dlugoterminowy\/([^/]+)$/;
const NOINDEX_RE = /^\/(admin|login|embed)(\/|$)|\/(lead|negotiate|zapytanie)$/;

async function resolveMeta(fastify: FastifyInstance, path: string, ctx: BrandCtx): Promise<PageMeta> {
    if (NOINDEX_RE.test(path)) {
        return defaultMeta(ctx, { noindex: true, status: 200 });
    }

    const lm = path.match(LISTING_RE);
    if (lm) {
        const id = extractListingIdFromSlug(lm[2]);
        const listing = id
            ? await fastify.prisma.listing.findFirst({
                  where: { id, isArchived: false },
                  select: {
                      make: true,
                      model: true,
                      version: true,
                      productionYear: true,
                      pricePln: true,
                      mileageKm: true,
                      fuelType: true,
                      bodyType: true,
                  },
              })
            : null;
        if (!id || !listing) return defaultMeta(ctx, { noindex: true, status: 404 });
        // Slug z URL bywa zmanipulowany — canonical liczymy z danych, nie z requestu
        const canonicalSlug = generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            id
        );
        return buildListingMeta(listing, canonicalSlug, lm[1] as ListingVariant, ctx);
    }

    const rm = path.match(RENTAL_RE);
    if (rm) {
        const rental = await fastify.prisma.rentalVehicle.findFirst({
            where: { slug: rm[1], isActive: true },
            select: {
                make: true,
                model: true,
                version: true,
                productionYear: true,
                sellingPrice: true,
            },
        });
        if (!rental) return defaultMeta(ctx, { noindex: true, status: 404 });
        return buildRentalMeta(rental, rm[1], ctx);
    }

    return buildStaticMeta(path, ctx) ?? defaultMeta(ctx, { noindex: true, status: 200 });
}

export async function renderRoutes(fastify: FastifyInstance) {
    fastify.get('/api/render', async (request, reply) => {
        const q = (request.query as { path?: unknown }).path;
        const rawPath = typeof q === 'string' && q ? q : '/';
        let path = rawPath.split('?')[0];
        if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';

        const cached = pageCache.get(path);
        if (cached && Date.now() - cached.at < PAGE_TTL_MS) {
            return reply
                .code(cached.status)
                .header('Content-Type', 'text/html; charset=utf-8')
                .send(cached.html);
        }

        const template = await getTemplate();
        if (!template) {
            return reply.code(503).send({ error: 'template unavailable' });
        }

        const ctx = resolveBrandCtx();
        const meta = await resolveMeta(fastify, path, ctx);
        const html = injectHead(template, meta);

        if (pageCache.size >= PAGE_CACHE_MAX) pageCache.clear();
        pageCache.set(path, { html, status: meta.status, at: Date.now() });

        return reply
            .code(meta.status)
            .header('Content-Type', 'text/html; charset=utf-8')
            .send(html);
    });
}
