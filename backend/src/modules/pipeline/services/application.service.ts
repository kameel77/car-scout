import { Prisma, PrismaClient, ScopeType, PipelineApplicationState, PipelinePhase } from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { ActorContext, changePhase } from './opportunity.service.js';
import { materializeDocumentsForOpportunity } from './document.service.js';

export type CreateApplicationInput = {
  financierId: string;
  offerId?: string | null;
  externalReference?: string | null;
  roundMode?: 'JOIN_CURRENT' | 'NEW_ROUND';
  rerouteFromId?: string | null;
};

export type SubmitApplicationInput = {
  stage: 'PRECHECK' | 'FULL';
  externalReference?: string | null;
};

export type DecideApplicationInput = {
  decision: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED';
  rejectionReasonCode?: string | null;
  rejectionComment?: string | null;
  approvedConditions?: Record<string, unknown> | null;
};

export type RerouteApplicationInput = {
  targetFinancierId: string;
  offerId?: string | null;
  note?: string | null;
};

export async function createApplication(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: CreateApplicationInput,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      applications: {
        orderBy: { roundNumber: 'desc' },
      },
    },
  });

  const financier = await tx.pipelineFinancier.findUniqueOrThrow({
    where: { id: input.financierId },
  });

  let roundNumber = 1;

  if (input.rerouteFromId) {
    const parent = await tx.pipelineApplication.findUniqueOrThrow({
      where: { id: input.rerouteFromId },
    });
    roundNumber = parent.roundNumber + 1;
  } else {
    const rounds = opportunity.applications.map((a) => a.roundNumber);
    const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;

    if (maxRound === 0) {
      roundNumber = 1;
    } else if (input.roundMode === 'NEW_ROUND') {
      roundNumber = maxRound + 1;
    } else {
      // JOIN_CURRENT (default):
      const alreadyInCurrentRound = opportunity.applications.some(
        (a) => a.financierId === input.financierId && a.roundNumber === maxRound
      );
      roundNumber = alreadyInCurrentRound ? maxRound + 1 : maxRound;
    }
  }

  const application = await tx.pipelineApplication.create({
    data: {
      opportunityId,
      financierId: input.financierId,
      offerId: input.offerId || null,
      roundNumber,
      rerouteFromId: input.rerouteFromId || null,
      externalReference: input.externalReference || null,
      state: PipelineApplicationState.DRAFT,
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'APPLICATION_CREATED',
    aggregateType: 'APPLICATION',
    aggregateId: application.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      financierCode: financier.code,
      roundNumber: application.roundNumber,
      offerId: application.offerId,
      rerouteFromId: application.rerouteFromId,
    },
  });

  // Auto-materialize documents across the union of all active financiers
  await materializeDocumentsForOpportunity(tx, opportunityId);

  return application;
}

export async function submitApplication(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  applicationId: string,
  input: SubmitApplicationInput,
  actor: ActorContext
) {
  const application = await tx.pipelineApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      opportunity: true,
      financier: true,
    },
  });

  const now = new Date();
  const isPrecheck = input.stage === 'PRECHECK';
  const newState = isPrecheck
    ? PipelineApplicationState.PRECHECK_SUBMITTED
    : PipelineApplicationState.FULL_SUBMITTED;

  const updateData: Prisma.PipelineApplicationUpdateInput = {
    state: newState,
    externalReference: input.externalReference ?? application.externalReference,
  };

  if (isPrecheck && !application.submittedFirstAt) {
    updateData.submittedFirstAt = now;
  } else if (!isPrecheck) {
    if (!application.submittedFirstAt) {
      updateData.submittedFirstAt = now;
    }
    updateData.submittedFullAt = now;
  }

  const updated = await tx.pipelineApplication.update({
    where: { id: applicationId },
    data: updateData,
  });

  await recordEvent(tx, {
    scopeType: application.opportunity.scopeType,
    scopeId: application.opportunity.scopeId,
    type: 'APPLICATION_SUBMITTED',
    aggregateType: 'APPLICATION',
    aggregateId: updated.id,
    opportunityId: application.opportunityId,
    customerId: application.opportunity.customerId,
    actor,
    payload: {
      stage: input.stage,
      financierCode: application.financier.code,
      externalReference: updated.externalReference,
    },
  });

  return updated;
}

