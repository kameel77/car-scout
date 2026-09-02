import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, ScopeType, PipelinePhase, LeadSourceChannel, PipelineActorType, ClientType, FinancingType, PipelineApplicationState, OpportunityStatus } from '@prisma/client';
import { executeCreateOpportunity } from '../services/opportunity.service.js';
import {
  executeCreateApplication,
  executeSubmitApplication,
  executeDecideApplication,
  executeRerouteApplication,
} from '../services/application.service.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-reroute-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-m2-reroute-1', label: 'Doradca Reroute' };

describe('Milestone M2: Applications & Reroute Sequence', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejecting an application requires a FINANCIER loss reason and NEVER closes the opportunity', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Jan Odrzucony',
      customerPhone: '+48600123999',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const financier = await prisma.pipelineFinancier.findFirstOrThrow({
      where: { code: 'VEHIS' },
    });

    // 1. Create and submit application
    const app = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: financier.id },
      TEST_ACTOR
    );

    expect(app.roundNumber).toBe(1);
    expect(app.state).toBe(PipelineApplicationState.DRAFT);

    await executeSubmitApplication(
      prisma,
      scope,
      app.id,
      { stage: 'PRECHECK', externalReference: 'VEHIS-REF-101' },
      TEST_ACTOR
    );

    // 2. Reject application with valid FINANCIER reason
    const decided = await executeDecideApplication(
      prisma,
      scope,
      app.id,
      {
        decision: 'REJECTED',
        rejectionReasonCode: 'FIN_CREDITWORTHINESS',
      },
      TEST_ACTOR
    );

    expect(decided.state).toBe(PipelineApplicationState.REJECTED);
    expect(decided.rejectionReasonCode).toBe('FIN_CREDITWORTHINESS');

    // 3. Verify opportunity is still OPEN
    const oppCheck = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: opp.id },
    });
    expect(oppCheck.status).toBe(OpportunityStatus.OPEN);
  });

  it('reroutes rejected application to a new financier in roundNumber 2, keeping opportunity open in FINANCIAL_DECISION', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Anna Reroute',
      customerPhone: '+48600987654',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({
      where: { code: 'VEHIS' },
    });
    const ayvens = await prisma.pipelineFinancier.findFirstOrThrow({
      where: { code: 'AYVENS' },
    });

    // 1. First attempt with Vehis
    const app1 = await executeCreateApplication(
      prisma,
      scope,
      opp.id,
      { financierId: vehis.id },
      TEST_ACTOR
    );

    await executeDecideApplication(
      prisma,
      scope,
      app1.id,
      {
        decision: 'REJECTED',
        rejectionReasonCode: 'FIN_CREDITWORTHINESS',
      },
      TEST_ACTOR
    );

    // 2. Execute Reroute to Ayvens (creates roundNumber = 2)
    const app2 = await executeRerouteApplication(
      prisma,
      scope,
      app1.id,
      { targetFinancierId: ayvens.id },
      TEST_ACTOR
    );

    expect(app2.roundNumber).toBe(2);
    expect(app2.rerouteFromId).toBe(app1.id);
    expect(app2.financierId).toBe(ayvens.id);
    expect(app2.state).toBe(PipelineApplicationState.DRAFT);

    // 3. Verify event emitted
    const rerouteEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'APPLICATION_REROUTED',
      },
    });

    expect(rerouteEvent).toBeDefined();
    expect((rerouteEvent?.payload as any).fromFinancierCode).toBe('VEHIS');
    expect((rerouteEvent?.payload as any).toFinancierCode).toBe('AYVENS');
    expect((rerouteEvent?.payload as any).fromApplicationId).toBe(app1.id);
    expect((rerouteEvent?.payload as any).rejectionReasonCode).toBe('FIN_CREDITWORTHINESS');

    // 4. Verify opportunity phase is FINANCIAL_DECISION and status OPEN
    const oppAfter = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: opp.id },
    });
    expect(oppAfter.phase).toBe(PipelinePhase.FINANCIAL_DECISION);
    expect(oppAfter.status).toBe(OpportunityStatus.OPEN);
  });
});
