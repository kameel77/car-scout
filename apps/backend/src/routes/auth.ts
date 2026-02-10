import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';

export async function authRoutes(fastify: FastifyInstance) {
    // Login
    fastify.post('/api/auth/login', async (request, reply) => {
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

    // Request password reset
    fastify.post('/api/auth/reset-password-request', async (request, reply) => {
        const { email } = request.body as { email: string };

        if (!email) {
            return reply.code(400).send({ error: 'Email is required' });
        }

        const user = await fastify.prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Return success even if user not found for security (prevent email enumeration)
            // But log the attempt for debugging
            fastify.log.warn(`Password reset requested for non-existent email: ${email}`);
            return { message: 'If an account with that email exists, a reset link has been generated.' };
        }

        // Generate a random token
        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await fastify.prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: token,
                resetPasswordExpires: expires
            }
        });

        // Log the reset link to console
        const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
        console.log('------------------------------------------');
        console.log('PASSWORD RESET REQUESTED');
        console.log(`User: ${email}`);
        console.log(`Reset Link: ${resetLink}`);
        console.log('------------------------------------------');

        return { message: 'If an account with that email exists, a reset link has been generated.' };
    });

    // Reset password using token
    fastify.post('/api/auth/reset-password', async (request, reply) => {
        const { token, newPassword } = request.body as {
            token: string;
            newPassword: string
        };

        if (!token || !newPassword) {
            return reply.code(400).send({
                error: 'Token and new password are required'
            });
        }

        const user = await fastify.prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
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