export async function decideApplication(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  applicationId: string,
  input: DecideApplicationInput,
  actor: ActorContext
) {
  const application = await tx.pipelineApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      opportunity: true,
      financier: true,
    },
  });

  const now = new Date();

  if (input.decision === 'REJECTED') {
    if (!input.rejectionReasonCode) {
      throw new Error('Kod powodu odrzucenia jest wymagany przy decyzji odmownej (REJECTED)');
    }

    const reason = await tx.pipelineLossReason.findUnique({
      where: { code: input.rejectionReasonCode },
    });

    if (!reason || reason.category !== 'FINANCIER') {
      throw new Error(
        `Nieprawidłowy kod powodu odrzucenia (${input.rejectionReasonCode}). Wymagany powód z kategorii FINANCIER.`
      );
    }

    if (reason.requiresComment && !input.rejectionComment?.trim()) {
      throw new Error(`Powód odrzucenia ${reason.label} wymaga podania komentarza.`);
    }
  }

  const baseDate = application.submittedFirstAt || application.createdAt;
  const decisionDays = Math.max(
    0,
    Math.floor((now.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const updated = await tx.pipelineApplication.update({
    where: { id: applicationId },
    data: {
      state: input.decision as PipelineApplicationState,
      decisionAt: now,
      rejectionReasonCode: input.decision === 'REJECTED' ? input.rejectionReasonCode : null,
      rejectionComment: input.decision === 'REJECTED' ? input.rejectionComment?.trim() || null : null,
      approvedConditions:
        input.decision !== 'REJECTED' && input.approvedConditions
          ? (input.approvedConditions as Prisma.InputJsonValue)
          : undefined,
    },
  });

  await recordEvent(tx, {
    scopeType: application.opportunity.scopeType,
    scopeId: application.opportunity.scopeId,
    type: 'APPLICATION_DECIDED',
    aggregateType: 'APPLICATION',
    aggregateId: updated.id,
    opportunityId: application.opportunityId,
    customerId: application.opportunity.customerId,
    actor,
    payload: {
      financierCode: application.financier.code,
      decision: input.decision,
      reasonCode: updated.rejectionReasonCode,
      conditions: updated.approvedConditions,
      decisionDays,
    },
  });

  // CRITICAL: A rejection MUST NEVER close the opportunity! Opportunity remains OPEN.
  return updated;
}

export async function rerouteApplication(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  sourceApplicationId: string,
  input: RerouteApplicationInput,
  actor: ActorContext
) {
  const sourceApp = await tx.pipelineApplication.findUniqueOrThrow({
    where: { id: sourceApplicationId },
    include: {
      opportunity: true,
      financier: true,
    },
  });

  const targetFinancier = await tx.pipelineFinancier.findUniqueOrThrow({
    where: { id: input.targetFinancierId },
  });

  // 1. Create new application with rerouteFromId pointing to the refusal
  const newApplication = await createApplication(
    tx,
    scope,
    sourceApp.opportunityId,
    {
      financierId: input.targetFinancierId,
      offerId: input.offerId ?? sourceApp.offerId,
      rerouteFromId: sourceApp.id,
      roundMode: 'NEW_ROUND',
    },
    actor
  );

  // 2. Emit rerouted event
  await recordEvent(tx, {
    scopeType: sourceApp.opportunity.scopeType,
    scopeId: sourceApp.opportunity.scopeId,
    type: 'APPLICATION_REROUTED',
    aggregateType: 'APPLICATION',
    aggregateId: newApplication.id,
    opportunityId: sourceApp.opportunityId,
    customerId: sourceApp.opportunity.customerId,
    actor,
    payload: {
      fromFinancierCode: sourceApp.financier.code,
      toFinancierCode: targetFinancier.code,
      fromApplicationId: sourceApp.id,
      rejectionReasonCode: sourceApp.rejectionReasonCode,
    },
  });

  // 3. Delegate phase transition directly to changePhase (no duplicate logic!)
  if (sourceApp.opportunity.phase !== PipelinePhase.FINANCIAL_DECISION) {
    await changePhase(tx, {
      id: sourceApp.opportunityId,
      targetPhase: PipelinePhase.FINANCIAL_DECISION,
      overridden: true,
      actor,
    });
  }

  return newApplication;
}

/**
 * Operational rule when a contract is signed:
 * Automatically withdraws all competing open applications for this opportunity with CONTRACTED_ELSEWHERE.
 */
export async function withdrawOtherApplicationsOnContract(
  tx: Prisma.TransactionClient,
  opportunityId: string,
  contractedApplicationId: string,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
  });

  const otherApps = await tx.pipelineApplication.findMany({
    where: {
      opportunityId,
      id: { not: contractedApplicationId },
      state: {
        in: [
          PipelineApplicationState.DRAFT,
          PipelineApplicationState.PRECHECK_SUBMITTED,
          PipelineApplicationState.FULL_SUBMITTED,
          PipelineApplicationState.APPROVED,
          PipelineApplicationState.CONDITIONALLY_APPROVED,
        ],
      },
    },
    include: { financier: true },
  });

  for (const app of otherApps) {
    await tx.pipelineApplication.update({
      where: { id: app.id },
      data: {
        state: PipelineApplicationState.WITHDRAWN,
        rejectionReasonCode: 'CONTRACTED_ELSEWHERE',
        rejectionComment: 'Podpisano umowę z innym finansującym',
      },
    });

    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'APPLICATION_WITHDRAWN',
      aggregateType: 'APPLICATION',
      aggregateId: app.id,
      opportunityId,
      customerId: opportunity.customerId,
      actor,
      payload: {
        financierCode: app.financier.code,
        reason: 'CONTRACTED_ELSEWHERE',
      },
    });
  }
}

// Transactional helper wrappers
export async function executeCreateApplication(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: CreateApplicationInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    createApplication(tx, scope, opportunityId, input, actor)
  );
}

export async function executeSubmitApplication(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  applicationId: string,
  input: SubmitApplicationInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    submitApplication(tx, scope, applicationId, input, actor)
  );
}

export async function executeDecideApplication(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  applicationId: string,
  input: DecideApplicationInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    decideApplication(tx, scope, applicationId, input, actor)
  );
}

export async function executeRerouteApplication(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  sourceApplicationId: string,
  input: RerouteApplicationInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    rerouteApplication(tx, scope, sourceApplicationId, input, actor)
  );
}
