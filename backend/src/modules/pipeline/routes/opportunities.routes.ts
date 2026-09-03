import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import {
  createOpportunitySchema,
  patchOpportunitySchema,
  transitionSchema,
  assignSchema,
  nextActionSchema,
  logContactSchema,
  closeWonSchema,
  closeLostSchema,
  listOpportunitiesQuerySchema,
} from '../schemas/pipeline.schemas.js';
import {
  executeCreateOpportunity,
  executeChangePhase,
  executeAssignOwner,
  executeSetNextAction,
  executeLogContact,
  executeCloseWon,
  executeCloseLost,
  executePatchOpportunity,
} from '../services/opportunity.service.js';
import {
  listOpportunities,
  getOpportunityById,
} from '../services/opportunity-read.service.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';

export async function registerOpportunityRoutes(app: FastifyInstance) {
  // GET /api/pipeline/opportunities
  app.get(
    '/api/pipeline/opportunities',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const query = listOpportunitiesQuerySchema.parse(request.query);

      const result = await listOpportunities(app.prisma, {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        phase: query.phase,
        status: query.status,
        ownerUserId: query.ownerUserId,
        clientType: query.clientType,
        financingType: query.financingType,
        leadSource: query.leadSource,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      });

      return reply.send(result);
    }
  );

  // GET /api/pipeline/opportunities/:id
  app.get(
    '/api/pipeline/opportunities/:id',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const { id } = request.params as { id: string };

      const opportunity = await getOpportunityById(app.prisma, id, scope);
      if (!opportunity) {
        return reply.code(404).send({ error: 'Sprawa nie została znaleziona' });
      }

      return reply.send(opportunity);
    }
  );

  // POST /api/pipeline/opportunities
  app.post(
    '/api/pipeline/opportunities',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const body = createOpportunitySchema.parse(request.body);
      const actor = getActorFromRequest(request);

      const opportunity = await executeCreateOpportunity(app.prisma, {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        leadSource: body.leadSource,
        leadSourceDetail: body.leadSourceDetail,
        clientType: body.clientType,
        financingType: body.financingType,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        companyName: body.companyName,
        companyNip: body.companyNip,
        sourceLeadId: body.sourceLeadId,
        ownerUserId: body.ownerUserId,
        nextActionType: body.nextActionType,
        nextActionDueAt: body.nextActionDueAt ? new Date(body.nextActionDueAt) : null,
        nextActionNote: body.nextActionNote,
        actor,
      });

      return reply.code(201).send(opportunity);
    }
  );

  // PATCH /api/pipeline/opportunities/:id
  app.patch(
    '/api/pipeline/opportunities/:id',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = patchOpportunitySchema.parse(request.body);
      const actor = getActorFromRequest(request);

      const updated = await executePatchOpportunity(app.prisma, {
        id,
        clientType: body.clientType,
        financingType: body.financingType,
        leadSource: body.leadSource,
        leadSourceDetail: body.leadSourceDetail,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        companyName: body.companyName,
        companyNip: body.companyNip,
        contractSignedAt: body.contractSignedAt,
        contractedApplicationId: body.contractedApplicationId,
        actor,
      });

      return reply.send(updated);
    }
  );

  // POST /api/pipeline/opportunities/:id/transition
  app.post(
    '/api/pipeline/opportunities/:id/transition',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = transitionSchema.parse(request.body);
      const actor = getActorFromRequest(request);

      try {
        const updated = await executeChangePhase(app.prisma, {
          id,
          targetPhase: body.targetPhase,
          overridden: body.overridden,
          overrideReason: body.overrideReason,
          actor,
        });

        return reply.send(updated);
      } catch (err: unknown) {
        const error = err as { statusCode?: number; currentPhase?: string; targetPhase?: string; missing?: unknown[]; message?: string };
        if (error?.statusCode === 422) {
          return reply.code(422).send({
            error: 'STAGE_GATE_VIOLATION',
            message: error.message,
            currentPhase: error.currentPhase,
            targetPhase: error.targetPhase,
            missing: error.missing ?? [],
          });
        }
        throw err;
      }
    }
  );

  // POST /api/pipeline/opportunities/:id/assign
  app.post(
    '/api/pipeline/opportunities/:id/assign',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = assignSchema.parse(request.body);
      const actor = getActorFromRequest(request);

      const updated = await executeAssignOwner(app.prisma, {
        id,
        newOwnerUserId: body.ownerUserId,
        reason: body.reason,
        actor,
      });

      return reply.send(updated);
    }
  );

  // POST /api/pipeline/opportunities/:id/next-action
  app.post(
    '/api/pipeline/opportunities/:id/next-action',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = nextActionSchema.parse(request.body);
      const actor = getActorFromRequest(request);

      const updated = await executeSetNextAction(app.prisma, {
        id,
        nextActionType: body.nextActionType,
        nextActionDueAt: body.nextActionDueAt ? new Date(body.nextActionDueAt) : null,
        nextActionNote: body.nextActionNote,
        actor,
      });

      return reply.send(updated);
    }
  );

  // POST /api/pipeline/opportunities/:id/log-contact
  app.post(
    '/api/pipeline/opportunities/:id/log-contact',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = logContactSchema.parse(request.body);
      const actor = getActorFromRequest(request);

      const updated = await executeLogContact(app.prisma, {
        id,
        channel: body.channel,
        note: body.note,
        nextActionType: body.nextActionType,
        nextActionDueAt: body.nextActionDueAt ? new Date(body.nextActionDueAt) : null,
        nextActionNote: body.nextActionNote,
        actor,
      });

      return reply.send(updated);
    }
  );

  // POST /api/pipeline/opportunities/:id/close
  app.post(
    '/api/pipeline/opportunities/:id/close',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status: string; reasonCode?: string; comment?: string };
      const actor = getActorFromRequest(request);

      if (body.status === 'WON') {
        closeWonSchema.parse(body);
        const updated = await executeCloseWon(app.prisma, { id, actor });
        return reply.send(updated);
      } else if (body.status === 'LOST') {
        const lostBody = closeLostSchema.parse(body);
        const updated = await executeCloseLost(app.prisma, {
          id,
          reasonCode: lostBody.reasonCode,
          comment: lostBody.comment,
          actor,
        });
        return reply.send(updated);
      } else {
        return reply.code(400).send({ error: 'Status musi mieć wartość WON lub LOST' });
      }
    }
  );
}
