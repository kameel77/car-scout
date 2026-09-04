import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerThuliumWebhookRoutes } from './thulium-webhook.routes.js';

describe('Thulium pipeline webhook route', () => {
  const originalUser = process.env.THULIUM_WEBHOOK_USER;
  const originalPassword = process.env.THULIUM_WEBHOOK_PASSWORD;
  let app: ReturnType<typeof Fastify>;
  let tx: any;

  beforeEach(async () => {
    process.env.THULIUM_WEBHOOK_USER = 'motolia-webhook';
    process.env.THULIUM_WEBHOOK_PASSWORD = 'test-thulium-webhook-password';
    const opportunity = {
      id: 'opp_982',
      scopeType: 'DEALER',
      scopeId: 'dealer_123',
      thuliumTicketId: null,
      customerId: 'customer_456',
      customer: { id: 'customer_456' },
    };
    tx = {
      pipelineOpportunity: {
        findMany: vi.fn().mockResolvedValue([opportunity]),
        findUnique: vi.fn().mockResolvedValue(opportunity),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ thuliumTicketId: 12345 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pipelineCustomer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer_456' }),
      },
      pipelineEvent: {
        findFirst: vi.fn().mockResolvedValue({ opportunityId: 'opp_982', customerId: 'customer_456' }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'event_789' }),
      },
      pipelineThuliumDeadLetter: {
        create: vi.fn().mockResolvedValue({ id: 'dl_1' }),
      },
    };
    app = Fastify({ logger: false });
    app.decorate('prisma', {
      $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
      pipelineThuliumDeadLetter: { create: vi.fn().mockResolvedValue({ id: 'dl_invalid' }) },
    } as any);
    await app.register(rateLimit, { global: false });
    await registerThuliumWebhookRoutes(app);
  });

  afterEach(async () => {
    await app.close();
    if (originalUser === undefined) delete process.env.THULIUM_WEBHOOK_USER;
    else process.env.THULIUM_WEBHOOK_USER = originalUser;
    if (originalPassword === undefined) delete process.env.THULIUM_WEBHOOK_PASSWORD;
    else process.env.THULIUM_WEBHOOK_PASSWORD = originalPassword;
  });

  function inject(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
      },
      payload,
    });
  }

  it('links AGENT_RINGING by normalized source_number', async () => {
    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: '1416225570.341',
      queue_id: 155,
      agent_login: 'jkowalski',
      source_number: '523993855',
      destination_number: '162',
      date: '2016-04-20 09:46:24',
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineOpportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OPEN', customer: { phone: '+48523993855' } },
        take: 2,
      })
    );
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('links AGENT_RINGING sent as application/x-www-form-urlencoded', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload:
        'action=AGENT_RINGING&connection_id=1416225570.341&queue_id=155&agent_login=jkowalski&source_number=523993855&destination_number=162&date=2016-04-20+09%3A46%3A24',
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineOpportunity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'OPEN', customer: { phone: '+48523993855' } },
        take: 2,
      })
    );
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('links RECORDING_READY by connection_id', async () => {
    const response = await inject({
      action: 'RECORDING_READY',
      connection_id: '1416225570.341',
      filename: 'SOME-QUEUE/2014-11-17/2014-11-17_125932_1416225570.341.wav',
      date: '2016-04-20 09:46:24',
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: 'CALL_LOGGED',
          payload: { path: ['thuliumConnectionId'], equals: '1416225570.341' },
        },
      })
    );
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('links TICKET_CREATED by thulium customer_id', async () => {
    const response = await inject({
      action: 'TICKET_CREATED',
      ticket_id: 12,
      agent_login: 'jkowalski',
      direction: 'in_behalf_of',
      date: '2016-04-20 09:46:24',
      customer_id: 154,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('links TICKET_CREATED sent as application/x-www-form-urlencoded, coercing ids to numbers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'action=TICKET_CREATED&ticket_id=12&customer_id=154',
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineCustomer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { thuliumCustomerId: 154 } })
    );
    expect(tx.pipelineOpportunity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { thuliumTicketId: 12 } })
    );
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('accepts CUSTOMER_CREATED as unresolved (no writes)', async () => {
    const response = await inject({
      action: 'CUSTOMER_CREATED',
      customer_id: 154,
      company_id: 5,
      date: '2016-04-20 09:46:24',
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
  });

  it('accepts CUSTOMER_UPDATED as unresolved (no writes)', async () => {
    const response = await inject({
      action: 'CUSTOMER_UPDATED',
      customer_id: 154,
      company_id: 5,
      date: '2016-04-20 09:46:24',
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
  });

  it('returns 409 instead of overwriting an existing Thulium ticket link', async () => {
    tx.pipelineOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp_982',
        scopeType: 'DEALER',
        scopeId: 'dealer_123',
        thuliumTicketId: 999,
        customerId: 'customer_456',
        customer: { id: 'customer_456' },
      },
    ]);

    const response = await inject({
      action: 'TICKET_CREATED',
      ticket_id: 12,
      customer_id: 154,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: 'Sprawa jest już połączona z innym ticketem Thulium' });
  });

  it('returns 204 without writes when the phone match is ambiguous', async () => {
    tx.pipelineOpportunity.findMany.mockResolvedValue([
      {
        id: 'opp_982',
        scopeType: 'DEALER',
        scopeId: 'dealer_123',
        thuliumTicketId: null,
        customerId: 'customer_456',
        customer: { id: 'customer_456' },
      },
      {
        id: 'opp_983',
        scopeType: 'DEALER',
        scopeId: 'dealer_123',
        thuliumTicketId: null,
        customerId: 'customer_457',
        customer: { id: 'customer_457' },
      },
    ]);

    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: 'conn-ambiguous',
      source_number: '523993855',
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
  });

  it('records a dead letter with the phone suffix for unmatched AGENT_RINGING and still returns 204', async () => {
    tx.pipelineOpportunity.findMany.mockResolvedValue([]);

    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: 'conn-unmatched',
      source_number: '523993855',
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineThuliumDeadLetter.create).toHaveBeenCalledWith({
      data: {
        scopeType: 'PLATFORM',
        scopeId: 'PLATFORM',
        action: 'AGENT_RINGING',
        reason: 'no_open_opportunity',
        payload: expect.objectContaining({ action: 'AGENT_RINGING', connection_id: 'conn-unmatched' }),
        phoneSuffix: '3855',
      },
    });
  });

  it('does not record a dead letter for CUSTOMER_UPDATED', async () => {
    const response = await inject({
      action: 'CUSTOMER_UPDATED',
      customer_id: 154,
    });

    expect(response.statusCode).toBe(204);
    expect(tx.pipelineThuliumDeadLetter.create).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request before any database lookup', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      payload: {
        action: 'AGENT_RINGING',
        connection_id: 'conn-1',
        source_number: '523993855',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(tx.pipelineOpportunity.findMany).not.toHaveBeenCalled();
  });

  it('rejects a request with a valid Basic Auth scheme but the wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:wrong-password').toString('base64'),
      },
      payload: {
        action: 'AGENT_RINGING',
        connection_id: 'conn-1',
        source_number: '523993855',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(tx.pipelineOpportunity.findMany).not.toHaveBeenCalled();
  });

  it('returns 503 when the webhook credentials are not configured', async () => {
    delete process.env.THULIUM_WEBHOOK_USER;
    delete process.env.THULIUM_WEBHOOK_PASSWORD;

    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: 'conn-1',
      source_number: '523993855',
    });

    expect(response.statusCode).toBe(503);
  });

  it('rejects an unknown action value', async () => {
    const response = await inject({
      action: 'SOMETHING_ELSE',
      connection_id: 'conn-1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('records a dead letter with reason invalid_payload for an unknown action value', async () => {
    const response = await inject({
      action: 'SOMETHING_ELSE',
      connection_id: 'conn-1',
    });

    expect(response.statusCode).toBe(400);
    const prisma = app.prisma as any;
    expect(prisma.pipelineThuliumDeadLetter.create).toHaveBeenCalledWith({
      data: {
        scopeType: 'PLATFORM',
        scopeId: 'PLATFORM',
        action: 'SOMETHING_ELSE',
        reason: 'invalid_payload',
        payload: { action: 'SOMETHING_ELSE', connection_id: 'conn-1' },
        phoneSuffix: null,
      },
    });
  });

  it('rejects AGENT_RINGING missing source_number', async () => {
    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: 'conn-1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects RECORDING_READY missing filename', async () => {
    const response = await inject({
      action: 'RECORDING_READY',
      connection_id: 'conn-1',
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects TICKET_CREATED missing customer_id', async () => {
    const response = await inject({
      action: 'TICKET_CREATED',
      ticket_id: 12,
    });

    expect(response.statusCode).toBe(400);
  });

  it('parses a JSON body sent with an unexpected content-type instead of returning 415', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'text/plain',
      },
      payload: JSON.stringify({
        action: 'TICKET_CREATED',
        ticket_id: 12,
        customer_id: 154,
      }),
    });

    expect(response.statusCode).not.toBe(415);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true, eventId: 'event_789' });
  });

  it('rejects an unparseable application/x-www-form-urlencoded body with 400, not 415', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'to-nie-jest-payload',
    });

    expect(response.statusCode).not.toBe(415);
    expect(response.statusCode).toBe(400);
  });

  // Regression test for a production incident: Thulium serializes empty form-urlencoded
  // fields as the literal string "null", not an empty string. This exact payload landed in
  // the dead letter with a 400 before the payload normalization fix.
  it('accepts the production CUSTOMER_UPDATED payload with company_id="null" as unresolved, not a validation error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'action=CUSTOMER_UPDATED&customer_id=682&company_id=null&date=2026-09-04+12%3A19%3A43',
    });

    expect(response.statusCode).toBe(204);
  });

  it('links AGENT_RINGING sent as application/x-www-form-urlencoded with queue_id="null"', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipeline/integrations/thulium/webhook',
      headers: {
        authorization: 'Basic ' + Buffer.from('motolia-webhook:test-thulium-webhook-password').toString('base64'),
        'content-type': 'application/x-www-form-urlencoded',
      },
      payload: 'action=AGENT_RINGING&connection_id=1416225570.341&queue_id=null&source_number=523993855',
    });

    expect(response.statusCode).toBe(202);
  });

  it('rejects TICKET_CREATED with ticket_id="null" (required field)', async () => {
    const response = await inject({
      action: 'TICKET_CREATED',
      ticket_id: 'null',
      customer_id: 154,
    });

    expect(response.statusCode).toBe(400);
  });

  it('normalizes an optional text field sent as "null" so the stored event does not persist the literal string', async () => {
    const response = await inject({
      action: 'AGENT_RINGING',
      connection_id: '1416225570.341',
      source_number: '523993855',
      agent_login: 'null',
    });

    expect(response.statusCode).toBe(202);
    expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ payload: expect.objectContaining({ agentName: null }) })],
      })
    );
  });

  it('rate limits repeated public webhook requests', async () => {
    let response;
    for (let index = 0; index < 61; index += 1) {
      response = await inject({
        action: 'TICKET_CREATED',
        ticket_id: 12,
        customer_id: 154,
      });
    }

    expect(response?.statusCode).toBe(429);
  });
});
