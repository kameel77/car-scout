import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineDictionaries } from '../services/opportunity-read.service.js';
import { getPipelineScope } from './scope-helper.js';

export async function registerDictionaryRoutes(app: FastifyInstance) {
  // GET /api/pipeline/dictionaries
  app.get(
    '/api/pipeline/dictionaries',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const dicts = await getPipelineDictionaries(app.prisma, scope);
      return reply.send(dicts);
    }
  );
}
