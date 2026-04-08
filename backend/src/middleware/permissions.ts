/**
 * Multi-tenant Permission Engine
 *
 * Central authorization module that replaces the legacy `authorizeRoles`.
 * Provides scope-aware permissions based on Membership records.
 */

import { FastifyReply, FastifyRequest } from 'fastify';
import { MemberRole, ScopeType } from '@prisma/client';

// ==========================================
// Types
// ==========================================

export interface ActiveContext {
    scopeType: ScopeType;
    scopeId: string;
}

export interface MembershipInfo {
    id: string;
    scopeType: ScopeType;
    scopeId: string;
    role: MemberRole;
    isDefaultContext: boolean;
}

export type Permission =
    // Platform settings
    | 'platform:settings:read'
    | 'platform:settings:write'
    // Dealer groups
    | 'dealer_groups:read'
    | 'dealer_groups:write'
    // Dealers
    | 'dealers:read'
    | 'dealers:write'
    // Users / memberships
    | 'users:read'
    | 'users:write'
    // Stock (listings)
    | 'stock:read'
    | 'stock:write'
    | 'stock:import'
    // Leads
    | 'leads:read'
    | 'leads:write'
    // Context switching
    | 'context:switch';

// ==========================================
// Role → Permission matrix
// ==========================================

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
    SUPERADMIN_PLATFORM: [
        'platform:settings:read', 'platform:settings:write',
        'dealer_groups:read', 'dealer_groups:write',
        'dealers:read', 'dealers:write',
        'users:read', 'users:write',
        'stock:read', 'stock:write', 'stock:import',
        'leads:read', 'leads:write',
        'context:switch',
    ],
    PLATFORM_MANAGER: [
        'dealer_groups:read', 'dealer_groups:write',
        'dealers:read', 'dealers:write',
        'users:read', 'users:write',
        'stock:read', 'stock:write', 'stock:import',
        'leads:read', 'leads:write',
        'context:switch',
    ],
    DEALER_GROUP_ADMIN: [
        'dealer_groups:read',  // read own group only
        'dealers:read', 'dealers:write',  // within own group
        'users:read', 'users:write',      // within own group
        'stock:read', 'stock:write', 'stock:import',
        'leads:read', 'leads:write',
    ],
    DEALER_ADMIN: [
        'dealers:read',        // read own dealer only
        'users:read', 'users:write',  // within own dealer
        'stock:read', 'stock:write', 'stock:import',
        'leads:read', 'leads:write',
    ],
    DEALER_EMPLOYEE: [
        'stock:read', 'stock:write', 'stock:import',
        'leads:read',
    ],
};

// Roles that operate at platform level (all contexts)
const PLATFORM_ROLES = new Set<MemberRole>([
    MemberRole.SUPERADMIN_PLATFORM,
    MemberRole.PLATFORM_MANAGER,
]);

// ==========================================
// Core permission check
// ==========================================

/**
 * Check if a given role has a specific permission
 */
export function roleHasPermission(role: MemberRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get the effective role for a user's active context from their memberships.
 * Returns the highest-privilege role matching the active context.
 */
export function getEffectiveRole(
    memberships: MembershipInfo[],
    activeContext: ActiveContext
): MemberRole | null {
    // Priority order (highest first)
    const rolePriority: MemberRole[] = [
        MemberRole.SUPERADMIN_PLATFORM,
        MemberRole.PLATFORM_MANAGER,
        MemberRole.DEALER_GROUP_ADMIN,
        MemberRole.DEALER_ADMIN,
        MemberRole.DEALER_EMPLOYEE,
    ];

    const matchingMemberships = memberships.filter(m => {
        // Platform-level memberships always match any context
        if (m.scopeType === ScopeType.PLATFORM && m.scopeId === 'PLATFORM') {
            return true;
        }
        // Exact scope match
        if (m.scopeType === activeContext.scopeType && m.scopeId === activeContext.scopeId) {
            return true;
        }
        // Group-level membership matches dealer context if dealer belongs to group
        // (this must be resolved externally via DB lookup — handled in middleware)
        return false;
    });

    const roles = new Set(matchingMemberships.map(m => m.role));

    for (const role of rolePriority) {
        if (roles.has(role)) return role;
    }

    return null;
}

/**
 * Check if a user has a specific permission in the given context
 */
export function hasPermission(
    memberships: MembershipInfo[],
    activeContext: ActiveContext,
    permission: Permission
): boolean {
    const effectiveRole = getEffectiveRole(memberships, activeContext);
    if (!effectiveRole) return false;
    return roleHasPermission(effectiveRole, permission);
}

// ==========================================
// Middleware
// ==========================================

/**
 * Fastify preHandler middleware that checks if the authenticated user
 * has a specific permission in their active context.
 *
 * Usage:
 *   fastify.get('/api/resource', {
 *       preHandler: [fastify.authenticate, requirePermission('stock:read')]
 *   }, handler);
 */
export function requirePermission(permission: Permission) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const user = request.user as any;
        if (!user?.userId) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        // Check memberships from JWT or DB
        const memberships: MembershipInfo[] = user.memberships || [];
        const activeContext: ActiveContext = user.activeContext || {
            scopeType: ScopeType.PLATFORM,
            scopeId: 'PLATFORM',
        };

        // Fallback to legacy role if no memberships (backward compat)
        if (memberships.length === 0 && user.role) {
            const legacyRole = legacyRoleToMemberRole(user.role);
            if (legacyRole && roleHasPermission(legacyRole, permission)) {
                return; // allowed
            }
        }

        if (!hasPermission(memberships, activeContext, permission)) {
            return reply.code(403).send({
                error: 'Forbidden',
                message: `Missing permission: ${permission}`,
            });
        }
    };
}

