import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';
import {
  executeCreateOrUpdateOffer,
  executeSupersedeOffer,
  executePresentOffer,
  executeAcceptOffer,
} from '../services/offer.service.js';
import {
  createOfferSchema,
  presentOfferSchema,
} from '../schemas/pipeline.schemas.js';

export async function registerOfferRoutes(app: FastifyInstance) {
  // Create or update current offer in place
  app.post(
    '/api/pipeline/opportunities/:id/offers',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = createOfferSchema.parse(request.body);

      const offer = await executeCreateOrUpdateOffer(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.code(201).send(offer);
    }
  );

  // Supersede offer (create version + 1)
  app.post(
    '/api/pipeline/opportunities/:id/offers/supersede',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = createOfferSchema.parse(request.body);

      const offer = await executeSupersedeOffer(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.code(201).send(offer);
    }
  );

  // Present offer to customer
  app.post(
    '/api/pipeline/opportunities/:id/offers/:offerId/present',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id, offerId } = request.params as { id: string; offerId: string };
      const body = presentOfferSchema.parse(request.body || {});

      const offer = await executePresentOffer(
        app.prisma,
        scope,
        id,
        offerId,
        body,
        actor
      );

      return reply.send(offer);
    }
  );

  // Accept offer
  app.post(
    '/api/pipeline/opportunities/:id/offers/:offerId/accept',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id, offerId } = request.params as { id: string; offerId: string };

      const offer = await executeAcceptOffer(
        app.prisma,
        scope,
        id,
        offerId,
        actor
      );

      return reply.send(offer);
    }
  );
}
