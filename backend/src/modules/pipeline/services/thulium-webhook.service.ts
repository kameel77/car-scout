import { PipelineActorType, Prisma } from '@prisma/client';
import { recordEvent, PLATFORM_SCOPE } from '../events/record-event.js';
import { isUnmatchablePhone, normalizePhone } from './customer.service.js';

export async function recordThuliumDeadLetter(
  tx: Prisma.TransactionClient,
  input: { action: string; reason: string; payload: unknown; phoneSuffix?: string | null }
): Promise<void> {
  await tx.pipelineThuliumDeadLetter.create({
    data: {
      scopeType: PLATFORM_SCOPE.scopeType,
      scopeId: PLATFORM_SCOPE.scopeId,
      action: input.action,
      reason: input.reason,
      payload: input.payload as Prisma.InputJsonValue,
      phoneSuffix: input.phoneSuffix ?? null,
    },
  });
}

export class ThuliumWebhookConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ThuliumWebhookConflictError';
  }
}

export type ThuliumNotification =
  | { action: 'AGENT_RINGING'; connectionId: string; sourceNumber: string; agentLogin?: string | null }
  | { action: 'RECORDING_READY'; connectionId: string; filename: string }
  | { action: 'TICKET_CREATED'; ticketId: number; customerId: number }
  | { action: 'CUSTOMER_CREATED' | 'CUSTOMER_UPDATED'; customerId: number };

export type ThuliumHandlingResult =
  | { status: 'linked'; eventId: string }
  | { status: 'unresolved'; reason: string };

async function handleAgentRinging(
  tx: Prisma.TransactionClient,
  notification: Extract<ThuliumNotification, { action: 'AGENT_RINGING' }>,
  idempotencyKey: string
): Promise<ThuliumHandlingResult> {
  const normalizedPhone = normalizePhone(notification.sourceNumber);
  if (!normalizedPhone || isUnmatchablePhone(normalizedPhone)) {
    return { status: 'unresolved', reason: 'unmatchable_phone' };
  }

  const matches = await tx.pipelineOpportunity.findMany({
    where: { status: 'OPEN', customer: { phone: normalizedPhone } },
    select: {
      id: true,
      scopeType: true,
      scopeId: true,
      customer: { select: { id: true } },
    },
    take: 2,
  });

  if (matches.length === 0) {
    return { status: 'unresolved', reason: 'no_open_opportunity' };
  }
  if (matches.length > 1) {
    return { status: 'unresolved', reason: 'ambiguous_phone' };
  }

  const opportunity = matches[0];
  const eventId = await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'CALL_LOGGED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customer.id,
    actor: { type: PipelineActorType.THULIUM, label: 'Thulium webhook' },
    payload: {
      thuliumConnectionId: notification.connectionId,
      direction: 'INBOUND',
      durationSeconds: 0,
      agentName: notification.agentLogin ?? null,
      recordingUrl: null,
      topic: null,
    },
    idempotencyKey,
  });

  return { status: 'linked', eventId };
}

async function handleRecordingReady(
  tx: Prisma.TransactionClient,
  notification: Extract<ThuliumNotification, { action: 'RECORDING_READY' }>,
  idempotencyKey: string
): Promise<ThuliumHandlingResult> {
  const callEvent = await tx.pipelineEvent.findFirst({
    where: {
      type: 'CALL_LOGGED',
      payload: { path: ['thuliumConnectionId'], equals: notification.connectionId },
    },
    orderBy: { occurredAt: 'desc' },
    select: { opportunityId: true, customerId: true },
  });

  if (!callEvent || !callEvent.opportunityId) {
    return { status: 'unresolved', reason: 'unknown_connection' };
  }

  const opportunity = await tx.pipelineOpportunity.findUnique({
    where: { id: callEvent.opportunityId },
    select: { id: true, scopeType: true, scopeId: true, customerId: true },
  });

  if (!opportunity) {
    return { status: 'unresolved', reason: 'unknown_connection' };
  }

  const eventId = await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'CALL_RECORDING_ATTACHED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: { type: PipelineActorType.THULIUM, label: 'Thulium webhook' },
    payload: {
      thuliumConnectionId: notification.connectionId,
      recordingFilename: notification.filename,
    },
    idempotencyKey,
  });

  return { status: 'linked', eventId };
}

async function handleTicketCreated(
  tx: Prisma.TransactionClient,
  notification: Extract<ThuliumNotification, { action: 'TICKET_CREATED' }>,
  idempotencyKey: string
): Promise<ThuliumHandlingResult> {
  const customer = await tx.pipelineCustomer.findFirst({
    where: { thuliumCustomerId: notification.customerId },
    select: { id: true },
  });

  if (!customer) {
    return { status: 'unresolved', reason: 'unknown_thulium_customer' };
  }

  const matches = await tx.pipelineOpportunity.findMany({
    where: { customerId: customer.id, status: 'OPEN' },
    select: {
      id: true,
      scopeType: true,
      scopeId: true,
      thuliumTicketId: true,
      customerId: true,
    },
    take: 2,
  });

  if (matches.length === 0) {
    return { status: 'unresolved', reason: 'no_open_opportunity' };
  }
  if (matches.length > 1) {
    return { status: 'unresolved', reason: 'ambiguous_customer_opportunities' };
  }

  const opportunity = matches[0];

  if (opportunity.thuliumTicketId != null && opportunity.thuliumTicketId !== notification.ticketId) {
    throw new ThuliumWebhookConflictError('Sprawa jest już połączona z innym ticketem Thulium');
  }

  if (opportunity.thuliumTicketId == null) {
    const updated = await tx.pipelineOpportunity.updateMany({
      where: { id: opportunity.id, thuliumTicketId: null },
      data: { thuliumTicketId: notification.ticketId },
    });
    if (updated.count === 0) {
      const current = await tx.pipelineOpportunity.findUniqueOrThrow({
        where: { id: opportunity.id },
        select: { thuliumTicketId: true },
      });
      if (current.thuliumTicketId !== notification.ticketId) {
        throw new ThuliumWebhookConflictError('Sprawa jest już połączona z innym ticketem Thulium');
      }
    }
  }

  const eventId = await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'TICKET_LINKED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: { type: PipelineActorType.THULIUM, label: 'Thulium webhook' },
    payload: {
      thuliumTicketId: notification.ticketId,
      thuliumCustomerId: notification.customerId,
    },
    idempotencyKey,
  });

  return { status: 'linked', eventId };
}

export async function handleThuliumNotification(
  tx: Prisma.TransactionClient,
  input: { notification: ThuliumNotification; idempotencyKey: string }
): Promise<ThuliumHandlingResult> {
  const { notification, idempotencyKey } = input;

  switch (notification.action) {
    case 'AGENT_RINGING':
      return handleAgentRinging(tx, notification, idempotencyKey);
    case 'RECORDING_READY':
      return handleRecordingReady(tx, notification, idempotencyKey);
    case 'TICKET_CREATED':
      return handleTicketCreated(tx, notification, idempotencyKey);
    case 'CUSTOMER_CREATED':
    case 'CUSTOMER_UPDATED':
      return { status: 'unresolved', reason: 'not_actionable_without_thulium_client' };
  }
}
