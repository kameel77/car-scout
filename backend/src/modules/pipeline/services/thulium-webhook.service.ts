import { PipelineActorType, Prisma } from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { isUnmatchablePhone, normalizePhone } from './customer.service.js';

export class ThuliumWebhookNotFoundError extends Error {
  constructor(opportunityId: string) {
    super(`Nie znaleziono sprawy ${opportunityId} dla zdarzenia Thulium`);
    this.name = 'ThuliumWebhookNotFoundError';
  }
}

export class ThuliumWebhookConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThuliumWebhookConflictError';
  }
}

type LinkThuliumTicketInput = {
  eventType?: 'TICKET_CREATED' | 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED';
  opportunityId?: string;
  customerPhone?: string;
  thuliumTicketId?: number | null;
  thuliumCustomerId?: number | null;
  idempotencyKey: string;
};

type ResolvedOpportunity = {
  id: string;
  scopeType: 'PLATFORM' | 'DEALER_GROUP' | 'DEALER';
  scopeId: string;
  thuliumTicketId: number | null;
  customer: {
    id: string;
    phone: string | null;
    thuliumCustomerId: number | null;
  };
};

function eventPayloadMatches(actual: unknown, expected: Record<string, number | null>): boolean {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const value = actual as Record<string, unknown>;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index] && value[key] === expected[key])
  );
}

async function resolveOpportunity(
  tx: Prisma.TransactionClient,
  input: Pick<LinkThuliumTicketInput, 'opportunityId' | 'customerPhone'>
): Promise<{ opportunity: ResolvedOpportunity | null; matchCount: number }> {
  const normalizedPhone = normalizePhone(input.customerPhone);

  if (input.opportunityId) {
    const opportunity = await tx.pipelineOpportunity.findFirst({
      where: { id: input.opportunityId },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        thuliumTicketId: true,
        customer: {
          select: { id: true, phone: true, thuliumCustomerId: true },
        },
      },
    });

    if (
      !opportunity ||
      (input.customerPhone !== undefined &&
        (!normalizedPhone || normalizePhone(opportunity.customer.phone) !== normalizedPhone))
    ) {
      throw new ThuliumWebhookNotFoundError(input.opportunityId);
    }
    return { opportunity, matchCount: 1 };
  }

  if (!normalizedPhone || isUnmatchablePhone(normalizedPhone)) {
    return { opportunity: null, matchCount: 0 };
  }

  const matches = await tx.pipelineOpportunity.findMany({
    where: { status: 'OPEN', customer: { phone: normalizedPhone } },
    select: {
      id: true,
      scopeType: true,
      scopeId: true,
      thuliumTicketId: true,
      customer: {
        select: { id: true, phone: true, thuliumCustomerId: true },
      },
    },
    take: 2,
  });

  return {
    opportunity: matches.length === 1 ? matches[0] : null,
    matchCount: matches.length,
  };
}

function assertCompatibleIds(opportunity: ResolvedOpportunity, input: LinkThuliumTicketInput): void {
  if (
    input.thuliumTicketId != null &&
    opportunity.thuliumTicketId != null &&
    opportunity.thuliumTicketId !== input.thuliumTicketId
  ) {
    throw new ThuliumWebhookConflictError('Sprawa jest już połączona z innym ticketem Thulium');
  }
  if (
    input.thuliumCustomerId != null &&
    opportunity.customer.thuliumCustomerId != null &&
    opportunity.customer.thuliumCustomerId !== input.thuliumCustomerId
  ) {
    throw new ThuliumWebhookConflictError('Klient jest już połączony z innym klientem Thulium');
  }
}

