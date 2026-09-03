import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, ScopeType, PipelineActorType, ClientType, LeadSourceChannel, PipelinePhase } from '@prisma/client';
import { recordEvent, PLATFORM_SCOPE } from '../events/record-event.js';

describe('recordEvent service helper', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createTestOpportunity() {
    const customer = await prisma.pipelineCustomer.create({
      data: {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        fullName: 'Jan Testowy',
        clientType: ClientType.B2C,
        phone: `+48${Math.floor(100000000 + Math.random() * 900000000)}`,
      },
    });

    const oppNumber = `MTL-TEST-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const opportunity = await prisma.pipelineOpportunity.create({
      data: {
        number: oppNumber,
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        customerId: customer.id,
        leadSource: LeadSourceChannel.TV,
        leadSourceDetail: 'Kampania jesienna',
        clientType: ClientType.B2C,
        phase: PipelinePhase.QUALIFICATION,
      },
    });

    return { customer, opportunity };
  }

  it('records an event within a transaction and returns its id', async () => {
    const { opportunity, customer } = await createTestOpportunity();
    let eventId = '';

    await prisma.$transaction(async (tx) => {
      eventId = await recordEvent(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        type: 'OPPORTUNITY_CREATED',
        aggregateType: 'OPPORTUNITY',
        aggregateId: opportunity.id,
        opportunityId: opportunity.id,
        customerId: customer.id,
        actor: {
          type: PipelineActorType.USER,
          userId: 'test-user-id',
          label: 'Jan Kowalski',
        },
        payload: {
          number: opportunity.number,
          leadSource: 'TV',
          leadSourceDetail: 'Kampania jesienna',
          clientType: 'B2C',
          createdFrom: 'MANUAL',
        },
      });
    });

    expect(eventId).toBeTruthy();

    const stored = await prisma.pipelineEvent.findUnique({
      where: { id: eventId },
    });
    expect(stored).toBeDefined();
    expect(stored?.type).toBe('OPPORTUNITY_CREATED');
    expect(stored?.aggregateType).toBe('OPPORTUNITY');
    expect(stored?.aggregateId).toBe(opportunity.id);
    expect(stored?.opportunityId).toBe(opportunity.id);
    expect(stored?.customerId).toBe(customer.id);
    expect(stored?.actorType).toBe(PipelineActorType.USER);
    expect(stored?.actorUserId).toBe('test-user-id');
    expect(stored?.actorLabel).toBe('Jan Kowalski');
    expect(stored?.payload).toMatchObject({
      number: opportunity.number,
      leadSource: 'TV',
      leadSourceDetail: 'Kampania jesienna',
      clientType: 'B2C',
      createdFrom: 'MANUAL',
    });
  });

  it('returns existing event id on sequential duplicate idempotencyKey without throwing', async () => {
    const { opportunity } = await createTestOpportunity();
    const idempotencyKey = `thulium:test-call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let firstId = '';
    await prisma.$transaction(async (tx) => {
      firstId = await recordEvent(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        type: 'CALL_LOGGED',
        aggregateType: 'OPPORTUNITY',
        aggregateId: opportunity.id,
        opportunityId: opportunity.id,
        actor: {
          type: PipelineActorType.THULIUM,
          label: 'Thulium Connector',
        },
        payload: {
          thuliumConnectionId: 'conn-12345',
          direction: 'INBOUND',
          durationSeconds: 180,
          agentName: 'Anna Nowak',
        },
        idempotencyKey,
      });
    });

    expect(firstId).toBeTruthy();

    let secondId = '';
    await prisma.$transaction(async (tx) => {
      secondId = await recordEvent(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        type: 'CALL_LOGGED',
        aggregateType: 'OPPORTUNITY',
        aggregateId: opportunity.id,
        opportunityId: opportunity.id,
        actor: {
          type: PipelineActorType.THULIUM,
          label: 'Thulium Connector',
        },
        payload: {
          thuliumConnectionId: 'conn-12345',
          direction: 'INBOUND',
          durationSeconds: 180,
          agentName: 'Anna Nowak',
        },
        idempotencyKey,
      });
    });

    expect(secondId).toBe(firstId);

    const matchingEvents = await prisma.pipelineEvent.findMany({
      where: { idempotencyKey },
    });
    expect(matchingEvents).toHaveLength(1);
  });

  it('deduplicates concurrent writes with the same idempotencyKey without transaction abort', async () => {
    const { opportunity } = await createTestOpportunity();
    const idempotencyKey = `concurrent:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;

    const runConcurrentTransaction = () =>
      prisma.$transaction(async (tx) => {
        return recordEvent(tx, {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          type: 'CALL_LOGGED',
          aggregateType: 'OPPORTUNITY',
          aggregateId: opportunity.id,
          opportunityId: opportunity.id,
          actor: {
            type: PipelineActorType.THULIUM,
            label: 'Thulium Webhook Retry',
          },
          payload: {
            thuliumConnectionId: 'conn-concurrent-1',
            direction: 'INBOUND',
            durationSeconds: 90,
          },
          idempotencyKey,
        });
      });

    // Run two transactions concurrently
    const [id1, id2] = await Promise.all([
      runConcurrentTransaction(),
      runConcurrentTransaction(),
    ]);

    // 1. Both calls resolve returning an id (neither transaction aborts)
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();

    // 2. Both calls return the exact same event id
    expect(id1).toBe(id2);

    // 3. Exactly one row exists in the database
    const matchingEvents = await prisma.pipelineEvent.findMany({
      where: { idempotencyKey },
    });
    expect(matchingEvents).toHaveLength(1);
    expect(matchingEvents[0].id).toBe(id1);
  });

  it('enforces opportunityId for non-CUSTOMER aggregate types', async () => {
    await prisma.$transaction(async (tx) => {
      await expect(
        recordEvent(tx, {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          type: 'OPPORTUNITY_CREATED',
          aggregateType: 'OPPORTUNITY',
          aggregateId: 'missing-opp-id',
          // opportunityId intentionally omitted
          actor: { type: PipelineActorType.USER },
          payload: {
            number: 'MTL-2026-00099',
            leadSource: 'OTHER',
            clientType: 'B2C',
            createdFrom: 'MANUAL',
          },
        })
      ).rejects.toThrow(/recordEvent: OPPORTUNITY_CREATED requires opportunityId/i);
    });
  });

  it('allows aggregateType CUSTOMER without opportunityId', async () => {
    const customer = await prisma.pipelineCustomer.create({
      data: {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        fullName: 'Customer Only Test',
        clientType: ClientType.B2B,
      },
    });

    let eventId = '';
    await prisma.$transaction(async (tx) => {
      eventId = await recordEvent(tx, {
        scopeType: PLATFORM_SCOPE.scopeType,
        scopeId: PLATFORM_SCOPE.scopeId,
        type: 'OPPORTUNITY_CLIENT_TYPE_SET',
        aggregateType: 'CUSTOMER',
        aggregateId: customer.id,
        customerId: customer.id,
        actor: { type: PipelineActorType.SYSTEM },
        payload: {
          before: ClientType.UNKNOWN,
          after: ClientType.B2B,
        },
      });
    });

    expect(eventId).toBeTruthy();
  });

  it('rolls back event creation if transaction fails', async () => {
    const { opportunity } = await createTestOpportunity();
    const idempotencyKey = `fail-test-${Date.now()}`;

    await expect(
      prisma.$transaction(async (tx) => {
        await recordEvent(tx, {
          scopeType: PLATFORM_SCOPE.scopeType,
          scopeId: PLATFORM_SCOPE.scopeId,
          type: 'NOTE_ADDED',
          aggregateType: 'OPPORTUNITY',
          aggregateId: opportunity.id,
          opportunityId: opportunity.id,
          actor: {
            type: PipelineActorType.USER,
          },
          payload: {
            content: 'This note should not be saved',
          },
          idempotencyKey,
        });
        throw new Error('Simulated business logic failure');
      })
    ).rejects.toThrow('Simulated business logic failure');

    const event = await prisma.pipelineEvent.findUnique({
      where: { idempotencyKey },
    });
    expect(event).toBeNull();
  });
});
