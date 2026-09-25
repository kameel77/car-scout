import { FastifyInstance } from 'fastify';
import { sanitizeListing, sanitizeDealer, tryAuthenticate } from '../constants/dealer.js';
import { normalizeBrand } from '../services/brand-normalization.service.js';
import { requirePermission } from '../middleware/permissions.js';
import { getOrSetJson, getJsonFromCache, setJsonInCache, buildRentalVehiclesQueryCacheKey, buildRentalVehicleSlugCacheKey, parseRentalVehiclesQuery } from '../services/api-cache.js';
import { calculateRatesWithInsurance } from '../services/rental-pricing.js';
export { calculateRatesWithInsurance };

export function selectBestMatrixEntry<T extends { id?: string; offerType?: string; feePct?: number | null; [key: string]: any }>(
    entries: T[],
    calcOfferType?: string
): T | null {
    if (!entries || entries.length === 0) return null;
    if (entries.length === 1) return entries[0];

    return [...entries].sort((a, b) => {
        // Priority 1: Exact match on requested offerType (e.g. 'business' or 'consumer')
        const getRank = (entry: T) => {
            if (calcOfferType && entry.offerType === calcOfferType) return 0;
            if (entry.offerType === 'all') return 1;
            return 2;
        };
        const rankDiff = getRank(a) - getRank(b);
        if (rankDiff !== 0) return rankDiff;

        // Priority 2: Deterministic tiebreaker by ID
        return (a.id || '').localeCompare(b.id || '');
    })[0];
}

