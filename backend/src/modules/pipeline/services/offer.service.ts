import { Prisma, PrismaClient, ScopeType, FinancingType, PipelineTaxMode } from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { ActorContext } from './opportunity.service.js';
import { calcOwnInstallment } from '../../../services/financing-calc.service.js';

export type OfferInput = {
  vehicleCandidateId?: string | null;
  financingProductId?: string | null;
  financingType: FinancingType;
  priceGrosze: number;
  downPaymentGrosze?: number;
  periodMonths: number;
  monthlyRateGrosze?: number | null;
  finalPaymentGrosze?: number | null;
  annualMileageKm?: number | null;
  taxMode?: PipelineTaxMode;
  currency?: string;
};

/**
 * Calculates monthly installment rate in grosze using the PMT calculation.
 */
export function calculateInstallmentGrosze(
  priceGrosze: number,
  downPaymentGrosze: number = 0,
  finalPaymentGrosze: number = 0,
  periodMonths: number = 60,
  referenceRate: number = 5.85, // standard WIBOR
  margin: number = 2.5 // standard margin
): number {
  const pricePln = priceGrosze / 100;
  const downPct = priceGrosze > 0 ? (downPaymentGrosze / priceGrosze) * 100 : 0;
  const finalPct = priceGrosze > 0 ? (finalPaymentGrosze / priceGrosze) * 100 : 0;

  const mockProduct: any = {
    referenceRate,
    margin,
  };

  const pmtPln = calcOwnInstallment(mockProduct, pricePln, {
    downPct,
    finalPct,
    months: periodMonths > 0 ? periodMonths : 60,
  });

  return Math.round(pmtPln * 100);
}

export async function createOrUpdateOffer(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: OfferInput,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      offers: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });

  const latestOffer = opportunity.offers[0];

  // Calculate monthly rate if not explicitly provided
  const monthlyRateGrosze =
    input.monthlyRateGrosze && input.monthlyRateGrosze > 0
      ? input.monthlyRateGrosze
      : calculateInstallmentGrosze(
          input.priceGrosze,
          input.downPaymentGrosze ?? 0,
          input.finalPaymentGrosze ?? 0,
          input.periodMonths
        );

  // If latest offer is in DRAFT status, edit in place
  if (latestOffer && latestOffer.status === 'DRAFT') {
    const diffBefore: Record<string, unknown> = {};
    const diffAfter: Record<string, unknown> = {};

    const checkField = (field: keyof typeof latestOffer, newVal: unknown) => {
      if (newVal !== undefined && latestOffer[field] !== newVal) {
        diffBefore[field] = latestOffer[field];
        diffAfter[field] = newVal;
      }
    };

    checkField('priceGrosze', input.priceGrosze);
    checkField('downPaymentGrosze', input.downPaymentGrosze ?? 0);
    checkField('periodMonths', input.periodMonths);
    checkField('monthlyRateGrosze', monthlyRateGrosze);
    checkField('finalPaymentGrosze', input.finalPaymentGrosze ?? null);
    checkField('financingType', input.financingType);

    const updated = await tx.pipelineOffer.update({
      where: { id: latestOffer.id },
      data: {
        vehicleCandidateId: input.vehicleCandidateId ?? latestOffer.vehicleCandidateId,
        financingProductId: input.financingProductId ?? latestOffer.financingProductId,
        financingType: input.financingType,
        priceGrosze: input.priceGrosze,
        downPaymentGrosze: input.downPaymentGrosze ?? 0,
        periodMonths: input.periodMonths,
        monthlyRateGrosze,
        finalPaymentGrosze: input.finalPaymentGrosze ?? null,
        annualMileageKm: input.annualMileageKm ?? latestOffer.annualMileageKm,
        taxMode: input.taxMode ?? latestOffer.taxMode,
        currency: input.currency ?? latestOffer.currency,
      },
    });

    if (Object.keys(diffAfter).length > 0) {
      await recordEvent(tx, {
        scopeType: opportunity.scopeType,
        scopeId: opportunity.scopeId,
        type: 'OFFER_UPDATED',
        aggregateType: 'OFFER',
        aggregateId: updated.id,
        opportunityId: opportunity.id,
        customerId: opportunity.customerId,
        actor,
        payload: {
          before: diffBefore,
          after: diffAfter,
        },
      });
    }

    return updated;
  }

  // Otherwise, create new offer
  const versionNumber = latestOffer ? latestOffer.versionNumber + 1 : 1;

  const newOffer = await tx.pipelineOffer.create({
    data: {
      opportunityId,
      versionNumber,
      vehicleCandidateId: input.vehicleCandidateId || null,
      financingProductId: input.financingProductId || null,
      financingType: input.financingType,
      status: 'DRAFT',
      priceGrosze: input.priceGrosze,
      downPaymentGrosze: input.downPaymentGrosze ?? 0,
      periodMonths: input.periodMonths,
      monthlyRateGrosze,
      finalPaymentGrosze: input.finalPaymentGrosze ?? null,
      annualMileageKm: input.annualMileageKm ?? null,
      taxMode: input.taxMode ?? PipelineTaxMode.GROSS,
      currency: input.currency ?? 'PLN',
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OFFER_CREATED',
    aggregateType: 'OFFER',
    aggregateId: newOffer.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      versionNumber: newOffer.versionNumber,
      financingType: newOffer.financingType,
      priceGrosze: newOffer.priceGrosze,
      monthlyRateGrosze: newOffer.monthlyRateGrosze,
      periodMonths: newOffer.periodMonths,
    },
  });

  return newOffer;
}

