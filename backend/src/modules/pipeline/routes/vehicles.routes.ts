import { FastifyInstance } from 'fastify';
import { requirePermission } from '../../../middleware/permissions.js';
import { getPipelineScope, getActorFromRequest } from './scope-helper.js';
import {
  executeAddVehicleCandidate,
  executeSelectVehicleCandidate,
  executeRemoveVehicleCandidate,
} from '../services/vehicle.service.js';
import { addVehicleCandidateSchema } from '../schemas/pipeline.schemas.js';

export async function registerVehicleRoutes(app: FastifyInstance) {
  // Add vehicle candidate to opportunity
  app.post(
    '/api/pipeline/opportunities/:id/candidates',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id } = request.params as { id: string };
      const body = addVehicleCandidateSchema.parse(request.body);

      const candidate = await executeAddVehicleCandidate(
        app.prisma,
        scope,
        id,
        body,
        actor
      );

      return reply.code(201).send(candidate);
    }
  );

  // Select vehicle candidate as primary (SELECTED)
  app.post(
    '/api/pipeline/opportunities/:id/candidates/:candidateId/select',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id, candidateId } = request.params as { id: string; candidateId: string };

      const candidate = await executeSelectVehicleCandidate(
        app.prisma,
        scope,
        id,
        candidateId,
        actor
      );

      return reply.send(candidate);
    }
  );

  // Remove vehicle candidate
  app.delete(
    '/api/pipeline/opportunities/:id/candidates/:candidateId',
    {
      preHandler: [app.authenticate, requirePermission('pipeline:write')],
    },
    async (request, reply) => {
      const scope = getPipelineScope(request);
      const actor = getActorFromRequest(request);
      const { id, candidateId } = request.params as { id: string; candidateId: string };

      await executeRemoveVehicleCandidate(
        app.prisma,
        scope,
        id,
        candidateId,
        actor
      );

      return reply.send({ success: true });
    }
  );
}
