import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';
import {
  executeCreateApplication,
  executeSubmitApplication,
  executeDecideApplication,
  executeRerouteApplication,
} from '../services/application.service.js';
import {
  createApplicationSchema,
  submitApplicationSchema,
  decideApplicationSchema,
  rerouteApplicationSchema,
} from '../schemas/pipeline.schemas.js';

export async function registerApplicationRoutes(app: FastifyInstance) {
  // Create application for opportunity
  app.post(
    '/api/pipeline/opportunities/:id/applications',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = createApplicationSchema.parse(request.body);

      const application = await executeCreateApplication(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.code(201).send(application);
    }
  );

  // Submit application (PRECHECK / FULL)
  app.post(
    '/api/pipeline/applications/:id/submit',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = submitApplicationSchema.parse(request.body);

      const application = await executeSubmitApplication(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.send(application);
    }
  );

  // Decide application (APPROVED / CONDITIONALLY_APPROVED / REJECTED)
  app.post(
    '/api/pipeline/applications/:id/decide',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = decideApplicationSchema.parse(request.body);

      const application = await executeDecideApplication(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.send(application);
    }
  );

  // Reroute application to another financier
  app.post(
    '/api/pipeline/applications/:id/reroute',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = rerouteApplicationSchema.parse(request.body);

      const newApplication = await executeRerouteApplication(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.code(201).send(newApplication);
    }
  );
}
