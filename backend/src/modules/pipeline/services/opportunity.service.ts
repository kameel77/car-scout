import {
  Prisma,
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  OpportunityStatus,
  PipelinePhase,
  LeadSourceChannel,
  PipelineActorType,
  PipelineOpportunity,
  PipelineApplicationState,
} from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { allocateOpportunityNumber } from './numbering.service.js';
import { findOrCreateCustomer } from './customer.service.js';
import { isPhaseTransitionAllowed, isForwardTransition } from '../workflow/phases.js';
import { evaluatePhaseRequirements, StageGateViolationError } from '../workflow/requirements.js';
import { materializeDocumentsForOpportunity } from './document.service.js';
import { withdrawOtherApplicationsOnContract } from './application.service.js';

export type ActorContext = {
  type: PipelineActorType;
  userId?: string | null;
  label?: string | null;
};

export type CreateOpportunityInput = {
  scopeType: ScopeType;
  scopeId: string;
  leadSource: LeadSourceChannel;
  leadSourceDetail?: string | null;
  clientType?: ClientType;
  financingType?: FinancingType | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  companyName?: string | null;
  companyNip?: string | null;
  sourceLeadId?: string | null;
  ownerUserId?: string | null;
  initialPhase?: PipelinePhase;
  nextActionType?: string | null;
  nextActionDueAt?: Date | null;
  nextActionNote?: string | null;
  actor: ActorContext;
};

export async function createOpportunity(
  tx: Prisma.TransactionClient,
  input: CreateOpportunityInput
): Promise<PipelineOpportunity> {
  if (!input.leadSource) {
    throw new Error('createOpportunity: leadSource is required');
  }

  const number = await allocateOpportunityNumber(tx, new Date().getFullYear());

  const { customer, isAmbiguous } = await findOrCreateCustomer(tx, {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    fullName: input.customerName,
    phone: input.customerPhone,
    email: input.customerEmail,
    companyName: input.companyName,
    companyNip: input.companyNip,
    clientType: input.clientType,
  });

  const now = new Date();
  const phase = input.initialPhase ?? PipelinePhase.QUALIFICATION;

  const opportunity = await tx.pipelineOpportunity.create({
    data: {
      number,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      customerId: customer.id,
      status: OpportunityStatus.OPEN,
      phase,
      phaseEnteredAt: now,
      firstTouchAt: now,
      clientType: input.clientType ?? ClientType.UNKNOWN,
      financingType: input.financingType ?? null,
      leadSource: input.leadSource,
      leadSourceDetail: input.leadSourceDetail ?? null,
      sourceLeadId: input.sourceLeadId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      nextActionType: input.nextActionType ?? null,
      nextActionDueAt: input.nextActionDueAt ?? null,
      nextActionNote: input.nextActionNote ?? null,
    },
  });

  // 1. Record OPPORTUNITY_CREATED event
  await recordEvent(tx, {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    type: 'OPPORTUNITY_CREATED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: customer.id,
    actor: input.actor,
    payload: {
      number: opportunity.number,
      leadSource: opportunity.leadSource,
      leadSourceDetail: opportunity.leadSourceDetail,
      clientType: opportunity.clientType,
      sourceLeadId: opportunity.sourceLeadId,
      createdFrom: input.sourceLeadId ? 'INBOX' : 'MANUAL',
    },
  });

  // 2. Record OPPORTUNITY_OWNER_CHANGED if assigned
  if (opportunity.ownerUserId) {
    await recordEvent(tx, {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      type: 'OPPORTUNITY_OWNER_CHANGED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: customer.id,
      actor: input.actor,
      payload: {
        before: null,
        after: opportunity.ownerUserId,
        reason: 'PICKUP',
      },
    });
  }

  // 3. Record OPPORTUNITY_NEXT_ACTION_SET if scheduled
  if (opportunity.nextActionType && opportunity.nextActionDueAt) {
    await recordEvent(tx, {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      type: 'OPPORTUNITY_NEXT_ACTION_SET',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: customer.id,
      actor: input.actor,
      payload: {
        before: null,
        after: {
          type: opportunity.nextActionType,
          dueAt: opportunity.nextActionDueAt.toISOString(),
          note: opportunity.nextActionNote,
        },
      },
    });
  }

  // If customer matching was ambiguous, record note
  if (isAmbiguous) {
    await recordEvent(tx, {
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      type: 'NOTE_ADDED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: customer.id,
      actor: { type: PipelineActorType.SYSTEM, label: 'Dopasowanie klienta' },
      payload: {
        content: 'Uwaga: Niejednoznaczne dopasowanie danych kontaktowych klienta. Utworzono nową kartotekę.',
      },
    });
  }

  // Auto-materialize initial document checklist
  await materializeDocumentsForOpportunity(tx, opportunity.id);

  return opportunity;
}

