import { FastifyInstance } from 'fastify';
import { extractListingIdFromSlug, generateListingSlug } from '../utils/url-utils.js';
import {
    buildListingMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    hasStaticRoute,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
    ListingVariant,
    PageMeta,
    RelatedListing,
    StaticPagination,
} from '../services/seo-meta.js';
import { getFinancingArticle } from '../content/financing-content.js';

// Strony kategorii finansowania → filtr financingType dla FAQ z CMS
const FINANCING_FAQ_TYPE: Record<string, string> = {
    '/leasing': 'leasing',
    '/kredyt': 'kredyt',
    '/wynajem-dlugoterminowy': 'wynajem',
};

const TEMPLATE_TTL_MS = 5 * 60 * 1000;
const PAGE_TTL_MS = 60 * 1000;
const PAGE_CACHE_MAX = 5000;

// Strony katalogowe z paginacją SSR (?page=N) — crawlery bez JS widzą kolejne porcje ofert.
// /leasing i /kredyt celowo bez paginacji: oferty są te same co w /samochody (każde auto
// dostępne w obu finansowaniach), więc pełna lista byłaby duplikatem — te strony pracują
// artykułem filarowym + krótką listą z linkiem do pełnego katalogu.
const PAGINATED_ROUTES = new Set([
    '/samochody',
    '/search',
    '/nowe',
    '/uzywane',
    '/wynajem-dlugoterminowy',
]);
const SSR_PER_PAGE = 30; // spójne z DEFAULT_PER_PAGE na froncie

// Zróżnicowanie list kategorii — jak filtry w SPA (ConditionPage)
const CONDITION_BY_PATH: Record<string, 'NEW' | 'USED'> = {
    '/nowe': 'NEW',
    '/uzywane': 'USED',
};
const FINANCING_LIST_TAKE = 12; // krótka lista na /leasing i /kredyt

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
        // Use SERVICE_URL_FRONTEND (public domain injected by Coolify) if available to bypass Docker DNS alias caching
        // which might resolve to dangling old frontend containers.
        // Fallback to INTERNAL_FRONTEND_URL or http://frontend:80.
        let base = process.env.SERVICE_URL_FRONTEND || process.env.INTERNAL_FRONTEND_URL || 'http://frontend:80';
        if (base === 'http://frontend:80' && process.env.INTERNAL_FRONTEND_URL && process.env.INTERNAL_FRONTEND_URL !== 'http://frontend:80') {
            base = process.env.INTERNAL_FRONTEND_URL;
        }
        base = base.replace(/\/$/, '');
        const res = await fetch(`${base}/index.html`);
        if (!res.ok) throw new Error(`template fetch status ${res.status}`);
        const html = await res.text();
        templateCache = { html, fetchedAt: Date.now() };
        return html;
    } catch (e) {
        // stale-if-error: Use stale cache ONLY for a few seconds during brief network blips
        // to prevent serving an old index.html (which points to missing chunks) for a long time.
        // If frontend is down longer, returning null will cause a 503, triggering Nginx @spa_fallback
        if (templateCache && Date.now() - templateCache.fetchedAt < 10 * 1000) {
            return templateCache.html;
        }
        return null;
    }
}

const LISTING_RE = /^\/(oferta|leasing|kredyt)\/([^/]+)$/;
const RENTAL_RE = /^\/wynajem-dlugoterminowy\/([^/]+)$/;
const NOINDEX_RE = /^\/(admin|login|embed|listing)(\/|$)|\/(lead|negotiate|zapytanie)$/;

