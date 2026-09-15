import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { verifyEmployeeAuth } from '../employee-auth.middleware.js';

const identity = { accountId: 'account', companyId: 'company', programId: 'program' };

describe('Mandatory employee session expiry', () => {
  for (const kind of ['missing', 'valid'] as const) {
    it(`${kind} expiration`, async () => {
      const app = Fastify();
      await app.register(jwt, { secret: 'isolated-expiry-fixture-signing-key' });
      app.decorate('redis', { get: async () => JSON.stringify(identity) } as never);
      app.decorate('prisma', { employeeAccount: { findUnique: async () => ({
        id: identity.accountId, email: 'fixture@example.invalid', isActive: true,
        membership: { ...identity, isActive: true, revokedAt: null,
          company: { isActive: true }, program: { isActive: true } },
      }) } } as never);
      app.get('/protected', { preHandler: verifyEmployeeAuth }, async () => ({ ok: true }));
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = app.jwt.sign({ ...identity, email: 'fixture@example.invalid',
        realm: 'employee', aud: 'employee-portal', jti: '12345678-1234-4234-8234-123456789abc',
        ...(kind === 'missing' ? {} : { exp: future }),
      });
      try {
        const result = await app.inject({ url: '/protected', headers: { cookie: `__Host-ep-session=${token}` } });
        expect(result.statusCode).toBe(kind === 'valid' ? 200 : 403);
      } finally { await app.close(); }
    });
  }
});
