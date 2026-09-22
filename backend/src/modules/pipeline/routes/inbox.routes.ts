import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { qualifyLeadSchema, dismissLeadSchema, inboxQuerySchema } from '../schemas/pipeline.schemas.js';
import { listInboxLeads, executeQualifyLead, executeDismissLeadAsSpam } from '../services/inbox.service.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';

export async function registerInboxRoutes(app: FastifyInstance) {
  // GET /api/pipeline/inbox
  app.get(
    '/api/pipeline/inbox',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:read')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const query = inboxQuerySchema.parse(request.query ?? {});

      const result = await listInboxLeads(app.prisma, {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        limit: query.limit,
        offset: query.offset,
        leadType: query.leadType,
      });

      return reply.send(result);
    }
  );

  // POST /api/pipeline/inbox/:leadId/qualify
  app.post(
    '/api/pipeline/inbox/:leadId/qualify',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const { leadId } = request.params as { leadId: string };
      const body = qualifyLeadSchema.parse(request.body ?? {});
      const actor = getActorFromRequest(request);

      const opportunity = await executeQualifyLead(app.prisma, {
        leadId,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        ownerUserId: body.ownerUserId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        companyName: body.companyName,
        companyNip: body.companyNip,
        nextActionType: body.nextActionType,
        nextActionDueAt: body.nextActionDueAt ? new Date(body.nextActionDueAt) : null,
        nextActionNote: body.nextActionNote,
        clientType: body.clientType,
        financingType: body.financingType,
        leadSource: body.leadSource,
        leadSourceDetail: body.leadSourceDetail,
        actor,
      });

      return reply.code(201).send(opportunity);
    }
  );

  // POST /api/pipeline/inbox/:leadId/dismiss
  app.post(
    '/api/pipeline/inbox/:leadId/dismiss',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const { leadId } = request.params as { leadId: string };
      const body = dismissLeadSchema.parse(request.body ?? {});
      const actor = getActorFromRequest(request);

      const closedOpp = await executeDismissLeadAsSpam(app.prisma, {
        leadId,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        comment: body.comment,
        actor,
      });

      return reply.send(closedOpp);
    }
  );
}
