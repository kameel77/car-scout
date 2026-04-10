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
            sortOrder = 'desc'
        } = request.query as Record<string, string | undefined>;

        const pageNum = Math.max(1, parseInt(page || '1'));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit || '12')));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            isActive: true,
            rentalAssignments: {
                some: {
                    isActive: true,
                    matrixEntries: {
                        some: {} // Must have at least one matrix entry
                    }
                }
            }
        };

        if (make) where.make = { contains: make, mode: 'insensitive' };
        if (model) where.model = { contains: model, mode: 'insensitive' };
        if (bodyType) where.bodyType = { equals: bodyType, mode: 'insensitive' };
        if (fuelType) where.fuelType = { equals: fuelType, mode: 'insensitive' };

        if (search) {
            where.OR = [
                { make: { contains: search, mode: 'insensitive' } },
                { model: { contains: search, mode: 'insensitive' } },
                { version: { contains: search, mode: 'insensitive' } }
            ];
        }

        const orderBy: any = {};
        const validSortFields = ['createdAt', 'sellingPrice', 'make', 'productionYear'];
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
                    slug: true,
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
        const vehiclesWithRates = vehicles.map((v) => {
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
                rentalAssignments: undefined // Remove raw assignments from public response
            };
        });

        // Get filter options
        const filterOptions = await getFilterOptions(fastify);

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
            select: { annualMileageKm: true, contractMonths: true, initialPaymentPct: true, offerType: true },
            distinct: ['annualMileageKm', 'contractMonths', 'initialPaymentPct', 'offerType']
        });

        const options = {
            annualMileageOptions: [...new Set(assignmentOptions.map(e => e.annualMileageKm))].sort((a, b) => a - b),
            contractMonthOptions: [...new Set(assignmentOptions.map(e => e.contractMonths))].sort((a, b) => a - b),
            initialPaymentOptions: [...new Set(assignmentOptions.map(e => e.initialPaymentPct))].sort((a, b) => a - b),
            offerTypeOptions: [...new Set(assignmentOptions.map(e => e.offerType))].sort()
        };

        return { vehicle, options };
    });

    // Public: Calculate rate lookup
    fastify.get('/api/rental/vehicles/:slug/calculate', async (request, reply) => {
        const { slug } = request.params as { slug: string };
        const { annualMileageKm, contractMonths, initialPaymentPct, offerType } = request.query as {
            annualMileageKm: string;
            contractMonths: string;
            initialPaymentPct: string;
            offerType?: string;
        };

        if (!annualMileageKm || !contractMonths || !initialPaymentPct) {
            return reply.code(400).send({
                error: 'Required query params: annualMileageKm, contractMonths, initialPaymentPct'
            });
        }

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
                                ...(offerType && offerType !== 'all'
                                    ? { offerType: { in: [offerType, 'all'] } }
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
                initialPaymentAmount: (vehicle.sellingPrice || 0) * (parseFloat(initialPaymentPct) / 100)
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

async function getFilterOptions(fastify: FastifyInstance) {
    const cacheKey = 'api:rental:filter-options';
    const cached = await fastify.redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    const [makes, bodyTypes, fuelTypes] = await Promise.all([
        fastify.prisma.rentalVehicle.findMany({
            where: { isActive: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } } },
            select: { make: true },
            distinct: ['make']
        }),
        fastify.prisma.rentalVehicle.findMany({
            where: { isActive: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } }, bodyType: { not: null } },
            select: { bodyType: true },
            distinct: ['bodyType']
        }),
        fastify.prisma.rentalVehicle.findMany({
            where: { isActive: true, rentalAssignments: { some: { isActive: true, matrixEntries: { some: {} } } }, fuelType: { not: null } },
            select: { fuelType: true },
            distinct: ['fuelType']
        })
    ]);

    const options = {
        makes: makes.map(v => v.make).sort(),
        bodyTypes: bodyTypes.map(v => v.bodyType as string).sort(),
        fuelTypes: fuelTypes.map(v => v.fuelType as string).sort()
    };

    // Cache for 10 minutes
    await fastify.redis.set(cacheKey, JSON.stringify(options), 'EX', 600);
    return options;
}
