import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';
import {
  executeMaterializeDocuments,
  executeUpdateDocumentStatus,
} from '../services/document.service.js';
import { updateDocumentStatusSchema } from '../schemas/pipeline.schemas.js';

export async function registerDocumentRoutes(app: FastifyInstance) {
  // Manual repair / rematerialize documents for opportunity
  app.post(
    '/api/pipeline/opportunities/:id/documents/materialize',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const documents = await executeMaterializeDocuments(
        app.prisma,
        id
      );

      return reply.send(documents);
    }
  );

  // Update document status
  app.patch(
    '/api/pipeline/documents/:id',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = updateDocumentStatusSchema.parse(request.body);

      const document = await executeUpdateDocumentStatus(
        app.prisma,
        scope,
        id,
        body as any,
        actor
      );

      return reply.send(document);
    }
  );
}
