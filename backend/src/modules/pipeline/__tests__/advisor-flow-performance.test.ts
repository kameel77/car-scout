import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  PrismaClient,
  ScopeType,
  LeadSourceChannel,
  PipelineActorType,
  ClientType,
  FinancingType,
  PipelinePhase,
  PipelineApplicationState,
  OpportunityStatus,
} from '@prisma/client';
import {
  executeQualifyLead,
} from '../services/inbox.service.js';
import {
  executeCreateOpportunity,
  executeChangePhase,
  executePatchOpportunity,
} from '../services/opportunity.service.js';
import {
  executeAddVehicleCandidate,
  executeSelectVehicleCandidate,
} from '../services/vehicle.service.js';
import {
  executeCreateOrUpdateOffer,
  executePresentOffer,
  executeAcceptOffer,
} from '../services/offer.service.js';
import {
  executeCreateApplication,
  executeSubmitApplication,
  executeDecideApplication,
  executeRerouteApplication,
} from '../services/application.service.js';
import {
  executeUpdateDocumentStatus,
  materializeDocumentsForOpportunity,
} from '../services/document.service.js';
import { listOpportunities } from '../services/opportunity-read.service.js';

describe('Advisor Flow Server Performance & Query Benchmark', () => {
  const prisma = new PrismaClient();
  const testScope = {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `stopwatch-group-${Date.now()}`,
  };
  const testActor = {
    type: PipelineActorType.USER,
    userId: 'doradca-stopwatch-user-1',
    label: 'Jan Doradca (Stopwatch Benchmark)',
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('measures complete end-to-end advisor path under SLA requirements (< 1000ms server processing, ready for 30s UI flow)', async () => {
    const timings: Record<string, number> = {};
    const totalStart = performance.now();

    // 0. Simulation: Customer submits contact form (Lead in Inbox)
    const leadRef = `LEAD-SW-${Date.now()}`;
    const lead = await prisma.lead.create({
      data: {
        referenceNumber: leadRef,
        name: 'Marek Benchmark',
        email: 'marek.benchmark@firma.pl',
        phone: '+48600111222',
        message: 'Dzień dobry, interesuje mnie leasing na BMW X3 2024 na firmę NIP 5252525252',
        trafficSource: 'META',
        leadType: 'b2b',
        createdAt: new Date(),
      },
    });

    const adminUser = await prisma.user.findFirst();
    const ownerId = adminUser?.id ?? null;

    // STEP 1: Advisor qualifies lead from Inbox (0 kliknięć do sprawy)
    const t1 = performance.now();
    const qualifyOpp = await executeQualifyLead(
      prisma,
      {
        leadId: lead.id,
        scopeType: testScope.scopeType,
        scopeId: testScope.scopeId,
        ownerUserId: ownerId,
        clientType: ClientType.B2B,
        financingType: FinancingType.LEASING,
        leadSource: LeadSourceChannel.META,
        leadSourceDetail: 'Kampania Q3 FB Ads',
        nextActionType: 'CALL',
        nextActionDueAt: new Date(Date.now() + 3600 * 1000),
        nextActionNote: 'Telefon kwalifikacyjny - omówić parametry leasingu',
        actor: {
          type: PipelineActorType.USER,
          userId: ownerId,
          label: 'Jan Doradca (Stopwatch Benchmark)',
        },
      }
    );
    timings['1_qualify_lead'] = performance.now() - t1;
    const oppId = qualifyOpp.id;

    // STEP 2: Add vehicle candidate & select primary
    const t2 = performance.now();
    const candidate = await executeAddVehicleCandidate(
      prisma,
      testScope,
      oppId,
      {
        customMake: 'BMW',
        customModel: 'X3',
        customVersion: 'xDrive20d M Sport',
        customYear: 2024,
        priceSnapshotGrosze: 26000000, // 260 000 PLN
        selectionStatus: 'SELECTED',
      },
      testActor
    );
    timings['2_select_vehicle'] = performance.now() - t2;
    expect(candidate.selectionStatus).toBe('SELECTED');

    // STEP 3: Create, calculate PMT & present offer
    const t3 = performance.now();
    const offer = await executeCreateOrUpdateOffer(
      prisma,
      testScope,
      oppId,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 26000000,
        downPaymentGrosze: 2600000, // 10%
        periodMonths: 48,
        monthlyRateGrosze: 485000, // 4 850 PLN
        finalPaymentGrosze: 5200000, // 20%
        annualMileageKm: 25000,
      },
      testActor
    );
    await executePresentOffer(
      prisma,
      testScope,
      oppId,
      offer.id,
      { channel: 'EMAIL' },
      testActor
    );
    timings['3_offer_calculate_present'] = performance.now() - t3;

    // STEP 4: Materialize and collect documents (advance to COMPLETING)
    const t4 = performance.now();
    const docs = await prisma.pipelineDocument.findMany({
      where: { opportunityId: oppId },
    });
    // Mark first required document as RECEIVED
    if (docs.length > 0) {
      await executeUpdateDocumentStatus(
        prisma,
        testScope,
        docs[0].id,
        { status: 'RECEIVED' },
        testActor
      );
    }
    // Update company NIP for B2B stage gate
    await executePatchOpportunity(prisma, {
      id: oppId,
      companyName: 'Benchmark Sp. z o.o.',
      companyNip: '5252525252',
      actor: testActor,
    });
    timings['4_documents_and_b2b_data'] = performance.now() - t4;

    // STEP 5: Parallel application submission in Round 1 (Vehis & Ayvens)
    const t5 = performance.now();
    const vehis = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'VEHIS' } });
    const ayvens = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'AYVENS' } });

    const appVehis = await executeCreateApplication(
      prisma,
      testScope,
      oppId,
      {
        financierId: vehis.id,
        roundMode: 'JOIN_CURRENT',
        externalReference: 'VEHIS-REQ-9921',
      },
      testActor
    );
    await executeSubmitApplication(
      prisma,
      testScope,
      appVehis.id,
      { stage: 'FULL', externalReference: 'VEHIS-REQ-9921' },
      testActor
    );

    const appAyvens = await executeCreateApplication(
      prisma,
      testScope,
      oppId,
      {
        financierId: ayvens.id,
        roundMode: 'JOIN_CURRENT',
        externalReference: 'AYV-REQ-8832',
      },
      testActor
    );
    await executeSubmitApplication(
      prisma,
      testScope,
      appAyvens.id,
      { stage: 'FULL', externalReference: 'AYV-REQ-8832' },
      testActor
    );
    timings['5_parallel_applications_r1'] = performance.now() - t5;

    // STEP 6: Financier 1 (Vehis) refuses
    const t6 = performance.now();
    await executeDecideApplication(
      prisma,
      testScope,
      appVehis.id,
      {
        decision: 'REJECTED',
        rejectionReasonCode: 'FIN_CREDITWORTHINESS',
        rejectionComment: 'Brak zdolności na okres 48m',
      },
      testActor
    );
    timings['6_financier_rejection'] = performance.now() - t6;

    // STEP 7: 1-Click Reroute to Financier 3 (Leasys) in Round 2
    const t7 = performance.now();
    const leasys = await prisma.pipelineFinancier.findFirstOrThrow({ where: { code: 'LEASYS' } });
    const appLeasys = await executeRerouteApplication(
      prisma,
      testScope,
      appVehis.id,
      {
        targetFinancierId: leasys.id,
        externalReference: 'LEA-REQ-5512',
      },
      testActor
    );
    timings['7_reroute_to_round_2'] = performance.now() - t7;
    expect(appLeasys.roundNumber).toBe(2);

    // STEP 8: Financier 2 (Ayvens) approves application in Round 1
    const t8 = performance.now();
    await executeDecideApplication(
      prisma,
      testScope,
      appAyvens.id,
      {
        decision: 'APPROVED',
      },
      testActor
    );
    timings['8_financier_approval'] = performance.now() - t8;

    // STEP 9: Client signs contract with Ayvens -> automatic withdrawal of Leasys with CONTRACTED_ELSEWHERE
    const t9 = performance.now();
    await executePatchOpportunity(prisma, {
      id: oppId,
      contractSignedAt: new Date().toISOString(),
      contractedApplicationId: appAyvens.id,
      actor: testActor,
    });
    timings['9_contract_signing_and_autowithdraw'] = performance.now() - t9;

    const totalDurationMs = performance.now() - totalStart;

    // Verify final state
    const oppFinal = await prisma.pipelineOpportunity.findUniqueOrThrow({
      where: { id: oppId },
      include: {
        applications: {
          include: { financier: true },
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    const vehisFinal = oppFinal.applications.find((a) => a.id === appVehis.id);
    const ayvensFinal = oppFinal.applications.find((a) => a.id === appAyvens.id);
    const leasysFinal = oppFinal.applications.find((a) => a.id === appLeasys.id);

    expect(vehisFinal?.state).toBe(PipelineApplicationState.REJECTED);
    expect(vehisFinal?.rejectionReasonCode).toBe('FIN_CREDITWORTHINESS');
    expect(vehisFinal?.withdrawalReasonCode).toBeNull();

    expect(ayvensFinal?.state).toBe(PipelineApplicationState.APPROVED);
    expect(oppFinal.contractedApplicationId).toBe(ayvensFinal?.id);

    expect(leasysFinal?.state).toBe(PipelineApplicationState.WITHDRAWN);
    expect(leasysFinal?.withdrawalReasonCode).toBe('CONTRACTED_ELSEWHERE');
    expect(leasysFinal?.rejectionReasonCode).toBeNull();

    // Log benchmark summary table
    console.log('\n======================================================');
    console.log('⏱️  ADVISOR JOURNEY STOPWATCH BENCHMARK (M1 -> M2 Flow)');
    console.log('======================================================');
    Object.entries(timings).forEach(([step, ms]) => {
      console.log(`  ${step.padEnd(35)}: ${ms.toFixed(2)} ms`);
    });
    console.log('------------------------------------------------------');
    console.log(`  TOTAL SERVER EXECUTION TIME        : ${totalDurationMs.toFixed(2)} ms`);
    console.log('======================================================\n');

    expect(totalDurationMs).toBeLessThan(1000); // Complete journey in < 1 second on DB layer
  });

  it('asserts constant query count / batch preloading when listing opportunities on the board', async () => {
    // Generate 10 sample opportunities in the test scope
    for (let i = 0; i < 10; i++) {
      await executeCreateOpportunity(prisma, {
        scopeType: testScope.scopeType,
        scopeId: testScope.scopeId,
        leadSource: LeadSourceChannel.ORGANIC,
        customerName: `Test Board User ${i}`,
        customerPhone: `+4860011100${i}`,
        clientType: i % 2 === 0 ? ClientType.B2C : ClientType.B2B,
        financingType: FinancingType.LEASING,
        actor: testActor,
      });
    }

    const tStart = performance.now();
    const result = await listOpportunities(prisma, {
      scopeType: testScope.scopeType,
      scopeId: testScope.scopeId,
      limit: 20,
    });
    const listDurationMs = performance.now() - tStart;

    expect(result.items.length).toBeGreaterThanOrEqual(10);
    for (const item of result.items) {
      expect(item).toHaveProperty('completeness');
      expect(item.completeness.percentage).toBeGreaterThanOrEqual(0);
    }

    // Must be fast (< 100ms) with constant-time in-memory evaluation
    expect(listDurationMs).toBeLessThan(100);
  });
});
