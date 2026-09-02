import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, ScopeType, PipelineActorType } from '@prisma/client';

describe('pipeline_events immutability trigger', () => {
  const prisma = new PrismaClient();
  const TEST_SCOPE = { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM_TEST_TRIGGER' };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Note: Since DELETE trigger blocks DELETE on pipeline_events, test rows remain or can be scoped
    await prisma.$disconnect();
  });

  async function createTestEvent(overrides: Record<string, unknown> = {}) {
    return prisma.pipelineEvent.create({
      data: {
        scopeType: TEST_SCOPE.scopeType,
        scopeId: TEST_SCOPE.scopeId,
        type: 'OPPORTUNITY_CREATED',
        aggregateType: 'OPPORTUNITY',
        aggregateId: `test-agg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        actorType: PipelineActorType.SYSTEM,
        actorLabel: 'test-runner',
        payload: { number: 'MTL-2026-00001', leadSource: 'ORGANIC', clientType: 'B2C', createdFrom: 'MANUAL' },
        ...overrides,
      },
    });
  }

  it('allows inserting a new event', async () => {
    const event = await createTestEvent();
    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.dispatchedAt).toBeNull();
  });

  it('blocks DELETE on pipeline_events with custom exception', async () => {
    const event = await createTestEvent();

    await expect(
      prisma.$executeRaw`DELETE FROM pipeline_events WHERE id = ${event.id}`
    ).rejects.toThrow(/pipeline_events is append-only: DELETE is not permitted/i);
  });

  it('blocks UPDATE of type column with custom exception', async () => {
    const event = await createTestEvent();

    await expect(
      prisma.$executeRaw`UPDATE pipeline_events SET type = 'OPPORTUNITY_WON' WHERE id = ${event.id}`
    ).rejects.toThrow(/pipeline_events is append-only: only dispatched_at may be updated/i);
  });

  it('blocks UPDATE of payload with custom exception', async () => {
    const event = await createTestEvent();

    await expect(
      prisma.$executeRaw`UPDATE pipeline_events SET payload = '{"tampered":true}'::jsonb WHERE id = ${event.id}`
    ).rejects.toThrow(/pipeline_events is append-only: only dispatched_at may be updated/i);
  });

  it('allows UPDATE of dispatched_at only', async () => {
    const event = await createTestEvent();
    const now = new Date();

    await prisma.$executeRaw`UPDATE pipeline_events SET dispatched_at = ${now} WHERE id = ${event.id}`;

    const updated = await prisma.pipelineEvent.findUnique({
      where: { id: event.id },
    });
    expect(updated).toBeDefined();
    expect(updated?.dispatchedAt).not.toBeNull();
    expect(updated?.type).toBe(event.type);
  });

  it('guarantees row state remains untouched after failed update in transaction', async () => {
    const event = await createTestEvent();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE pipeline_events SET type = 'TAMPERED' WHERE id = ${event.id}`;
      });
    } catch {
      // expected error
    }

    const current = await prisma.pipelineEvent.findUnique({
      where: { id: event.id },
    });
    expect(current?.type).toBe('OPPORTUNITY_CREATED');
  });
});
