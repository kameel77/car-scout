import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('Auth & User Creation / Login Integration Tests', () => {
    let app: FastifyInstance;
    let adminToken: string;
    const testEmailsToCleanup: string[] = [];

    beforeAll(async () => {
        app = await buildApp();
        await app.ready();

        adminToken = app.jwt.sign({
            userId: 'admin-test-user-id',
            email: 'admin@motolia.pl',
            role: 'admin',
            memberships: [
                { id: 'm-admin', scopeType: 'PLATFORM', scopeId: 'PLATFORM', role: 'SUPERADMIN_PLATFORM', isDefaultContext: true }
            ],
            activeContext: { scopeType: 'PLATFORM', scopeId: 'PLATFORM' }
        });
    });

    afterAll(async () => {
        if (testEmailsToCleanup.length > 0) {
            await app.prisma.user.deleteMany({
                where: {
                    email: { in: testEmailsToCleanup }
                }
            });
        }
        await app.close();
    });

    it('creates a user with mixed-case email and whitespace, then logs in with lowercase trimmed email', async () => {
        const rawEmail = '  Jan.Nowak.Test@Motolia.PL  ';
        const normalizedEmail = 'jan.nowak.test@motolia.pl';
        const password = 'SuperSecretPassword123!';
        testEmailsToCleanup.push(normalizedEmail);

        // 1. Create user via POST /api/users
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/users',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                email: rawEmail,
                name: ' Jan Nowak ',
                password: password,
                membershipScopeType: 'PLATFORM',
                membershipScopeId: 'PLATFORM',
                membershipRole: 'SUPERADMIN_PLATFORM'
            }
        });

        expect(createRes.statusCode).toBe(200);
        const createdUser = createRes.json().user;
        expect(createdUser.email).toBe(normalizedEmail);
        expect(createdUser.name).toBe('Jan Nowak');
        expect(createdUser.isActive).toBe(true);

        // 2. Login with lowercase email
        const loginRes1 = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: 'jan.nowak.test@motolia.pl',
                password: password
            }
        });

        expect(loginRes1.statusCode).toBe(200);
        expect(loginRes1.json().token).toBeDefined();
        expect(loginRes1.json().user.email).toBe(normalizedEmail);

        // 3. Login with mixed case + whitespace
        const loginRes2 = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: '  JAN.NOWAK.TEST@MOTOLIA.PL ',
                password: password
            }
        });

        expect(loginRes2.statusCode).toBe(200);
        expect(loginRes2.json().token).toBeDefined();

        // 4. Login with wrong password
        const loginResWrongPass = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: normalizedEmail,
                password: 'WrongPassword!'
            }
        });

        expect(loginResWrongPass.statusCode).toBe(401);
        expect(loginResWrongPass.json().error).toBe('Invalid credentials');
    });

    it('rejects duplicate user creation with different casing', async () => {
        const email = 'duplicate.test@motolia.pl';
        testEmailsToCleanup.push(email);

        // Create first
        const res1 = await app.inject({
            method: 'POST',
            url: '/api/users',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                email: email,
                password: 'Password123!',
                membershipScopeType: 'PLATFORM',
                membershipScopeId: 'PLATFORM',
                membershipRole: 'PLATFORM_MANAGER'
            }
        });
        expect(res1.statusCode).toBe(200);

        // Create duplicate with uppercase
        const res2 = await app.inject({
            method: 'POST',
            url: '/api/users',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                email: 'DUPLICATE.TEST@MOTOLIA.PL',
                password: 'Password123!',
                membershipScopeType: 'PLATFORM',
                membershipScopeId: 'PLATFORM',
                membershipRole: 'PLATFORM_MANAGER'
            }
        });
        expect(res2.statusCode).toBe(409);
        expect(res2.json().error).toBe('Email already exists');
    });

    it('returns 403 when inactive user attempts to log in', async () => {
        const email = 'inactive.user@motolia.pl';
        const password = 'Password123!';
        testEmailsToCleanup.push(email);

        // Create user
        const createRes = await app.inject({
            method: 'POST',
            url: '/api/users',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                email: email,
                password: password,
                membershipScopeType: 'PLATFORM',
                membershipScopeId: 'PLATFORM',
                membershipRole: 'PLATFORM_MANAGER',
                isActive: false
            }
        });
        expect(createRes.statusCode).toBe(200);

        // Attempt login
        const loginRes = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: email,
                password: password
            }
        });

        expect(loginRes.statusCode).toBe(403);
        expect(loginRes.json().error).toContain('nieaktywne');
    });

    it('allows updating user password and logging in with the new password', async () => {
        const email = 'update.pass.test@motolia.pl';
        const initialPassword = 'InitialPassword123!';
        const newPassword = 'NewPassword456!';
        testEmailsToCleanup.push(email);

        const createRes = await app.inject({
            method: 'POST',
            url: '/api/users',
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                email: email,
                password: initialPassword,
                membershipScopeType: 'PLATFORM',
                membershipScopeId: 'PLATFORM',
                membershipRole: 'PLATFORM_MANAGER'
            }
        });
        expect(createRes.statusCode).toBe(200);
        const userId = createRes.json().user.id;

        // Update password via PATCH /api/users/:id
        const patchRes = await app.inject({
            method: 'PATCH',
            url: `/api/users/${userId}`,
            headers: { authorization: `Bearer ${adminToken}` },
            payload: {
                password: newPassword
            }
        });
        expect(patchRes.statusCode).toBe(200);

        // Old password should fail
        const loginOldRes = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: email,
                password: initialPassword
            }
        });
        expect(loginOldRes.statusCode).toBe(401);

        // New password should succeed
        const loginNewRes = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: email,
                password: newPassword
            }
        });
        expect(loginNewRes.statusCode).toBe(200);
        expect(loginNewRes.json().token).toBeDefined();
    });
});
