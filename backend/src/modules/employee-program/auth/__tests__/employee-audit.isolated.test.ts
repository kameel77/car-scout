import { it, expect } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { registerEmployeeProgramModule } from '../../index.js';
import { verifySignedCsrfToken, generateSignedCsrfToken } from '../employee-session.helpers.js';

it('logs out inactive users idempotently without masking Redis failure', async () => {
  const app = Fastify();
  await app.register(jwt, { secret: 'isolated-audit-fixture-key' });
  const keys: string[] = [];
  let fail = false;
  app.decorate('redis', { get: async () => '{}', del: async (key: string) => {
    if (fail) throw new Error('fixture redis outage');
    keys.push(key); return keys.length === 1 ? 1 : 0;
  } } as never);
  app.decorate('prisma', { employeeAccount: { findUnique: async () => ({ isActive: false }) } } as never);
  await registerEmployeeProgramModule(app);
  const jti = '12345678-1234-4234-8234-123456789abc';
  const session = app.jwt.sign({ accountId: 'account', email: 'fixture@example.invalid', companyId: 'company', programId: 'program', realm: 'employee', aud: 'employee-portal', jti }, { expiresIn: '1h' });
  const csrf = generateSignedCsrfToken(app.jwt);
  const headers = { host: 'portal.test', origin: 'https://portal.test', 'x-csrf-token': csrf, cookie: `__Host-ep-session=${session}; __Host-ep-csrf=${csrf}` };
  try {
    for (let i = 0; i < 2; i++) {
      const result = await app.inject({ method: 'POST', url: '/api/employee/auth/logout', headers });
      expect(result.statusCode).toBe(200);
      expect(String(result.headers['set-cookie'])).toContain('Max-Age=0');
    }
    expect(keys).toEqual([`ep:session:${jti}`, `ep:session:${jti}`]);
    fail = true;
    const failed = await app.inject({ method: 'POST', url: '/api/employee/auth/logout', headers });
    expect(failed.statusCode).toBe(500);
    expect(failed.headers['set-cookie']).toBeUndefined();
  } finally { await app.close(); }
});

it('encapsulates employee cache and error hooks away from neighboring routes', async () => {
  const app = Fastify();
  await app.register(jwt, { secret: 'isolated-audit-fixture-key' });
  app.setErrorHandler((_error, _request, reply) => reply.code(418).send({ neighbor: true }));
  await registerEmployeeProgramModule(app);
  app.get('/neighbor', async (_, reply) => reply.header('Cache-Control', 'public, max-age=3600').send({ ok: true }));
  app.get('/neighbor-error', async () => { throw new Error('fixture'); });
  try {
    expect((await app.inject('/neighbor')).headers['cache-control']).toBe('public, max-age=3600');
    expect((await app.inject('/neighbor-error')).statusCode).toBe(418);
    expect((await app.inject('/api/employee/auth/csrf')).headers['cache-control']).toContain('no-store');
  } finally { await app.close(); }
});

it('rejects a signed CSRF JWT without expiration', async () => {
  const app = Fastify();
  await app.register(jwt, { secret: 'isolated-audit-fixture-key' });
  try {
    const token = app.jwt.sign({ realm: 'employee-csrf', aud: 'employee-csrf', nonce: 'fixture' });
    expect(verifySignedCsrfToken(token, app.jwt)).toBe(false);
  } finally { await app.close(); }
});
