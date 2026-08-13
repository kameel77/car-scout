import { FastifyReply, FastifyRequest } from 'fastify';
import { MemberRole } from '@prisma/client';
import { isPlatformRole, getEffectiveRole, ActiveContext, MembershipInfo } from './permissions.js';

export function authorizeRoles(roles: string[]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const role = (request.user as any)?.role;
        if (!role || !roles.includes(role)) {
            return reply.code(403).send({ error: 'Forbidden' });
        }
    };
}

/**
 * The legacy `request.user.role` field is NOT a valid authorization source: it only ever
 * distinguishes SUPERADMIN_PLATFORM ('admin') from everyone else ('manager') — see
 * users.ts, where every DEALER_GROUP_ADMIN, DEALER_ADMIN and DEALER_EMPLOYEE is stamped
 * with role: 'manager'. Checking it here would let any authenticated user (including a
 * dealer employee pinned to a single dealer) through. The real role is derived from the
 * user's Membership records for their active context — see permissions.ts.
 *
 * Assumes `fastify.authenticate` already ran as an earlier preHandler.
 */
export function requirePlatformRole(opts?: { superadminOnly?: boolean }) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
        const user = request.user as any;
        const memberships: MembershipInfo[] = user?.memberships || [];
        const activeContext: ActiveContext = user?.activeContext || {
            scopeType: 'PLATFORM' as any,
            scopeId: 'PLATFORM',
        };

        const forbidden = () =>
            reply.code(403).send({ error: 'Forbidden', message: 'Platform role required' });

        if (opts?.superadminOnly) {
            const effectiveRole = getEffectiveRole(memberships, activeContext);
            if (effectiveRole !== MemberRole.SUPERADMIN_PLATFORM) {
                return forbidden();
            }
            return;
        }

        if (!isPlatformRole(memberships, activeContext)) {
            return forbidden();
        }
    };
}
