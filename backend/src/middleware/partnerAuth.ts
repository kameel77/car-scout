import { FastifyRequest, FastifyReply } from 'fastify';
import { Partner } from '@prisma/client';

export interface PartnerRequest extends FastifyRequest {
    partner: Partner & { dealerId: string };
}

export async function partnerAuth(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized. Invalid or missing Bearer token.' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const prisma = request.server.prisma;

    const partner = await prisma.partner.findUnique({
        where: { apiKey: token, isActive: true }
    });

    if (!partner) {
        request.log.warn(`Partner API: Nieudana próba dostępu z tokenem: ${token.substring(0, 5)}...`);
        return reply.code(401).send({ error: 'Unauthorized. Invalid API Key or Partner is inactive.' });
    }

    if (!partner.dealerId) {
        request.log.error(`Partner API: Partner ${partner.id} próbował wykonać akcję bez przypisanego dealera.`);
        return reply.code(403).send({ error: 'Forbidden. Partner does not have an assigned Dealer.' });
    }

    // Attach partner to request for handlers to use
    (request as PartnerRequest).partner = partner as Partner & { dealerId: string };
}
