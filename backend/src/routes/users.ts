import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { requirePermission, type MembershipInfo, type ActiveContext } from '../middleware/permissions.js';
import { ScopeType, MemberRole } from '@prisma/client';

/**
 * Roles that can be assigned at each scope level
 */
const ASSIGNABLE_ROLES: Record<ScopeType, MemberRole[]> = {
    PLATFORM: [MemberRole.SUPERADMIN_PLATFORM, MemberRole.PLATFORM_MANAGER, MemberRole.CONTENT_MANAGER_PLATFORM],
    DEALER_GROUP: [MemberRole.DEALER_GROUP_ADMIN],
    DEALER: [MemberRole.DEALER_ADMIN, MemberRole.DEALER_EMPLOYEE],
};

async function validateAssignmentScope(fastify: FastifyInstance, callerMemberships: MembershipInfo[], targetScopeType: ScopeType, targetScopeId: string): Promise<boolean> {
    const isSuperAdmin = callerMemberships.some(m => m.scopeType === ScopeType.PLATFORM && m.role === MemberRole.SUPERADMIN_PLATFORM);
    if (targetScopeType === ScopeType.PLATFORM) {
        return isSuperAdmin;
    }

    const isPlatform = isSuperAdmin || callerMemberships.some(m => m.scopeType === ScopeType.PLATFORM && m.role === MemberRole.PLATFORM_MANAGER);
    if (isPlatform) return true;

    if (targetScopeType === ScopeType.DEALER_GROUP) {
        return callerMemberships.some(m => m.scopeType === ScopeType.DEALER_GROUP && m.scopeId === targetScopeId);
    }

    if (targetScopeType === ScopeType.DEALER) {
        if (callerMemberships.some(m => m.scopeType === ScopeType.DEALER && m.scopeId === targetScopeId)) {
            return true;
        }
        const dealer = await fastify.prisma.dealer.findUnique({ where: { id: targetScopeId } });
        if (dealer?.dealerGroupId) {
            return callerMemberships.some(m => m.scopeType === ScopeType.DEALER_GROUP && m.scopeId === dealer.dealerGroupId);
        }
    }
    return false;
}

