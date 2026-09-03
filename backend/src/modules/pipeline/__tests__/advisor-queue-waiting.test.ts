import { describe, it, expect, afterAll } from 'vitest';
import {
  PrismaClient,
  ScopeType,
  LeadSourceChannel,
  PipelineActorType,
  ClientType,
  PipelineApplicationState,
  PipelineDocumentStatus,
} from '@prisma/client';
import { executeCreateOpportunity } from '../services/opportunity.service.js';
import { getAdvisorQueue } from '../services/queue.service.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-waiting-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-waiting-1', label: 'Tester Doradca' };

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function createOpp(scope: { scopeType: ScopeType; scopeId: string }, customerName: string) {
  return executeCreateOpportunity(prisma, {
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    leadSource: LeadSourceChannel.ORGANIC,
    customerName,
    customerPhone: '+48600000000',
    clientType: ClientType.B2C,
    actor: TEST_ACTOR,
  });
}

describe('getAdvisorQueue: kubełek waiting', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('wniosek FULL_SUBMITTED złożony 5 dni temu bez decyzji trafia do waiting z APPLICATION_PENDING', async () => {
    const scope = getTestScope();
    const opp = await createOpp(scope, 'Jan Wniosek5Dni');
    const financier = await prisma.pipelineFinancier.findFirst({ where: { isActive: true } });

    await prisma.pipelineApplication.create({
      data: {
        opportunityId: opp.id,
        financierId: financier!.id,
        roundNumber: 1,
        state: PipelineApplicationState.FULL_SUBMITTED,
        submittedFirstAt: daysAgo(6),
        submittedFullAt: daysAgo(5),
        decisionAt: null,
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    const found = queue.waiting.find((o) => o.id === opp.id);
    expect(found).toBeDefined();
    expect(found!.waitingReason).toBe('APPLICATION_PENDING');
  });

  it('wniosek złożony wczoraj NIE trafia do waiting', async () => {
    const scope = getTestScope();
    const opp = await createOpp(scope, 'Anna WczorajZlozony');
    const financier = await prisma.pipelineFinancier.findFirst({ where: { isActive: true } });

    await prisma.pipelineApplication.create({
      data: {
        opportunityId: opp.id,
        financierId: financier!.id,
        roundNumber: 1,
        state: PipelineApplicationState.FULL_SUBMITTED,
        submittedFirstAt: daysAgo(1),
        submittedFullAt: daysAgo(1),
        decisionAt: null,
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    const found = queue.waiting.find((o) => o.id === opp.id);
    expect(found).toBeUndefined();
  });

  it('dokument REQUESTED sprzed 4 dni trafia do waiting z DOCUMENT_PENDING', async () => {
    const scope = getTestScope();
    const opp = await createOpp(scope, 'Piotr Dokument4Dni');

    await prisma.pipelineDocument.create({
      data: {
        opportunityId: opp.id,
        code: 'ID_CARD',
        label: 'Dowód osobisty',
        status: PipelineDocumentStatus.REQUESTED,
        requestedAt: daysAgo(4),
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    const found = queue.waiting.find((o) => o.id === opp.id);
    expect(found).toBeDefined();
    expect(found!.waitingReason).toBe('DOCUMENT_PENDING');
  });

  it('sprawa już w overdue nie dubluje się w waiting', async () => {
    const scope = getTestScope();
    const opp = await createOpp(scope, 'Ewa Zalegla');
    const financier = await prisma.pipelineFinancier.findFirst({ where: { isActive: true } });

    await prisma.pipelineOpportunity.update({
      where: { id: opp.id },
      data: { nextActionDueAt: daysAgo(2) },
    });

    await prisma.pipelineApplication.create({
      data: {
        opportunityId: opp.id,
        financierId: financier!.id,
        roundNumber: 1,
        state: PipelineApplicationState.PRECHECK_SUBMITTED,
        submittedFirstAt: daysAgo(5),
        decisionAt: null,
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    expect(queue.overdue.find((o) => o.id === opp.id)).toBeDefined();
    expect(queue.waiting.find((o) => o.id === opp.id)).toBeUndefined();
  });

  it('gdy oba warunki naraz, waitingReason wskazuje ten ze starszym znacznikiem', async () => {
    const scope = getTestScope();
    const opp = await createOpp(scope, 'Tomasz OboWarunki');
    const financier = await prisma.pipelineFinancier.findFirst({ where: { isActive: true } });

    // Application submitted 10 days ago (older) -> should win
    await prisma.pipelineApplication.create({
      data: {
        opportunityId: opp.id,
        financierId: financier!.id,
        roundNumber: 1,
        state: PipelineApplicationState.FULL_SUBMITTED,
        submittedFirstAt: daysAgo(11),
        submittedFullAt: daysAgo(10),
        decisionAt: null,
      },
    });

    // Document requested 4 days ago (newer)
    await prisma.pipelineDocument.create({
      data: {
        opportunityId: opp.id,
        code: 'ID_CARD',
        label: 'Dowód osobisty',
        status: PipelineDocumentStatus.REQUESTED,
        requestedAt: daysAgo(4),
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    const found = queue.waiting.find((o) => o.id === opp.id);
    expect(found).toBeDefined();
    expect(found!.waitingReason).toBe('APPLICATION_PENDING');
  });

  it('counts.waiting zgadza się z długością tablicy waiting', async () => {
    const scope = getTestScope();
    const opp1 = await createOpp(scope, 'Klient Waiting1');
    const opp2 = await createOpp(scope, 'Klient Waiting2');
    const financier = await prisma.pipelineFinancier.findFirst({ where: { isActive: true } });

    await prisma.pipelineApplication.create({
      data: {
        opportunityId: opp1.id,
        financierId: financier!.id,
        roundNumber: 1,
        state: PipelineApplicationState.FULL_SUBMITTED,
        submittedFirstAt: daysAgo(5),
        submittedFullAt: daysAgo(5),
        decisionAt: null,
      },
    });

    await prisma.pipelineDocument.create({
      data: {
        opportunityId: opp2.id,
        code: 'ID_CARD',
        label: 'Dowód osobisty',
        status: PipelineDocumentStatus.REQUESTED,
        requestedAt: daysAgo(4),
      },
    });

    const queue = await getAdvisorQueue(prisma, scope);
    expect(queue.counts.waiting).toBe(queue.waiting.length);
    expect(queue.waiting.length).toBeGreaterThanOrEqual(2);
  });
});