export async function linkThuliumTicket(
  tx: Prisma.TransactionClient,
  input: LinkThuliumTicketInput
): Promise<{ status: 'linked'; eventId: string } | { status: 'unresolved'; matchCount: number }> {
  const resolution = await resolveOpportunity(tx, input);
  if (!resolution.opportunity) {
    return { status: 'unresolved', matchCount: resolution.matchCount };
  }
  const opportunity = resolution.opportunity;

  const isTicketEvent =
    (input.eventType ?? (input.thuliumTicketId != null ? 'TICKET_CREATED' : 'CUSTOMER_UPDATED')) ===
    'TICKET_CREATED';

  assertCompatibleIds(opportunity, input);

  const actor = { type: PipelineActorType.THULIUM, label: 'Thulium webhook' };
  let eventId: string;
  let eventType: 'TICKET_LINKED' | 'THULIUM_CUSTOMER_LINKED';
  let aggregateType: 'OPPORTUNITY' | 'CUSTOMER';
  let aggregateId: string;
  let payload: Record<string, number | null>;

  if (isTicketEvent && input.thuliumTicketId != null) {
    eventType = 'TICKET_LINKED';
    aggregateType = 'OPPORTUNITY';
    aggregateId = opportunity.id;
    payload = {
      thuliumTicketId: input.thuliumTicketId,
      thuliumCustomerId: input.thuliumCustomerId ?? null,
    };
    eventId = await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'TICKET_LINKED',
      aggregateType,
      aggregateId,
      opportunityId: opportunity.id,
      customerId: opportunity.customer.id,
      actor,
      payload: {
        thuliumTicketId: input.thuliumTicketId,
        thuliumCustomerId: input.thuliumCustomerId ?? null,
      },
      idempotencyKey: input.idempotencyKey,
    });
  } else {
    eventType = 'THULIUM_CUSTOMER_LINKED';
    aggregateType = 'CUSTOMER';
    aggregateId = opportunity.customer.id;
    payload = { thuliumCustomerId: input.thuliumCustomerId as number };
    eventId = await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'THULIUM_CUSTOMER_LINKED',
      aggregateType,
      aggregateId,
      opportunityId: opportunity.id,
      customerId: opportunity.customer.id,
      actor,
      payload: { thuliumCustomerId: input.thuliumCustomerId as number },
      idempotencyKey: input.idempotencyKey,
    });
  }

  const persistedEvent = await tx.pipelineEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: { type: true, aggregateType: true, aggregateId: true, payload: true },
  });
  if (
    persistedEvent.type !== eventType ||
    persistedEvent.aggregateType !== aggregateType ||
    persistedEvent.aggregateId !== aggregateId ||
    !eventPayloadMatches(persistedEvent.payload, payload)
  ) {
    throw new ThuliumWebhookConflictError('Identyfikator zdarzenia Thulium został już użyty z innymi danymi');
  }

  if (isTicketEvent && input.thuliumTicketId != null && opportunity.thuliumTicketId == null) {
    const updated = await tx.pipelineOpportunity.updateMany({
      where: { id: opportunity.id, thuliumTicketId: null },
      data: { thuliumTicketId: input.thuliumTicketId },
    });
    if (updated.count === 0) {
      const current = await tx.pipelineOpportunity.findUniqueOrThrow({
        where: { id: opportunity.id },
        select: { thuliumTicketId: true },
      });
      if (current.thuliumTicketId !== input.thuliumTicketId) {
        throw new ThuliumWebhookConflictError('Sprawa jest już połączona z innym ticketem Thulium');
      }
    }
  }

  if (input.thuliumCustomerId != null && opportunity.customer.thuliumCustomerId == null) {
    const updated = await tx.pipelineCustomer.updateMany({
      where: { id: opportunity.customer.id, thuliumCustomerId: null },
      data: { thuliumCustomerId: input.thuliumCustomerId },
    });
    if (updated.count === 0) {
      const current = await tx.pipelineCustomer.findUniqueOrThrow({
        where: { id: opportunity.customer.id },
        select: { thuliumCustomerId: true },
      });
      if (current.thuliumCustomerId !== input.thuliumCustomerId) {
        throw new ThuliumWebhookConflictError('Klient jest już połączony z innym klientem Thulium');
      }
    }
  }

  return { status: 'linked', eventId };
}