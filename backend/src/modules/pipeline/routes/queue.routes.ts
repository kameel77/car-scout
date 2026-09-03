import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getAdvisorQueue } from '../services/queue.service.js';
import { getPipelineScope } from './scope-helper.js';
import { queueQuerySchema } from '../schemas/pipeline.schemas.js';

export async function registerQueueRoutes(app: FastifyInstance) {
  app.get(
    '/api/pipeline/queue',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const query = queueQuerySchema.parse(request.query);

      const queue = await getAdvisorQueue(app.prisma, {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        ownerUserId: query.ownerUserId,
        clientType: query.clientType,
        financingType: query.financingType,
        leadSource: query.leadSource,
        search: query.search,
      });

      return reply.send(queue);
    }
  );
}
