import { FastifyInstance } from 'fastify';
import { extractListingIdFromSlug, generateListingSlug } from '../utils/url-utils.js';
import { normalizeBrand, normalizeModel } from './brand-normalization.service.js';
import { slugifyBrandName, getBrandCatalog, getModelCatalog } from './brand-pages.service.js';

export const RECENTLY_SOLD_THRESHOLD_DAYS = 90;

export type OfferLifecycleState = 'ACTIVE' | 'RECENTLY_SOLD' | 'LONG_GONE' | 'NOT_FOUND';

export interface SimilarListingSummary {
    id: string;
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    pricePln: number;
    mileageKm: number;
    fuelType: string | null;
    bodyType: string | null;
    primaryImageUrl: string | null;
    slug: string;
}

export interface OfferLifecycleResult {
    state: OfferLifecycleState;
    listing: any | null;
    similarListings: SimilarListingSummary[];
    redirectUrl: string | null; // e.g. /samochody/toyota/corolla or /samochody/toyota
    canonicalSlug: string | null;
    daysSinceArchived: number | null;
}

export function isOfferLifecycleV2Enabled(): boolean {
    return process.env.OFFER_LIFECYCLE_V2 !== 'false';
}

export const LIFECYCLE_LISTING_SELECT = {
    id: true,
    slug: true,
    make: true,
    model: true,
    version: true,
    productionYear: true,
    pricePln: true,
    mileageKm: true,
    fuelType: true,
    bodyType: true,
    transmission: true,
    condition: true,
    enginePowerHp: true,
    engineCapacityCm3: true,
    color: true,
    doors: true,
    seats: true,
    vatMargin: true,
    motoliaDiscountPln: true,
    primaryImageUrl: true,
    imageUrls: true,
    equipmentSafety: true,
    equipmentAudioMultimedia: true,
    equipmentComfortExtras: true,
    equipmentOther: true,
    additionalInfoContent: true,
    isArchived: true,
    archivedAt: true,
    archivedReason: true,
    updatedAt: true,
    createdAt: true,
    lastManualEditAt: true,
    dealerId: true,
};

/**
 * Resolves the lifecycle state of an offer slug or listing ID.
 * Fast indexed lookup with minimal field projection and zero join overhead.
 */
