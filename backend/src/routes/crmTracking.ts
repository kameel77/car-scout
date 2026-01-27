import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const VisitSchema = z.object({
    uuid: z.string().min(1),
    sessionId: z.string().min(1),
    url: z.string().min(1),
    visitedAt: z.string().optional()
});

export async function crmTrackingRoutes(fastify: FastifyInstance) {
    fastify.post('/api/crm-tracking/visit', async (request, reply) => {
        const data = VisitSchema.parse(request.body);
        const visitedAt = data.visitedAt ? new Date(data.visitedAt) : new Date();

        if (Number.isNaN(visitedAt.getTime())) {
            return reply.code(400).send({ error: 'Invalid visitedAt timestamp' });
        }

        await fastify.prisma.crmTrackingSession.upsert({
            where: { id: data.sessionId },
            create: {
                id: data.sessionId,
                uuid: data.uuid,
                lastSeenAt: new Date()
            },
            update: {
                uuid: data.uuid,
                lastSeenAt: new Date()
            }
        });

        await fastify.prisma.crmTrackingVisit.create({
            data: {
                sessionId: data.sessionId,
                url: data.url,
                visitedAt
            }
        });

        return { success: true };
    });

    fastify.get('/api/crm-tracking/:uuid', async (request) => {
        const { uuid } = request.params as { uuid: string };

        const sessions = await fastify.prisma.crmTrackingSession.findMany({
            where: { uuid },
            include: {
                visits: {
                    orderBy: { visitedAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        const visits = sessions.flatMap((session) =>
            session.visits.map((visit) => ({
                sessionId: session.id,
                url: visit.url,
                visitedAt: visit.visitedAt
            }))
        );

        return {
            uuid,
            sessions: sessions.map((session) => ({
                id: session.id,
                createdAt: session.createdAt,
                lastSeenAt: session.lastSeenAt
            })),
            visits
        };
    });
}