export async function executeRentalVehiclesQuery(
    fastify: FastifyInstance,
    rawQuery: Record<string, any>,
    auth = false
): Promise<{
    vehicles: any[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: any;
    facets: any;
}> {
    const parsed = parseRentalVehiclesQuery(rawQuery);

            // priceBasis controls whether priceFrom/priceTo are compared against monthlyRateNet or monthlyRateGross.
            // Default gross preserves prior behaviour for callers that omit it.
            const rateField: 'monthlyRateNet' | 'monthlyRateGross' =
                parsed.priceBasis === 'net' ? 'monthlyRateNet' : 'monthlyRateGross';

            const pageNum = parsed.page;
            const limitNum = Math.min(50, parsed.limit);
            const skip = (pageNum - 1) * limitNum;

            const makes = parsed.make;
            const models = parsed.model;
            const bodyTypes = parsed.bodyType;
            const fuelTypesRaw = parsed.fuelType;
            const transmissionsRaw = parsed.transmission;
            const drives = parsed.drive;
            const statuses = parsed.condition;

            // Canonical fuel buckets (mirrors listings.ts).
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

            // Expand canonical transmission tokens ('manual'/'automatic') into raw DB values
            // matching the corresponding prefix. Anything else passes through unchanged.
            let transmissions: string[] | undefined = transmissionsRaw;
            if (transmissionsRaw && transmissionsRaw.some((t) => t.toLowerCase() === 'manual' || t.toLowerCase() === 'automatic')) {
                const distinct = await fastify.prisma.rentalVehicle.findMany({
                    where: { isActive: true, transmission: { not: null } },
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

            // Expand canonical fuel tokens to matching raw DB values.
            let fuelTypes: string[] | undefined = fuelTypesRaw;
            if (fuelTypesRaw && fuelTypesRaw.some((t) => FUEL_CANONICALS.has(t.toLowerCase()))) {
                const distinctFuel = await fastify.prisma.rentalVehicle.findMany({
                    where: { isActive: true, fuelType: { not: null } },
                    select: { fuelType: true },
                    distinct: ['fuelType'],
                });
                const allRawFuel = distinctFuel.map((d) => d.fuelType).filter((v): v is string => !!v);
                fuelTypes = fuelTypesRaw.flatMap((token) => {
                    const lower = token.toLowerCase();
                    if (FUEL_CANONICALS.has(lower)) {
                        return allRawFuel.filter((v) => fuelCanonical(v) === lower);
                    }
                    return [token];
                });
            }

            // Build matrix entry filter for offerType
            const matrixEntryFilter: any = {};
            if (parsed.offerType) {
                matrixEntryFilter.offerType = { in: [parsed.offerType, 'all'] };
            }

            const where: any = {
                isActive: true,
                isPublished: true,
                rentalAssignments: {
                    some: {
                        isActive: true,
                        matrixEntries: {
                            some: matrixEntryFilter // Must have at least one matrix entry matching offerType
                        }
                    }
                }
            };

            if (makes) where.make = { in: makes, mode: 'insensitive' as const };
            if (models) where.model = { in: models, mode: 'insensitive' as const };
            if (bodyTypes) where.bodyType = { in: bodyTypes, mode: 'insensitive' as const };
            if (fuelTypes) where.fuelType = { in: fuelTypes, mode: 'insensitive' as const };
            if (transmissions) where.transmission = { in: transmissions, mode: 'insensitive' as const };
            if (drives) where.drive = { in: drives, mode: 'insensitive' as const };

            // Condition filter (NEW / USED)
            if (statuses) {
                where.condition = { in: statuses };
            }

            // Year range filter
            if (parsed.yearFrom !== undefined || parsed.yearTo !== undefined) {
                where.productionYear = {};
                if (parsed.yearFrom !== undefined) where.productionYear.gte = parsed.yearFrom;
                if (parsed.yearTo !== undefined) where.productionYear.lte = parsed.yearTo;
            }

            // Mileage range filter
            if (parsed.mileageFrom !== undefined || parsed.mileageTo !== undefined) {
                where.mileageKm = {};
                if (parsed.mileageFrom !== undefined) where.mileageKm.gte = parsed.mileageFrom;
                if (parsed.mileageTo !== undefined) where.mileageKm.lte = parsed.mileageTo;
            }

            // Power range filter
            if (parsed.powerFrom !== undefined || parsed.powerTo !== undefined) {
                where.enginePowerHp = {};
                if (parsed.powerFrom !== undefined) where.enginePowerHp.gte = parsed.powerFrom;
                if (parsed.powerTo !== undefined) where.enginePowerHp.lte = parsed.powerTo;
            }

            // Engine capacity range filter
            if (parsed.capacityFrom !== undefined || parsed.capacityTo !== undefined) {
                where.engineCapacityCm3 = {};
                if (parsed.capacityFrom !== undefined) where.engineCapacityCm3.gte = parsed.capacityFrom;
                if (parsed.capacityTo !== undefined) where.engineCapacityCm3.lte = parsed.capacityTo;
            }

            if (parsed.search) {
                where.OR = [
                    { make: { contains: parsed.search, mode: 'insensitive' } },
                    { model: { contains: parsed.search, mode: 'insensitive' } },
                    { version: { contains: parsed.search, mode: 'insensitive' } }
                ];
            }

            const isRateSort = parsed.sortBy === 'minMonthlyRateNet' || parsed.sortBy === 'minMonthlyRateGross';
            const isPriceFilter = parsed.priceFrom !== undefined || parsed.priceTo !== undefined;

            const orderBy: any = {};
            const validSortFields = ['createdAt', 'sellingPrice', 'make', 'productionYear', 'catalogPrice'];
            const sortField = validSortFields.includes(parsed.sortBy) ? parsed.sortBy : 'createdAt';
            orderBy[sortField] = parsed.sortOrder;

        const fullSelect = {
            id: true,
            make: true,
            model: true,
            version: true,
            bodyType: true,
            fuelType: true,
            transmission: true,
            enginePowerHp: true,
            productionYear: true,
            catalogPrice: true,
            sellingPrice: true,
            primaryImageUrl: true,
            imageUrls: true,
            slug: true,
            condition: true,
            dealer: {
                select: { id: true, name: true, city: true }
            },
            rentalAssignments: {
                where: { isActive: true },
                include: {
                    rentalCompany: {
                        select: { id: true, name: true, slug: true, logoUrl: true, includedServices: true, insuranceAddMode: true }
                    },
                    matrixEntries: {
                        where: matrixEntryFilter,
                        orderBy: [
                            { contractMonths: 'asc' },
                            { annualMileageKm: 'asc' },
                            { initialPaymentAmountNet: 'asc' },
                            { monthlyRateGross: 'asc' }
                        ] as any,
                        take: 1,
                        select: {
                            monthlyRateNet: true,
                            monthlyRateGross: true,
                            contractMonths: true,
                            annualMileageKm: true,
                            initialPaymentAmountNet: true,
                            servicesIncluded: true,
                            insuranceNet: true
                        }
                    }
                }
            }
        } as const;

        let vehicles: any[] = [];
        let total = 0;
        // When rate filter is active, byCondition computed from the in-memory filtered set -
        // overrides the DB-only count from getFilterOptions so tab counts match the listing.
        let byConditionOverride: { NEW: number; USED: number } | undefined;

        if (isRateSort || isPriceFilter) {
            // 1. Fetch minimal data for all matching vehicles
            const allVehiclesMinimal = await fastify.prisma.rentalVehicle.findMany({
                where,
                orderBy: [{ id: 'asc' }],
                select: {
                    id: true,
                    condition: true,
                    [sortField as string]: true,
                    rentalAssignments: {
                        where: { isActive: true },
                        select: {
                            includedServicesOverride: true,
                            insuranceAddModeOverride: true,
                            rentalCompany: {
                                select: {
                                    includedServices: true,
                                    insuranceAddMode: true
                                }
                            },
                            matrixEntries: {
                                where: matrixEntryFilter,
                                select: {
                                    monthlyRateNet: true,
                                    monthlyRateGross: true,
                                    contractMonths: true,
                                    annualMileageKm: true,
                                    initialPaymentAmountNet: true,
                                    insuranceNet: true
                                }
                            }
                        }
                    }
                }
            } as any); // Cast to any because of dynamic sortField

            // 2. Compute min rate (cheapest entry, tie-broken on contract/mileage/initial/gross)
            let mapped = (allVehiclesMinimal as any[]).map(v => {
                let bestRateEntry: any = null;
                for (const a of v.rentalAssignments || []) {
                    for (const mRaw of a.matrixEntries || []) {
                        const m = calculateRatesWithInsurance(mRaw, a);
                        if (m.insuranceMissing) continue;
                        if (!bestRateEntry) {
                            bestRateEntry = m;
                        } else {
                            if (m.contractMonths < bestRateEntry.contractMonths) {
                                bestRateEntry = m;
                            } else if (m.contractMonths === bestRateEntry.contractMonths) {
                                if (m.annualMileageKm < bestRateEntry.annualMileageKm) {
                                    bestRateEntry = m;
                                } else if (m.annualMileageKm === bestRateEntry.annualMileageKm) {
                                    if (m.initialPaymentAmountNet < bestRateEntry.initialPaymentAmountNet) {
                                        bestRateEntry = m;
                                    } else if (m.initialPaymentAmountNet === bestRateEntry.initialPaymentAmountNet) {
                                        if (m.monthlyRateGross < bestRateEntry.monthlyRateGross) {
                                            bestRateEntry = m;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                const minRate = bestRateEntry ? bestRateEntry[rateField] : null;
                return { id: String(v.id), condition: v.condition, minRate, sortFieldValue: v[sortField as string] };
            });

            // 3. Filter by price (comparing against monthlyRateNet or monthlyRateGross per priceBasis)
            if (isPriceFilter) {
                const from = parsed.priceFrom ?? 0;
                const to = parsed.priceTo ?? Infinity;
                mapped = mapped.filter(v => v.minRate !== null && v.minRate >= from && v.minRate <= to);

                // Compute byCondition from the post-filter set so tab counts match what the user sees.
                byConditionOverride = { NEW: 0, USED: 0 };
                for (const v of mapped) {
                    if (v.condition === 'NEW' || v.condition === 'USED') {
                        byConditionOverride[v.condition as 'NEW' | 'USED'] += 1;
                    }
                }
            }

            // 4. Sort
            if (isRateSort) {
                mapped.sort((a, b) => {
                    if (a.minRate === null && b.minRate === null) return a.id.localeCompare(b.id);
                    if (a.minRate === null) return 1;
                    if (b.minRate === null) return -1;
                    const diff = a.minRate - b.minRate;
                    if (diff !== 0) return parsed.sortOrder === 'asc' ? diff : -diff;
                    return a.id.localeCompare(b.id);
                });
            } else {
                mapped.sort((a, b) => {
                    const valA = a.sortFieldValue;
                    const valB = b.sortFieldValue;
                    if (valA === null || valA === undefined) return parsed.sortOrder === 'asc' ? 1 : -1;
                    if (valB === null || valB === undefined) return parsed.sortOrder === 'asc' ? -1 : 1;
                    if (valA < valB) return parsed.sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return parsed.sortOrder === 'asc' ? 1 : -1;
                    return a.id.localeCompare(b.id);
                });
            }

            total = mapped.length;
            const pagedIds = mapped.slice(skip, skip + limitNum).map(v => v.id);

            // 5. Fetch full details
            if (pagedIds.length > 0) {
                const unsortedVehicles = await fastify.prisma.rentalVehicle.findMany({
                    where: { id: { in: pagedIds } },
                    select: fullSelect
                });
                // Re-sort to match pagedIds order
                vehicles = pagedIds.map((id: string) => unsortedVehicles.find(v => v.id === id)).filter(Boolean);
            }
        } else {
            // Standard Prisma sort and pagination
            const [fetchedVehicles, totalCount] = await Promise.all([
                fastify.prisma.rentalVehicle.findMany({
                    where,
                    skip,
                    take: limitNum,
                    orderBy: [orderBy, { id: 'asc' }],
                    select: fullSelect
                }),
                fastify.prisma.rentalVehicle.count({ where })
            ]);
            vehicles = fetchedVehicles;
            total = totalCount;
        }

        const vehiclesWithRates = vehicles.map((v) => {
            const allMinRates = v.rentalAssignments
                .flatMap((a: any) => a.matrixEntries.map((e: any) => ({
                    ...calculateRatesWithInsurance(e, a),
                    companyName: a.rentalCompany.name,
                    companySlug: a.rentalCompany.slug
                })));

            const validRates = allMinRates.filter((r: any) => !r.insuranceMissing);
            const candidateRates = validRates.length > 0 ? validRates : allMinRates;

            const minRate = candidateRates.length > 0
                ? candidateRates.reduce((best: any, current: any) => {
                    if (current.contractMonths < best.contractMonths) return current;
                    if (current.contractMonths > best.contractMonths) return best;
                    if (current.annualMileageKm < best.annualMileageKm) return current;
                    if (current.annualMileageKm > best.annualMileageKm) return best;
                    if (current.initialPaymentAmountNet < best.initialPaymentAmountNet) return current;
                    if (current.initialPaymentAmountNet > best.initialPaymentAmountNet) return best;
                    if (current.monthlyRateGross < best.monthlyRateGross) return current;
                    return best;
                })
                : null;

            const isInsuranceMissing = Boolean(minRate?.insuranceMissing);

            return {
                ...v,
                minMonthlyRateGross: minRate && !isInsuranceMissing ? Math.ceil(minRate.monthlyRateGross) : null,
                minMonthlyRateNet: minRate && !isInsuranceMissing ? Math.ceil(minRate.monthlyRateNet) : null,
                insuranceMissing: isInsuranceMissing,
                minRateCompany: minRate?.companyName || null,
                minRateConfig: minRate ? {
                    contractMonths: minRate.contractMonths,
                    annualMileageKm: minRate.annualMileageKm,
                    servicesIncluded: minRate.servicesIncluded
                } : null,
                rentalCompanyCount: v.rentalAssignments.length,
                rentalAssignments: undefined, // Remove raw assignments from public response
                productionYear: v.productionYear,
                condition: v.condition
            };
        });

        // Get filter options (including condition counts) + per-dimension facets
        const filterOptions = await getFilterOptions(fastify, where);
        const facets = await computeFacets(fastify, where);

        // When rate filter shrank the in-memory set, replace the DB-derived byCondition
        // with the post-filter counts so tab numbers don't overstate the result.
        if (byConditionOverride) {
            filterOptions.byCondition = byConditionOverride;
        }

        const sanitizedVehicles = vehiclesWithRates.map((v: any) => sanitizeListing(v, auth));

        return {
            vehicles: sanitizedVehicles,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            filters: filterOptions,
            facets
        };
}

export async function rentalPublicRoutes(fastify: FastifyInstance) {
    // Public: List active rental vehicles with minimum rates
    fastify.get('/api/rental/vehicles', async (request, reply) => {
        const hasAuthHeader = Boolean(request.headers.authorization);
        const isAuthenticated = hasAuthHeader && await tryAuthenticate(fastify, request);

        if (isAuthenticated) {
            const data = await executeRentalVehiclesQuery(fastify, request.query as Record<string, any>, true);
            return reply.header('Cache-Control', 'private, no-store').send(data);
        }

        const cacheKey = buildRentalVehiclesQueryCacheKey(request.query as Record<string, any>);
        // 300s dla spójności z pozostałymi publicznymi endpointami (patrz Cloudflare cache rule) —
        // świeżość i tak gwarantuje purge przy każdej zmianie pojazdu (invalidateOfferCache).
        const data = await getOrSetJson(cacheKey, 300, () =>
            executeRentalVehiclesQuery(fastify, request.query as Record<string, any>, false)
        );

        return reply
            .header('Cache-Control', 'public, max-age=0, s-maxage=300')
            .header('Vary', 'Origin, Accept-Encoding')
            .send(data);
    });

    // Public: Get vehicle details with dynamic options from the matrix
    fastify.get('/api/rental/vehicles/:slug', async (request, reply) => {
        const { slug } = request.params as { slug: string };
        const hasAuthHeader = Boolean(request.headers.authorization);
        const isAuthenticated = hasAuthHeader && await tryAuthenticate(fastify, request);

        const fetchDetail = async (auth: boolean) => {
            const vehicle = await fastify.prisma.rentalVehicle.findFirst({
                where: {
                    OR: [
                        { slug },
                        { id: slug } // Fallback to ID
                    ],
                    isActive: true,
                    isPublished: true
                },
                select: {
                    id: true,
                    slug: true,
                    make: true,
                    model: true,
                    version: true,
                    bodyType: true,
                    fuelType: true,
                    transmission: true,
                    drive: true,
                    doors: true,
                    seats: true,
                    color: true,
                    paintType: true,
                    enginePowerHp: true,
                    engineCapacityCm3: true,
                    productionYear: true,
                    catalogPrice: true,
                    sellingPrice: true,
                    condition: true,
                    primaryImageUrl: true,
                    imageUrls: true,
                    additionalInfoHeader: true,
                    additionalInfoContent: true,
                    specificationUrl: true,
                    equipmentAudioMultimedia: true,
                    equipmentSafety: true,
                    equipmentComfortExtras: true,
                    equipmentOther: true,
                    createdAt: true,
                    updatedAt: true,
                    dealer: {
                        select: { id: true, name: true, addressLine1: true, city: true, contactPhone: true }
                    },
                    rentalAssignments: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            rentalCompany: {
                                select: { id: true, name: true, slug: true, logoUrl: true, contactEmail: true, contactPhone: true }
                            }
                        }
                    }
                }
            });

            if (!vehicle) {
                return null;
            }

            const assignmentIds = vehicle.rentalAssignments.map((a: any) => a.id);
            
            // Fetch explicit distinct options from the DB rather than mapping thousands of entries in memory
            const assignmentOptions = await fastify.prisma.rentalMatrixEntry.findMany({
                where: { assignmentId: { in: assignmentIds } },
                select: { annualMileageKm: true, contractMonths: true, initialPaymentPct: true, initialPaymentAmountNet: true, initialPaymentAmountGross: true, offerType: true },
                distinct: ['annualMileageKm', 'contractMonths', 'initialPaymentPct', 'initialPaymentAmountNet', 'initialPaymentAmountGross', 'offerType']
            });

            const initialPayments = assignmentOptions.map(e => ({ pct: e.initialPaymentPct, amountNet: e.initialPaymentAmountNet, amountGross: e.initialPaymentAmountGross }));
            const uniqueInitialPayments = Array.from(new Set(initialPayments.map(p => JSON.stringify(p)))).map(p => JSON.parse(p));
            uniqueInitialPayments.sort((a, b) => (a.pct === b.pct) ? (a.amountNet - b.amountNet) : (a.pct - b.pct));

            const options = {
                annualMileageOptions: [...new Set(assignmentOptions.map(e => e.annualMileageKm))].sort((a, b) => a - b),
                contractMonthOptions: [...new Set(assignmentOptions.map(e => e.contractMonths))].sort((a, b) => a - b),
                initialPaymentOptions: uniqueInitialPayments,
                offerTypeOptions: [...new Set(assignmentOptions.map(e => e.offerType))].sort()
            };

            return { vehicle: sanitizeListing(vehicle, auth), options };
        };

        if (isAuthenticated) {
            const data = await fetchDetail(true);
            if (!data) return reply.code(404).header('Cache-Control', 'private, no-store').send({ error: 'Rental vehicle not found' });
            return reply.code(200).header('Cache-Control', 'private, no-store').send(data);
        }

        const cacheKey = buildRentalVehicleSlugCacheKey(slug);
        const cached = await getJsonFromCache<any>(cacheKey);
        if (cached) {
            return reply
                .code(200)
                .header('Cache-Control', 'public, max-age=0, s-maxage=300')
                .header('Vary', 'Origin, Accept-Encoding')
                .send(cached);
        }

        const fresh = await fetchDetail(false);
        if (!fresh) {
            return reply
                .code(404)
                .header('Cache-Control', 'public, max-age=0, s-maxage=60')
                .header('Vary', 'Origin, Accept-Encoding')
                .send({ error: 'Rental vehicle not found' });
        }

        await setJsonInCache(cacheKey, fresh, 300);
        return reply
            .code(200)
            .header('Cache-Control', 'public, max-age=0, s-maxage=300')
            .header('Vary', 'Origin, Accept-Encoding')
            .send(fresh);
    });

    // Public: Calculate rate lookup
    fastify.get('/api/rental/vehicles/:slug/calculate', async (request, reply) => {
        const { slug } = request.params as { slug: string };
        const { annualMileageKm, contractMonths, initialPaymentPct, initialPaymentAmountNet, initialPaymentAmountGross, offerType } = request.query as {
            annualMileageKm: string;
            contractMonths: string;
            initialPaymentPct: string;
            initialPaymentAmountNet?: string;
            initialPaymentAmountGross?: string;
            offerType?: string;
        };

        if (!annualMileageKm || !contractMonths || !initialPaymentPct) {
            return reply.code(400).send({
                error: 'Required query params: annualMileageKm, contractMonths, initialPaymentPct'
            });
        }

        // Normalize offerType
        let calcOfferType = offerType?.trim().toLowerCase();
        if (calcOfferType && ['b2b', 'firma', 'business'].includes(calcOfferType)) calcOfferType = 'business';
        if (calcOfferType && ['b2c', 'prywatnie', 'prywatny', 'consumer'].includes(calcOfferType)) calcOfferType = 'consumer';

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                isActive: true,
                isPublished: true
            },
            select: {
                id: true,
                make: true,
                model: true,
                sellingPrice: true,
                rentalAssignments: {
                    where: { isActive: true },
                    select: {
                        includedServicesOverride: true,
                        insuranceAddModeOverride: true,
                        rentalCompany: {
                            select: { id: true, name: true, slug: true, logoUrl: true, includedServices: true, insuranceAddMode: true }
                        },
                        matrixEntries: {
                            where: {
                                annualMileageKm: parseInt(annualMileageKm),
                                contractMonths: parseInt(contractMonths),
                                initialPaymentPct: parseFloat(initialPaymentPct),
                                ...(initialPaymentAmountNet && { initialPaymentAmountNet: parseFloat(initialPaymentAmountNet) }),
                                ...(initialPaymentAmountGross && { initialPaymentAmountGross: parseFloat(initialPaymentAmountGross) }),
                                ...(calcOfferType && calcOfferType !== 'all'
                                    ? { offerType: { in: [calcOfferType, 'all'] } }
                                    : {})
                            },
                            orderBy: [
                                { offerType: 'asc' },
                                { id: 'asc' }
                            ]
                        }
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Build offers from each company with deterministic entry selection
        const offers = vehicle.rentalAssignments
            .map((a: any) => {
                const bestEntry = selectBestMatrixEntry(a.matrixEntries, calcOfferType);
                if (!bestEntry) return null;
                const calculatedEntry = calculateRatesWithInsurance(bestEntry, a);
                return {
                    company: a.rentalCompany,
                    monthlyRateNet: Math.ceil(calculatedEntry.monthlyRateNet),
                    monthlyRateGross: Math.ceil(calculatedEntry.monthlyRateGross),
                    servicesIncluded: calculatedEntry.servicesIncluded,
                    insuranceMissing: Boolean(calculatedEntry.insuranceMissing),
                    initialPaymentAmountNet: calculatedEntry.initialPaymentAmountNet,
                    initialPaymentAmountGross: calculatedEntry.initialPaymentAmountGross
                };
            })
            .filter((o): o is NonNullable<typeof o> => o !== null)
            .sort((a, b) => {
                // Incomplete offers (insuranceMissing) always at the end
                if (a.insuranceMissing !== b.insuranceMissing) {
                    return a.insuranceMissing ? 1 : -1;
                }
                // Sort by the rate the user is seeing: gross for consumer, net for B2B
                return calcOfferType === 'consumer'
                    ? a.monthlyRateGross - b.monthlyRateGross
                    : a.monthlyRateNet - b.monthlyRateNet;
            });

        const cheapest = offers.find(o => !o.insuranceMissing) || offers[0] || null;

        return {
            vehicleId: vehicle.id,
            params: {
                annualMileageKm: parseInt(annualMileageKm),
                contractMonths: parseInt(contractMonths),
                initialPaymentPct: parseFloat(initialPaymentPct)
            },
            offers,
            cheapest
        };
    });

    // Operator only: Get operator financials (feePct) for vehicle offers with permission check
    fastify.get('/api/rental/vehicles/:slug/operator-financials', {
        preHandler: [fastify.authenticate, requirePermission('rental:financials:read')]
    }, async (request, reply) => {
        const { slug } = request.params as { slug: string };
        const { annualMileageKm, contractMonths, initialPaymentPct, initialPaymentAmountNet, initialPaymentAmountGross, offerType } = request.query as {
            annualMileageKm?: string;
            contractMonths?: string;
            initialPaymentPct?: string;
            initialPaymentAmountNet?: string;
            initialPaymentAmountGross?: string;
            offerType?: string;
        };

        if (!annualMileageKm || !contractMonths || !initialPaymentPct) {
            return reply.code(400).send({
                error: 'Required query params: annualMileageKm, contractMonths, initialPaymentPct'
            });
        }

        let calcOfferType = offerType?.trim().toLowerCase();
        if (calcOfferType && ['b2b', 'firma', 'business'].includes(calcOfferType)) calcOfferType = 'business';
        if (calcOfferType && ['b2c', 'prywatnie', 'prywatny', 'consumer'].includes(calcOfferType)) calcOfferType = 'consumer';

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                isActive: true
            },
            select: {
                id: true,
                rentalAssignments: {
                    where: { isActive: true },
                    select: {
                        rentalCompany: {
                            select: { id: true, name: true }
                        },
                        matrixEntries: {
                            where: {
                                annualMileageKm: parseInt(annualMileageKm),
                                contractMonths: parseInt(contractMonths),
                                initialPaymentPct: parseFloat(initialPaymentPct),
                                ...(initialPaymentAmountNet && { initialPaymentAmountNet: parseFloat(initialPaymentAmountNet) }),
                                ...(initialPaymentAmountGross && { initialPaymentAmountGross: parseFloat(initialPaymentAmountGross) }),
                                ...(calcOfferType && calcOfferType !== 'all'
                                    ? { offerType: { in: [calcOfferType, 'all'] } }
                                    : {})
                            },
                            select: {
                                id: true,
                                offerType: true,
                                feePct: true
                            },
                            orderBy: [
                                { offerType: 'asc' },
                                { id: 'asc' }
                            ]
                        }
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        const financialsByCompanyId: Record<string, { feePct: number | null }> = {};
        const offers = vehicle.rentalAssignments
            .map((a: any) => {
                const bestEntry = selectBestMatrixEntry(a.matrixEntries, calcOfferType);
                if (!bestEntry) return null;
                const feePct = bestEntry.feePct ?? null;
                financialsByCompanyId[a.rentalCompany.id] = { feePct };
                return {
                    companyId: a.rentalCompany.id,
                    companyName: a.rentalCompany.name,
                    feePct
                };
            })
            .filter((o): o is NonNullable<typeof o> => o !== null);

        return {
            vehicleId: vehicle.id,
            offers,
            financialsByCompanyId
        };
    });

    // Operator only: Get vehicle-level operator information (supplier: dealer / ownerRentalCompany, availableFrom, firstRegistrationDate, vin)
    fastify.get('/api/rental/vehicles/:slug/operator-info', {
        preHandler: [fastify.authenticate, requirePermission('rental:financials:read')]
    }, async (request, reply) => {
        const { slug } = request.params as { slug: string };

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: {
                OR: [{ slug }, { id: slug }],
                isActive: true
            },
            select: {
                id: true,
                slug: true,
                vin: true,
                firstRegistrationDate: true,
                availableFrom: true,
                dealer: {
                    select: {
                        id: true,
                        name: true,
                        city: true,
                        addressLine1: true,
                        contactPhone: true
                    }
                },
                ownerRentalCompany: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        return {
            vehicleId: vehicle.id,
            slug: vehicle.slug,
            vin: vehicle.vin,
            firstRegistrationDate: vehicle.firstRegistrationDate,
            availableFrom: vehicle.availableFrom,
            dealer: vehicle.dealer,
            ownerRentalCompany: vehicle.ownerRentalCompany
        };
    });
}

// Per-dimension facets: for each dimension, count grouped by it with that dimension's filter stripped
// (so the user sees "BMW (24)" even after selecting BMW — the count is for the alternative if BMW were deselected).
async function computeFacets(fastify: FastifyInstance, where: any) {
    const stripKey = (w: any, key: string) => {
        const { [key]: _, ...rest } = w;
        return rest;
    };

    // Canonical bucket for transmission: collapse vendor variants under "manual"/"automatic".
    const transmissionCanonical = (raw: string): string => {
        const lower = raw.toLowerCase();
        if (lower.startsWith('manual')) return 'manual';
        if (lower.startsWith('automat')) return 'automatic';
        return raw;
    };

    // Canonical bucket for fuel (mirrors the main endpoint).
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
            if (key === 'make') {
                const k = normalizeBrand(raw);
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

    const [byMake, byModel, byFuel, byBody, byTransmission, byDrive] = await Promise.all([
        fastify.prisma.rentalVehicle.groupBy({
            by: ['make'],
            where: stripKey(where, 'make'),
            _count: { _all: true },
        }),
        fastify.prisma.rentalVehicle.groupBy({
            by: ['model'],
            where: stripKey(where, 'model'),
            _count: { _all: true },
        }),
        fastify.prisma.rentalVehicle.groupBy({
            by: ['fuelType'],
            where: stripKey(where, 'fuelType'),
            _count: { _all: true },
        }),
        fastify.prisma.rentalVehicle.groupBy({
            by: ['bodyType'],
            where: stripKey(where, 'bodyType'),
            _count: { _all: true },
        }),
        fastify.prisma.rentalVehicle.groupBy({
            by: ['transmission'],
            where: stripKey(where, 'transmission'),
            _count: { _all: true },
        }),
        fastify.prisma.rentalVehicle.groupBy({
            by: ['drive'],
            where: stripKey(where, 'drive'),
            _count: { _all: true },
        }),
    ]);

    return {
        make: toFacetMap(byMake, 'make'),
        model: toFacetMap(byModel, 'model'),
        fuelType: toFacetMap(byFuel, 'fuelType'),
        bodyType: toFacetMap(byBody, 'bodyType'),
        transmission: toFacetMap(byTransmission, 'transmission'),
        drive: toFacetMap(byDrive, 'drive'),
    };
}

async function getFilterOptions(fastify: FastifyInstance, currentWhere?: any) {
    const cacheKey = 'api:rental:filter-options';
    const cached = await fastify.redis.get(cacheKey);

    let staticOptions: any;
    if (cached) {
        staticOptions = JSON.parse(cached);
    } else {
        const activeWhere = { isActive: true, isPublished: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } } };

        const [makes, models, bodyTypes, fuelTypes, years] = await Promise.all([
            fastify.prisma.rentalVehicle.findMany({
                where: activeWhere,
                select: { make: true },
                distinct: ['make']
            }),
            fastify.prisma.rentalVehicle.findMany({
                where: activeWhere,
                select: { make: true, model: true },
                distinct: ['make', 'model']
            }),
            fastify.prisma.rentalVehicle.findMany({
                where: { ...activeWhere, bodyType: { not: null } },
                select: { bodyType: true },
                distinct: ['bodyType']
            }),
            fastify.prisma.rentalVehicle.findMany({
                where: { ...activeWhere, fuelType: { not: null } },
                select: { fuelType: true },
                distinct: ['fuelType']
            }),
            fastify.prisma.rentalVehicle.findMany({
                where: { ...activeWhere, productionYear: { not: null } },
                select: { productionYear: true },
                distinct: ['productionYear'],
                orderBy: { productionYear: 'desc' }
            })
        ]);

        staticOptions = {
            makes: [...new Set(makes.map(v => normalizeBrand(v.make)))].sort(),
            models: models.map(v => ({ make: normalizeBrand(v.make), model: v.model })).sort((a, b) => a.model.localeCompare(b.model)),
            bodyTypes: bodyTypes.map(v => v.bodyType as string).sort(),
            fuelTypes: fuelTypes.map(v => v.fuelType as string).sort(),
            years: years.map(v => v.productionYear as number)
        };

        // Cache for 10 minutes
        await fastify.redis.set(cacheKey, JSON.stringify(staticOptions), 'EX', 600);
    }

    // Condition counts — honour all active filters except `condition` itself,
    // so the NEW/USED tab counts shrink in step with the rest of the query.
    const baseWhere = { isActive: true, isPublished: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } } };
    let countWhere: any = baseWhere;
    if (currentWhere) {
        const { condition: _omit, ...rest } = currentWhere;
        countWhere = rest;
    }
    const [newCount, usedCount] = await Promise.all([
        fastify.prisma.rentalVehicle.count({ where: { ...countWhere, condition: 'NEW' } }),
        fastify.prisma.rentalVehicle.count({ where: { ...countWhere, condition: 'USED' } })
    ]);

    return {
        ...staticOptions,
        byCondition: { NEW: newCount, USED: usedCount }
    };
}
