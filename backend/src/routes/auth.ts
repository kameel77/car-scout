import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { ScopeType, MemberRole } from '@prisma/client';
import type { ActiveContext, MembershipInfo } from '../middleware/permissions.js';
import { sendPasswordResetEmail } from '../services/email.js';

export async function authRoutes(fastify: FastifyInstance) {
    // Login
    fastify.post('/api/auth/login', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1 minute'
            }
        }
    }, async (request, reply) => {
        try {
            const { email, password } = request.body as {
                email: string;
                password: string
            };

            if (!email || !password) {
                return reply.code(400).send({
                    error: 'Email and password are required'
                });
            }

            const user = await fastify.prisma.user.findUnique({
                where: { email },
                include: {
                    memberships: true,
                },
            });

            if (!user || !user.isActive) {
                return reply.code(401).send({
                    error: 'Invalid credentials'
                });
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return reply.code(401).send({
                    error: 'Invalid credentials'
                });
            }

            // Update last login
            await fastify.prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });

            // Determine active context from memberships
            const memberships: MembershipInfo[] = user.memberships.map(m => ({
                id: m.id,
                scopeType: m.scopeType,
                scopeId: m.scopeId,
                role: m.role,
                isDefaultContext: m.isDefaultContext,
            }));

            // Find default context or fallback to first membership
            const defaultMembership = memberships.find(m => m.isDefaultContext) || memberships[0];
            const activeContext: ActiveContext = defaultMembership
                ? { scopeType: defaultMembership.scopeType, scopeId: defaultMembership.scopeId }
                : { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' };

            // Generate JWT v2 with memberships + active context
            const token = fastify.jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: user.role, // legacy compat
                    memberships,
                    activeContext,
                },
                { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
            );

            return {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role, // legacy compat
                    memberships,
                    activeContext,
                },
            };
        } catch (error) {
            fastify.log.error(error, 'Login error details');
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Verify token and get current user
    fastify.get('/api/auth/me', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const user = await fastify.prisma.user.findUnique({
            where: { id: request.user!.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                lastLogin: true,
                memberships: true,
            }
        });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        const memberships: MembershipInfo[] = user.memberships.map(m => ({
            id: m.id,
            scopeType: m.scopeType,
            scopeId: m.scopeId,
            role: m.role,
            isDefaultContext: m.isDefaultContext,
        }));

        // Active context from JWT (or default)
        const jwtContext = (request.user as any)?.activeContext;
        const activeContext: ActiveContext = jwtContext || {
            scopeType: ScopeType.PLATFORM,
            scopeId: 'PLATFORM',
        };

        return {
            user: {
                ...user,
                memberships,
                activeContext,
            },
        };
    });

    // Switch active context
    fastify.post('/api/auth/context', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { scopeType, scopeId } = request.body as {
            scopeType: ScopeType;
            scopeId: string;
        };

        if (!scopeType || !scopeId) {
            return reply.code(400).send({ error: 'scopeType and scopeId are required' });
        }

        const user = await fastify.prisma.user.findUnique({
            where: { id: request.user!.userId },
            include: { memberships: true },
        });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        const memberships: MembershipInfo[] = user.memberships.map(m => ({
            id: m.id,
            scopeType: m.scopeType,
            scopeId: m.scopeId,
            role: m.role,
            isDefaultContext: m.isDefaultContext,
        }));

        // Platform roles can switch to any context
        const isPlatformUser = memberships.some(m =>
            m.scopeType === ScopeType.PLATFORM &&
            (m.role === MemberRole.SUPERADMIN_PLATFORM || m.role === MemberRole.PLATFORM_MANAGER)
        );

        if (!isPlatformUser) {
            // Non-platform users: verify they have a membership in the requested context
            const hasAccess = memberships.some(m =>
                m.scopeType === scopeType && m.scopeId === scopeId
            );

            // Also check if they have group-level access for a dealer context
            if (!hasAccess && scopeType === ScopeType.DEALER) {
                const dealer = await fastify.prisma.dealer.findUnique({
                    where: { id: scopeId },
                    select: { dealerGroupId: true },
                });
                if (dealer?.dealerGroupId) {
                    const hasGroupAccess = memberships.some(m =>
                        m.scopeType === ScopeType.DEALER_GROUP && m.scopeId === dealer.dealerGroupId
                    );
                    if (!hasGroupAccess) {
                        return reply.code(403).send({ error: 'No access to this context' });
                    }
                } else {
                    return reply.code(403).send({ error: 'No access to this context' });
                }
            } else if (!hasAccess) {
                return reply.code(403).send({ error: 'No access to this context' });
            }
        }

        // Validate the scope target exists
        if (scopeType === ScopeType.DEALER_GROUP) {
            const group = await fastify.prisma.dealerGroup.findUnique({ where: { id: scopeId } });
            if (!group) {
                return reply.code(404).send({ error: 'Dealer group not found' });
            }
        } else if (scopeType === ScopeType.DEALER) {
            const dealer = await fastify.prisma.dealer.findUnique({ where: { id: scopeId } });
            if (!dealer) {
                return reply.code(404).send({ error: 'Dealer not found' });
            }
        }

        const activeContext: ActiveContext = { scopeType, scopeId };

        // Issue a new JWT with updated context
        const token = fastify.jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                memberships,
                activeContext,
            },
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return { token, activeContext };
    });

    // Logout
    fastify.post('/api/auth/logout', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // Blacklist the token in Redis for 7 days (max JWT TTL)
            await fastify.redis.set(`blacklist:${token}`, 'true', 'EX', 7 * 24 * 60 * 60);
        }
        return { message: 'Logged out successfully' };
    });

    // Request password reset
    fastify.post('/api/auth/reset-password-request', {
        config: {
            rateLimit: {
                max: 3,
                timeWindow: '15 minutes'
            }
        }
    }, async (request, reply) => {
        const { email } = request.body as { email: string };

        if (!email) {
            return reply.code(400).send({ error: 'Email is required' });
        }

        const user = await fastify.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Return success even if user not found for security (prevent email enumeration)
            return { message: 'If an account with that email exists, a reset link has been generated.' };
        }

        // Generate a random token and its hash
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await fastify.prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: expires
            }
        });

        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
        await sendPasswordResetEmail(fastify, email, resetLink);

        return { message: 'If an account with that email exists, a reset link has been generated.' };
    });

    // Reset password using token
    fastify.post('/api/auth/reset-password', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '15 minutes'
            }
        }
    }, async (request, reply) => {
        const { token, newPassword } = request.body as {
            token: string;
            newPassword: string
        };

        if (!token || !newPassword) {
            return reply.code(400).send({
                error: 'Token and new password are required'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await fastify.prisma.user.findFirst({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: {
                    gt: new Date()
                }
            }
        });

        if (!user) {
            return reply.code(400).send({
                error: 'Invalid or expired password reset token'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await fastify.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        return { message: 'Password has been reset successfully. You can now log in with your new password.' };
    });
}
