import { FastifyInstance } from 'fastify';

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
        preHandler: [fastify.authenticate]
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
        preHandler: [fastify.authenticate]
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
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { name, contactEmail, contactPhone, logoUrl, includedServices, insuranceAddMode } = request.body as {
            name: string;
            contactEmail?: string;
            contactPhone?: string;
            logoUrl?: string;
            includedServices?: string[];
            insuranceAddMode?: 'INSURANCE_23' | 'INSURANCE_0';
        };

        if (!name) {
            return reply.code(400).send({ error: 'Name is required' });
        }

        const slug = generateCompanySlug(name);

        const company = await fastify.prisma.rentalCompany.create({
            data: {
                name,
                slug,
                contactEmail: contactEmail || null,
                contactPhone: contactPhone || null,
                logoUrl: logoUrl || null,
                includedServices: includedServices || [],
                insuranceAddMode: insuranceAddMode || 'INSURANCE_23'
            }
        });

        return reply.code(201).send({ company });
    });

    // Update rental company
    fastify.patch('/api/rental-companies/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            name?: string;
            contactEmail?: string;
            contactPhone?: string;
            logoUrl?: string;
            isActive?: boolean;
            includedServices?: string[];
            insuranceAddMode?: 'INSURANCE_23' | 'INSURANCE_0';
        };

        const existing = await fastify.prisma.rentalCompany.findUnique({ where: { id } });
        if (!existing) {
            return reply.code(404).send({ error: 'Rental company not found' });
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

        return { company };
    });

    // Delete rental company
    fastify.delete('/api/rental-companies/:id', {
        preHandler: [fastify.authenticate]
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
