import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';

const listQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export async function registerThuliumDeadLetterRoutes(app: FastifyInstance) {
  // GET /api/pipeline/integrations/thulium/unmatched
  app.get(
    '/api/pipeline/integrations/thulium/unmatched',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const query = listQuerySchema.parse(request.query);

      const where = {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        dismissedAt: null,
      };

      const [items, total] = await Promise.all([
        app.prisma.pipelineThuliumDeadLetter.findMany({
          where,
          orderBy: { receivedAt: 'desc' },
          take: query.take,
        }),
        app.prisma.pipelineThuliumDeadLetter.count({ where }),
      ]);

      return reply.send({ items, total });
    }
  );

  // POST /api/pipeline/integrations/thulium/unmatched/:id/dismiss
  app.post(
    '/api/pipeline/integrations/thulium/unmatched/:id/dismiss',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const { id } = request.params as { id: string };
      const actor = getActorFromRequest(request);

      const updated = await app.prisma.pipelineThuliumDeadLetter.updateMany({
        where: {
          id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          dismissedAt: null,
        },
        data: {
          dismissedAt: new Date(),
          dismissedUserId: actor.userId,
        },
      });

      if (updated.count === 0) {
        return reply.code(404).send({ error: 'Zgłoszenie nie zostało znalezione' });
      }

      return reply.send({ dismissed: true });
    }
  );
}