/**
 * Map legacy string role to MemberRole enum (backward compat)
 */
function legacyRoleToMemberRole(role: string): MemberRole | null {
    switch (role) {
        case 'admin': return MemberRole.SUPERADMIN_PLATFORM;
        case 'manager': return MemberRole.PLATFORM_MANAGER;
        default: return null;
    }
}

// ==========================================
// Scope filter helpers (Prisma where clause)
// ==========================================

export interface ScopeFilter {
    dealerId?: string | { in: string[] };
}

/**
 * Build a Prisma `where` filter that restricts data to the user's active scope.
 * 
 * - Platform roles (superadmin, manager): no filter (see all)
 * - Group admin: filter by dealerIds within the group
 * - Dealer admin/employee: filter by single dealerId
 * 
 * @param memberships User's memberships
 * @param activeContext Current active context
 * @param dealerIdsInGroup Pre-resolved dealer IDs for group scope (pass from DB)
 * @returns Prisma where clause fragment for `dealerId`
 */
export function buildScopeFilter(
    memberships: MembershipInfo[],
    activeContext: ActiveContext,
    dealerIdsInGroup?: string[]
): ScopeFilter {
    const effectiveRole = getEffectiveRole(memberships, activeContext);

    // Platform roles see everything
    if (effectiveRole && PLATFORM_ROLES.has(effectiveRole)) {
        // If they've explicitly selected a context, filter accordingly
        if (activeContext.scopeType === ScopeType.DEALER) {
            return { dealerId: activeContext.scopeId };
        }
        if (activeContext.scopeType === ScopeType.DEALER_GROUP && dealerIdsInGroup) {
            return { dealerId: { in: dealerIdsInGroup } };
        }
        return {}; // no filter — see all
    }

    // Group admin
    if (effectiveRole === MemberRole.DEALER_GROUP_ADMIN) {
        if (dealerIdsInGroup && dealerIdsInGroup.length > 0) {
            return { dealerId: { in: dealerIdsInGroup } };
        }
        return { dealerId: '__none__' }; // safety: don't leak data if no dealers resolved
    }

    // Dealer admin or employee
    if (
        effectiveRole === MemberRole.DEALER_ADMIN ||
        effectiveRole === MemberRole.DEALER_EMPLOYEE
    ) {
        return { dealerId: activeContext.scopeId };
    }

    // No role → see nothing
    return { dealerId: '__none__' };
}

/**
 * Check if the user's effective role is a platform-level role
 */
export function isPlatformRole(memberships: MembershipInfo[], activeContext: ActiveContext): boolean {
    const role = getEffectiveRole(memberships, activeContext);
    return role !== null && PLATFORM_ROLES.has(role);
}

/**
 * Get all dealer IDs the user has access to based on their memberships.
 * This is used for data isolation queries.
 */
export function getAccessibleDealerIds(memberships: MembershipInfo[]): {
    isUnrestricted: boolean;
    dealerIds: string[];
    groupIds: string[];
} {
    const isPlatform = memberships.some(m =>
        m.scopeType === ScopeType.PLATFORM && PLATFORM_ROLES.has(m.role)
    );

    if (isPlatform) {
        return { isUnrestricted: true, dealerIds: [], groupIds: [] };
    }

    const dealerIds = memberships
        .filter(m => m.scopeType === ScopeType.DEALER)
        .map(m => m.scopeId);

    const groupIds = memberships
        .filter(m => m.scopeType === ScopeType.DEALER_GROUP)
        .map(m => m.scopeId);

    return { isUnrestricted: false, dealerIds, groupIds };
}
