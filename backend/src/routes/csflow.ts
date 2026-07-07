import { FastifyPluginAsync } from 'fastify';
import { syncAllCSFlowSources } from '../services/csflow.service.js';

export const csflowRoutes: FastifyPluginAsync = async (fastify) => {
    // Ręczna synchronizacja WSZYSTKICH włączonych źródeł CSFlow
    fastify.post('/api/csflow/sync', {
        onRequest: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const user = request.user as { userId: string };
            const result = await syncAllCSFlowSources(fastify.prisma, user.userId);
            if ((result as any).skipped) {
                return reply.status(400).send({
                    success: false,
                    error: 'Synchronizacja z CSFlow jest wyłączona w ustawieniach.'
                });
            }
            return reply.send({ success: true, result });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({
                success: false,
                error: 'Wystąpił błąd podczas ręcznej synchronizacji CSFlow API'
            });
        }
    });
};
