/**
 * Scope resolution helper for route handlers.
 * 
 * Extracts the user's active context from the JWT token and resolves
 * the appropriate Prisma where-clause filter for data isolation.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { ScopeType, MemberRole } from '@prisma/client';
import {
    buildScopeFilter,
    getEffectiveRole,
    isPlatformRole,
    type MembershipInfo,
    type ActiveContext,
} from '../middleware/permissions.js';

/** Parsed scope info from JWT */
export interface ResolvedScope {
    memberships: MembershipInfo[];
    activeContext: ActiveContext;
    effectiveRole: MemberRole | null;
    isPlatform: boolean;
    /** Prisma where fragment for dealerId filtering */
    dealerFilter: ReturnType<typeof buildScopeFilter>;
}

/**
 * Resolve scope info from request's JWT user.
 * Automatically fetches dealer IDs for group contexts.
 */
export async function resolveScope(
    fastify: FastifyInstance,
    request: FastifyRequest
): Promise<ResolvedScope> {
    const user = request.user as any;

    const memberships: MembershipInfo[] = (user.memberships || []).map((m: any) => ({
        id: m.id,
        scopeType: m.scopeType as ScopeType,
        scopeId: m.scopeId,
        role: m.role as MemberRole,
        isDefaultContext: m.isDefaultContext,
    }));

    const activeContext: ActiveContext = user.activeContext
        ? { scopeType: user.activeContext.scopeType as ScopeType, scopeId: user.activeContext.scopeId }
        : { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' };

    const effectiveRole = getEffectiveRole(memberships, activeContext);
    const isPlatform = isPlatformRole(memberships, activeContext);

    // Resolve dealer IDs for group context
    let dealerIdsInGroup: string[] | undefined;
    if (activeContext.scopeType === ScopeType.DEALER_GROUP) {
        const dealers = await fastify.prisma.dealer.findMany({
            where: { dealerGroupId: activeContext.scopeId },
            select: { id: true },
        });
        dealerIdsInGroup = dealers.map(d => d.id);
    }

    const dealerFilter = buildScopeFilter(memberships, activeContext, dealerIdsInGroup);

    return {
        memberships,
        activeContext,
        effectiveRole,
        isPlatform,
        dealerFilter,
    };
}
