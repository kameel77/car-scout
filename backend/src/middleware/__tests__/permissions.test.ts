import { describe, it, expect } from 'vitest';
import { MemberRole, ScopeType } from '@prisma/client';
import {
    ROLE_PERMISSIONS,
    getEffectivePermissions,
    hasPermission,
    isPlatformRole,
    requirePermission,
    Permission,
    ActiveContext,
    MembershipInfo,
} from '../permissions.js';

function fakeReply() {
    const reply: any = {
        statusCode: undefined as number | undefined,
        body: undefined as any,
        code(code: number) {
            reply.statusCode = code;
            return reply;
        },
        send(body: any) {
            reply.body = body;
            return reply;
        },
    };
    return reply;
}

function fakeRequest(user: any) {
    return { user } as any;
}

describe('Permissions Matrix & Engine', () => {
    const platformCtx: ActiveContext = { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' };
    const dealerGroupCtx: ActiveContext = { scopeType: ScopeType.DEALER_GROUP, scopeId: 'group-1' };
    const dealerCtx: ActiveContext = { scopeType: ScopeType.DEALER, scopeId: 'dealer-1' };

    describe('ROLE_PERMISSIONS Matrix', () => {
        it('SUPERADMIN_PLATFORM has all 21 permissions', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.SUPERADMIN_PLATFORM];
            expect(perms.length).toBe(21);
            expect(perms).toContain('platform:settings:read');
            expect(perms).toContain('platform:settings:write');
            expect(perms).toContain('dealer_groups:read');
            expect(perms).toContain('dealer_groups:write');
            expect(perms).toContain('dealers:read');
            expect(perms).toContain('dealers:write');
            expect(perms).toContain('users:read');
            expect(perms).toContain('users:write');
            expect(perms).toContain('stock:read');
            expect(perms).toContain('stock:write');
            expect(perms).toContain('stock:import');
            expect(perms).toContain('stock:sources:write');
            expect(perms).toContain('rental:read');
            expect(perms).toContain('rental:write');
            expect(perms).toContain('rental:config:write');
            expect(perms).toContain('leads:read');
            expect(perms).toContain('leads:write');
            expect(perms).toContain('analytics:read');
            expect(perms).toContain('content:read');
            expect(perms).toContain('content:write');
            expect(perms).toContain('context:switch');
        });

        it('PLATFORM_MANAGER has operational permissions (15 permissions) but NO content:write, users, settings', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.PLATFORM_MANAGER];
            expect(perms.length).toBe(15);
            expect(perms).toContain('dealer_groups:read');
            expect(perms).toContain('dealer_groups:write');
            expect(perms).toContain('dealers:read');
            expect(perms).toContain('dealers:write');
            expect(perms).toContain('stock:read');
            expect(perms).toContain('stock:write');
            expect(perms).toContain('stock:import');
            expect(perms).toContain('stock:sources:write');
            expect(perms).toContain('rental:read');
            expect(perms).toContain('rental:write');
            expect(perms).toContain('rental:config:write');
            expect(perms).toContain('leads:read');
            expect(perms).toContain('leads:write');
            expect(perms).toContain('analytics:read');
            expect(perms).toContain('context:switch');

            // Must NOT have:
            expect(perms).not.toContain('content:read');
            expect(perms).not.toContain('content:write');
            expect(perms).not.toContain('users:read');
            expect(perms).not.toContain('users:write');
            expect(perms).not.toContain('platform:settings:read');
            expect(perms).not.toContain('platform:settings:write');
        });

        it('CONTENT_MANAGER_PLATFORM has only content:read and content:write', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.CONTENT_MANAGER_PLATFORM];
            expect(perms.length).toBe(2);
            expect(perms).toEqual(['content:read', 'content:write']);

            // Must NOT have fleet or settings:
            expect(perms).not.toContain('stock:read');
            expect(perms).not.toContain('stock:write');
            expect(perms).not.toContain('stock:import');
            expect(perms).not.toContain('rental:read');
            expect(perms).not.toContain('rental:write');
            expect(perms).not.toContain('rental:config:write');
            expect(perms).not.toContain('leads:read');
            expect(perms).not.toContain('leads:write');
            expect(perms).not.toContain('analytics:read');
            expect(perms).not.toContain('users:read');
            expect(perms).not.toContain('users:write');
            expect(perms).not.toContain('platform:settings:read');
            expect(perms).not.toContain('platform:settings:write');
        });

        it('DEALER_GROUP_ADMIN has group-level permissions', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.DEALER_GROUP_ADMIN];
            expect(perms.length).toBe(12);
            expect(perms).toContain('dealer_groups:read');
            expect(perms).toContain('dealers:read');
            expect(perms).toContain('dealers:write');
            expect(perms).toContain('users:read');
            expect(perms).toContain('users:write');
            expect(perms).toContain('stock:read');
            expect(perms).toContain('stock:write');
            expect(perms).toContain('stock:import');
            expect(perms).toContain('rental:read');
            expect(perms).toContain('rental:write');
            expect(perms).toContain('leads:read');
            expect(perms).toContain('leads:write');

            expect(perms).not.toContain('analytics:read');
            expect(perms).not.toContain('content:write');
            expect(perms).not.toContain('platform:settings:write');
        });

        it('DEALER_ADMIN has dealer-level admin permissions', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.DEALER_ADMIN];
            expect(perms.length).toBe(10);
            expect(perms).toContain('dealers:read');
            expect(perms).toContain('users:read');
            expect(perms).toContain('users:write');
            expect(perms).toContain('stock:read');
            expect(perms).toContain('stock:write');
            expect(perms).toContain('stock:import');
            expect(perms).toContain('rental:read');
            expect(perms).toContain('rental:write');
            expect(perms).toContain('leads:read');
            expect(perms).toContain('leads:write');

            expect(perms).not.toContain('analytics:read');
            expect(perms).not.toContain('content:write');
        });

        it('DEALER_EMPLOYEE has restricted dealer operations', () => {
            const perms = ROLE_PERMISSIONS[MemberRole.DEALER_EMPLOYEE];
            expect(perms.length).toBe(6);
            expect(perms).toContain('stock:read');
            expect(perms).toContain('stock:write');
            expect(perms).toContain('stock:import');
            expect(perms).toContain('rental:read');
            expect(perms).toContain('rental:write');
            expect(perms).toContain('leads:read');

            expect(perms).not.toContain('leads:write');
            expect(perms).not.toContain('rental:config:write');
            expect(perms).not.toContain('users:read');
            expect(perms).not.toContain('users:write');
            expect(perms).not.toContain('content:write');
            expect(perms).not.toContain('analytics:read');
        });
    });

    describe('getEffectivePermissions (Union of multi-memberships)', () => {
        it('returns union of permissions when user has multiple matching memberships', () => {
            const memberships: MembershipInfo[] = [
                {
                    id: 'm1',
                    scopeType: ScopeType.DEALER,
                    scopeId: 'dealer-1',
                    role: MemberRole.DEALER_EMPLOYEE,
                    isDefaultContext: true,
                },
                {
                    id: 'm2',
                    scopeType: ScopeType.PLATFORM,
                    scopeId: 'PLATFORM',
                    role: MemberRole.CONTENT_MANAGER_PLATFORM,
                    isDefaultContext: false,
                },
            ];

            // In dealer-1 context, gets DEALER_EMPLOYEE + PLATFORM membership union
            const effective = getEffectivePermissions(memberships, dealerCtx);
            expect(effective.has('stock:write')).toBe(true); // from DEALER_EMPLOYEE
            expect(effective.has('content:write')).toBe(true); // from CONTENT_MANAGER_PLATFORM
            expect(effective.has('platform:settings:write')).toBe(false); // neither has it
        });
    });

    describe('isPlatformRole (Dealer Isolation Check)', () => {
        it('returns true for SUPERADMIN_PLATFORM and PLATFORM_MANAGER', () => {
            const saMemberships: MembershipInfo[] = [
                { id: '1', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.SUPERADMIN_PLATFORM, isDefaultContext: true }
            ];
            expect(isPlatformRole(saMemberships, platformCtx)).toBe(true);

            const pmMemberships: MembershipInfo[] = [
                { id: '2', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.PLATFORM_MANAGER, isDefaultContext: true }
            ];
            expect(isPlatformRole(pmMemberships, platformCtx)).toBe(true);
        });

        it('returns false for CONTENT_MANAGER_PLATFORM to preserve dealer isolation', () => {
            const cmMemberships: MembershipInfo[] = [
                { id: '3', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.CONTENT_MANAGER_PLATFORM, isDefaultContext: true }
            ];
            expect(isPlatformRole(cmMemberships, platformCtx)).toBe(false);
        });
    });

    describe('requirePermission Fastify Middleware', () => {
        it('allows access when user has permission', async () => {
            const request = fakeRequest({
                userId: 'cm-1',
                memberships: [
                    { id: 'm1', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.CONTENT_MANAGER_PLATFORM, isDefaultContext: true }
                ],
                activeContext: platformCtx,
            });
            const reply = fakeReply();

            await requirePermission('content:write')(request, reply);

            expect(reply.statusCode).toBeUndefined();
            expect(reply.body).toBeUndefined();
        });

        it('rejects with 403 when user lacks permission', async () => {
            const request = fakeRequest({
                userId: 'cm-1',
                memberships: [
                    { id: 'm1', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.CONTENT_MANAGER_PLATFORM, isDefaultContext: true }
                ],
                activeContext: platformCtx,
            });
            const reply = fakeReply();

            await requirePermission('stock:write')(request, reply);

            expect(reply.statusCode).toBe(403);
            expect(reply.body).toEqual({ error: 'Forbidden', message: 'Missing permission: stock:write' });
        });
    });
});
