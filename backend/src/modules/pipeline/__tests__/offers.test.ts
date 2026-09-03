import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient, ScopeType, LeadSourceChannel, PipelineActorType, ClientType, FinancingType, PipelinePhase } from '@prisma/client';
import { executeCreateOpportunity } from '../services/opportunity.service.js';
import {
  executeCreateOrUpdateOffer,
  executeSupersedeOffer,
  executePresentOffer,
  calculateInstallmentGrosze,
} from '../services/offer.service.js';
import { evaluatePhaseRequirements } from '../workflow/requirements.js';

const prisma = new PrismaClient();

function getTestScope() {
  return {
    scopeType: ScopeType.DEALER_GROUP,
    scopeId: `test-offers-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

const TEST_ACTOR = { type: PipelineActorType.USER, userId: 'user-m2-offers-1', label: 'Doradca Oferty' };

describe('Milestone M2: Offers Management & Versioning', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('calculates monthly installment in grosze accurately via PMT formula', () => {
    // 100,000 PLN (10,000,000 groszy), 10% down, 0% final, 60 months
    const rateGrosze = calculateInstallmentGrosze(10000000, 1000000, 0, 60, 5.85, 2.5);
    expect(rateGrosze).toBeGreaterThan(150000); // ~1,840 PLN
    expect(rateGrosze).toBeLessThan(250000);
  });

  it('creates an offer and updates it in place when in DRAFT state, recording OFFER_UPDATED diff event', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Michał Oferta',
      customerPhone: '+48600444555',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    // 1. Create initial offer
    const offer1 = await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 10000000,
        downPaymentGrosze: 1000000,
        periodMonths: 36,
        monthlyRateGrosze: 260000,
      },
      TEST_ACTOR
    );

    expect(offer1.versionNumber).toBe(1);
    expect(offer1.status).toBe('DRAFT');

    // 2. Update offer in place (change price and monthly rate)
    const updated = await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 12000000,
        downPaymentGrosze: 1200000,
        periodMonths: 48,
        monthlyRateGrosze: 240000,
      },
      TEST_ACTOR
    );

    expect(updated.id).toBe(offer1.id);
    expect(updated.versionNumber).toBe(1);
    expect(updated.priceGrosze).toBe(12000000);
    expect(updated.periodMonths).toBe(48);

    // 3. Verify OFFER_UPDATED event contains shallow diff
    const updateEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OFFER_UPDATED',
      },
    });

    expect(updateEvent).toBeDefined();
    const payload = updateEvent?.payload as any;
    expect(payload.before.priceGrosze).toBe(10000000);
    expect(payload.after.priceGrosze).toBe(12000000);
    expect(payload.before.periodMonths).toBe(36);
    expect(payload.after.periodMonths).toBe(48);
  });

  it('supersedes an offer, creating version 2, and resolves requirements against the active version', async () => {
    const scope = getTestScope();

    const opp = await executeCreateOpportunity(prisma, {
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      leadSource: LeadSourceChannel.ORGANIC,
      customerName: 'Robert Wersje',
      customerPhone: '+48600888999',
      clientType: ClientType.B2C,
      financingType: FinancingType.LEASING,
      actor: TEST_ACTOR,
    });

    // 1. Initial offer v1
    const v1 = await executeCreateOrUpdateOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 10000000,
        downPaymentGrosze: 1000000,
        periodMonths: 36,
        monthlyRateGrosze: 250000,
      },
      TEST_ACTOR
    );

    // Present v1
    await executePresentOffer(prisma, scope, opp.id, v1.id, { channel: 'EMAIL' }, TEST_ACTOR);

    // 2. Supersede with v2 (e.g. client wanted 48 months instead)
    const v2 = await executeSupersedeOffer(
      prisma,
      scope,
      opp.id,
      {
        financingType: FinancingType.LEASING,
        priceGrosze: 10000000,
        downPaymentGrosze: 1000000,
        periodMonths: 48,
        monthlyRateGrosze: 210000,
      },
      TEST_ACTOR
    );

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe('DRAFT');

    const v1After = await prisma.pipelineOffer.findUniqueOrThrow({
      where: { id: v1.id },
    });
    expect(v1After.status).toBe('SUPERSEDED');

    // 3. Verify OFFER_SUPERSEDED event
    const supersededEvent = await prisma.pipelineEvent.findFirst({
      where: {
        opportunityId: opp.id,
        type: 'OFFER_SUPERSEDED',
      },
    });

    expect(supersededEvent).toBeDefined();
    expect((supersededEvent?.payload as any).versionNumber).toBe(1);
    expect((supersededEvent?.payload as any).bySupersedingOfferId).toBe(v2.id);

    // 4. Verify requirement evaluator resolves against v2 (not v1)
    const evalResult = await evaluatePhaseRequirements(
      prisma,
      scope,
      opp.id,
      PipelinePhase.FINANCIAL_DECISION
    );

    // offer.priceGrosze and offer.monthlyRateGrosze should be fulfilled by v2
    const missingPrice = evalResult.unmetHard.find((m) => m.fieldPath === 'offer.priceGrosze');
    const missingRate = evalResult.unmetHard.find((m) => m.fieldPath === 'offer.monthlyRateGrosze');
    expect(missingPrice).toBeUndefined();
    expect(missingRate).toBeUndefined();
  });
});