export async function userRoutes(fastify: FastifyInstance) {
    // List users (scope-aware)
    fastify.get('/api/users', {
        preHandler: [fastify.authenticate, requirePermission('users:read')]
    }, async (request, reply) => {
        const { scopeType, scopeId } = request.query as { scopeType?: string; scopeId?: string };
        const user = request.user as any;
        const memberships: MembershipInfo[] = user.memberships || [];
        const activeContext: ActiveContext = user.activeContext || {
            scopeType: ScopeType.PLATFORM,
            scopeId: 'PLATFORM',
        };

        const isPlatform = memberships.some(m =>
            m.scopeType === ScopeType.PLATFORM &&
            m.role === MemberRole.SUPERADMIN_PLATFORM
        );

        let memberFilter: any = {};

        if (scopeType && scopeId) {
            // Explicit scope requested → filter by that scope
            memberFilter = {
                memberships: {
                    some: {
                        scopeType: scopeType as ScopeType,
                        scopeId,
                    },
                },
            };
        } else if (isPlatform) {
            // Platform users with no explicit scope → show all users
            memberFilter = {};
        } else if (activeContext.scopeType === ScopeType.DEALER_GROUP) {
            // Group admin → users with memberships in any dealer of this group
            const dealerIds = await fastify.prisma.dealer.findMany({
                where: { dealerGroupId: activeContext.scopeId },
                select: { id: true },
            });
            const ids = dealerIds.map(d => d.id);

            memberFilter = {
                memberships: {
                    some: {
                        OR: [
                            { scopeType: ScopeType.DEALER_GROUP, scopeId: activeContext.scopeId },
                            { scopeType: ScopeType.DEALER, scopeId: { in: ids } },
                        ],
                    },
                },
            };
        } else if (activeContext.scopeType === ScopeType.DEALER) {
            memberFilter = {
                memberships: {
                    some: {
                        scopeType: ScopeType.DEALER,
                        scopeId: activeContext.scopeId,
                    },
                },
            };
        }

        const users = await fastify.prisma.user.findMany({
            where: memberFilter,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
                memberships: {
                    select: {
                        id: true,
                        scopeType: true,
                        scopeId: true,
                        role: true,
                        isDefaultContext: true,
                    },
                },
            },
        });

        return { users };
    });

    // Create user with membership
    fastify.post('/api/users', {
        preHandler: [fastify.authenticate, requirePermission('users:write')]
    }, async (request, reply) => {
        const { email, name, password, membershipScopeType, membershipScopeId, membershipRole } =
            request.body as any;

        if (!email || !password) {
            return reply.code(400).send({ error: 'email and password are required' });
        }

        // Determine membership params
        const scopeType = (membershipScopeType as ScopeType) || ScopeType.PLATFORM;
        const scopeId = membershipScopeId || 'PLATFORM';
        const role = (membershipRole as MemberRole) || MemberRole.PLATFORM_MANAGER;

        // Validate: role must be valid for the scope
        const allowedRoles = ASSIGNABLE_ROLES[scopeType];
        if (!allowedRoles?.includes(role)) {
            return reply.code(400).send({
                error: `Role ${role} is not valid for scope ${scopeType}. Allowed: ${allowedRoles?.join(', ')}`,
            });
        }

        // Validate: scope target exists
        if (scopeType === ScopeType.DEALER_GROUP) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: scopeId } });
            if (!group) return reply.code(400).send({ error: 'Dealer group not found' });
        } else if (scopeType === ScopeType.DEALER) {
            const dealer = await fastify.prisma.dealer.findUnique({ where: { id: scopeId } });
            if (!dealer) return reply.code(400).send({ error: 'Dealer not found' });
        }

        // Validate: caller authority
        const callerMemberships = (request.user as any)?.memberships || [];
        const hasAuthority = await validateAssignmentScope(fastify, callerMemberships, scopeType, scopeId);
        if (!hasAuthority) {
            return reply.code(403).send({ error: 'You do not have permission to assign a membership in this scope' });
        }

        // Determine legacy role for backward compat
        const legacyRole = role === MemberRole.SUPERADMIN_PLATFORM ? 'admin' : 'manager';

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const user = await fastify.prisma.user.create({
                data: {
                    email,
                    name,
                    password: hashedPassword,
                    role: legacyRole,
                    memberships: {
                        create: {
                            scopeType,
                            scopeId,
                            role,
                            isDefaultContext: true,
                        },
                    },
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    memberships: {
                        select: {
                            id: true,
                            scopeType: true,
                            scopeId: true,
                            role: true,
                            isDefaultContext: true,
                        },
                    },
                },
            });

            return { user };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Email already exists' });
            }
            throw error;
        }
    });

    // Add membership to existing user
    fastify.post('/api/users/:id/memberships', {
        preHandler: [fastify.authenticate, requirePermission('users:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { scopeType, scopeId, role } = request.body as any;

        if (!scopeType || !scopeId || !role) {
            return reply.code(400).send({ error: 'scopeType, scopeId, and role are required' });
        }

        const allowedRoles = ASSIGNABLE_ROLES[scopeType as ScopeType];
        if (!allowedRoles?.includes(role as MemberRole)) {
            return reply.code(400).send({
                error: `Role ${role} is not valid for scope ${scopeType}`,
            });
        }

        // Validate: scope target exists
        if (scopeType === ScopeType.DEALER_GROUP) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: scopeId } });
            if (!group) return reply.code(400).send({ error: 'Dealer group not found' });
        } else if (scopeType === ScopeType.DEALER) {
            const dealer = await fastify.prisma.dealer.findUnique({ where: { id: scopeId } });
            if (!dealer) return reply.code(400).send({ error: 'Dealer not found' });
        }

        // Validate: caller authority
        const callerMemberships = (request.user as any)?.memberships || [];
        const hasAuthority = await validateAssignmentScope(fastify, callerMemberships, scopeType, scopeId);
        if (!hasAuthority) {
            return reply.code(403).send({ error: 'You do not have permission to assign a membership in this scope' });
        }

        try {
            const membership = await fastify.prisma.membership.create({
                data: {
                    userId: id,
                    scopeType: scopeType as ScopeType,
                    scopeId,
                    role: role as MemberRole,
                },
            });

            return { membership };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'This membership already exists' });
            }
            if (error.code === 'P2003') {
                return reply.code(404).send({ error: 'User not found' });
            }
            throw error;
        }
    });

    // Remove membership from user
    fastify.delete('/api/users/:userId/memberships/:membershipId', {
        preHandler: [fastify.authenticate, requirePermission('users:write')]
    }, async (request, reply) => {
        const { userId, membershipId } = request.params as { userId: string; membershipId: string };

        const membership = await fastify.prisma.membership.findUnique({
            where: { id: membershipId },
        });

        if (!membership || membership.userId !== userId) {
            return reply.code(404).send({ error: 'Membership not found' });
        }

        await fastify.prisma.membership.delete({ where: { id: membershipId } });

        return { success: true };
    });

    // Update user
    fastify.patch('/api/users/:id', {
        preHandler: [fastify.authenticate, requirePermission('users:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { email, name, password, isActive } = request.body as any;

        const updateData: any = {};
        if (email !== undefined) updateData.email = email;
        if (name !== undefined) updateData.name = name;
        if (isActive !== undefined) updateData.isActive = isActive;

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        try {
            const user = await fastify.prisma.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                    updatedAt: true,
                    memberships: {
                        select: {
                            id: true,
                            scopeType: true,
                            scopeId: true,
                            role: true,
                            isDefaultContext: true,
                        },
                    },
                },
            });

            return { user };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Email already exists' });
            }
            return reply.code(404).send({ error: 'User not found' });
        }
    });

    // Delete user
    fastify.delete('/api/users/:id', {
        preHandler: [fastify.authenticate, requirePermission('users:write')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        // Prevent self-deletion
        if (id === (request.user as any)?.userId) {
            return reply.code(400).send({ error: 'Cannot delete your own account' });
        }

        try {
            // Memberships cascade delete via onDelete: Cascade
            await fastify.prisma.user.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'User not found' });
        }
    });
}
