import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, ScopeType, PipelinePhase, LeadSourceChannel, PipelineActorType, ClientType, FinancingType } from '@prisma/client';
import { executeCreateOpportunity, executeChangePhase } from '../services/opportunity.service.js';
import { executeCreateOrUpdateOffer } from '../services/offer.service.js';
import { executeCreateApplication } from '../services/application.service.js';
import { StageGateViolationError, calculateOpportunityCompleteness } from '../workflow/requirements.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-gating-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-m2-gating-1', label: 'Tester Doradca' };

describe('Milestone M2: Stage Gating Engine', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocks forward transition to FINANCIAL_DECISION with 422 if hard requirements are missing, without touching DB or writing events', async () => {
    const scope = getTestScope();

    // 1. Create opportunity starting in QUALIFICATION with empty financingType
    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Jan Kowalski Test',
      customerPhone: '+48600111222',
      clientType: ClientType.B2C,
      financingType: null, // empty
      actor: TEST_ACTOR,
    });

    const eventCountBefore = await prisma.pipelineEvent.count({
      where: { opportunityId: opp.id },
    });

    // 2. Attempt forward move to FINANCIAL_DECISION without offer, vehicle, application or financingType
    let caughtError: any = null;
    try {
      await executeChangePhase(prisma, {
        id: opp.id,
        targetPhase: PipelinePhase.FINANCIAL_DECISION,
        actor: TEST_ACTOR,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(StageGateViolationError);
    expect(caughtError.statusCode).toBe(422);
    expect(caughtError.targetPhase).toBe(PipelinePhase.FINANCIAL_DECISION);
    expect(caughtError.missing.length).toBeGreaterThan(0);

    const missingPaths = caughtError.missing.map((m: any) => m.fieldPath);
    expect(missingPaths).toContain('opportunity.financingType');
    expect(missingPaths).toContain('offer.priceGrosze');
    expect(missingPaths).toContain('offer.monthlyRateGrosze');
    expect(missingPaths).toContain('application.financierId');

    // 3. Verify DB is completely untouched: phase remains QUALIFICATION and NO new events recorded
    const oppAfter = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: opp.id },
    });
    expect(oppAfter.phase).toBe(PipelinePhase.QUALIFICATION);

    const eventCountAfter = await prisma.pipelineEvent.count({
      where: { opportunityId: opp.id },
    });
    expect(eventCountAfter).toBe(eventCountBefore);
  });

  it('requires customer.companyNip for B2B clients entering FINANCIAL_DECISION', async () => {
    const scope = getTestScope();

    // 1. Create B2B opportunity without NIP
    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Firma Testowa Sp. z o.o.',
      customerPhone: '+48600333444',
      clientType: ClientType.B2B,
      companyName: 'Firma Testowa',
      companyNip: null, // missing NIP
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    // Create offer & application
    await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 15000000,
        downPaymentGrosze: 1500000,
        periodMonths: 36,
        monthlyRateGrosze: 320000,
      },
      TEST_ACTOR
    );

    const financier = await prisma.pipelineFinancier.findFirst({
      where: { isActive: true },
    });

    await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      {
        financierId: financier!.id,
      },
      TEST_ACTOR
    );

    // Attempt forward transition to FINANCIAL_DECISION
    let caughtError: any = null;
    try {
      await executeChangePhase(prisma, {
        id: opp.id,
        targetPhase: PipelinePhase.FINANCIAL_DECISION,
        actor: TEST_ACTOR,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(StageGateViolationError);
    const missingPaths = caughtError.missing.map((m: any) => m.fieldPath);
    expect(missingPaths).toContain('customer.companyNip');
  });

  it('allows backward transition without evaluation of forward hard gates and still emits OPPORTUNITY_PHASE_CHANGED', async () => {
    const scope = getTestScope();

    // Create opportunity in CONTRACT phase
    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Marek Cofanie',
      customerPhone: '+48600555666',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      initialPhase: PipelinePhase.CONTRACT,
      actor: TEST_ACTOR,
    });

    // Move backward to SELECTION
    const moved = await executeChangePhase(prisma, {
      id: opp.id,
      targetPhase: PipelinePhase.SELECTION,
      actor: TEST_ACTOR,
    });

    expect(moved.phase).toBe(PipelinePhase.SELECTION);

    // Verify event was recorded
    const phaseEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OPPORTUNITY_PHASE_CHANGED',
      },
      orderBy: { occurredAt: 'desc' },
    });

    expect(phaseEvent).toBeDefined();
    expect((phaseEvent?.payload as any).before).toBe(PipelinePhase.CONTRACT);
    expect((phaseEvent?.payload as any).after).toBe(PipelinePhase.SELECTION);
  });

  it('succeeds entering FINANCIAL_DECISION when all hard requirements are fulfilled and calculates next-phase completeness', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Piotr Sukces',
      customerPhone: '+48600777888',
      clientType: ClientType.B2C,
      financingType: FinancingType.CREDIT,
      actor: TEST_ACTOR,
    });

    // 1. Add offer
    await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.CREDIT,
        priceGrosze: 8000000,
        downPaymentGrosze: 800000,
        periodMonths: 48,
        monthlyRateGrosze: 180000,
      },
      TEST_ACTOR
    );

    // 2. Add application with financier
    const financier = await prisma.pipelineFinancier.findFirst({
      where: { isActive: true },
    });

    await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      {
        financierId: financier!.id,
      },
      TEST_ACTOR
    );

    // 3. Move forward to FINANCIAL_DECISION
    const moved = await executeChangePhase(prisma, {
      id: opp.id,
      targetPhase: PipelinePhase.FINANCIAL_DECISION,
      actor: TEST_ACTOR,
    });

    expect(moved.phase).toBe(PipelinePhase.FINANCIAL_DECISION);

    // 4. Test completeness calculation measuring NEXT phase (FINANCIAL_DECISION from COMPLETING)
    const allReqs = await prisma.pipelinePhaseRequirement.findMany({
      where: { isActive: true },
    });

    const fullOpp = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: opp.id },
      include: {
        customer: true,
        offers: true,
        applications: true,
        vehicleCandidates: true,
        commissions: true,
      },
    });

    // When opp was in COMPLETING, nextPhase is FINANCIAL_DECISION
    const compCompleting = calculateOpportunityCompleteness({ ...fullOpp, phase: PipelinePhase.COMPLETING }, allReqs);
    expect(compCompleting.nextPhase).toBe(PipelinePhase.FINANCIAL_DECISION);
    expect(compCompleting.total).toBeGreaterThan(0);
    expect(compCompleting.percentage).toBe(100);

    // When opp is in CONTRACT, nextPhase is DELIVERY
    const compContract = calculateOpportunityCompleteness({ ...fullOpp, phase: PipelinePhase.CONTRACT }, allReqs);
    expect(compContract.nextPhase).toBe(PipelinePhase.DELIVERY);
    expect(compContract.total).toBeGreaterThan(0);
  });
});
