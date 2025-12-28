import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';

export async function authRoutes(fastify: FastifyInstance) {
    // Login
    fastify.post('/api/auth/login', async (request, reply) => {
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
            where: { email }
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

        // Generate JWT
        const token = fastify.jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        };
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
                lastLogin: true
            }
        });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return { user };
    });

    // Logout (optional - for future token blacklist)
    fastify.post('/api/auth/logout', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        // TODO: Implement token blacklist in Redis if needed
        return { message: 'Logged out successfully' };
    });
}
