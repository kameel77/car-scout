import { FastifyInstance } from 'fastify';

const calculateRatesWithInsurance = (entry: any, assignment: any) => {
    const insuranceAddMode = assignment.insuranceAddModeOverride || assignment.rentalCompany?.insuranceAddMode || 'INSURANCE_23';
    const servicesIncluded = (assignment.includedServicesOverride && assignment.includedServicesOverride.length > 0)
        ? assignment.includedServicesOverride
        : (assignment.rentalCompany?.includedServices && assignment.rentalCompany.includedServices.length > 0
            ? assignment.rentalCompany.includedServices
            : (entry.servicesIncluded || []));

    let finalNet = entry.monthlyRateNet;
    let finalGross = entry.monthlyRateGross;
    if (entry.insuranceNet) {
        if (insuranceAddMode === 'INSURANCE_23') {
            finalNet += entry.insuranceNet;
            finalGross += (entry.insuranceNet * 1.23);
        } else if (insuranceAddMode === 'INSURANCE_0') {
            finalNet += entry.insuranceNet;
            finalGross += entry.insuranceNet;
        }
    }
    return { ...entry, monthlyRateNet: finalNet, monthlyRateGross: finalGross, servicesIncluded };
};

export async function rentalPublicRoutes(fastify: FastifyInstance) {
    // Public: List active rental vehicles with minimum rates
    fastify.get('/api/rental/vehicles', async (request, reply) => {
        const {
            page = '1',
            limit = '12',
            make,
            model,
            bodyType,
            fuelType,
            transmission,
            drive,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            offerType,
            yearFrom,
            yearTo,
            priceFrom,
            priceTo,
            priceBasis,
            mileageFrom,
            mileageTo,
            powerFrom,
            powerTo,
            capacityFrom,
            capacityTo,
            condition
        } = request.query as Record<string, string | undefined>;

        // priceBasis controls whether priceFrom/priceTo are compared against monthlyRateNet or monthlyRateGross.
        // Default gross preserves prior behaviour for callers that omit it.
        const rateField: 'monthlyRateNet' | 'monthlyRateGross' =
            priceBasis === 'net' ? 'monthlyRateNet' : 'monthlyRateGross';

        const pageNum = Math.max(1, parseInt(page || '1'));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit || '12')));
        const skip = (pageNum - 1) * limitNum;

        const toArray = (val: unknown): string[] | undefined => {
            if (!val) return undefined;
            if (Array.isArray(val)) return val.map(String);
            return String(val).split(',');
        };

        const makes = toArray(make);
        const models = toArray(model);
        const bodyTypes = toArray(bodyType);
        const fuelTypesRaw = toArray(fuelType);
        const transmissionsRaw = toArray(transmission);
        const drives = toArray(drive);

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
        if (transmissionsRaw && transmissionsRaw.some((t) => t === 'manual' || t === 'automatic')) {
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
        if (fuelTypesRaw && fuelTypesRaw.some((t) => FUEL_CANONICALS.has(t))) {
            const distinctFuel = await fastify.prisma.rentalVehicle.findMany({
                where: { isActive: true, fuelType: { not: null } },
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
        const statuses = toArray(condition)
            ?.map((c) => c.toUpperCase())
            .filter((c) => c === 'NEW' || c === 'USED') as ('NEW' | 'USED')[] | undefined;

        // Normalize offerType (frontend sends b2b/b2c, DB stores business/consumer)
        let normalizedOfferType = offerType?.trim().toLowerCase();
        if (normalizedOfferType && ['b2b', 'firma', 'business'].includes(normalizedOfferType)) normalizedOfferType = 'business';
        if (normalizedOfferType && ['b2c', 'prywatnie', 'prywatny', 'consumer'].includes(normalizedOfferType)) normalizedOfferType = 'consumer';

        // Build matrix entry filter for offerType
        const matrixEntryFilter: any = {};
        if (normalizedOfferType && normalizedOfferType !== 'all') {
            matrixEntryFilter.offerType = { in: [normalizedOfferType, 'all'] };
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
        if (yearFrom || yearTo) {
            where.productionYear = {};
            if (yearFrom) where.productionYear.gte = parseInt(yearFrom);
            if (yearTo) where.productionYear.lte = parseInt(yearTo);
        }

        // Mileage range filter
        if (mileageFrom || mileageTo) {
            where.mileageKm = {};
            if (mileageFrom) where.mileageKm.gte = parseInt(mileageFrom);
            if (mileageTo) where.mileageKm.lte = parseInt(mileageTo);
        }

        // Power range filter
        if (powerFrom || powerTo) {
            where.enginePowerHp = {};
            if (powerFrom) where.enginePowerHp.gte = parseInt(powerFrom);
            if (powerTo) where.enginePowerHp.lte = parseInt(powerTo);
        }

        // Engine capacity range filter
        if (capacityFrom || capacityTo) {
            where.engineCapacityCm3 = {};
            if (capacityFrom) where.engineCapacityCm3.gte = parseInt(capacityFrom);
            if (capacityTo) where.engineCapacityCm3.lte = parseInt(capacityTo);
        }

        if (search) {
            where.OR = [
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { version: { contains: search, mode: 'insensitive' } }
            ];
        }

        const isRateSort = sortBy === 'minMonthlyRateNet' || sortBy === 'minMonthlyRateGross';
        const isPriceFilter = !!(priceFrom || priceTo);

        const orderBy: any = {};
        const validSortFields = ['createdAt', 'sellingPrice', 'make', 'productionYear', 'catalogPrice'];
        const sortField = validSortFields.includes(sortBy || '') ? sortBy : 'createdAt';
        orderBy[sortField!] = sortOrder === 'asc' ? 'asc' : 'desc';

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
        // When rate filter is active, byCondition computed from the in-memory filtered set —
        // overrides the DB-only count from getFilterOptions so tab counts match the listing.
        let byConditionOverride: { NEW: number; USED: number } | undefined;

        if (isRateSort || isPriceFilter) {
            // 1. Fetch minimal data for all matching vehicles
            const allVehiclesMinimal = await fastify.prisma.rentalVehicle.findMany({
                where,
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
                const from = priceFrom ? parseInt(priceFrom) : 0;
                const to = priceTo ? parseInt(priceTo) : Infinity;
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
                    const diff = (a.minRate ?? Infinity) - (b.minRate ?? Infinity);
                    return sortOrder === 'asc' ? diff : -diff;
                });
            } else {
                mapped.sort((a, b) => {
                    const valA = a.sortFieldValue;
                    const valB = b.sortFieldValue;
                    if (valA === null || valA === undefined) return sortOrder === 'asc' ? 1 : -1;
                    if (valB === null || valB === undefined) return sortOrder === 'asc' ? -1 : 1;
                    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
                    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
                    return 0;
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
                    orderBy,
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

            const minRate = allMinRates.length > 0
                ? allMinRates.reduce((best: any, current: any) => {
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

            return {
                ...v,
                minMonthlyRateGross: minRate ? Math.ceil(minRate.monthlyRateGross) : null,
                minMonthlyRateNet: minRate ? Math.ceil(minRate.monthlyRateNet) : null,
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

        return {
            vehicles: vehiclesWithRates,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            filters: filterOptions,
            facets
        };
    });

    // Public: Get vehicle details with dynamic options from the matrix
    fastify.get('/api/rental/vehicles/:slug', async (request, reply) => {
        const { slug } = request.params as { slug: string };

        const vehicle = await fastify.prisma.rentalVehicle.findFirst({
            where: {
                OR: [
                    { slug },
                    { id: slug } // Fallback to ID
                ],
                isActive: true,
                isPublished: true
            },
            include: {
                dealer: {
                    select: { id: true, name: true, addressLine1: true, city: true, contactPhone: true }
                },
                rentalAssignments: {
                    where: { isActive: true },
                    include: {
                        rentalCompany: {
                            select: { id: true, name: true, slug: true, logoUrl: true, contactEmail: true, contactPhone: true }
                        }
                        // Explicitly NOT including all matrixEntries here to avoid JSON bloat and OOM
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
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

        return { vehicle, options };
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
                            }
                        }
                    }
                }
            }
        });

        if (!vehicle) {
            return reply.code(404).send({ error: 'Rental vehicle not found' });
        }

        // Build offers from each company
        const offers = vehicle.rentalAssignments
            .filter((a: any) => a.matrixEntries.length > 0)
            .map((a: any) => {
                const calculatedEntry = calculateRatesWithInsurance(a.matrixEntries[0], a);
                return {
                    company: a.rentalCompany,
                    monthlyRateNet: Math.ceil(calculatedEntry.monthlyRateNet),
                    monthlyRateGross: Math.ceil(calculatedEntry.monthlyRateGross),
                    servicesIncluded: calculatedEntry.servicesIncluded,
                    initialPaymentAmountNet: calculatedEntry.initialPaymentAmountNet,
                    initialPaymentAmountGross: calculatedEntry.initialPaymentAmountGross
                };
            })
            .sort((a: any, b: any) => a.monthlyRateGross - b.monthlyRateGross);

        return {
            vehicleId: vehicle.id,
            params: {
                annualMileageKm: parseInt(annualMileageKm),
                contractMonths: parseInt(contractMonths),
                initialPaymentPct: parseFloat(initialPaymentPct)
            },
            offers,
            cheapest: offers.length > 0 ? offers[0] : null
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
            makes: makes.map(v => v.make).sort(),
            models: models.map(v => ({ make: v.make, model: v.model })).sort((a, b) => a.model.localeCompare(b.model)),
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