export async function changePhase(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    targetPhase: PipelinePhase;
    actor: ActorContext;
    overridden?: boolean;
    overrideReason?: string;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  if (opportunity.phase === input.targetPhase) {
    return opportunity;
  }

  if (!isPhaseTransitionAllowed(opportunity.phase, input.targetPhase, input.overridden)) {
    throw new Error(`Niedozwolone przejście z fazy ${opportunity.phase} do ${input.targetPhase}`);
  }

  let unmetSoftFields: string[] = [];

  // Evaluate hard stage gates only on forward transitions
  if (isForwardTransition(opportunity.phase, input.targetPhase)) {
    const evalResult = await evaluatePhaseRequirements(
      tx,
      { scopeType: opportunity.scopeType, scopeId: opportunity.scopeId },
      opportunity.id,
      input.targetPhase
    );

    if (!evalResult.allowed && !input.overridden) {
      throw new StageGateViolationError(
        opportunity.phase,
        input.targetPhase,
        evalResult.unmetHard
      );
    }

    unmetSoftFields = evalResult.unmetSoft.map((m) => m.fieldPath);
  }

  const now = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - opportunity.phaseEnteredAt.getTime()) / 1000)
  );

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: {
      phase: input.targetPhase,
      phaseEnteredAt: now,
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OPPORTUNITY_PHASE_CHANGED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: input.actor,
    payload: {
      before: opportunity.phase,
      after: input.targetPhase,
      durationSeconds,
      overridden: input.overridden ?? false,
      unmetRequirements: unmetSoftFields.length > 0 ? unmetSoftFields : undefined,
    },
  });

  return updated;
}

export async function assignOwner(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    newOwnerUserId: string | null;
    actor: ActorContext;
    reason?: 'MANUAL' | 'ROUND_ROBIN' | 'PICKUP';
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  if (opportunity.ownerUserId === input.newOwnerUserId) {
    return opportunity;
  }

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: { ownerUserId: input.newOwnerUserId },
  });

  if (input.newOwnerUserId) {
    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'OPPORTUNITY_OWNER_CHANGED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor: input.actor,
      payload: {
        before: opportunity.ownerUserId,
        after: input.newOwnerUserId,
        reason: input.reason ?? 'MANUAL',
      },
    });
  }

  return updated;
}

export async function setNextAction(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    nextActionType: string;
    nextActionDueAt: Date | null;
    nextActionNote?: string | null;
    actor: ActorContext;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: {
      nextActionType: input.nextActionType,
      nextActionDueAt: input.nextActionDueAt,
      nextActionNote: input.nextActionNote ?? null,
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OPPORTUNITY_NEXT_ACTION_SET',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: input.actor,
    payload: {
      before: opportunity.nextActionType
        ? {
            type: opportunity.nextActionType,
            dueAt: opportunity.nextActionDueAt?.toISOString() ?? null,
          }
        : null,
      after: {
        type: input.nextActionType,
        dueAt: input.nextActionDueAt ? input.nextActionDueAt.toISOString() : null,
        note: input.nextActionNote ?? null,
      },
    },
  });

  return updated;
}

export async function logContact(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    channel: 'CALL' | 'EMAIL' | 'SMS' | 'MEETING';
    actor: ActorContext;
    note?: string | null;
    nextActionType?: string | null;
    nextActionDueAt?: Date | null;
    nextActionNote?: string | null;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  const now = new Date();
  const isFirstContact = !opportunity.firstContactAt;
  const firstContactAt = opportunity.firstContactAt ?? now;

  let updateData: Prisma.PipelineOpportunityUpdateInput = {};
  if (isFirstContact) {
    updateData.firstContactAt = firstContactAt;
  }

  if (input.nextActionType && input.nextActionDueAt) {
    updateData.nextActionType = input.nextActionType;
    updateData.nextActionDueAt = input.nextActionDueAt;
    updateData.nextActionNote = input.nextActionNote ?? null;
  }

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: updateData,
  });

  // Record FIRST_CONTACT if this was the initial contact
  if (isFirstContact) {
    const secondsFromFirstTouch = Math.max(
      0,
      Math.floor((now.getTime() - opportunity.firstTouchAt.getTime()) / 1000)
    );

    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'OPPORTUNITY_FIRST_CONTACT',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor: input.actor,
      payload: {
        at: now.toISOString(),
        channel: input.channel,
        secondsFromFirstTouch,
      },
    });
  }

  // Record contact note if provided
  if (input.note) {
    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'NOTE_ADDED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor: input.actor,
      payload: {
        content: `[Kontakt: ${input.channel}] ${input.note}`,
      },
    });
  }

  // Record NEXT_ACTION_SET if updated
  if (input.nextActionType && input.nextActionDueAt) {
    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'OPPORTUNITY_NEXT_ACTION_SET',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor: input.actor,
      payload: {
        before: opportunity.nextActionType
          ? {
              type: opportunity.nextActionType,
              dueAt: opportunity.nextActionDueAt?.toISOString() ?? null,
            }
          : null,
        after: {
          type: input.nextActionType,
          dueAt: input.nextActionDueAt.toISOString(),
          note: input.nextActionNote ?? null,
        },
      },
    });
  }

  return updated;
}

export async function closeWon(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    actor: ActorContext;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  const now = new Date();
  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: {
      status: OpportunityStatus.WON,
      wonAt: now,
      // Phase remains intact
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OPPORTUNITY_WON',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: input.actor,
    payload: {
      phase: opportunity.phase,
    },
  });

  return updated;
}

