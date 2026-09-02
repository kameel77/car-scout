import { describe, it, expect, afterAll } from 'vitest';
import {
  PrismaClient,
  ScopeType,
  PipelinePhase,
  LeadSourceChannel,
  PipelineActorType,
  ClientType,
  FinancingType,
  PipelineApplicationState,
  OpportunityStatus,
} from '@prisma/client';
import { executeCreateOpportunity, executeChangePhase, executePatchOpportunity } from '../services/opportunity.service.js';
import {
  executeCreateApplication,
  executeSubmitApplication,
  executeDecideApplication,
  executeRerouteApplication,
} from '../services/application.service.js';
import { executeCreateOrUpdateOffer } from '../services/offer.service.js';
import { evaluatePhaseRequirements } from '../workflow/requirements.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-parallel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-m2-parallel-1', label: 'Doradca Parallel' };

describe('Milestone M2: Parallel Applications, Document Union & Contracted Withdrawal', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows parallel submissions in the same round, gates pass if ANY application satisfies requirements', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Krzysztof Równoległy',
      customerPhone: '+48600444555',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    // 1. Create offer
    await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 10000000,
        downPaymentGrosze: 1000000,
        periodMonths: 48,
        monthlyRateGrosze: 220000,
      },
      TEST_ACTOR
    );

    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'VEHIS' } });
    const ayvens = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'AYVENS' } });

    // 2. Submit application to Vehis in Round 1
    const app1 = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id, roundMode: 'JOIN_CURRENT' },
      TEST_ACTOR
    );

    // 3. Submit application to Ayvens in Round 1 (parallel)
    const app2 = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: ayvens.id, roundMode: 'JOIN_CURRENT' },
      TEST_ACTOR
    );

    expect(app1.roundNumber).toBe(1);
    expect(app2.roundNumber).toBe(1);

    // 4. Verify gate evaluation for FINANCIAL_DECISION passes
    const evalRes = await prisma.$transaction((tx) =>
      evaluatePhaseRequirements(tx, scope, opp.id, PipelinePhase.FINANCIAL_DECISION)
    );
    expect(evalRes.allowed).toBe(true);
    expect(evalRes.unmetHard).toHaveLength(0);

    // 5. Verify document materialization unions documents for both active financiers
    const docs = await prisma.pipelineDocument.findMany({
      where: { opportunityId: opp.id },
    });
    expect(docs.length).toBeGreaterThan(0);
  });

  it('keeps opportunity OPEN when one parallel application is rejected and another is approved', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Tomasz Dual',
      customerPhone: '+48600888999',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'VEHIS' } });
    const ayvens = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'AYVENS' } });

    const appVehis = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id },
      TEST_ACTOR
    );

    const appAyvens = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: ayvens.id },
      TEST_ACTOR
    );

    // Vehis rejects
    await executeDecideApplication(
      prisma,
      scope,
      appVehis.id,
      {
        decision: 'REJECTED',
        rejectionReasonCode: 'FIN_CREDITWORTHINESS',
      },
      TEST_ACTOR
    );

    // Ayvens approves
    await executeDecideApplication(
      prisma,
      scope,
      appAyvens.id,
      {
        decision: 'APPROVED',
      },
      TEST_ACTOR
    );

    const oppCheck = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: opp.id },
    });
    expect(oppCheck.status).toBe(OpportunityStatus.OPEN);
  });

  it('contract signature with contractedApplicationId automatically withdraws competing applications with CONTRACTED_ELSEWHERE', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Zwycięzca Umowy',
      customerPhone: '+48600999000',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'VEHIS' } });
    const ayvens = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'AYVENS' } });
    const leasys = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'LEASYS' } });

    const appVehis = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id },
      TEST_ACTOR
    );

    const appAyvens = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: ayvens.id },
      TEST_ACTOR
    );

    const appLeasys = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: leasys.id },
      TEST_ACTOR
    );

    // Sign contract for Ayvens
    await executePatchOpportunity(prisma, {
      id: opp.id,
      contractSignedAt: new Date().toISOString(),
      contractedApplicationId: appAyvens.id,
      actor: TEST_ACTOR,
    });

    // Verify Ayvens is unchanged (or approved), while Vehis and Leasys are WITHDRAWN
    const appsAfter = await prisma.pipelineApplication.findMany({
      where: { opportunityId: opp.id },
      orderBy: { createdAt: 'asc' },
    });

    const vehisAfter = appsAfter.find((a) => a.id === appVehis.id);
    const ayvensAfter = appsAfter.find((a) => a.id === appAyvens.id);
    const leasysAfter = appsAfter.find((a) => a.id === appLeasys.id);

    expect(ayvensAfter?.state).not.toBe(PipelineApplicationState.WITHDRAWN);
    expect(vehisAfter?.state).toBe(PipelineApplicationState.WITHDRAWN);
    expect(vehisAfter?.withdrawalReasonCode).toBe('CONTRACTED_ELSEWHERE');
    expect(vehisAfter?.rejectionReasonCode).toBeNull();
    expect(leasysAfter?.state).toBe(PipelineApplicationState.WITHDRAWN);
    expect(leasysAfter?.withdrawalReasonCode).toBe('CONTRACTED_ELSEWHERE');
    expect(leasysAfter?.rejectionReasonCode).toBeNull();

    // Verify APPLICATION_WITHDRAWN events recorded
    const withdrawnEvents = await prisma.pipelineEvent.findMany({
      where: {
        opportunityId: opp.id,
        type: 'APPLICATION_WITHDRAWN',
      },
    });

    expect(withdrawnEvents.length).toBe(2);
    expect((withdrawnEvents[0].payload as any).reason).toBe('CONTRACTED_ELSEWHERE');
  });

  it('escalates JOIN_CURRENT to a new round if the same financier is already present in the current round', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Escalation Test',
      customerPhone: '+48600123456',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'VEHIS' } });

    // Round 1
    const app1 = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id, roundMode: 'JOIN_CURRENT' },
      TEST_ACTOR
    );
    expect(app1.roundNumber).toBe(1);

    // Adding same financier with JOIN_CURRENT must escalate to round 2 without key violation
    const app2 = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id, roundMode: 'JOIN_CURRENT' },
      TEST_ACTOR
    );
    expect(app2.roundNumber).toBe(2);
  });
});
