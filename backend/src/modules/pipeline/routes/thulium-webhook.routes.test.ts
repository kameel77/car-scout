import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerThuliumWebhookRoutes } from './thulium-webhook.routes.js';

describe('Thulium pipeline webhook route', () => {
  const originalSecret = process.env.THULIUM_WEBHOOK_SECRET;
  let app: ReturnType<typeof Fastify>;
  let tx: any;

  beforeEach(async () => {
    process.env.THULIUM_WEBHOOK_SECRET = 'test-thulium-webhook-secret';
    const opportunity = {
      id: 'opp_982',
      scopeType: 'DEALER',
      scopeId: 'dealer_123',
      thuliumTicketId: null,
      customer: {
        id: 'customer_456',
        phone: '+48123123123',
        thuliumCustomerId: null,
      },
    };
    const event = {
      id: 'event_789',
      type: 'TICKET_LINKED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: 'opp_982',
      payload: { thuliumTicketId: 12345, thuliumCustomerId: 67890 },
    };
    tx = {
      pipelineOpportunity: {
        findFirst: vi.fn().mockResolvedValue(opportunity),
        findMany: vi.fn().mockResolvedValue([opportunity]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ thuliumTicketId: 12345 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pipelineCustomer: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ thuliumCustomerId: 67890 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pipelineEvent: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.id ? event : { id: event.id })
        ),
      },
    };
    app = Fastify({ logger: false });
    app.decorate('prisma', { $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) } as any);
    await app.register(rateLimit, { global: false });
    await registerThuliumWebhookRoutes(app);
  });

  afterEach(async () => {
    await app.close();
    if (originalSecret === undefined) delete process.env.THULIUM_WEBHOOK_SECRET;
    else process.env.THULIUM_WEBHOOK_SECRET = originalSecret;
  });

  function inject(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: { authorization: 'Bearer test-thulium-webhook-secret' },
      payload,
    });
  }

  it('links by phone when Thulium does not know the opportunity ID', async () => {
    const response = await inject({
      event_id: 'event-1',
      event_type: 'TICKET_CREATED',
      customer_phone: '48 123 123 123',
      thulium_ticket_id: 12345,
      thulium_customer_id: 67890,
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineOpportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OPEN', customer: { phone: '+48123123123' } },
        take: 2,
      })
    );
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('accepts an explicit opportunity without a phone', async () => {
    const response = await inject({
      event_id: 'event-2',
      event_type: 'TICKET_CREATED',
      opportunity_id: 'opp_982',
      thulium_ticket_id: 12345,
      thulium_customer_id: 67890,
    });

    expect(response.statusCode).toBe(202);
  });

  it('uses CUSTOMER_UPDATED semantics even when the payload also contains a ticket ID', async () => {
    tx.pipelineEvent.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id
          ? {
              id: 'event_customer',
              type: 'THULIUM_CUSTOMER_LINKED',
              aggregateType: 'CUSTOMER',
              aggregateId: 'customer_456',
              payload: { thuliumCustomerId: 67890 },
            }
          : { id: 'event_customer' }
      )
    );

    const response = await inject({
      event_id: 'event-customer-update',
      event_type: 'CUSTOMER_UPDATED',
      opportunity_id: 'opp_982',
      thulium_ticket_id: 12345,
      thulium_customer_id: 67890,
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
    expect(tx.pipelineCustomer.updateMany).toHaveBeenCalled();
    expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ type: 'THULIUM_CUSTOMER_LINKED' })],
      })
    );
  });

  it('returns 404 when an explicit opportunity phone guard does not match', async () => {
    const response = await inject({
      event_id: 'event-phone-mismatch',
      event_type: 'TICKET_CREATED',
      opportunity_id: 'opp_982',
      customer_phone: '501 222 333',
      thulium_ticket_id: 12345,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Nie znaleziono sprawy opp_982 dla zdarzenia Thulium' });
  });

  it('returns 409 instead of overwriting an existing Thulium identifier', async () => {
    tx.pipelineOpportunity.findFirst.mockResolvedValueOnce({
      id: 'opp_982',
      scopeType: 'DEALER',
      scopeId: 'dealer_123',
      thuliumTicketId: 999,
      customer: {
        id: 'customer_456',
        phone: '+48123123123',
        thuliumCustomerId: null,
      },
    });

    const response = await inject({
      event_id: 'event-conflict',
      event_type: 'TICKET_CREATED',
      opportunity_id: 'opp_982',
      thulium_ticket_id: 12345,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'Sprawa jest już połączona z innym ticketem Thulium' });
  });

  it('returns 204 without writes when phone resolution is ambiguous', async () => {
    tx.pipelineOpportunity.findMany.mockResolvedValue([
      await tx.pipelineOpportunity.findFirst(),
      { ...(await tx.pipelineOpportunity.findFirst()), id: 'opp_983' },
    ]);

    const response = await inject({
      event_id: 'event-3',
      event_type: 'TICKET_CREATED',
      customer_phone: '123123123',
      thulium_ticket_id: 12345,
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request before any database lookup', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      payload: {
        event_id: 'event-4',
        event_type: 'TICKET_CREATED',
        customer_phone: '123123123',
        thulium_ticket_id: 12345,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(tx.pipelineOpportunity.findMany).not.toHaveBeenCalled();
  });

  it('rejects a payload without an opportunity selector', async () => {
    const response = await inject({
      event_id: 'event-5',
      event_type: 'TICKET_CREATED',
      thulium_ticket_id: 12345,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rate limits repeated public webhook requests', async () => {
    let response;
    for (let index = 0; index < 61; index += 1) {
      response = await inject({
        event_id: `rate-${index}`,
        event_type: 'TICKET_CREATED',
        opportunity_id: 'opp_982',
        thulium_ticket_id: 12345,
        thulium_customer_id: 67890,
      });
    }

    expect(response?.statusCode).toBe(429);
  });
});