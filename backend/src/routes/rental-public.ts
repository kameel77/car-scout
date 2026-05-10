import { FastifyInstance } from 'fastify';

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
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            offerType,
            yearFrom,
            yearTo,
            priceFrom,
            priceTo,
            condition
        } = request.query as Record<string, string | undefined>;

        const pageNum = Math.max(1, parseInt(page || '1'));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit || '12')));
        const skip = (pageNum - 1) * limitNum;

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
            rentalAssignments: {
                some: {
                    isActive: true,
                    matrixEntries: {
                        some: matrixEntryFilter // Must have at least one matrix entry matching offerType
                    }
                }
            }
        };

        if (make) where.make = { contains: make, mode: 'insensitive' };
        if (model) where.model = { contains: model, mode: 'insensitive' };
        if (bodyType) where.bodyType = { equals: bodyType, mode: 'insensitive' };
        if (fuelType) where.fuelType = { equals: fuelType, mode: 'insensitive' };

        // Condition filter (NEW / USED)
        if (condition && (condition === 'NEW' || condition === 'USED')) {
            where.condition = condition;
        }

        // Year range filter
        if (yearFrom || yearTo) {
            where.productionYear = {};
            if (yearFrom) where.productionYear.gte = parseInt(yearFrom);
            if (yearTo) where.productionYear.lte = parseInt(yearTo);
        }

        if (search) {
            where.OR = [
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { version: { contains: search, mode: 'insensitive' } }
            ];
        }

        const orderBy: any = {};
        const validSortFields = ['createdAt', 'sellingPrice', 'make', 'productionYear', 'minMonthlyRateNet'];
        const sortField = validSortFields.includes(sortBy || '') ? sortBy : 'createdAt';
        orderBy[sortField!] = sortOrder === 'asc' ? 'asc' : 'desc';

        const [vehicles, total] = await Promise.all([
            fastify.prisma.rentalVehicle.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                select: {
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
                                select: { id: true, name: true, slug: true, logoUrl: true }
                            },
                            matrixEntries: {
                                where: matrixEntryFilter,
                                orderBy: { monthlyRateGross: 'asc' },
                                take: 1,
                                select: {
                                    monthlyRateNet: true,
                                    monthlyRateGross: true,
                                    contractMonths: true,
                                    annualMileageKm: true,
                                    servicesIncluded: true
                                }
                            }
                        }
                    }
                }
            }),
            fastify.prisma.rentalVehicle.count({ where })
        ]);

        // Transform to include minRate
        let vehiclesWithRates = vehicles.map((v) => {
            const allMinRates = v.rentalAssignments
                .flatMap(a => a.matrixEntries.map(e => ({
                    ...e,
                    companyName: a.rentalCompany.name,
                    companySlug: a.rentalCompany.slug
                })));

            const minRate = allMinRates.length > 0
                ? allMinRates.reduce((min, r) => r.monthlyRateGross < min.monthlyRateGross ? r : min)
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

        // Post-filter by monthly rate range (rates are computed from matrix, not a direct column)
        if (priceFrom || priceTo) {
            const from = priceFrom ? parseInt(priceFrom) : 0;
            const to = priceTo ? parseInt(priceTo) : Infinity;
            vehiclesWithRates = vehiclesWithRates.filter(v => {
                const rate = v.minMonthlyRateGross;
                if (rate === null) return false;
                return rate >= from && rate <= to;
            });
        }

        // Get filter options (including condition counts)
        const filterOptions = await getFilterOptions(fastify, where);

        return {
            vehicles: vehiclesWithRates,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            filters: filterOptions
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
                isActive: true
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
                isActive: true
            },
            select: {
                id: true,
                make: true,
                model: true,
                sellingPrice: true,
                rentalAssignments: {
                    where: { isActive: true },
                    include: {
                        rentalCompany: {
                            select: { id: true, name: true, slug: true, logoUrl: true }
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
            .filter(a => a.matrixEntries.length > 0)
            .map(a => ({
                company: a.rentalCompany,
                monthlyRateNet: Math.ceil(a.matrixEntries[0].monthlyRateNet),
                monthlyRateGross: Math.ceil(a.matrixEntries[0].monthlyRateGross),
                servicesIncluded: a.matrixEntries[0].servicesIncluded,
                initialPaymentAmountNet: a.matrixEntries[0].initialPaymentAmountNet,
                initialPaymentAmountGross: a.matrixEntries[0].initialPaymentAmountGross
            }))
            .sort((a, b) => a.monthlyRateGross - b.monthlyRateGross);

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

async function getFilterOptions(fastify: FastifyInstance, currentWhere?: any) {
    const cacheKey = 'api:rental:filter-options';
    const cached = await fastify.redis.get(cacheKey);

    let staticOptions: any;
    if (cached) {
        staticOptions = JSON.parse(cached);
    } else {
        const activeWhere = { isActive: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } } };

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

    // Condition counts — always fresh (based on active vehicles, ignoring condition filter)
    const baseWhere = { isActive: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } } };
    const [newCount, usedCount] = await Promise.all([
        fastify.prisma.rentalVehicle.count({ where: { ...baseWhere, condition: 'NEW' } }),
        fastify.prisma.rentalVehicle.count({ where: { ...baseWhere, condition: 'USED' } })
    ]);

    return {
        ...staticOptions,
        byCondition: { NEW: newCount, USED: usedCount }
    };
}
