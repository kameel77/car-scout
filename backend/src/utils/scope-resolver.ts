/**
 * Scope resolution helper for route handlers.
 * 
 * Extracts the user's active context from the JWT token and resolves
 * the appropriate Prisma where-clause filter for data isolation.
 * 
 * Backward-compatible with legacy JWTs that don't contain memberships.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { ScopeType, MemberRole } from '@prisma/client';
import {
    buildScopeFilter,
    getEffectiveRole,
    isPlatformRole,
    getAccessibleDealerIds,
    type MembershipInfo,
    type ActiveContext,
} from '../middleware/permissions.js';

/** Parsed scope info from JWT */
export interface ResolvedScope {
    memberships: MembershipInfo[];
    activeContext: ActiveContext;
    effectiveRole: MemberRole | null;
    isPlatform: boolean;
    accessibleDealerIds: string[];
    /** Prisma where fragment for dealerId filtering */
    dealerFilter: ReturnType<typeof buildScopeFilter>;
}

/**
 * Resolve scope info from request's JWT user.
 * Automatically fetches dealer IDs for group contexts.
 * Falls back to legacy role-based resolution when memberships are absent.
 */
export async function resolveScope(
    fastify: FastifyInstance,
    request: FastifyRequest
): Promise<ResolvedScope> {
    const user = request.user as any;

    let memberships: MembershipInfo[] = (user.memberships || []).map((m: any) => ({
        id: m.id,
        scopeType: m.scopeType as ScopeType,
        scopeId: m.scopeId,
        role: m.role as MemberRole,
        isDefaultContext: m.isDefaultContext,
    }));

    // ── Legacy backward-compat ──
    // If no memberships in JWT (pre-multitenant token), infer from legacy role
    if (memberships.length === 0 && user.role) {
        const legacyRole = user.role as string;
        if (legacyRole === 'admin' || legacyRole === 'superadmin') {
            memberships = [{
                id: 'legacy',
                scopeType: ScopeType.PLATFORM,
                scopeId: 'PLATFORM',
                role: MemberRole.SUPERADMIN_PLATFORM,
                isDefaultContext: true,
            }];
        } else if (legacyRole === 'manager') {
            memberships = [{
                id: 'legacy',
                scopeType: ScopeType.PLATFORM,
                scopeId: 'PLATFORM',
                role: MemberRole.PLATFORM_MANAGER,
                isDefaultContext: true,
            }];
        }
    }

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

    const accessible = getAccessibleDealerIds(memberships);
    let accessibleDealerIds = accessible.dealerIds;
    if (dealerIdsInGroup) {
        accessibleDealerIds = [...new Set([...accessibleDealerIds, ...dealerIdsInGroup])];
    }

    const dealerFilter = buildScopeFilter(memberships, activeContext, dealerIdsInGroup);

    return {
        memberships,
        activeContext,
        effectiveRole,
        isPlatform,
        accessibleDealerIds,
        dealerFilter,
    };
}