async function resolveMeta(fastify: FastifyInstance, path: string, ctx: BrandCtx, page: number = 1): Promise<PageMeta> {
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
                      condition: true,
                      fuelType: true,
                      bodyType: true,
                      transmission: true,
                      primaryImageUrl: true,
                      additionalInfoContent: true,
                      equipmentSafety: true,
                      equipmentAudioMultimedia: true,
                      equipmentComfortExtras: true,
                      equipmentOther: true,
                  },
              })
            : null;
        if (!id || !listing) return defaultMeta(ctx, { noindex: true, status: 404 });

        // Fetch related listings (same make or just latest)
        const relatedRaw = await fastify.prisma.listing.findMany({
            where: { isArchived: false, NOT: { id } },
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                bodyType: true,
                fuelType: true,
            },
        });

        const related: RelatedListing[] = relatedRaw.map(r => ({
            ...r,
            slug: generateListingSlug(r.make, r.model, r.version, r.productionYear, r.bodyType, r.fuelType, r.id)
        }));

        const variant = lm[1] as ListingVariant;

        // FAQ jak na froncie: page=offers; dla wariantów finansowych dodatkowo filtr financingType
        const variantFaq = await fastify.prisma.faqEntry.findMany({
            where: {
                isPublished: true,
                page: 'offers',
                pageContext: { in: ['all', 'offers'] },
                ...(variant !== 'oferta'
                    ? { OR: [{ financingType: variant }, { financingType: null }, { financingType: 'all' }] }
                    : {}),
            },
            orderBy: { sortOrder: 'asc' },
            select: { questionPl: true, answerPl: true },
        });

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
        return buildListingMeta(listing, canonicalSlug, variant, ctx, related, variantFaq);
    }

    const rm = path.match(RENTAL_RE);
    if (rm) {
        const rental = await fastify.prisma.rentalVehicle.findFirst({
            where: { slug: rm[1], isActive: true },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                sellingPrice: true,
                primaryImageUrl: true,
                bodyType: true,
                fuelType: true,
                transmission: true,
                enginePowerHp: true,
                doors: true,
                seats: true,
                color: true,
                mileageKm: true,
                condition: true,
                equipmentSafety: true,
                equipmentAudioMultimedia: true,
                equipmentComfortExtras: true,
                equipmentOther: true,
            },
        });
        if (!rental) return defaultMeta(ctx, { noindex: true, status: 404 });

        // FAQ najmu — ten sam filtr co frontend (page=rental, pageContext=rental)
        const rentalFaq = await fastify.prisma.faqEntry.findMany({
            where: {
                isPublished: true,
                page: 'rental',
                pageContext: { in: ['all', 'rental'] },
            },
            orderBy: { sortOrder: 'asc' },
            select: { questionPl: true, answerPl: true },
        });

        // Najniższa rata brutto z matrycy najmu (aktywne przypisania pojazdu)
        const rateAgg = await fastify.prisma.rentalMatrixEntry.aggregate({
            _min: { monthlyRateGross: true },
            where: { assignment: { vehicleId: rental.id, isActive: true } },
        });

        return buildRentalMeta(rental, rm[1], ctx, rentalFaq, rateAgg._min.monthlyRateGross ?? null);
    }

    // Nieznane ścieżki (m.in. probe'y skanerów) odrzucamy przed zapytaniami do bazy
    if (!hasStaticRoute(path)) {
        return defaultMeta(ctx, { noindex: true, status: 404 });
    }

    // Kategoria najmu listuje pojazdy najmu (linki do self-canonical stron), nie auta sprzedażowe
    let listings: RelatedListing[];
    let listingsBasePath = '/oferta';
    let pagination: StaticPagination | undefined;
    const paginated = PAGINATED_ROUTES.has(path);
    const isFinancingList = path === '/leasing' || path === '/kredyt';
    const take = paginated ? SSR_PER_PAGE : isFinancingList ? FINANCING_LIST_TAKE : 20;
    const skip = paginated ? (page - 1) * SSR_PER_PAGE : 0;

    if (path === '/wynajem-dlugoterminowy') {
        const where = { isActive: true, slug: { not: null } };
        if (paginated) {
            const total = await fastify.prisma.rentalVehicle.count({ where });
            const totalPages = Math.max(1, Math.ceil(total / SSR_PER_PAGE));
            if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
            pagination = { page, totalPages };
        }
        const rentalsRaw = await fastify.prisma.rentalVehicle.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                slug: true,
            },
        });
        listings = rentalsRaw.map(r => ({ ...r, pricePln: null, slug: r.slug as string }));
        listingsBasePath = '/wynajem-dlugoterminowy';
    } else {
        const where = {
            isArchived: false,
            ...(CONDITION_BY_PATH[path] ? { condition: CONDITION_BY_PATH[path] } : {}),
        };
        if (paginated) {
            const total = await fastify.prisma.listing.count({ where });
            const totalPages = Math.max(1, Math.ceil(total / SSR_PER_PAGE));
            if (page > totalPages) return defaultMeta(ctx, { noindex: true, status: 404 });
            pagination = { page, totalPages };
        }
        const listingsRaw = await fastify.prisma.listing.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                bodyType: true,
                fuelType: true,
            },
        });
        listings = listingsRaw.map(l => ({
            ...l,
            slug: generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id)
        }));
    }

    let faq: any[] = [];
    if (path === '/faq') {
        faq = await fastify.prisma.faqEntry.findMany({
            where: { isPublished: true },
            orderBy: { sortOrder: 'asc' },
        });
    } else if (FINANCING_FAQ_TYPE[path]) {
        faq = await fastify.prisma.faqEntry.findMany({
            where: {
                page: 'financing',
                isPublished: true,
                OR: [
                    { financingType: FINANCING_FAQ_TYPE[path] },
                    { financingType: 'all' },
                    { financingType: null },
                ],
            },
            orderBy: { sortOrder: 'asc' },
        });
    }

    return buildStaticMeta(path, ctx, listings, faq, listingsBasePath, getFinancingArticle(ctx.brand, path), pagination) ?? defaultMeta(ctx, { noindex: true, status: 404 });
}

export async function renderRoutes(fastify: FastifyInstance) {
    fastify.get('/api/render', async (request, reply) => {
        const q = (request.query as { path?: unknown }).path;
        const rawPath = typeof q === 'string' && q ? q : '/';
        const [rawPathname, rawQuery] = rawPath.split('?');
        let path = rawPathname;
        if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';

        // ?page=N tylko dla stron katalogowych; clamp chroni cache przed spamem parametrów.
        // Nginx przekazuje pełne $request_uri w ?path=, ale surowe `&` w URI klienta
        // rozbija parametry na najwyższy poziom query — czytamy page z obu miejsc.
        let page = 1;
        if (PAGINATED_ROUTES.has(path)) {
            const topLevelPage = (request.query as { page?: unknown }).page;
            const pageStr =
                (rawQuery ? new URLSearchParams(rawQuery).get('page') : null) ??
                (typeof topLevelPage === 'string' ? topLevelPage : null);
            const parsed = parseInt(pageStr ?? '1', 10);
            if (Number.isFinite(parsed)) page = Math.min(Math.max(parsed, 1), 10000);
        }

        const cacheKey = page > 1 ? `${path}?page=${page}` : path;
        const cached = pageCache.get(cacheKey);
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
        const meta = await resolveMeta(fastify, path, ctx, page);
        const html = injectHead(template, meta);

        if (pageCache.size >= PAGE_CACHE_MAX) pageCache.clear();
        pageCache.set(cacheKey, { html, status: meta.status, at: Date.now() });

        return reply
            .code(meta.status)
            .header('Content-Type', 'text/html; charset=utf-8')
            .send(html);
    });
}
