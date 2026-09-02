import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { ScopeType, MemberRole } from '@prisma/client';
import { registerPipelineModule } from '../index.js';
import { getPipelineScope, TenantScopeForbiddenError } from '../routes/scope-helper.js';

describe('Tenant Scope Isolation & Fail-Closed Authorization', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(fastifyJwt, {
      secret: 'test-secret-key-for-pipeline-auth-tests',
    });

    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });

    // Mock prisma on app
    app.decorate('prisma', {
      pipelineOpportunity: {
        findMany: () => Promise.resolve([]),
        count: () => Promise.resolve(0),
      },
      lead: {
        findMany: () => Promise.resolve([]),
        count: () => Promise.resolve(0),
      },
    } as any);

    await registerPipelineModule(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Unit: getPipelineScope', () => {
    it('throws 403 TenantScopeForbiddenError when request has no user or no activeContext', () => {
      const mockReqEmpty = { user: undefined, server: {} } as any;
      expect(() => getPipelineScope(mockReqEmpty)).toThrow(TenantScopeForbiddenError);

      const mockReqNoCtx = { user: { userId: 'u1' }, server: {} } as any;
      expect(() => getPipelineScope(mockReqNoCtx)).toThrow(TenantScopeForbiddenError);
    });

    it('throws 403 TenantScopeForbiddenError when activeContext is partially incomplete', () => {
      const mockReqNoId = {
        user: { userId: 'u1', activeContext: { scopeType: ScopeType.DEALER } },
        server: {},
      } as any;
      expect(() => getPipelineScope(mockReqNoId)).toThrow(TenantScopeForbiddenError);

      const mockReqNoType = {
        user: { userId: 'u1', activeContext: { scopeId: 'dealer_1' } },
        server: {},
      } as any;
      expect(() => getPipelineScope(mockReqNoType)).toThrow(TenantScopeForbiddenError);
    });

    it('returns exact scope when activeContext is valid and never falls open to PLATFORM', () => {
      const mockReqDealer = {
        user: {
          userId: 'u1',
          activeContext: { scopeType: ScopeType.DEALER, scopeId: 'dealer_123' },
        },
        server: {},
      } as any;

      const scope = getPipelineScope(mockReqDealer);
      expect(scope).toEqual({
        scopeType: ScopeType.DEALER,
        scopeId: 'dealer_123',
      });
    });
  });

  describe('Integration HTTP: Request without activeContext', () => {
    it('returns HTTP 403 Forbidden on /api/pipeline/queue when token lacks activeContext', async () => {
      // Token minted without activeContext (e.g. legacy token, missing scope)
      const tokenWithoutContext = app.jwt.sign({
        userId: 'test-user-1',
        email: 'user@example.com',
        role: 'admin',
        memberships: [],
        // activeContext intentionally missing
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/queue',
        headers: {
          authorization: `Bearer ${tokenWithoutContext}`,
        },
      });

      // Must be 403 Forbidden, NEVER 200 with platform data!
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.message).toMatch(/Brak aktywnego kontekstu organizacji|Forbidden/i);
    });

    it('returns HTTP 403 Forbidden on /api/pipeline/opportunities when token lacks activeContext', async () => {
      const tokenWithoutContext = app.jwt.sign({
        userId: 'test-user-1',
        email: 'user@example.com',
        role: 'admin',
        memberships: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/opportunities',
        headers: {
          authorization: `Bearer ${tokenWithoutContext}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns HTTP 200 when token carries valid activeContext', async () => {
      const tokenWithContext = app.jwt.sign({
        userId: 'test-user-1',
        email: 'user@example.com',
        role: 'admin',
        activeContext: {
          scopeType: 'PLATFORM',
          scopeId: 'PLATFORM',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/queue',
        headers: {
          authorization: `Bearer ${tokenWithContext}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('counts');
    });
  });
});
