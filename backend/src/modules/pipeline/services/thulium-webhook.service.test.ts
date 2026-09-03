import { describe, expect, it, vi } from 'vitest';
import { PipelineActorType, ScopeType } from '@prisma/client';
import {
  linkThuliumTicket,
  ThuliumWebhookConflictError,
  ThuliumWebhookNotFoundError,
} from './thulium-webhook.service.js';

const opportunity = {
  id: 'opp_982',
  scopeType: ScopeType.DEALER,
  scopeId: 'dealer_123',
  thuliumTicketId: null,
  customer: {
    id: 'customer_456',
    phone: '+48123123123',
    thuliumCustomerId: null,
  },
};

function createTx(overrides: Record<string, unknown> = {}) {
  const persistedEvent = {
    id: 'event_789',
    type: 'TICKET_LINKED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    payload: { thuliumTicketId: 12345, thuliumCustomerId: 67890 },
  };
  return {
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
        Promise.resolve(where.id ? persistedEvent : { id: persistedEvent.id })
      ),
    },
    ...overrides,
  } as any;
}

describe('linkThuliumTicket', () => {
  it.each(['123123123', '48123123123', '+48 123 123 123'])(
    'resolves one open opportunity by normalized phone %s',
    async (customerPhone) => {
      const tx = createTx();

      const result = await linkThuliumTicket(tx, {
        customerPhone,
        thuliumTicketId: 12345,
        thuliumCustomerId: 67890,
        idempotencyKey: 'thulium:event-1',
      });

      expect(result).toEqual({ status: 'linked', eventId: 'event_789' });
      expect(tx.pipelineOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'OPEN', customer: { phone: '+48123123123' } },
          take: 2,
        })
      );
      expect(tx.pipelineOpportunity.updateMany).toHaveBeenCalled();
      expect(tx.pipelineCustomer.updateMany).toHaveBeenCalled();
    }
  );

  it.each([
    { matches: [] },
    { matches: [opportunity, { ...opportunity, id: 'opp_983' }] },
  ])(
    'does not write when phone resolution is not unique',
    async ({ matches }) => {
      const tx = createTx();
      tx.pipelineOpportunity.findMany.mockResolvedValue(matches);

      const result = await linkThuliumTicket(tx, {
        customerPhone: '123123123',
        thuliumTicketId: 12345,
        idempotencyKey: 'thulium:event-unresolved',
      });

      expect(result).toEqual({ status: 'unresolved', matchCount: matches.length });
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
      expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
      expect(tx.pipelineCustomer.updateMany).not.toHaveBeenCalled();
    }
  );

  it('accepts an explicit opportunity without a phone guard', async () => {
    const tx = createTx();

    await expect(
      linkThuliumTicket(tx, {
        opportunityId: 'opp_982',
        thuliumTicketId: 12345,
        thuliumCustomerId: 67890,
        idempotencyKey: 'thulium:event-explicit',
      })
    ).resolves.toEqual({ status: 'linked', eventId: 'event_789' });
  });

  it('normalizes an optional phone guard and rejects a mismatch without writes', async () => {
    const tx = createTx();

    await expect(
      linkThuliumTicket(tx, {
        opportunityId: 'opp_982',
        customerPhone: '999888777',
        thuliumTicketId: 12345,
        idempotencyKey: 'thulium:event-mismatch',
      })
    ).rejects.toBeInstanceOf(ThuliumWebhookNotFoundError);

    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a replay whose persisted event has a different payload', async () => {
    const tx = createTx();
    tx.pipelineEvent.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id
          ? {
              id: 'event_789',
              type: 'TICKET_LINKED',
              aggregateType: 'OPPORTUNITY',
              aggregateId: opportunity.id,
              payload: { thuliumTicketId: 99999, thuliumCustomerId: 67890 },
            }
          : { id: 'event_789' }
      )
    );

    await expect(
      linkThuliumTicket(tx, {
        opportunityId: 'opp_982',
        thuliumTicketId: 12345,
        thuliumCustomerId: 67890,
        idempotencyKey: 'thulium:event-conflict',
      })
    ).rejects.toBeInstanceOf(ThuliumWebhookConflictError);
    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a different ticket ID already linked to the opportunity', async () => {
    const tx = createTx();
    tx.pipelineOpportunity.findFirst.mockResolvedValue({ ...opportunity, thuliumTicketId: 77777 });

    await expect(
      linkThuliumTicket(tx, {
        opportunityId: 'opp_982',
        thuliumTicketId: 12345,
        idempotencyKey: 'thulium:event-existing-conflict',
      })
    ).rejects.toBeInstanceOf(ThuliumWebhookConflictError);
    expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
  });

  it('detects a concurrent conflicting ticket link instead of overwriting it', async () => {
    const tx = createTx();
    tx.pipelineOpportunity.updateMany.mockResolvedValueOnce({ count: 0 });
    tx.pipelineOpportunity.findUniqueOrThrow.mockResolvedValueOnce({ thuliumTicketId: 99999 });

    await expect(
      linkThuliumTicket(tx, {
        opportunityId: 'opp_982',
        thuliumTicketId: 12345,
        thuliumCustomerId: 67890,
        idempotencyKey: 'thulium:event-concurrent-conflict',
      })
    ).rejects.toBeInstanceOf(ThuliumWebhookConflictError);

    expect(tx.pipelineOpportunity.updateMany).toHaveBeenCalledWith({
      where: { id: 'opp_982', thuliumTicketId: null },
      data: { thuliumTicketId: 12345 },
    });
  });

  it('keeps an identical replay as a no-op', async () => {
    const linked = {
      ...opportunity,
      thuliumTicketId: 12345,
      customer: { ...opportunity.customer, thuliumCustomerId: 67890 },
    };
    const tx = createTx();
    tx.pipelineOpportunity.findFirst.mockResolvedValue(linked);

    await linkThuliumTicket(tx, {
      opportunityId: 'opp_982',
      thuliumTicketId: 12345,
      thuliumCustomerId: 67890,
      idempotencyKey: 'thulium:event-replay',
    });

    expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
    expect(tx.pipelineCustomer.updateMany).not.toHaveBeenCalled();
  });

  it('records a customer audit event before updating the customer', async () => {
    const tx = createTx();
    tx.pipelineEvent.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.id
          ? {
              id: 'event_customer',
              type: 'THULIUM_CUSTOMER_LINKED',
              aggregateType: 'CUSTOMER',
              aggregateId: opportunity.customer.id,
              payload: { thuliumCustomerId: 67890 },
            }
          : { id: 'event_customer' }
      )
    );

    await linkThuliumTicket(tx, {
      opportunityId: 'opp_982',
      thuliumCustomerId: 67890,
      idempotencyKey: 'thulium:customer-event',
    });

    expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ type: 'THULIUM_CUSTOMER_LINKED' })],
      })
    );
    expect(tx.pipelineCustomer.updateMany).toHaveBeenCalled();
    expect(tx.pipelineEvent.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.pipelineCustomer.updateMany.mock.invocationCallOrder[0]
    );
    expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ actorType: PipelineActorType.THULIUM })],
      })
    );
  });
});