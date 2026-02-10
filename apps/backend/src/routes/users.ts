import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { authorizeRoles } from '../middleware/authorize.js';

const ALLOWED_ROLES = ['admin', 'manager'] as const;

export async function userRoutes(fastify: FastifyInstance) {
    // List users
    fastify.get('/api/users', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async () => {
        const users = await fastify.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true
            }
        });

        return { users };
    });

    // Create user
    fastify.post('/api/users', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const { email, name, password, role } = request.body as any;

        if (!email || !password) {
            return reply.code(400).send({ error: 'email and password are required' });
        }

        const normalizedRole = role || 'manager';
        if (!ALLOWED_ROLES.includes(normalizedRole)) {
            return reply.code(400).send({ error: 'Invalid role' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            const user = await fastify.prisma.user.create({
                data: {
                    email,
                    name,
                    password: hashedPassword,
                    role: normalizedRole
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true
                }
            });

            return { user };
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Email already exists' });
            }
            throw error;
        }
    });

    // Update user
    fastify.patch('/api/users/:id', {
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { email, name, password, role, isActive } = request.body as any;

        const updateData: any = {
            email,
            name,
            isActive
        };

        if (role) {
            if (!ALLOWED_ROLES.includes(role)) {
                return reply.code(400).send({ error: 'Invalid role' });
            }
            updateData.role = role;
        }

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
                    updatedAt: true
                }
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
        preHandler: [fastify.authenticate, authorizeRoles(['admin'])]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };

        try {
            await fastify.prisma.user.delete({ where: { id } });
            return { success: true };
        } catch (error) {
            return reply.code(404).send({ error: 'User not found' });
        }
    });
}
