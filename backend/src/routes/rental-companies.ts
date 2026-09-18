import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';
import { calculateRentalRate } from '../services/rental-pricing.js';

function hasInsuranceService(services: string[] = []): boolean {
    return services.some(s => {
        const lower = s.toLowerCase().trim();
        return lower === 'insurance' || lower === 'ubezpieczenie';
    });
}

function generateCompanySlug(name: string): string {
    const translitMap: Record<string, string> = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
    };

    return name
        .toLowerCase()
        // eslint-disable-next-line no-control-regex
        .replace(/[^\x00-\x7F]/g, char => translitMap[char] || char)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export async function rentalCompanyRoutes(fastify: FastifyInstance) {
    // List all rental companies
    fastify.get('/api/rental-companies', {
        preHandler: [fastify.authenticate, requirePermission('rental:read')]
    }, async (request, reply) => {
        const companies = await fastify.prisma.rentalCompany.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { vehicleAssignments: true }
                }
            }
        });

        return { companies };
    });

    // Get single rental company
    fastify.get('/api/rental-companies/:id', {
        preHandler: [fastify.authenticate, requirePermission('rental:read')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const company = await fastify.prisma.rentalCompany.findUnique({
            where: { id },
            include: {
                vehicleAssignments: {
                    include: {
                        vehicle: {
                            select: { id: true, make: true, model: true, version: true, productionYear: true, slug: true }
                        },
                        _count: { select: { matrixEntries: true } }
                    }
                }
            }
        });

        if (!company) {
            return reply.code(404).send({ error: 'Rental company not found' });
        }

        return { company };
    });

    // Create rental company
    fastify.post('/api/rental-companies', {
        preHandler: [fastify.authenticate, requirePermission('rental:config:write')]
    }, async (request, reply) => {
        const { name, contactEmail, contactPhone, logoUrl, includedServices, insuranceAddMode } = request.body as {
            name: string;
            contactEmail?: string;
            contactPhone?: string;
            logoUrl?: string;
            includedServices?: string[];
            insuranceAddMode?: 'INSURANCE_23' | 'INSURANCE_0' | 'INSURANCE_INCLUDED';
        };

        if (!name) {
            return reply.code(400).send({ error: 'Name is required' });
        }

        const effectiveMode = insuranceAddMode || 'INSURANCE_23';
        const effectiveServices = includedServices || [];
        if (effectiveMode === 'INSURANCE_INCLUDED' && !hasInsuranceService(effectiveServices)) {
            return reply.code(400).send({
                error: 'Tryb All-In wymaga zaznaczenia usługi Ubezpieczenie w liście wliczonych usług'
            });
        }

        const slug = generateCompanySlug(name);

        const company = await fastify.prisma.rentalCompany.create({
            data: {
                name,
                slug,
                contactEmail: contactEmail || null,
                contactPhone: contactPhone || null,
                logoUrl: logoUrl || null,
                includedServices: effectiveServices,
                insuranceAddMode: effectiveMode
            }
        });

        request.log.info({
            action: 'RENTAL_COMPANY_CREATED',
            companyId: company.id,
            companyName: company.name,
            insuranceAddMode: company.insuranceAddMode,
            includedServices: company.includedServices,
            userId: (request.user as any)?.id || null
        }, 'Rental company created');

        return reply.code(201).send({ company });
    });

    // Update rental company
    fastify.patch('/api/rental-companies/:id', {
        preHandler: [fastify.authenticate, requirePermission('rental:config:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            name?: string;
            contactEmail?: string;
            contactPhone?: string;
            logoUrl?: string;
            isActive?: boolean;
            includedServices?: string[];
            insuranceAddMode?: 'INSURANCE_23' | 'INSURANCE_0' | 'INSURANCE_INCLUDED';
        };

        const existing = await fastify.prisma.rentalCompany.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: 'Rental company not found' });
        }

        const effectiveMode = body.insuranceAddMode !== undefined ? body.insuranceAddMode : existing.insuranceAddMode;
        const effectiveServices = body.includedServices !== undefined ? body.includedServices : existing.includedServices;
        if (effectiveMode === 'INSURANCE_INCLUDED' && !hasInsuranceService(effectiveServices)) {
            return reply.code(400).send({
                error: 'Tryb All-In wymaga zaznaczenia usługi Ubezpieczenie w liście wliczonych usług'
            });
        }

        const updateData: any = {};
        if (body.name !== undefined) {
            updateData.name = body.name;
            updateData.slug = generateCompanySlug(body.name);
        }
        if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
        if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;
        if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.includedServices !== undefined) updateData.includedServices = body.includedServices;
        if (body.insuranceAddMode !== undefined) updateData.insuranceAddMode = body.insuranceAddMode;

        const company = await fastify.prisma.rentalCompany.update({
            where: { id },
            data: updateData
        });

        request.log.info({
            action: 'RENTAL_COMPANY_UPDATED',
            companyId: id,
            companyName: existing.name,
            changes: updateData,
            userId: (request.user as any)?.id || null,
            timestamp: new Date().toISOString()
        }, 'Rental company configuration updated');

        return { company };
    });

    // Matrix health check (warning on missing insurance in matrix)
    fastify.get('/api/rental-companies/:id/matrix-health', {
        preHandler: [fastify.authenticate, requirePermission('rental:read')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const company = await fastify.prisma.rentalCompany.findUnique({
            where: { id },
            select: { id: true, name: true, insuranceAddMode: true }
        });

        if (!company) {
            return reply.code(404).send({ error: 'Rental company not found' });
        }

        const assignments = await fastify.prisma.vehicleRentalAssignment.findMany({
            where: { rentalCompanyId: id },
            select: {
                id: true,
                vehicleId: true,
                insuranceAddModeOverride: true,
                vehicle: { select: { make: true, model: true } },
                matrixEntries: {
                    select: { id: true, insuranceNet: true }
                }
            }
        });

        let totalEntries = 0;
        let missingInsuranceCount = 0;
        const affectedVehicles = new Set<string>();

        for (const a of assignments) {
            const mode = a.insuranceAddModeOverride || company.insuranceAddMode || 'INSURANCE_23';
            const isExternal = mode === 'INSURANCE_23' || mode === 'INSURANCE_0';
            for (const m of a.matrixEntries) {
                totalEntries++;
                if (isExternal && (!m.insuranceNet || m.insuranceNet <= 0)) {
                    missingInsuranceCount++;
                    affectedVehicles.add(a.vehicleId);
                }
            }
        }

        return {
            companyId: id,
            companyName: company.name,
            insuranceAddMode: company.insuranceAddMode,
            totalAssignments: assignments.length,
            totalEntries,
            missingInsuranceCount,
            affectedVehiclesCount: affectedVehicles.size,
            isHealthy: missingInsuranceCount === 0
        };
    });

    // Calculation preview (B2B vs Consumer view on sample vehicle)
    fastify.get('/api/rental-companies/:id/calculation-preview', {
        preHandler: [fastify.authenticate, requirePermission('rental:read')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const company = await fastify.prisma.rentalCompany.findUnique({
            where: { id },
            include: {
                vehicleAssignments: {
                    where: { isActive: true },
                    include: {
                        vehicle: {
                            select: { id: true, make: true, model: true, version: true, productionYear: true, slug: true }
                        },
                        rentalCompany: {
                            select: { insuranceAddMode: true, includedServices: true }
                        },
                        matrixEntries: {
                            take: 5,
                            orderBy: { contractMonths: 'asc' }
                        }
                    },
                    take: 1
                }
            }
        });

        if (!company) {
            return reply.code(404).send({ error: 'Rental company not found' });
        }

        const assignment = company.vehicleAssignments[0];
        if (!assignment || assignment.matrixEntries.length === 0) {
            return {
                company: { id: company.id, name: company.name, insuranceAddMode: company.insuranceAddMode },
                hasSample: false,
                message: 'Brak przypisanych pojazdów lub cennika dla tej firmy'
            };
        }

        const entry = assignment.matrixEntries[0];
        const breakdown = calculateRentalRate(entry, assignment);

        return {
            company: { id: company.id, name: company.name, insuranceAddMode: company.insuranceAddMode },
            hasSample: true,
            vehicle: assignment.vehicle,
            matrixParams: {
                contractMonths: entry.contractMonths,
                annualMileageKm: entry.annualMileageKm,
                initialPaymentPct: entry.initialPaymentPct
            },
            breakdown,
            b2bView: {
                primary: `${Math.ceil(breakdown.monthlyRateNet)} zł netto / mies.`,
                secondary: `${Math.ceil(breakdown.monthlyRateGross)} zł brutto`
            },
            consumerView: {
                primary: `${Math.ceil(breakdown.monthlyRateGross)} zł brutto / mies.`,
                secondary: `${Math.ceil(breakdown.monthlyRateNet)} zł netto`
            }
        };
    });

    // Delete rental company
    fastify.delete('/api/rental-companies/:id', {
        preHandler: [fastify.authenticate, requirePermission('rental:config:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Check if has active assignments
        const assignmentCount = await fastify.prisma.vehicleRentalAssignment.count({
            where: { rentalCompanyId: id }
        });

        if (assignmentCount > 0) {
            return reply.code(409).send({
                error: `Cannot delete: company has ${assignmentCount} vehicle assignment(s). Remove assignments first.`
            });
        }

        await fastify.prisma.rentalCompany.delete({ where: { id } });

        return { success: true };
    });
}
