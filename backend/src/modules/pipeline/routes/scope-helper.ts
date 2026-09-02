import { FastifyRequest } from 'fastify';
import { ScopeType, PipelineActorType } from '@prisma/client';

export class TenantScopeForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'Brak aktywnego kontekstu organizacji (active tenant context)') {
    super(message);
    this.name = 'TenantScopeForbiddenError';
  }
}

/**
 * Resolves the authenticated user's active tenant scope.
 *
 * CRITICAL TENANT ISOLATION RULE:
 * Scope is NEVER read from request.body, request.query, or request.params.
 * It is derived exclusively from the verified activeContext in the user's JWT session.
 *
 * If activeContext is missing or invalid, an HTTP 403 Forbidden is thrown.
 * We NEVER fail-open to PLATFORM_SCOPE or any default.
 */
export function getPipelineScope(request: FastifyRequest): { scopeType: ScopeType; scopeId: string } {
  const user = request.user as {
    activeContext?: {
      scopeType?: ScopeType;
      scopeId?: string;
    };
  } | undefined;

  const ctx = user?.activeContext;
  if (!ctx?.scopeType || !ctx?.scopeId) {
    if ((request.server as any).httpErrors?.forbidden) {
      throw (request.server as any).httpErrors.forbidden(
        'Brak aktywnego kontekstu organizacji (active tenant context)'
      );
    }
    throw new TenantScopeForbiddenError();
  }

  return {
    scopeType: ctx.scopeType,
    scopeId: ctx.scopeId,
  };
}

export function getActorFromRequest(request: FastifyRequest) {
  const user = request.user as {
    userId?: string;
    email?: string;
    name?: string;
  } | undefined;

  return {
    type: PipelineActorType.USER,
    userId: user?.userId ?? null,
    label: user?.name || user?.email || 'Doradca',
  };
}
