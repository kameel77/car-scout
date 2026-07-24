import { FastifyRequest, FastifyReply } from 'fastify';
import { Partner } from '@prisma/client';

export interface PartnerRequest extends FastifyRequest {
    partner: Partner & { mappings: { externalId: string, dealerId: string }[] };
}

export async function partnerAuth(request: FastifyRequest, reply: FastifyReply) {
    try {
        const authHeader = request.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized. Invalid or missing Bearer token.' });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        const prisma = request.server.prisma;

        const partner = await prisma.partner.findUnique({
            where: { apiKey: token, isActive: true },
            include: {
                mappings: {
                    select: { externalId: true, dealerId: true }
                }
            }
        });

        if (!partner) {
            request.log.warn(`Partner API: Nieudana próba dostępu z tokenem: ${token.substring(0, 5)}...`);
            return reply.code(401).send({ error: 'Unauthorized. Invalid API Key or Partner is inactive.' });
        }

        (request as PartnerRequest).partner = {
            ...partner,
            mappings: partner.mappings || []
        };
    } catch (err: any) {
        request.log.error(err, 'Partner authentication error');
        return reply.code(401).send({ error: 'Unauthorized. Partner authentication failed: ' + (err.message || String(err)) });
    }
}
