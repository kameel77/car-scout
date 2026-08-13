import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { requirePlatformRole } from '../middleware/authorize.js';

function last4(secret: string | null | undefined): string | null {
    if (!secret || secret.length < 4) return null;
    return secret.slice(-4);
}

// Strips the apiKey value from a partner before it goes out over HTTP.
// Only presence + last 4 chars are exposed.
function maskPartner(partner: any) {
    const { apiKey, ...rest } = partner;
    return {
        ...rest,
        hasApiKey: !!apiKey,
        apiKeyLast4: last4(apiKey),
    };
}

export async function partnerManagementRoutes(fastify: FastifyInstance) {

    // Tylko dla zalogowanych (Admin panel)
    fastify.addHook('preHandler', fastify.authenticate);
    // Tylko role platformowe (admin/manager) - partnerzy API i ich klucze
    // nie są przypisani do dealera, więc DEALER_EMPLOYEE nie ma tu wglądu.
    fastify.addHook('preHandler', requirePlatformRole());

    // GET /api/partners - list all partners
    fastify.get('/api/partners', async (request, reply) => {
        try {
            const partners = await fastify.prisma.partner.findMany({
                include: {
                    mappings: {
                        include: {
                            dealer: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            return { partners: partners.map(maskPartner) };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to fetch partners' });
        }
    });

    // POST /api/partners - create a new partner
    fastify.post('/api/partners', async (request, reply) => {
        const body = request.body as any;
        const { name, nip, contactPerson, contactEmail, contactPhone, mappings } = body;

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
                    mappings: mappings && mappings.length > 0 ? {
                        create: mappings.map((m: any) => ({
                            externalId: m.externalId,
                            dealerId: m.dealerId
                        }))
                    } : undefined,
                    isActive: true
                }
            });
            // Intentional plaintext exposure: this is the only moment the newly
            // generated key can ever be shown to the admin, so only the key + id
            // are returned here (not the whole partner record).
            return reply.code(201).send({ id: partner.id, apiKey: partner.apiKey });
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to create partner' });
        }
    });

    // PUT /api/partners/:id - update partner
    fastify.put('/api/partners/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const { name, nip, contactPerson, contactEmail, contactPhone, mappings, isActive } = body;

        try {
            const partner = await fastify.prisma.partner.update({
                where: { id },
                data: {
                    name,
                    nip,
                    contactPerson,
                    contactEmail,
                    contactPhone,
                    mappings: mappings !== undefined ? {
                        deleteMany: {},
                        create: mappings.map((m: any) => ({
                            externalId: m.externalId,
                            dealerId: m.dealerId
                        }))
                    } : undefined,
                    isActive: isActive !== undefined ? isActive : undefined
                }
            });
            return { partner: maskPartner(partner) };
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
            // Intentional plaintext exposure: this is the only moment the new key
            // can ever be shown to the admin, so only the key + id are returned
            // here (not the whole partner record).
            return { id: partner.id, apiKey: partner.apiKey };
        } catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Failed to regenerate API key' });
        }
    });
}