export async function closeLost(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    reasonCode: string;
    comment?: string | null;
    actor: ActorContext;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
  });

  const reason = await tx.pipelineLossReason.findUnique({
    where: { code: input.reasonCode },
  });
  if (!reason) {
    throw new Error(`Nieprawidłowy powód odrzucenia: ${input.reasonCode}`);
  }

  const now = new Date();
  const daysOpen = Math.max(
    0,
    Math.floor((now.getTime() - opportunity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: {
      status: OpportunityStatus.LOST,
      lostAt: now,
      lostReasonCode: input.reasonCode,
      lostComment: input.comment ?? null,
      // Phase remains intact
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OPPORTUNITY_LOST',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor: input.actor,
    payload: {
      phase: opportunity.phase,
      reasonCode: input.reasonCode,
      comment: input.comment ?? undefined,
      daysOpen,
    },
  });

  return updated;
}

export async function patchOpportunity(
  tx: Prisma.TransactionClient,
  input: {
    id: string;
    clientType?: ClientType;
    financingType?: FinancingType | null;
    leadSource?: LeadSourceChannel;
    leadSourceDetail?: string | null;
    customerName?: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    companyName?: string | null;
    companyNip?: string | null;
    contractSignedAt?: string | null;
    contractedApplicationId?: string | null;
    actor: ActorContext;
  }
): Promise<PipelineOpportunity> {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: input.id },
    include: { customer: true },
  });

  const oppUpdate: Prisma.PipelineOpportunityUpdateInput = {};
  if (input.clientType) oppUpdate.clientType = input.clientType;
  if (input.financingType !== undefined) oppUpdate.financingType = input.financingType;
  if (input.leadSource) oppUpdate.leadSource = input.leadSource;
  if (input.leadSourceDetail !== undefined) oppUpdate.leadSourceDetail = input.leadSourceDetail;
  if (input.contractSignedAt !== undefined) {
    oppUpdate.contractSignedAt = input.contractSignedAt ? new Date(input.contractSignedAt) : null;
  }
  if (input.contractedApplicationId !== undefined) {
    oppUpdate.contractedApplication = input.contractedApplicationId
      ? { connect: { id: input.contractedApplicationId } }
      : { disconnect: true };
  }

  const updated = await tx.pipelineOpportunity.update({
    where: { id: input.id },
    data: oppUpdate,
  });

  // Update customer details if provided
  const custUpdate: Prisma.PipelineCustomerUpdateInput = {};
  if (input.customerName) custUpdate.fullName = input.customerName.trim();
  if (input.customerPhone !== undefined) custUpdate.phone = input.customerPhone;
  if (input.customerEmail !== undefined) custUpdate.email = input.customerEmail;
  if (input.companyName !== undefined) custUpdate.companyName = input.companyName;
  if (input.companyNip !== undefined) custUpdate.companyNip = input.companyNip;
  if (input.clientType) custUpdate.clientType = input.clientType;

  if (Object.keys(custUpdate).length > 0) {
    await tx.pipelineCustomer.update({
      where: { id: opportunity.customerId },
      data: custUpdate,
    });
  }

  // If contractedApplicationId is specified with contract signing, withdraw competing applications
  if (input.contractedApplicationId) {
    await withdrawOtherApplicationsOnContract(
      tx,
      opportunity.id,
      input.contractedApplicationId,
      input.actor
    );

    // Attach commission to contracted application
    await tx.pipelineCommission.updateMany({
      where: { opportunityId: opportunity.id, applicationId: null },
      data: { applicationId: input.contractedApplicationId },
    });
  }

  if (input.clientType || input.financingType !== undefined) {
    await materializeDocumentsForOpportunity(tx, opportunity.id);
  }

  return updated;
}

// Transactional executor wrappers for routes
export async function executeCreateOpportunity(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: CreateOpportunityInput
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => createOpportunity(tx, input))
    : createOpportunity(prisma as Prisma.TransactionClient, input);
}

export async function executeChangePhase(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof changePhase>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => changePhase(tx, input))
    : changePhase(prisma as Prisma.TransactionClient, input);
}

export async function executeAssignOwner(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof assignOwner>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => assignOwner(tx, input))
    : assignOwner(prisma as Prisma.TransactionClient, input);
}

export async function executeSetNextAction(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof setNextAction>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => setNextAction(tx, input))
    : setNextAction(prisma as Prisma.TransactionClient, input);
}

export async function executeLogContact(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof logContact>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => logContact(tx, input))
    : logContact(prisma as Prisma.TransactionClient, input);
}

export async function executeCloseWon(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof closeWon>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => closeWon(tx, input))
    : closeWon(prisma as Prisma.TransactionClient, input);
}

export async function executeCloseLost(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof closeLost>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => closeLost(tx, input))
    : closeLost(prisma as Prisma.TransactionClient, input);
}

export async function executePatchOpportunity(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof patchOpportunity>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => patchOpportunity(tx, input))
    : patchOpportunity(prisma as Prisma.TransactionClient, input);
}
