import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const VisitSchema = z.object({
    uuid: z.string().min(1),
    sessionId: z.string().min(1),
    url: z.string().min(1),
    visitedAt: z.string().optional()
});

export async function crmTrackingRoutes(fastify: FastifyInstance) {
    // Public endpoint for tracking visits
    fastify.post('/api/crm-tracking/visit', {
        schema: {
            description: 'Track a user visit for CRM analytics',
            tags: ['CRM Tracking'],
            body: {
                type: 'object',
                required: ['uuid', 'sessionId', 'url'],
                properties: {
                    uuid: { type: 'string', description: 'Client UUID from CRM' },
                    sessionId: { type: 'string', description: 'Tracking session ID' },
                    url: { type: 'string', description: 'Visited URL path' },
                    visitedAt: { type: 'string', format: 'date-time', description: 'Visit timestamp (ISO 8601)' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const data = VisitSchema.parse(request.body);
            const visitedAt = data.visitedAt ? new Date(data.visitedAt) : new Date();

            if (Number.isNaN(visitedAt.getTime())) {
                fastify.log.warn({ uuid: data.uuid, visitedAt: data.visitedAt }, 'Invalid timestamp received');
                return reply.code(400).send({ error: 'Invalid visitedAt timestamp' });
            }

            fastify.log.info({
                uuid: data.uuid,
                sessionId: data.sessionId,
                url: data.url
            }, 'CRM visit tracked');

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
        } catch (error) {
            fastify.log.error({ error }, 'Failed to track CRM visit');
            throw error;
        }
    });

    // Protected endpoint for retrieving tracking data
    fastify.get('/api/crm-tracking/:uuid', {
        schema: {
            description: 'Retrieve CRM tracking data for a client UUID',
            tags: ['CRM Tracking'],
            params: {
                type: 'object',
                properties: {
                    uuid: { type: 'string', description: 'Client UUID' }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    from: { type: 'string', format: 'date-time', description: 'Filter visits from this date' },
                    to: { type: 'string', format: 'date-time', description: 'Filter visits until this date' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        clientUuid: { type: 'string' },
                        trackingSessionId: { type: ['string', 'null'] },
                        visits: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    url: { type: 'string' },
                                    timestamp: { type: 'string', format: 'date-time' }
                                }
                            }
                        },
                        range: {
                            type: 'object',
                            properties: {
                                from: { type: 'string', format: 'date-time' },
                                to: { type: 'string', format: 'date-time' }
                            }
                        }
                    }
                }
            }
        },
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { uuid } = request.params as { uuid: string };
        const { from, to } = request.query as { from?: string; to?: string };

        try {
            const sessions = await fastify.prisma.crmTrackingSession.findMany({
                where: { uuid },
                include: {
                    visits: {
                        where: {
                            visitedAt: {
                                ...(from ? { gte: new Date(from) } : {}),
                                ...(to ? { lte: new Date(to) } : {})
                            }
                        },
                        orderBy: { visitedAt: 'asc' }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            const visits = sessions.flatMap((session) =>
                session.visits.map((visit) => ({
                    url: visit.url,
                    timestamp: visit.visitedAt.toISOString()
                }))
            );

            const range = visits.length > 0 ? {
                from: visits[0].timestamp,
                to: visits[visits.length - 1].timestamp
            } : undefined;

            return {
                clientUuid: uuid,
                trackingSessionId: sessions[0]?.id || null,
                visits,
                ...(range && { range })
            };
        } catch (error) {
            fastify.log.error({ error, uuid }, 'Failed to retrieve CRM tracking data');
            throw error;
        }
    });
}
