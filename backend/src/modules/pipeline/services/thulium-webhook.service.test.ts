import { describe, expect, it, vi } from 'vitest';
import { ScopeType } from '@prisma/client';
import {
  handleThuliumNotification,
  ThuliumWebhookConflictError,
  type ThuliumNotification,
} from './thulium-webhook.service.js';

const opportunity = {
  id: 'opp_982',
  scopeType: ScopeType.DEALER,
  scopeId: 'dealer_123',
  thuliumTicketId: null as number | null,
  customerId: 'customer_456',
  customer: { id: 'customer_456' },
};

function createTx(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  } as any;
}

function call(tx: any, notification: ThuliumNotification, idempotencyKey: string) {
  return handleThuliumNotification(tx, { notification, idempotencyKey });
}

describe('handleThuliumNotification', () => {
  describe('AGENT_RINGING', () => {
    it.each(['523993855', '48523993855', '+48 523 993 855'])(
      'resolves one open opportunity by normalized phone %s',
      async (sourceNumber) => {
        const tx = createTx();

        const result = await call(
          tx,
          { action: 'AGENT_RINGING', connectionId: 'conn-1', sourceNumber },
          'thulium:ringing:conn-1'
        );

        expect(result).toEqual({ status: 'linked', eventId: 'event_789' });
        expect(tx.pipelineOpportunity.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status: 'OPEN', customer: { phone: '+48523993855' } },
            take: 2,
          })
        );
        expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: [expect.objectContaining({ type: 'CALL_LOGGED' })],
          })
        );
      }
    );

    it('returns unresolved without writing when no open opportunity matches', async () => {
      const tx = createTx();
      tx.pipelineOpportunity.findMany.mockResolvedValue([]);

      const result = await call(
        tx,
        { action: 'AGENT_RINGING', connectionId: 'conn-2', sourceNumber: '523993855' },
        'thulium:ringing:conn-2'
      );

      expect(result).toEqual({ status: 'unresolved', reason: 'no_open_opportunity' });
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    });

    it('returns unresolved without writing when the phone match is ambiguous', async () => {
      const tx = createTx();
      tx.pipelineOpportunity.findMany.mockResolvedValue([opportunity, { ...opportunity, id: 'opp_983' }]);

      const result = await call(
        tx,
        { action: 'AGENT_RINGING', connectionId: 'conn-3', sourceNumber: '523993855' },
        'thulium:ringing:conn-3'
      );

      expect(result).toEqual({ status: 'unresolved', reason: 'ambiguous_phone' });
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    });
  });

  describe('RECORDING_READY', () => {
    it('finds the opportunity by connection_id and records CALL_RECORDING_ATTACHED', async () => {
      const tx = createTx();

      const result = await call(
        tx,
        { action: 'RECORDING_READY', connectionId: 'conn-1', filename: 'SOME-QUEUE/2014-11-17/rec.wav' },
        'thulium:recording:conn-1'
      );

      expect(result).toEqual({ status: 'linked', eventId: 'event_789' });
      expect(tx.pipelineEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: 'CALL_LOGGED',
            payload: { path: ['thuliumConnectionId'], equals: 'conn-1' },
          },
        })
      );
      expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ type: 'CALL_RECORDING_ATTACHED' })],
        })
      );
    });

    it('returns unresolved without writing for an unknown connection_id', async () => {
      const tx = createTx();
      tx.pipelineEvent.findFirst.mockResolvedValue(null);

      const result = await call(
        tx,
        { action: 'RECORDING_READY', connectionId: 'conn-unknown', filename: 'rec.wav' },
        'thulium:recording:conn-unknown'
      );

      expect(result).toEqual({ status: 'unresolved', reason: 'unknown_connection' });
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    });
  });

  describe('TICKET_CREATED', () => {
    it('resolves the opportunity via thuliumCustomerId', async () => {
      const tx = createTx();

      const result = await call(
        tx,
        { action: 'TICKET_CREATED', ticketId: 12, customerId: 154 },
        'thulium:ticket:12'
      );

      expect(result).toEqual({ status: 'linked', eventId: 'event_789' });
      expect(tx.pipelineCustomer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { thuliumCustomerId: 154 } })
      );
      expect(tx.pipelineOpportunity.updateMany).toHaveBeenCalledWith({
        where: { id: 'opp_982', thuliumTicketId: null },
        data: { thuliumTicketId: 12 },
      });
      expect(tx.pipelineEvent.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [expect.objectContaining({ type: 'TICKET_LINKED' })],
        })
      );
    });

    it('rejects a ticket already linked to a different Thulium ticket', async () => {
      const tx = createTx();
      tx.pipelineOpportunity.findMany.mockResolvedValue([{ ...opportunity, thuliumTicketId: 999 }]);

      await expect(
        call(tx, { action: 'TICKET_CREATED', ticketId: 12, customerId: 154 }, 'thulium:ticket:12')
      ).rejects.toBeInstanceOf(ThuliumWebhookConflictError);
      expect(tx.pipelineOpportunity.updateMany).not.toHaveBeenCalled();
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    });
  });

  describe('CUSTOMER_UPDATED', () => {
    it('returns unresolved without writing', async () => {
      const tx = createTx();

      const result = await call(tx, { action: 'CUSTOMER_UPDATED', customerId: 154 }, 'thulium:customer:154:nodate');

      expect(result).toEqual({ status: 'unresolved', reason: 'not_actionable_without_thulium_client' });
      expect(tx.pipelineCustomer.findFirst).not.toHaveBeenCalled();
      expect(tx.pipelineOpportunity.findMany).not.toHaveBeenCalled();
      expect(tx.pipelineEvent.createMany).not.toHaveBeenCalled();
    });
  });
});