export async function supersedeOffer(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: OfferInput,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      offers: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });

  const previousOffer = opportunity.offers.find((o) => o.status !== 'SUPERSEDED');

  const versionNumber = (opportunity.offers[0]?.versionNumber ?? 0) + 1;

  const monthlyRateGrosze =
    input.monthlyRateGrosze && input.monthlyRateGrosze > 0
      ? input.monthlyRateGrosze
      : calculateInstallmentGrosze(
          input.priceGrosze,
          input.downPaymentGrosze ?? 0,
          input.finalPaymentGrosze ?? 0,
          input.periodMonths
        );

  const newOffer = await tx.pipelineOffer.create({
    data: {
      opportunityId,
      versionNumber,
      vehicleCandidateId: input.vehicleCandidateId || null,
      financingProductId: input.financingProductId || null,
      financingType: input.financingType,
      status: 'DRAFT',
      priceGrosze: input.priceGrosze,
      downPaymentGrosze: input.downPaymentGrosze ?? 0,
      periodMonths: input.periodMonths,
      monthlyRateGrosze,
      finalPaymentGrosze: input.finalPaymentGrosze ?? null,
      annualMileageKm: input.annualMileageKm ?? null,
      taxMode: input.taxMode ?? PipelineTaxMode.GROSS,
      currency: input.currency ?? 'PLN',
    },
  });

  if (previousOffer) {
    await tx.pipelineOffer.update({
      where: { id: previousOffer.id },
      data: { status: 'SUPERSEDED' },
    });

    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'OFFER_SUPERSEDED',
      aggregateType: 'OFFER',
      aggregateId: previousOffer.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor,
      payload: {
        bySupersedingOfferId: newOffer.id,
        versionNumber: previousOffer.versionNumber,
      },
    });
  }

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OFFER_CREATED',
    aggregateType: 'OFFER',
    aggregateId: newOffer.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      versionNumber: newOffer.versionNumber,
      financingType: newOffer.financingType,
      priceGrosze: newOffer.priceGrosze,
      monthlyRateGrosze: newOffer.monthlyRateGrosze,
      periodMonths: newOffer.periodMonths,
    },
  });

  return newOffer;
}

export async function presentOffer(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  offerId: string,
  input: { channel?: 'CALL' | 'EMAIL' | 'SMS' },
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
  });

  const now = new Date();
  const updated = await tx.pipelineOffer.update({
    where: { id: offerId },
    data: {
      presentedAt: now,
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OFFER_PRESENTED',
    aggregateType: 'OFFER',
    aggregateId: updated.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      channel: input.channel || 'EMAIL',
      at: now.toISOString(),
    },
  });

  return updated;
}

export async function acceptOffer(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  offerId: string,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
  });

  const now = new Date();
  const updated = await tx.pipelineOffer.update({
    where: { id: offerId },
    data: {
      status: 'ACCEPTED',
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'OFFER_ACCEPTED',
    aggregateType: 'OFFER',
    aggregateId: updated.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      at: now.toISOString(),
    },
  });

  return updated;
}

// Transactional helper wrappers
export async function executeCreateOrUpdateOffer(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: OfferInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    createOrUpdateOffer(tx, scope, opportunityId, input, actor)
  );
}

export async function executeSupersedeOffer(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: OfferInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    supersedeOffer(tx, scope, opportunityId, input, actor)
  );
}

export async function executePresentOffer(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  offerId: string,
  input: { channel?: 'CALL' | 'EMAIL' | 'SMS' },
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    presentOffer(tx, scope, opportunityId, offerId, input, actor)
  );
}

export async function executeAcceptOffer(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  offerId: string,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    acceptOffer(tx, scope, opportunityId, offerId, actor)
  );
}
