import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';

export async function partnerManagementRoutes(fastify: FastifyInstance) {
    
    // Tylko dla zalogowanych (Admin panel)
    fastify.addHook('preHandler', fastify.authenticate);

    // GET /api/partners - list all partners
    fastify.get('/api/partners', async (request, reply) => {
        try {
            const partners = await fastify.prisma.partner.findMany({
                include: {
                    dealer: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return { partners };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to fetch partners' });
        }
    });

    // POST /api/partners - create a new partner
    fastify.post('/api/partners', async (request, reply) => {
        const body = request.body as any;
        const { name, nip, contactPerson, contactEmail, contactPhone, dealerId } = body;

        if (!name) {
            return reply.code(400).send({ error: 'Name is required' });
        }

        // Generate a random, strong API key for the new partner
        const apiKey = `cs_partner_${randomBytes(16).toString('hex')}`;

        try {
            const partner = await fastify.prisma.partner.create({
                data: {
                    name,
                    apiKey,
                    nip,
                    contactPerson,
                    contactEmail,
                    contactPhone,
                    dealerId: dealerId || null,
                    isActive: true
                }
            });
            return reply.code(201).send({ partner });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to create partner' });
        }
    });

    // PUT /api/partners/:id - update partner
    fastify.put('/api/partners/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const { name, nip, contactPerson, contactEmail, contactPhone, dealerId, isActive } = body;

        try {
            const partner = await fastify.prisma.partner.update({
                where: { id },
                data: {
                    name,
                    nip,
                    contactPerson,
                    contactEmail,
                    contactPhone,
                    dealerId: dealerId !== undefined ? (dealerId || null) : undefined,
                    isActive: isActive !== undefined ? isActive : undefined
                }
            });
            return { partner };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to update partner' });
        }
    });

    // POST /api/partners/:id/regenerate-key - regenerate API key
    fastify.post('/api/partners/:id/regenerate-key', async (request, reply) => {
        const { id } = request.params as { id: string };
        const newApiKey = `cs_partner_${randomBytes(16).toString('hex')}`;

        try {
            const partner = await fastify.prisma.partner.update({
                where: { id },
                data: { apiKey: newApiKey }
            });
            return { partner };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to regenerate API key' });
        }
    });
}
