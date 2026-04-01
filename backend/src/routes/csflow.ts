import { FastifyPluginAsync } from 'fastify';
import { syncCSFlowAPI } from '../services/csflow.service.js';

export const csflowRoutes: FastifyPluginAsync = async (fastify) => {
    // Ręczne uruchomienie importu CSFlow z panelu lub zewnętrznej usługi API 
    // (/api/csflow/sync)
    fastify.post('/api/csflow/sync', {
        // Zabezpieczenie poprzez JWT, na wypadek gdyby front chciał triggerować to po przycisku w panelu Admina
        onRequest: [fastify.authenticate] 
    }, async (request, reply) => {
        try {
            const user = request.user as { userId: string };
            const result = await syncCSFlowAPI(fastify.prisma, user.userId);
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
