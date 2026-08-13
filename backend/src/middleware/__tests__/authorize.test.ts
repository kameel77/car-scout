import { describe, it, expect } from 'vitest';
import { requirePlatformRole } from '../authorize.js';

// Prisma client is not generated in this environment, so `MemberRole`/`ScopeType` can't be
// imported from '@prisma/client'. Using the schema's string literal values directly instead
// (see backend/prisma/schema.prisma: enum MemberRole / enum ScopeType).
const MemberRole = {
    SUPERADMIN_PLATFORM: 'SUPERADMIN_PLATFORM',
    PLATFORM_MANAGER: 'PLATFORM_MANAGER',
    DEALER_GROUP_ADMIN: 'DEALER_GROUP_ADMIN',
    DEALER_ADMIN: 'DEALER_ADMIN',
    DEALER_EMPLOYEE: 'DEALER_EMPLOYEE',
} as const;

const ScopeType = {
    PLATFORM: 'PLATFORM',
    DEALER_GROUP: 'DEALER_GROUP',
    DEALER: 'DEALER',
} as const;

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

describe('requirePlatformRole', () => {
    it('rejects a DEALER_EMPLOYEE membership with 403', async () => {
        const request = fakeRequest({
            userId: 'u1',
            memberships: [
                { id: 'm1', scopeType: ScopeType.DEALER, scopeId: 'dealer-1', role: MemberRole.DEALER_EMPLOYEE, isDefaultContext: true },
            ],
            activeContext: { scopeType: ScopeType.DEALER, scopeId: 'dealer-1' },
        });
        const reply = fakeReply();

        await requirePlatformRole()(request, reply);

        expect(reply.statusCode).toBe(403);
        expect(reply.body).toEqual({ error: 'Forbidden', message: 'Platform role required' });
    });

    it('allows a PLATFORM_MANAGER membership', async () => {
        const request = fakeRequest({
            userId: 'u2',
            memberships: [
                { id: 'm2', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.PLATFORM_MANAGER, isDefaultContext: true },
            ],
            activeContext: { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        });
        const reply = fakeReply();

        await requirePlatformRole()(request, reply);

        expect(reply.statusCode).toBeUndefined();
        expect(reply.body).toBeUndefined();
    });

    it('rejects a PLATFORM_MANAGER when superadminOnly is set', async () => {
        const request = fakeRequest({
            userId: 'u3',
            memberships: [
                { id: 'm3', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.PLATFORM_MANAGER, isDefaultContext: true },
            ],
            activeContext: { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        });
        const reply = fakeReply();

        await requirePlatformRole({ superadminOnly: true })(request, reply);

        expect(reply.statusCode).toBe(403);
        expect(reply.body).toEqual({ error: 'Forbidden', message: 'Platform role required' });
    });

    it('allows a SUPERADMIN_PLATFORM membership both with and without superadminOnly', async () => {
        const request = fakeRequest({
            userId: 'u4',
            memberships: [
                { id: 'm4', scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM', role: MemberRole.SUPERADMIN_PLATFORM, isDefaultContext: true },
            ],
            activeContext: { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        });

        const replyDefault = fakeReply();
        await requirePlatformRole()(request, replyDefault);
        expect(replyDefault.statusCode).toBeUndefined();

        const replySuperadminOnly = fakeReply();
        await requirePlatformRole({ superadminOnly: true })(request, replySuperadminOnly);
        expect(replySuperadminOnly.statusCode).toBeUndefined();
    });

    it('rejects a token carrying only the legacy role field and no memberships', async () => {
        const request = fakeRequest({
            userId: 'u5',
            role: 'admin',
        });
        const reply = fakeReply();

        await requirePlatformRole()(request, reply);

        expect(reply.statusCode).toBe(403);
        expect(reply.body).toEqual({ error: 'Forbidden', message: 'Platform role required' });
    });
});
