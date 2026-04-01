import { FastifyInstance } from 'fastify';
import { requirePermission } from '../middleware/permissions.js';

export async function dealerGroupRoutes(fastify: FastifyInstance) {
    // List all dealer groups
    fastify.get('/api/dealer-groups', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:read')]
    }, async (request, reply) => {
        const { includeInactive } = request.query as { includeInactive?: string };

        const groups = await fastify.prisma.dealerGroup.findMany({
            where: includeInactive === 'true' ? {} : { isActive: true },
            include: {
                _count: { select: { dealers: true } },
                settings: true,
            },
            orderBy: { name: 'asc' },
        });

        return { groups };
    });

    // Get single dealer group
    fastify.get('/api/dealer-groups/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:read')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const group = await fastify.prisma.dealerGroup.findUnique({
            where: { id },
            include: {
                dealers: {
                    orderBy: { name: 'asc' },
                    include: {
                        _count: { select: { listings: true } },
                    },
                },
                settings: true,
                _count: { select: { dealers: true } },
            },
        });

        if (!group) {
            return reply.code(404).send({ error: 'Dealer group not found' });
        }

        return { group };
    });

    // Create dealer group
    fastify.post('/api/dealer-groups', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { name, contactName, contactEmail, contactPhone, addressLine1, city, nip } =
            request.body as any;

        if (!name) {
            return reply.code(400).send({ error: 'Name is required' });
        }

        // Generate slug from name
        const slug = name
            .toLowerCase()
            .replace(/[ąàáâã]/g, 'a').replace(/[ćč]/g, 'c')
            .replace(/[ęèéêë]/g, 'e').replace(/[łĺ]/g, 'l')
            .replace(/[ńñ]/g, 'n').replace(/[óòôõö]/g, 'o')
            .replace(/[śšş]/g, 's').replace(/[ùúûü]/g, 'u')
            .replace(/[żźž]/g, 'z').replace(/[ć]/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        try {
            const group = await fastify.prisma.dealerGroup.create({
                data: {
                    name,
                    slug,
                    contactName,
                    contactEmail,
                    contactPhone,
                    addressLine1,
                    city,
                    nip,
                },
            });

            return { group };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Dealer group with this name already exists' });
            }
            throw error;
        }
    });

    // Update dealer group
    fastify.patch('/api/dealer-groups/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { name, contactName, contactEmail, contactPhone, addressLine1, city, nip, isActive } =
            request.body as any;

        try {
            const group = await fastify.prisma.dealerGroup.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(contactName !== undefined && { contactName }),
                    ...(contactEmail !== undefined && { contactEmail }),
                    ...(contactPhone !== undefined && { contactPhone }),
                    ...(addressLine1 !== undefined && { addressLine1 }),
                    ...(city !== undefined && { city }),
                    ...(nip !== undefined && { nip }),
                    ...(isActive !== undefined && { isActive }),
                },
            });

            return { group };
        } catch (error: any) {
            if (error.code === 'P2025') {
                return reply.code(404).send({ error: 'Dealer group not found' });
            }
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Name already exists' });
            }
            throw error;
        }
    });

    // Delete dealer group (only if no dealers assigned)
    fastify.delete('/api/dealer-groups/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const dealerCount = await fastify.prisma.dealer.count({
            where: { dealerGroupId: id },
        });

        if (dealerCount > 0) {
            return reply.code(409).send({
                error: `Cannot delete group with ${dealerCount} assigned dealer(s). Reassign or remove dealers first.`,
            });
        }

        try {
            await fastify.prisma.dealerGroup.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'Dealer group not found' });
        }
    });

    // Update dealer group settings (override)
    fastify.put('/api/dealer-groups/:id/settings', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const settings = request.body as any;

        const group = await fastify.prisma.dealerGroup.findUnique({ where: { id } });
        if (!group) {
            return reply.code(404).send({ error: 'Dealer group not found' });
        }

        const result = await fastify.prisma.dealerGroupSettings.upsert({
            where: { dealerGroupId: id },
            update: {
                headerLogoUrl: settings.headerLogoUrl,
                footerLogoUrl: settings.footerLogoUrl,
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort,
                smtpUser: settings.smtpUser,
                smtpPassword: settings.smtpPassword,
                smtpFromEmail: settings.smtpFromEmail,
                smtpRecipientEmail: settings.smtpRecipientEmail,
            },
            create: {
                dealerGroupId: id,
                headerLogoUrl: settings.headerLogoUrl,
                footerLogoUrl: settings.footerLogoUrl,
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort,
                smtpUser: settings.smtpUser,
                smtpPassword: settings.smtpPassword,
                smtpFromEmail: settings.smtpFromEmail,
                smtpRecipientEmail: settings.smtpRecipientEmail,
            },
        });

        return { settings: result };
    });

    // Assign dealer to group
    fastify.post('/api/dealer-groups/:groupId/dealers/:dealerId', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { groupId, dealerId } = request.params as { groupId: string; dealerId: string };

        const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: groupId } });
        if (!group) {
            return reply.code(404).send({ error: 'Dealer group not found' });
        }

        try {
            const dealer = await fastify.prisma.dealer.update({
                where: { id: dealerId },
                data: { dealerGroupId: groupId },
            });

            return { dealer };
        } catch (error) {
            return reply.code(404).send({ error: 'Dealer not found' });
        }
    });

    // Remove dealer from group (unassign)
    fastify.delete('/api/dealer-groups/:groupId/dealers/:dealerId', {
        preHandler: [fastify.authenticate, requirePermission('dealer_groups:write')]
    }, async (request, reply) => {
        const { groupId, dealerId } = request.params as { groupId: string; dealerId: string };

        const dealer = await fastify.prisma.dealer.findUnique({ where: { id: dealerId } });
        if (!dealer || dealer.dealerGroupId !== groupId) {
            return reply.code(404).send({ error: 'Dealer not found in this group' });
        }

        await fastify.prisma.dealer.update({
            where: { id: dealerId },
            data: { dealerGroupId: null },
        });

        return { success: true };
    });
}
