import { FastifyInstance } from 'fastify';
import { requirePermission, buildScopeFilter, type MembershipInfo, type ActiveContext } from '../middleware/permissions.js';
import { ScopeType, MemberRole } from '@prisma/client';

export async function dealerAdminRoutes(fastify: FastifyInstance) {
    /**
     * Helper: resolve dealer IDs in the user's active group scope
     */
    async function resolveDealerIdsInGroup(groupId: string): Promise<string[]> {
        const dealers = await fastify.prisma.dealer.findMany({
            where: { dealerGroupId: groupId },
            select: { id: true },
        });
        return dealers.map(d => d.id);
    }

    // List dealers (scope-aware)
    fastify.get('/api/admin/dealers', {
        preHandler: [fastify.authenticate, requirePermission('dealers:read')]
    }, async (request, reply) => {
        const { groupId, unassigned } = request.query as { groupId?: string; unassigned?: string };
        const user = request.user as any;
        const memberships: MembershipInfo[] = user.memberships || [];
        const activeContext: ActiveContext = user.activeContext || {
            scopeType: ScopeType.PLATFORM,
            scopeId: 'PLATFORM',
        };

        // Build scope-aware where clause
        const where: any = {};

        // Platform roles can see all; they can additionally filter by groupId
        const isPlatform = memberships.some(m =>
            m.scopeType === ScopeType.PLATFORM &&
            (m.role === MemberRole.SUPERADMIN_PLATFORM || m.role === MemberRole.PLATFORM_MANAGER)
        );

        if (isPlatform) {
            if (groupId) {
                where.dealerGroupId = groupId;
            }
            if (unassigned === 'true') {
                where.dealerGroupId = null;
            }
        } else if (activeContext.scopeType === ScopeType.DEALER_GROUP) {
            where.dealerGroupId = activeContext.scopeId;
        } else if (activeContext.scopeType === ScopeType.DEALER) {
            where.id = activeContext.scopeId;
        }

        const dealers = await fastify.prisma.dealer.findMany({
            where,
            include: {
                dealerGroup: { select: { id: true, name: true } },
                _count: { select: { listings: true, rentalVehicles: true } },
            },
            orderBy: { name: 'asc' },
        });

        // Determine status for each dealer
        const dealerIds = dealers.map(d => d.id);
        const adminMemberships = await fastify.prisma.membership.findMany({
            where: {
                scopeType: ScopeType.DEALER,
                scopeId: { in: dealerIds },
                role: { in: [MemberRole.DEALER_ADMIN] },
            },
            select: { scopeId: true },
        });
        const dealersWithAdmin = new Set(adminMemberships.map(m => m.scopeId));

        const enrichedDealers = dealers.map(d => ({
            ...d,
            hasAdminAccount: dealersWithAdmin.has(d.id),
            isAssignedToGroup: d.dealerGroupId !== null,
        }));

        return { dealers: enrichedDealers };
    });

    // Get single dealer
    fastify.get('/api/admin/dealers/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealers:read')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const dealer = await fastify.prisma.dealer.findUnique({
            where: { id },
            include: {
                dealerGroup: true,
                settings: true,
                _count: { select: { listings: true, rentalVehicles: true } },
            },
        });

        if (!dealer) {
            return reply.code(404).send({ error: 'Dealer not found' });
        }

        // Get members (users assigned to this dealer)
        const members = await fastify.prisma.membership.findMany({
            where: {
                scopeType: ScopeType.DEALER,
                scopeId: id,
            },
            include: {
                user: {
                    select: { id: true, email: true, name: true, isActive: true },
                },
            },
        });

        return { dealer, members };
    });

    // Create dealer
    fastify.post('/api/admin/dealers', {
        preHandler: [fastify.authenticate, requirePermission('dealers:write')]
    }, async (request, reply) => {
        const {
            name, addressLine1, addressLine2, addressLine3, city,
            contactPhone, contactEmail,
            dealerGroupId,
            googleRating, googleReviewCount, googleLink,
        } = request.body as any;

        if (!name || !addressLine1) {
            return reply.code(400).send({ error: 'name and addressLine1 are required' });
        }

        // Validate dealerGroupId if provided
        if (dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({
                where: { id: dealerGroupId },
            });
            if (!group) {
                return reply.code(400).send({ error: 'Dealer group not found' });
            }
        }

        try {
            const dealer = await fastify.prisma.dealer.create({
                data: {
                    name,
                    addressLine1,
                    addressLine2,
                    addressLine3,
                    city,
                    contactPhone,
                    contactEmail,
                    dealerGroupId: dealerGroupId || null,
                    googleRating: googleRating ? parseFloat(googleRating) : undefined,
                    googleReviewCount: googleReviewCount ? parseInt(googleReviewCount) : undefined,
                    googleLink,
                },
            });

            return { dealer };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Dealer with this name and address already exists' });
            }
            throw error;
        }
    });

    // Update dealer
    fastify.patch('/api/admin/dealers/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealers:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        // Validate dealerGroupId if provided
        if (body.dealerGroupId) {
            const group = await fastify.prisma.dealerGroup.findUnique({
                where: { id: body.dealerGroupId },
            });
            if (!group) {
                return reply.code(400).send({ error: 'Dealer group not found' });
            }
        }

        try {
            const dealer = await fastify.prisma.dealer.update({
                where: { id },
                data: {
                    ...(body.name !== undefined && { name: body.name }),
                    ...(body.addressLine1 !== undefined && { addressLine1: body.addressLine1 }),
                    ...(body.addressLine2 !== undefined && { addressLine2: body.addressLine2 }),
                    ...(body.addressLine3 !== undefined && { addressLine3: body.addressLine3 }),
                    ...(body.city !== undefined && { city: body.city }),
                    ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone }),
                    ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail }),
                    ...(body.dealerGroupId !== undefined && { dealerGroupId: body.dealerGroupId || null }),
                    ...(body.googleRating !== undefined && { googleRating: parseFloat(body.googleRating) }),
                    ...(body.googleReviewCount !== undefined && { googleReviewCount: parseInt(body.googleReviewCount) }),
                    ...(body.googleLink !== undefined && { googleLink: body.googleLink }),
                },
            });

            return { dealer };
        } catch (error: any) {
            if (error.code === 'P2025') {
                return reply.code(404).send({ error: 'Dealer not found' });
            }
            throw error;
        }
    });

    // Update dealer settings (override)
    fastify.put('/api/admin/dealers/:id/settings', {
        preHandler: [fastify.authenticate, requirePermission('dealers:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const settings = request.body as any;

        const dealer = await fastify.prisma.dealer.findUnique({ where: { id } });
        if (!dealer) {
            return reply.code(404).send({ error: 'Dealer not found' });
        }

        const result = await fastify.prisma.dealerSettings.upsert({
            where: { dealerId: id },
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
                dealerId: id,
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

    // Delete dealer
    fastify.delete('/api/admin/dealers/:id', {
        preHandler: [fastify.authenticate, requirePermission('dealers:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        const listingCount = await fastify.prisma.listing.count({
            where: { dealerId: id },
        });

        if (listingCount > 0) {
            return reply.code(409).send({
                error: `Cannot delete dealer with ${listingCount} listing(s). Archive or reassign listings first.`,
            });
        }

        try {
            await fastify.prisma.dealer.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'Dealer not found' });
        }
    });
}