export async function resolveOfferLifecycle(
    fastify: FastifyInstance,
    slugOrId: string
): Promise<OfferLifecycleResult> {
    const extractedId = extractListingIdFromSlug(slugOrId);
    let listing: any = null;

    if (extractedId) {
        listing = await fastify.prisma.listing.findUnique({
            where: { id: extractedId },
            select: LIFECYCLE_LISTING_SELECT,
        });
    }

    if (!listing) {
        // Fallback to direct ID or slug match
        listing = await fastify.prisma.listing.findFirst({
            where: {
                OR: [
                    { id: slugOrId },
                    { slug: slugOrId },
                ],
            },
            select: LIFECYCLE_LISTING_SELECT,
        });
    }

    if (!listing) {
        return {
            state: 'NOT_FOUND',
            listing: null,
            similarListings: [],
            redirectUrl: null,
            canonicalSlug: null,
            daysSinceArchived: null,
        };
    }

    const canonicalSlug = generateListingSlug(
        listing.make,
        listing.model,
        listing.version,
        listing.productionYear,
        listing.bodyType,
        listing.fuelType,
        listing.id
    );

    if (!listing.isArchived) {
        return {
            state: 'ACTIVE',
            listing,
            similarListings: [],
            redirectUrl: null,
            canonicalSlug,
            daysSinceArchived: null,
        };
    }

    if (!isOfferLifecycleV2Enabled()) {
        // Fallback V1 behavior: all archived listings are treated as 404
        return {
            state: 'NOT_FOUND',
            listing,
            similarListings: [],
            redirectUrl: null,
            canonicalSlug,
            daysSinceArchived: null,
        };
    }

    // Determine archived duration — use archivedAt, fallback to lastManualEditAt or createdAt (avoid updatedAt which is bumped by nightly referenceCalcAt)
    const archivedDate = listing.archivedAt || listing.lastManualEditAt || listing.createdAt;
    const daysSinceArchived = Math.max(0, Math.floor((Date.now() - archivedDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (daysSinceArchived <= RECENTLY_SOLD_THRESHOLD_DAYS) {
        // Recently Sold: state 200 + noindex + similar cars
        const similarListings = await getSimilarAvailableListings(fastify, listing, 8);
        return {
            state: 'RECENTLY_SOLD',
            listing,
            similarListings,
            redirectUrl: null,
            canonicalSlug,
            daysSinceArchived,
        };
    }

    // Long Gone (> 90 days): 301 to best match or 410 Gone
    const redirectUrl = await resolveRedirectTarget(fastify, listing.make, listing.model);
    return {
        state: 'LONG_GONE',
        listing,
        similarListings: [],
        redirectUrl,
        canonicalSlug,
        daysSinceArchived,
    };
}

/**
 * Resolves redirect target for long-gone listings.
 * 1. /samochody/<make>/<model> (if model page exists and has >= 2 active listings or published CMS)
 * 2. /samochody/<make> (if brand page exists and has >= 1 active listings or published CMS)
 * 3. null -> 410 Gone
 * NEVER returns '/' (homepage).
 */
export async function resolveRedirectTarget(
    fastify: FastifyInstance,
    make: string,
    model: string
): Promise<string | null> {
    const brandName = normalizeBrand(make);
    const modelName = normalizeModel(model);
    const brandSlug = slugifyBrandName(brandName);
    const modelSlug = slugifyBrandName(modelName);

    if (!brandSlug) return null;

    const brandCatalog = await getBrandCatalog(fastify);
    const brandEntry = brandCatalog.find(b => b.slug === brandSlug);

    // 1. Try model page if brand exists (consistent with sitemap threshold: count >= 2 or CMS)
    if (brandEntry && modelSlug) {
        const modelCatalog = await getModelCatalog(fastify, brandEntry.rawMakes);
        const modelEntry = modelCatalog.find(m => m.slug === modelSlug);
        if (modelEntry && modelEntry.count >= 2) {
            return `/samochody/${brandSlug}/${modelSlug}`;
        }
        // Check if model page has published CMS content
        const cmsModel = await fastify.prisma.seoContentPage.findFirst({
            where: { urlPath: `/samochody/${brandSlug}/${modelSlug}`, isPublished: true },
            select: { id: true },
        });
        if (cmsModel) {
            return `/samochody/${brandSlug}/${modelSlug}`;
        }
    }

    // 2. Try brand page (brand requires count >= 1 or published CMS)
    if (brandEntry && brandEntry.count >= 1) {
        return `/samochody/${brandSlug}`;
    }
    const cmsBrand = await fastify.prisma.seoContentPage.findFirst({
        where: { urlPath: `/samochody/${brandSlug}`, isPublished: true },
        select: { id: true },
    });
    if (cmsBrand) {
        return `/samochody/${brandSlug}`;
    }

    // 3. Neither exists -> 410 Gone
    return null;
}

/**
 * Finds 6–12 similar available cars in priority order:
 * 1. same make + model (uses index [make, model])
 * 2. same make + comparable body type
 * 3. comparable price (±20%, uses index [pricePln])
 *
 * Uses exact case matching to enable Postgres B-Tree index scans.
 */
export async function getSimilarAvailableListings(
    fastify: FastifyInstance,
    listing: { id: string; make: string; model: string; bodyType?: string | null; pricePln?: number | null },
    desiredCount: number = 8
): Promise<SimilarListingSummary[]> {
    const results: SimilarListingSummary[] = [];
    const seenIds = new Set<string>([listing.id]);

    const toSummary = (l: any): SimilarListingSummary => ({
        id: l.id,
        make: l.make,
        model: l.model,
        version: l.version || null,
        productionYear: l.productionYear,
        pricePln: l.pricePln,
        mileageKm: l.mileageKm,
        fuelType: l.fuelType || null,
        bodyType: l.bodyType || null,
        primaryImageUrl: l.primaryImageUrl || null,
        slug: generateListingSlug(l.make, l.model, l.version, l.productionYear, l.bodyType, l.fuelType, l.id),
    });

    // Resolve brand entry with rawMakes variants (e.g. ['BMW', 'bmw', 'Bmw'])
    const brandName = normalizeBrand(listing.make);
    const brandSlug = slugifyBrandName(brandName);
    let makes = [listing.make];
    try {
        const brandCatalog = await getBrandCatalog(fastify);
        const brandEntry = brandCatalog.find(b => b.slug === brandSlug);
        if (brandEntry && brandEntry.rawMakes && brandEntry.rawMakes.length > 0) {
            makes = brandEntry.rawMakes;
        }
    } catch {
        // fallback to [listing.make]
    }

    const modelName = normalizeModel(listing.model);
    const models = Array.from(new Set([listing.model, modelName, listing.model.trim()].filter(Boolean)));

    // 1. Same make (using rawMakes variants) + model (hits index [make, model])
    const sameModelRaw = await fastify.prisma.listing.findMany({
        where: {
            isArchived: false,
            pricePln: { gt: 0 },
            make: makes.length === 1 ? makes[0] : { in: makes },
            model: models.length === 1 ? models[0] : { in: models },
            NOT: { id: listing.id },
        },
        take: desiredCount,
        orderBy: [{ createdAt: 'desc' }],
        select: {
            id: true,
            make: true,
            model: true,
            version: true,
            productionYear: true,
            pricePln: true,
            mileageKm: true,
            fuelType: true,
            bodyType: true,
            primaryImageUrl: true,
        },
    });

    for (const l of sameModelRaw) {
        if (!seenIds.has(l.id)) {
            seenIds.add(l.id);
            results.push(toSummary(l));
        }
    }

    // 2. Same make + comparable body type (if needed)
    if (results.length < desiredCount && listing.bodyType) {
        const remaining = desiredCount - results.length;
        const bodyTypes = Array.from(new Set([
            listing.bodyType,
            listing.bodyType.toLowerCase(),
            listing.bodyType.toUpperCase(),
            listing.bodyType.charAt(0).toUpperCase() + listing.bodyType.slice(1).toLowerCase(),
        ].filter(Boolean)));

        const sameMakeBodyRaw = await fastify.prisma.listing.findMany({
            where: {
                isArchived: false,
                pricePln: { gt: 0 },
                make: makes.length === 1 ? makes[0] : { in: makes },
                bodyType: bodyTypes.length === 1 ? bodyTypes[0] : { in: bodyTypes },
                NOT: { id: { in: Array.from(seenIds) } },
            },
            take: remaining,
            orderBy: [{ createdAt: 'desc' }],
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                mileageKm: true,
                fuelType: true,
                bodyType: true,
                primaryImageUrl: true,
            },
        });

        for (const l of sameMakeBodyRaw) {
            if (!seenIds.has(l.id)) {
                seenIds.add(l.id);
                results.push(toSummary(l));
            }
        }
    }

    // 3. Comparable price (±20%) across available catalog (direct index scan on @@index([pricePln]))
    if (results.length < desiredCount && listing.pricePln && listing.pricePln > 0) {
        const remaining = desiredCount - results.length;
        const minPrice = Math.round(listing.pricePln * 0.8);
        const maxPrice = Math.round(listing.pricePln * 1.2);

        const samePriceRaw = await fastify.prisma.listing.findMany({
            where: {
                isArchived: false,
                pricePln: { gte: minPrice, lte: maxPrice },
                NOT: { id: { in: Array.from(seenIds) } },
            },
            take: remaining,
            orderBy: [{ createdAt: 'desc' }],
            select: {
                id: true,
                make: true,
                model: true,
                version: true,
                productionYear: true,
                pricePln: true,
                mileageKm: true,
                fuelType: true,
                bodyType: true,
                primaryImageUrl: true,
            },
        });

        for (const l of samePriceRaw) {
            if (!seenIds.has(l.id)) {
                seenIds.add(l.id);
                results.push(toSummary(l));
            }
        }
    }

    return results;
}

/**
 * Calculates the last meaningful change date for a listing.
 * Price recalculation (reference installments) must NOT bump this timestamp.
 */
export function getListingLastMeaningfulChange(listing: {
    createdAt: Date;
    lastManualEditAt?: Date | null;
    priceHistory?: { changedAt: Date }[];
}): Date {
    let latest = listing.createdAt;
    if (listing.lastManualEditAt && listing.lastManualEditAt > latest) {
        latest = listing.lastManualEditAt;
    }
    if (listing.priceHistory && listing.priceHistory.length > 0) {
        const lastPriceChange = listing.priceHistory[0].changedAt;
        if (lastPriceChange && lastPriceChange > latest) {
            latest = lastPriceChange;
        }
    }
    return latest;
}
