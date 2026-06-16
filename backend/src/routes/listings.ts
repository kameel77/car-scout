import { FastifyInstance } from 'fastify';
import { refreshListingImages } from '../services/image-refresh.service.js';
import { generateListingSlug, extractListingIdFromSlug } from '../utils/url-utils.js';
import { resolveScope } from '../utils/scope-resolver.js';
import {
    mapManualPayloadToListing,
    mapManualPayloadToListingUpdate,
    pickCsvEditableFields,
    validateListingPayload,
} from '../services/listing-mapper.js';

export async function listingRoutes(fastify: FastifyInstance) {
    // Get filter options (makes and models) - only active listings
    fastify.get('/api/listings/options', async (request, reply) => {
        // fetch distinct makes from non-archived listings
        const makesRaw = await fastify.prisma.listing.findMany({
            where: { isArchived: false },
            select: { make: true },
            distinct: ['make'],
            orderBy: { make: 'asc' }
        });

        // fetch distinct models with their makes from non-archived listings
        const modelsRaw = await fastify.prisma.listing.findMany({
            where: { isArchived: false },
            select: { make: true, model: true },
            distinct: ['make', 'model'],
            orderBy: { model: 'asc' }
        });

        // fetch distinct body types from non-archived listings
        const bodyTypesRaw = await fastify.prisma.listing.findMany({
            where: { isArchived: false, bodyType: { not: null } },
            select: { bodyType: true },
            distinct: ['bodyType'],
            orderBy: { bodyType: 'asc' }
        });

        const makes = makesRaw.map(m => m.make).filter(Boolean);
        const models = modelsRaw.map(m => ({ make: m.make, model: m.model })).filter(m => m.make && m.model);
        const bodyTypes = bodyTypesRaw.map(b => b.bodyType).filter(Boolean) as string[];

        return { makes, models, bodyTypes };
    });

    fastify.post('/api/listings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const body = request.body as any;
        const scope = await resolveScope(fastify, request);

        let dealerId = body.dealerId;
        if (!dealerId && scope.activeContext.scopeType === 'DEALER') {
            dealerId = scope.activeContext.scopeId;
        }
        if (!dealerId) {
            return reply.code(400).send({ error: 'dealerId is required' });
        }

        if (!scope.isPlatform) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && dealerId !== allowed) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
            if (allowed && typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(dealerId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }

        const errors = validateListingPayload(body);
        if (errors.length > 0) {
            return reply.code(400).send({ errors });
        }

        const dealer = await fastify.prisma.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer) {
            return reply.code(400).send({ error: 'Dealer not found' });
        }

        if (body.vin) {
            const existingByVin = await fastify.prisma.listing.findUnique({ where: { vin: body.vin } });
            if (existingByVin) {
                return reply.code(409).send({
                    error: 'VIN already exists',
                    existingListingId: existingByVin.id,
                });
            }
        }

        const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
        const brokerFeePct = settings?.brokerFeePctPln ?? 3.5;
        const brokerPricePln = Math.round(body.pricePln * (1 + brokerFeePct / 100));

        const listing = await fastify.prisma.listing.create({
            data: {
                ...mapManualPayloadToListing(body, dealerId),
                brokerPricePln,
                entrySource: 'MANUAL',
                lastManualEditAt: new Date(),
            },
        });

        const slug = generateListingSlug(
            listing.make,
            listing.model,
            listing.version,
            listing.productionYear,
            listing.bodyType,
            listing.fuelType,
            listing.id
        );
        const updated = await fastify.prisma.listing.update({
            where: { id: listing.id },
            data: { slug },
        });

        return reply.code(201).send({ listing: updated });
    });

    fastify.patch('/api/listings/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const scope = await resolveScope(fastify, request);

        const existing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        if (!scope.isPlatform && existing.dealerId) {
            const allowed = scope.dealerFilter.dealerId;
            if (typeof allowed === 'string' && existing.dealerId !== allowed) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
            if (allowed && typeof allowed === 'object' && 'in' in allowed && !allowed.in.includes(existing.dealerId)) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }

        const isImported = existing.entrySource === 'CSFLOW';

        let updateData: any;
        if (isImported) {
            updateData = pickCsvEditableFields(body);
        } else {
            const errors = validateListingPayload({
                ...existing,
                ...body,
            });
            if (errors.length > 0) {
                return reply.code(400).send({ errors });
            }
            updateData = mapManualPayloadToListingUpdate(body);
        }

        if (!isImported && body.pricePln !== undefined && body.pricePln !== existing.pricePln) {
            const settings = await fastify.prisma.appSettings.findUnique({ where: { id: 'default' } });
            const brokerFeePct = settings?.brokerFeePctPln ?? 3.5;
            updateData.brokerPricePln = Math.round(body.pricePln * (1 + brokerFeePct / 100));
        }

        updateData.lastManualEditAt = new Date();

        const updated = await fastify.prisma.listing.update({
            where: { id },
            data: updateData,
        });

        return reply.send({ listing: updated });
    });

    // Get all listings (with filters)
    // If an authenticated user with a scoped context calls this, results are filtered.
    fastify.get('/api/listings', async (request, reply) => {
        // Optionally resolve scope if user is authenticated
        let scopeDealerFilter: Record<string, any> = {};
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                await request.jwtVerify();
                const scope = await resolveScope(fastify, request);
                scopeDealerFilter = scope.dealerFilter;
            } catch {
                // Not authenticated or invalid token — ignore, serve public
            }
        }

        const {
            q, // Search query
            make, model,
            priceMin, priceMax,
            yearMin, yearMax,
            mileageMin, mileageMax,
            powerMin, powerMax,
            capacityMin, capacityMax,
            fuelType, transmission, bodyType, drive,
            status,
            sortBy,
            includeArchived,
            currency, // Added currency parameter
            page: pageParam,
            perPage: perPageParam,
            entrySource,
            lastManualEditBefore,
            // Rate filter (translated to price filter on the fly)
            rateMin, rateMax, rateType, rateBasis,
        } = request.query as any;

        // Helper to parse comma-separated lists into array or undefined
        const toArray = (val: unknown): string[] | undefined => {
            if (!val) return undefined;
            if (Array.isArray(val)) return val.map(String);
            return String(val).split(',');
        };

        const fuelTypesRaw = toArray(fuelType);
        const transmissionsRaw = toArray(transmission);
        const bodyTypes = toArray(bodyType);
        const drives = toArray(drive);
        const makes = toArray(make);
        const models = toArray(model);

        // Canonical fuel buckets. Order matters in the if-chain below.
        const FUEL_CANONICALS = new Set(['petrol', 'diesel', 'hybrid', 'hybrid_plugin', 'petrol_lpg', 'electric', 'lpg', 'cng']);
        const fuelCanonical = (raw: string): string => {
            const lower = raw.toLowerCase();
            if (lower.includes('plug') && lower.includes('hybryd')) return 'hybrid_plugin';
            if (lower.includes('plug-in')) return 'hybrid_plugin';
            if (lower.startsWith('hybryd') || lower.startsWith('hybrid')) return 'hybrid';
            if (/benzyn.*gaz|benzyn.*lpg|gaz.*benzyn|petrol.*lpg/.test(lower)) return 'petrol_lpg';
            if (lower.startsWith('benzyn') || lower === 'pb' || lower === 'petrol') return 'petrol';
            if (lower.startsWith('diesel') || lower === 'on') return 'diesel';
            if (lower.startsWith('elektry') || lower === 'ev' || lower === 'bev' || lower === 'electric') return 'electric';
            if (lower === 'lpg' || lower === 'gaz') return 'lpg';
            if (lower === 'cng') return 'cng';
            return raw;
        };

        // Expand canonical transmission tokens ('manual'/'automatic') into the set of raw
        // DB values that start with the corresponding prefix. Anything else (raw values,
        // e.g. from legacy bookmarks) passes through unchanged.
        let transmissions: string[] | undefined = transmissionsRaw;
        if (transmissionsRaw && transmissionsRaw.some((t) => t === 'manual' || t === 'automatic')) {
            const distinct = await fastify.prisma.listing.findMany({
                where: { isArchived: false, transmission: { not: null } },
                select: { transmission: true },
                distinct: ['transmission'],
            });
            const allRaw = distinct.map((d) => d.transmission).filter((v): v is string => !!v);
            transmissions = transmissionsRaw.flatMap((token) => {
                const lower = token.toLowerCase();
                if (lower === 'manual') return allRaw.filter((v) => v.toLowerCase().startsWith('manual'));
                if (lower === 'automatic') return allRaw.filter((v) => v.toLowerCase().startsWith('automat'));
                return [token];
            });
        }

        // Expand canonical fuel tokens to the set of raw DB values matching the bucket.
        let fuelTypes: string[] | undefined = fuelTypesRaw;
        if (fuelTypesRaw && fuelTypesRaw.some((t) => FUEL_CANONICALS.has(t))) {
            const distinctFuel = await fastify.prisma.listing.findMany({
                where: { isArchived: false, fuelType: { not: null } },
                select: { fuelType: true },
                distinct: ['fuelType'],
            });
            const allRawFuel = distinctFuel.map((d) => d.fuelType).filter((v): v is string => !!v);
            fuelTypes = fuelTypesRaw.flatMap((token) => {
                if (FUEL_CANONICALS.has(token)) {
                    return allRawFuel.filter((v) => fuelCanonical(v) === token);
                }
                return [token];
            });
        }
        // status: 'new' | 'used' (case-insensitive); maps to Prisma `condition` enum NEW | USED
        const statuses = toArray(status)
            ?.map((c) => c.toUpperCase())
            .filter((c) => c === 'NEW' || c === 'USED') as ('NEW' | 'USED')[] | undefined;

        const isEur = currency === 'EUR';
        const priceField = isEur ? 'brokerPriceEur' : 'brokerPricePln';

        // Translate monthly rate filter into broker price filter (PLN only, mirrors ListingCard formula).
        // - credit gross rate = price * 0.014
        // - credit net rate   = price * 0.014 / 1.23
        // - lease  net rate   = price * 0.012 / 1.23
        // - lease  gross rate = price * 0.012
        let rateAsPriceMin: number | undefined;
        let rateAsPriceMax: number | undefined;
        if (!isEur && (rateMin || rateMax)) {
            const factor = rateType === 'lease' ? 0.012 : 0.014;
            const vatMul = rateBasis === 'net' ? 1.23 : 1;
            if (rateMin) rateAsPriceMin = Math.floor((parseInt(rateMin) * vatMul) / factor);
            if (rateMax) rateAsPriceMax = Math.ceil((parseInt(rateMax) * vatMul) / factor);
        }

        const page = Math.max(1, parseInt(pageParam) || 1);
        const parsedPerPage = parseInt(perPageParam);
        const perPage = [30, 60].includes(parsedPerPage) ? parsedPerPage : 30;

        const orderBy: any = {};
        switch (sortBy) {
            case 'cheapest':
            case 'price_asc': orderBy[priceField] = 'asc'; break;
            case 'expensive':
            case 'price_desc': orderBy[priceField] = 'desc'; break;
            case 'year_asc': orderBy.productionYear = 'asc'; break;
            case 'year_desc': orderBy.productionYear = 'desc'; break;
            case 'mileage':
            case 'mileage_asc': orderBy.mileageKm = 'asc'; break;
            case 'mileage_desc': orderBy.mileageKm = 'desc'; break;
            case 'newest': orderBy.createdAt = 'desc'; break;
            default: orderBy.productionYear = 'desc'; break; // Default to newest production year
        }

        // Search logic
        const searchTerms = q ? (q as string).trim().split(/\s+/).filter(Boolean) : [];
        const searchFilter = searchTerms.length > 0 ? {
            AND: searchTerms.map(term => {
                const isNumber = !isNaN(parseInt(term));
                const termFilter: any[] = [
                    { make: { contains: term, mode: 'insensitive' } },
                    { model: { contains: term, mode: 'insensitive' } },
                    { version: { contains: term, mode: 'insensitive' } },
                    { fuelType: { contains: term, mode: 'insensitive' } },
                    { transmission: { contains: term, mode: 'insensitive' } },
                    { bodyType: { contains: term, mode: 'insensitive' } },
                    // Check equipment arrays for exact matches (limit of Prisma)
                    { equipmentAudioMultimedia: { has: term } },
                    { equipmentSafety: { has: term } },
                    { equipmentComfortExtras: { has: term } },
                    { equipmentOther: { has: term } }
                ];

                if (isNumber) {
                    termFilter.push({ productionYear: { equals: parseInt(term) } });
                }

                return { OR: termFilter };
            })
        } : {};

        const where = {
            ...searchFilter,
            make: makes ? { in: makes, mode: 'insensitive' as const } : undefined,
            model: models ? { in: models, mode: 'insensitive' as const } : undefined,

            [priceField]: {
                gte: (() => {
                    const fromPrice = priceMin ? parseInt(priceMin) : undefined;
                    if (rateAsPriceMin !== undefined && fromPrice !== undefined) return Math.max(fromPrice, rateAsPriceMin);
                    return fromPrice ?? rateAsPriceMin;
                })(),
                lte: (() => {
                    const toPrice = priceMax ? parseInt(priceMax) : undefined;
                    if (rateAsPriceMax !== undefined && toPrice !== undefined) return Math.min(toPrice, rateAsPriceMax);
                    return toPrice ?? rateAsPriceMax;
                })()
            },
            productionYear: {
                gte: yearMin ? parseInt(yearMin) : undefined,
                lte: yearMax ? parseInt(yearMax) : undefined
            },
            mileageKm: {
                gte: mileageMin ? parseInt(mileageMin) : undefined,
                lte: mileageMax ? parseInt(mileageMax) : undefined
            },
            enginePowerHp: {
                gte: powerMin ? parseInt(powerMin) : undefined,
                lte: powerMax ? parseInt(powerMax) : undefined
            },
            engineCapacityCm3: {
                gte: capacityMin ? parseInt(capacityMin) : undefined,
                lte: capacityMax ? parseInt(capacityMax) : undefined
            },

            fuelType: fuelTypes ? { in: fuelTypes, mode: 'insensitive' as const } : undefined,
            transmission: transmissions ? { in: transmissions, mode: 'insensitive' as const } : undefined,
            bodyType: bodyTypes ? { in: bodyTypes, mode: 'insensitive' as const } : undefined,
            drive: drives ? { in: drives, mode: 'insensitive' as const } : undefined,
            condition: statuses && statuses.length ? { in: statuses } : undefined,
            isArchived: includeArchived === 'true' ? undefined : false,
            entrySource: lastManualEditBefore
                ? ('MANUAL' as const)
                : (entrySource && ['CSV', 'CSFLOW', 'MANUAL'].includes(String(entrySource))
                    ? (String(entrySource) as 'CSV' | 'CSFLOW' | 'MANUAL')
                    : undefined),
            lastManualEditAt: lastManualEditBefore
                ? { lt: new Date(String(lastManualEditBefore)) }
                : undefined,
            // Apply scope-based dealerId filter (if authenticated with scoped context)
            ...scopeDealerFilter,
        };

        // For per-dimension facets, count vehicles grouped by that dimension IGNORING
        // the filter on that dimension (so the user sees "BMW (24)" even after selecting BMW).
        // byCondition ignores the condition filter.
        const { condition: _conditionFilter, ...whereWithoutCondition } = where;
        const { make: _makeFilter, ...whereWithoutMake } = where;
        const { model: _modelFilter, ...whereWithoutModel } = where;
        const { fuelType: _fuelFilter, ...whereWithoutFuel } = where;
        const { transmission: _transmissionFilter, ...whereWithoutTransmission } = where;
        const { bodyType: _bodyFilter, ...whereWithoutBody } = where;
        const { drive: _driveFilter, ...whereWithoutDrive } = where;

        const [
            listings,
            totalCount,
            byConditionRaw,
            byMakeRaw,
            byModelRaw,
            byFuelRaw,
            byTransmissionRaw,
            byBodyRaw,
            byDriveRaw,
        ] = await Promise.all([
            fastify.prisma.listing.findMany({
                where,
                include: {
                    dealer: true
                },
                orderBy,
                skip: (page - 1) * perPage,
                take: perPage
            }),
            fastify.prisma.listing.count({ where }),
            fastify.prisma.listing.groupBy({
                by: ['condition'],
                where: whereWithoutCondition,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['make'],
                where: whereWithoutMake,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['model'],
                where: whereWithoutModel,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['fuelType'],
                where: whereWithoutFuel,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['transmission'],
                where: whereWithoutTransmission,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['bodyType'],
                where: whereWithoutBody,
                _count: { _all: true },
            }),
            fastify.prisma.listing.groupBy({
                by: ['drive'],
                where: whereWithoutDrive,
                _count: { _all: true },
            }),
        ]);

        const byCondition = { NEW: 0, USED: 0 };
        for (const row of byConditionRaw) {
            if (row.condition === 'NEW' || row.condition === 'USED') {
                byCondition[row.condition] = row._count._all;
            }
        }

        // Canonical bucket for transmission: collapse vendor variants under "manual"/"automatic".
        const transmissionCanonical = (raw: string): string => {
            const lower = raw.toLowerCase();
            if (lower.startsWith('manual')) return 'manual';
            if (lower.startsWith('automat')) return 'automatic';
            return raw;
        };

        // Build facet maps. Keys preserve the first-seen original case (e.g. "Benzynowy"),
        // but rows with different casings collapse into one bucket. Frontend matching
        // against these keys must be case-insensitive. For 'transmission' and 'fuelType',
        // raw values are bucketed under canonical keys so the UI shows clean unified
        // options (e.g. all vendor "automatic" variants roll up to one "automatic",
        // and "benzynowy"/"benzyna"/"PB" all roll up to "petrol").
        const toFacetMap = (rows: any[], key: string): Record<string, number> => {
            const out: Record<string, number> = {};
            const canonical: Record<string, string> = {};
            for (const r of rows) {
                const v = r[key];
                if (v == null || v === '') continue;
                const raw = String(v);
                if (key === 'transmission') {
                    const k = transmissionCanonical(raw);
                    out[k] = (out[k] || 0) + r._count._all;
                    continue;
                }
                if (key === 'fuelType') {
                    const k = fuelCanonical(raw);
                    out[k] = (out[k] || 0) + r._count._all;
                    continue;
                }
                const lower = raw.toLowerCase();
                if (!canonical[lower]) canonical[lower] = raw;
                const k = canonical[lower];
                out[k] = (out[k] || 0) + r._count._all;
            }
            return out;
        };

        const facets = {
            make: toFacetMap(byMakeRaw, 'make'),
            model: toFacetMap(byModelRaw, 'model'),
            fuelType: toFacetMap(byFuelRaw, 'fuelType'),
            transmission: toFacetMap(byTransmissionRaw, 'transmission'),
            bodyType: toFacetMap(byBodyRaw, 'bodyType'),
            drive: toFacetMap(byDriveRaw, 'drive'),
        };

        return {
            listings,
            count: totalCount,
            byCondition,
            facets,
            page,
            perPage,
            totalPages: Math.max(1, Math.ceil(totalCount / perPage))
        };
    });

    // Get multiple listings by IDs (for personal offer / CRM selection)
    fastify.get('/api/listings/by-ids', async (request, reply) => {
        const { ids } = request.query as { ids?: string };

        if (!ids || !ids.trim()) {
            return reply.code(400).send({ error: 'Missing ids parameter' });
        }

        const idList = ids.split(',').map(id => id.trim()).filter(Boolean);

        if (idList.length === 0) {
            return { listings: [] };
        }

        // Limit to 20 IDs for safety
        const limitedIds = idList.slice(0, 20);

        const listings = await fastify.prisma.listing.findMany({
            where: {
                id: { in: limitedIds },
                isArchived: false
            },
            include: {
                dealer: true
            }
        });

        return { listings };
    });

    // Get single listing by slug with price history
    fastify.get('/api/listings/by-slug/:slug', async (request, reply) => {
        const { slug } = request.params as { slug: string };

        // Try to find by slug first
        let listing = await fastify.prisma.listing.findUnique({
            where: { slug },
            include: {
                dealer: {
                    include: { settings: true }
                },
                creditProduct: true,
                leasingProduct: true,
                priceHistory: {
                    orderBy: { changedAt: 'desc' },
                    take: 30
                }
            }
        });

        // If not found by slug, try to extract ID from slug and find by ID
        if (!listing) {
            const idFromSlug = extractListingIdFromSlug(slug);
            if (idFromSlug) {
                listing = await fastify.prisma.listing.findUnique({
                    where: { id: idFromSlug },
                    include: {
                        dealer: {
                            include: { settings: true }
                        },
                        creditProduct: true,
                        leasingProduct: true,
                        priceHistory: {
                            orderBy: { changedAt: 'desc' },
                            take: 30
                        }
                    }
                });
            }
        }

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        return { listing };
    });

    // Get single listing by ID with price history (for backward compatibility)
    fastify.get('/api/listings/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        const listing = await fastify.prisma.listing.findUnique({
            where: { id },
            include: {
                dealer: {
                    include: { settings: true }
                },
                creditProduct: true,
                leasingProduct: true,
                priceHistory: {
                    orderBy: { changedAt: 'desc' },
                    take: 30
                }
            }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        return { listing };
    });

    // Archive listing (admin only, scope-aware)
    fastify.post('/api/listings/:id/archive', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { reason } = request.body as { reason?: string };
        const scope = await resolveScope(fastify, request);

        // Verify ownership — non-platform users can only archive their own listings
        if (!scope.isPlatform) {
            const existing = await fastify.prisma.listing.findUnique({ where: { id }, select: { dealerId: true } });
            const allowedDealerIds = scope.dealerFilter.dealerId;
            const dealerId = existing?.dealerId;
            if (!dealerId) return reply.code(403).send({ error: 'Listing has no dealer' });
            if (typeof allowedDealerIds === 'string' && dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const listing = await fastify.prisma.listing.update({
            where: { id },
            data: {
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: reason || 'Manual archive'
            }
        });

        return { listing };
    });

    // Restore from archive (admin only, scope-aware)
    fastify.post('/api/listings/:id/restore', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const scope = await resolveScope(fastify, request);

        if (!scope.isPlatform) {
            const existing = await fastify.prisma.listing.findUnique({ where: { id }, select: { dealerId: true } });
            const allowedDealerIds = scope.dealerFilter.dealerId;
            const dealerId = existing?.dealerId;
            if (!dealerId) return reply.code(403).send({ error: 'Listing has no dealer' });
            if (typeof allowedDealerIds === 'string' && dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const listing = await fastify.prisma.listing.update({
            where: { id },
            data: {
                isArchived: false,
                archivedAt: null,
                archivedReason: null
            }
        });

        return { listing };
    });

    // Delete listing permanently (admin only, scope-aware)
    fastify.delete('/api/listings/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const scope = await resolveScope(fastify, request);

        if (!scope.isPlatform) {
            const existing = await fastify.prisma.listing.findUnique({ where: { id }, select: { dealerId: true } });
            const allowedDealerIds = scope.dealerFilter.dealerId;
            const dealerId = existing?.dealerId;
            if (!dealerId) return reply.code(403).send({ error: 'Listing has no dealer' });
            if (typeof allowedDealerIds === 'string' && dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        try {
            // Due to onDelete: Cascade in schema, related records (leads, priceHistory) will be deleted automatically
            await fastify.prisma.listing.delete({
                where: { id }
            });

            return { success: true, message: 'Listing deleted permanently' };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                error: 'Failed to delete listing',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get listing counts grouped by importSource (platform admin only)
    fastify.get('/api/listings/sources', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform) return reply.code(403).send({ error: 'Forbidden' });

        const groups = await fastify.prisma.listing.groupBy({
            by: ['importSource'],
            _count: { _all: true },
            where: { isArchived: false },
            orderBy: { _count: { importSource: 'desc' } }
        });

        const archivedGroups = await fastify.prisma.listing.groupBy({
            by: ['importSource'],
            _count: { _all: true },
            where: { isArchived: true },
            orderBy: { _count: { importSource: 'desc' } }
        });

        const archivedMap = new Map(archivedGroups.map(g => [g.importSource ?? '__null__', g._count._all]));

        const sources = groups.map(g => ({
            source: g.importSource ?? null,
            activeCount: g._count._all,
            archivedCount: archivedMap.get(g.importSource ?? '__null__') ?? 0,
        }));

        // Also include sources that only have archived listings
        for (const ag of archivedGroups) {
            if (!groups.find(g => g.importSource === ag.importSource)) {
                sources.push({
                    source: ag.importSource ?? null,
                    activeCount: 0,
                    archivedCount: ag._count._all,
                });
            }
        }

        return { sources };
    });

    // Bulk archive all listings by importSource (platform admin only)
    fastify.post('/api/listings/bulk/archive-by-source', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform) return reply.code(403).send({ error: 'Forbidden' });

        const { source } = request.body as { source: string | null };

        const where = source === null || source === '__null__'
            ? { importSource: null, isArchived: false }
            : { importSource: source, isArchived: false };

        const result = await fastify.prisma.listing.updateMany({
            where,
            data: {
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: `Bulk archive by source: ${source ?? 'manual'}`,
            }
        });

        return { success: true, count: result.count };
    });

    // Bulk delete all listings by importSource (platform admin only)
    fastify.post('/api/listings/bulk/delete-by-source', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const scope = await resolveScope(fastify, request);
        if (!scope.isPlatform) return reply.code(403).send({ error: 'Forbidden' });

        const { source, includeArchived } = request.body as { source: string | null; includeArchived?: boolean };

        const where = source === null || source === '__null__'
            ? { importSource: null, ...(includeArchived ? {} : { isArchived: false }) }
            : { importSource: source, ...(includeArchived ? {} : { isArchived: false }) };

        try {
            const result = await fastify.prisma.listing.deleteMany({ where });
            return { success: true, count: result.count };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                error: 'Bulk delete failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });

    // Duplicate model (technical specs only)
    fastify.post('/api/listings/:id/duplicate-model', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const scope = await resolveScope(fastify, request);

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        if (!scope.isPlatform && listing.dealerId) {
            const allowedDealerIds = scope.dealerFilter.dealerId;
            if (typeof allowedDealerIds === 'string' && listing.dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(listing.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        const newListing = await fastify.prisma.listing.create({
            data: {
                dealerId: listing.dealerId,
                ownerUserId: listing.ownerUserId,
                make: listing.make,
                model: listing.model,
                version: listing.version,
                bodyType: listing.bodyType,
                fuelType: listing.fuelType,
                transmission: listing.transmission,
                enginePowerHp: listing.enginePowerHp,
                engineCapacityCm3: listing.engineCapacityCm3,
                productionYear: listing.productionYear,
                doors: listing.doors,
                seats: listing.seats,
                drive: listing.drive,
                condition: listing.condition,
                isChineseBrand: listing.isChineseBrand,
                financingPriceBase: listing.financingPriceBase,
                // Required fields with placeholder values — user will fill in
                pricePln: 0,
                mileageKm: 0,
                // Do not copy: VIN, prices, equipment, images, contact data, listingId/url, slug
                // Archive by default so placeholder-priced draft is not shown publicly
                isArchived: true,
                archivedAt: new Date(),
                archivedReason: 'Draft from duplicate model',
                entrySource: 'MANUAL',
                lastManualEditAt: new Date(),
            }
        });

        const slug = generateListingSlug(
            newListing.make, newListing.model, newListing.version,
            newListing.productionYear, newListing.bodyType, newListing.fuelType, newListing.id
        );

        const updated = await fastify.prisma.listing.update({
            where: { id: newListing.id },
            data: { slug }
        });

        return reply.code(201).send({ listing: updated });
    });

    // Duplicate offer (full copy without unique fields and state)
    fastify.post('/api/listings/:id/duplicate-offer', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const scope = await resolveScope(fastify, request);

        const listing = await fastify.prisma.listing.findUnique({ where: { id } });
        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        if (!scope.isPlatform && listing.dealerId) {
            const allowedDealerIds = scope.dealerFilter.dealerId;
            if (typeof allowedDealerIds === 'string' && listing.dealerId !== allowedDealerIds) return reply.code(403).send({ error: 'Forbidden' });
            if (typeof allowedDealerIds === 'object' && 'in' in allowedDealerIds && !allowedDealerIds.in.includes(listing.dealerId)) return reply.code(403).send({ error: 'Forbidden' });
        }

        // Copy everything except id, unique fields, and state
        const {
            id: _id,
            slug: _slug,
            vin: _vin,
            listingId: _listingId,
            listingUrl: _listingUrl,
            scrapedAt: _scrapedAt,
            isFeatured: _isFeatured,
            isArchived: _isArchived,
            archivedAt: _archivedAt,
            archivedReason: _archivedReason,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
            ...dataToCopy
        } = listing;

        const newListing = await fastify.prisma.listing.create({
            data: {
                ...dataToCopy,
                entrySource: 'MANUAL',
                lastManualEditAt: new Date(),
            } as any
        });

        const slug = generateListingSlug(
            newListing.make, newListing.model, newListing.version,
            newListing.productionYear, newListing.bodyType, newListing.fuelType, newListing.id
        );

        const updated = await fastify.prisma.listing.update({
            where: { id: newListing.id },
            data: { slug }
        });

        return reply.code(201).send({ listing: updated });
    });

    // Refresh images from source (admin only for manual refresh, public for auto-refresh)
    fastify.post('/api/listings/:id/refresh-images', async (request, reply) => {
        const { id } = request.params as { id: string };

        // Check if user is authenticated (for manual refresh)
        const authHeader = request.headers.authorization;
        const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');

        if (!isAuthenticated) {
            // For auto-refresh, check if autoRefreshImages setting is enabled
            try {
                const settings = await fastify.prisma.appSettings.findFirst();
                // If settings are missing, we default to "auto-refresh disabled" instead of 500
                if (!settings?.autoRefreshImages) {
                    return reply.code(403).send({
                        error: 'Auto-refresh not enabled'
                    });
                }
            } catch (error) {
                fastify.log.error(error, 'Refresh-images: Settings check failed');
                // Return 500 only if there's a serious DB error, but give more context
                return reply.code(500).send({
                    error: 'Settings check failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        try {
            const listing = await refreshListingImages(fastify.prisma, id);
            return { success: true, listing };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(400).send({
                error: 'Refresh failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
