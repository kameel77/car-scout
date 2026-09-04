import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { registerThuliumDeadLetterRoutes } from './thulium-dead-letters.routes.js';

describe('Thulium dead letter review routes', () => {
  let app: ReturnType<typeof Fastify>;
  let prisma: any;

  beforeAll(async () => {
    prisma = {
      pipelineThuliumDeadLetter: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'dl_1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', dismissedAt: null },
        ]),
        count: vi.fn().mockResolvedValue(1),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    app = Fastify({ logger: false });
    await app.register(fastifyJwt, { secret: 'test-secret-key-for-dead-letter-tests' });
    app.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({ error: 'Unauthorized' });
      }
    });
    app.decorate('prisma', prisma);
    await registerThuliumDeadLetterRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(scopeType: string, scopeId: string) {
    return app.jwt.sign({
      userId: 'user_1',
      email: 'doradca@motolia.pl',
      name: 'Doradca Testowy',
      role: 'admin',
      activeContext: { scopeType, scopeId },
    });
  }

  it('lists only undismissed dead letters for the caller scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pipeline/integrations/thulium/unmatched',
      headers: { authorization: `Bearer ${tokenFor('PLATFORM', 'PLATFORM')}` },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.pipelineThuliumDeadLetter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scopeType: 'PLATFORM', scopeId: 'PLATFORM', dismissedAt: null },
        orderBy: { receivedAt: 'desc' },
        take: 50,
      })
    );
    expect(response.json()).toEqual({
      items: [{ id: 'dl_1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', dismissedAt: null }],
      total: 1,
    });
  });

  it('dismiss sets dismissedAt/dismissedUserId and returns {dismissed:true}', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/unmatched/dl_1/dismiss',
      headers: { authorization: `Bearer ${tokenFor('PLATFORM', 'PLATFORM')}` },
    });

    expect(response.statusCode).toBe(200);
    expect(prisma.pipelineThuliumDeadLetter.updateMany).toHaveBeenCalledWith({
      where: { id: 'dl_1', scopeType: 'PLATFORM', scopeId: 'PLATFORM', dismissedAt: null },
      data: { dismissedAt: expect.any(Date), dismissedUserId: 'user_1' },
    });
    expect(response.json()).toEqual({ dismissed: true });
  });

  it('returns 404 when dismissing a row from another scope', async () => {
    prisma.pipelineThuliumDeadLetter.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/unmatched/dl_other_dealer/dismiss',
      headers: { authorization: `Bearer ${tokenFor('DEALER', 'dealer_999')}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when dismissing a non-existent row', async () => {
    prisma.pipelineThuliumDeadLetter.updateMany.mockResolvedValueOnce({ count: 0 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/unmatched/does_not_exist/dismiss',
      headers: { authorization: `Bearer ${tokenFor('PLATFORM', 'PLATFORM')}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
