import { FastifyRequest } from 'fastify';
import { ScopeType } from '@prisma/client';
import { PLATFORM_SCOPE } from '../events/record-event.js';

/**
 * Resolves the authenticated user's active tenant scope.
 *
 * CRITICAL TENANT ISOLATION RULE:
 * Scope is NEVER read from request.body, request.query, or request.params.
 * It is derived exclusively from the verified activeContext in the user's JWT session.
 */
export function getPipelineScope(request: FastifyRequest): { scopeType: ScopeType; scopeId: string } {
  const user = request.user as {
    activeContext?: {
      scopeType?: ScopeType;
      scopeId?: string;
    };
  } | undefined;

  if (user?.activeContext?.scopeType && user?.activeContext?.scopeId) {
    return {
      scopeType: user.activeContext.scopeType,
      scopeId: user.activeContext.scopeId,
    };
  }

  return PLATFORM_SCOPE;
}

export function getActorFromRequest(request: FastifyRequest) {
  const user = request.user as {
    userId?: string;
    email?: string;
    name?: string;
  } | undefined;

  return {
    type: 'USER' as const,
    userId: user?.userId ?? null,
    label: user?.name || user?.email || 'Doradca',
  };
}
