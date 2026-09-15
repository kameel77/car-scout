import { Prisma, PrismaClient, ScopeType } from '@prisma/client';
import { recordEvent } from '../events/record-event.js';
import { ActorContext } from './opportunity.service.js';

export type AddVehicleCandidateInput = {
  listingId?: string | null;
  rentalVehicleId?: string | null;
  rentalStockUnitId?: string | null;
  customMake?: string | null;
  customModel?: string | null;
  customVersion?: string | null;
  customYear?: number | null;
  priceSnapshotGrosze?: number | null;
  selectionStatus?: 'CANDIDATE' | 'SELECTED';
};

export async function addVehicleCandidate(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: AddVehicleCandidateInput,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      vehicleCandidates: true,
    },
  });

  // Determine if this is the first candidate (make it selected if so or if specified)
  const isFirst = opportunity.vehicleCandidates.length === 0;
  const shouldBeSelected = input.selectionStatus === 'SELECTED' || isFirst;

  if (shouldBeSelected && opportunity.vehicleCandidates.length > 0) {
    // Demote others to CANDIDATE
    await tx.pipelineVehicleCandidate.updateMany({
      where: { opportunityId },
      data: { selectionStatus: 'CANDIDATE' },
    });
  }

  // Derive label and price snapshot if from Listing or Rental
  let label = `${input.customMake || ''} ${input.customModel || ''}`.trim() || 'Pojazd';
  let priceSnapshotGrosze = input.priceSnapshotGrosze ?? null;

  if (input.listingId) {
    const listing = await tx.listing.findUnique({
      where: { id: input.listingId },
      select: { make: true, model: true, version: true, productionYear: true, pricePln: true },
    });
    if (listing) {
      label = `${listing.make} ${listing.model} (${listing.productionYear ?? ''})`.trim();
      if (!priceSnapshotGrosze && listing.pricePln) {
        priceSnapshotGrosze = Math.round(Number(listing.pricePln) * 100);
      }
    }
  } else if (input.rentalVehicleId) {
    const rental = await tx.rentalVehicle.findUnique({
      where: { id: input.rentalVehicleId },
      select: { make: true, model: true, version: true, productionYear: true },
    });
    if (rental) {
      label = `${rental.make} ${rental.model} (${rental.productionYear ?? ''})`.trim();
    }
  }

  const candidate = await tx.pipelineVehicleCandidate.create({
    data: {
      opportunityId,
      listingId: input.listingId || null,
      rentalVehicleId: input.rentalVehicleId || null,
      rentalStockUnitId: input.rentalStockUnitId || null,
      customMake: input.customMake || null,
      customModel: input.customModel || null,
      customVersion: input.customVersion || null,
      customYear: input.customYear || null,
      priceSnapshotGrosze,
      selectionStatus: shouldBeSelected ? 'SELECTED' : 'CANDIDATE',
    },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'VEHICLE_CANDIDATE_ADDED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      candidateId: candidate.id,
      listingId: candidate.listingId,
      rentalVehicleId: candidate.rentalVehicleId,
      label,
      priceSnapshotGrosze: candidate.priceSnapshotGrosze,
    },
  });

  if (shouldBeSelected) {
    await recordEvent(tx, {
      scopeType: opportunity.scopeType,
      scopeId: opportunity.scopeId,
      type: 'VEHICLE_SELECTED',
      aggregateType: 'OPPORTUNITY',
      aggregateId: opportunity.id,
      opportunityId: opportunity.id,
      customerId: opportunity.customerId,
      actor,
      payload: {
        candidateId: candidate.id,
        previousCandidateId: null,
      },
    });
  }

  return candidate;
}

export async function selectVehicleCandidate(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  candidateId: string,
  actor: ActorContext
) {
  const opportunity = await tx.pipelineOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      vehicleCandidates: true,
    },
  });

  const previousSelected = opportunity.vehicleCandidates.find(
    (v) => v.selectionStatus === 'SELECTED'
  );

  if (previousSelected?.id === candidateId) {
    return previousSelected;
  }

  // Demote all candidates
  await tx.pipelineVehicleCandidate.updateMany({
    where: { opportunityId },
    data: { selectionStatus: 'CANDIDATE' },
  });

  // Promote target candidate
  const updated = await tx.pipelineVehicleCandidate.update({
    where: { id: candidateId },
    data: { selectionStatus: 'SELECTED' },
  });

  await recordEvent(tx, {
    scopeType: opportunity.scopeType,
    scopeId: opportunity.scopeId,
    type: 'VEHICLE_SELECTED',
    aggregateType: 'OPPORTUNITY',
    aggregateId: opportunity.id,
    opportunityId: opportunity.id,
    customerId: opportunity.customerId,
    actor,
    payload: {
      candidateId: updated.id,
      previousCandidateId: previousSelected?.id ?? null,
    },
  });

  return updated;
}

export async function removeVehicleCandidate(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  candidateId: string,
  _actor: ActorContext
) {
  return tx.pipelineVehicleCandidate.delete({
    where: { id: candidateId },
  });
}

// Transactional helper wrappers
export async function executeAddVehicleCandidate(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  input: AddVehicleCandidateInput,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    addVehicleCandidate(tx, scope, opportunityId, input, actor)
  );
}

export async function executeSelectVehicleCandidate(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  candidateId: string,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    selectVehicleCandidate(tx, scope, opportunityId, candidateId, actor)
  );
}

export async function executeRemoveVehicleCandidate(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  candidateId: string,
  actor: ActorContext
) {
  return prisma.$transaction((tx) =>
    removeVehicleCandidate(tx, scope, opportunityId, candidateId, actor)
  );
}
