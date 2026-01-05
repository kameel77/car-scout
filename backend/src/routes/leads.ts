import { FastifyInstance } from 'fastify';

type PreferredContact = 'email' | 'phone';

interface LeadPayload {
    listingId: string;
    name: string;
    email: string;
    phone?: string;
    preferredContact?: PreferredContact;
    message: string;
    consentMarketing?: boolean;
    consentPrivacy?: boolean;
}

const generateReference = () => {
    const timestamp = Date.now().toString();
    return `AF-${timestamp.slice(-8)}`;
};

export async function leadRoutes(fastify: FastifyInstance) {
    // Create new lead from public form
    fastify.post('/api/leads', async (request, reply) => {
        const {
            listingId,
            name,
            email,
            phone,
            preferredContact,
            message,
            consentMarketing,
            consentPrivacy
        } = request.body as LeadPayload;

        if (!listingId || !name || !email || !message) {
            return reply.code(400).send({ error: 'listingId, name, email and message are required' });
        }

        const listing = await fastify.prisma.listing.findUnique({
            where: { id: listingId },
            include: { dealer: true }
        });

        if (!listing) {
            return reply.code(404).send({ error: 'Listing not found' });
        }

        const lead = await fastify.prisma.lead.create({
            data: {
                listingId,
                name,
                email,
                phone,
                preferredContact: preferredContact || 'email',
                message,
                status: 'new',
                referenceNumber: generateReference(),
                consentMarketingAt: consentMarketing ? new Date() : null,
                consentPrivacyAt: consentPrivacy ? new Date() : null
            },
            include: {
                listing: {
                    include: { dealer: true }
                }
            }
        });

        return { lead };
    });

    // Get leads for backoffice (requires auth)
    fastify.get('/api/leads', {
        preHandler: [fastify.authenticate]
    }, async () => {
        const leads = await fastify.prisma.lead.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                listing: {
                    include: { dealer: true }
                }
            }
        });

        return { leads };
    });
}
