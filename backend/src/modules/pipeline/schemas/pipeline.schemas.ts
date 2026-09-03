import { z } from 'zod';
import { ClientType, FinancingType, LeadSourceChannel, PipelinePhase, OpportunityStatus } from '@prisma/client';

export const createOpportunitySchema = z.object({
  leadSource: z.nativeEnum(LeadSourceChannel, {
    required_error: 'leadSource jest wymagane',
  }),
  leadSourceDetail: z.string().optional().nullable(),
  clientType: z.nativeEnum(ClientType).optional(),
  financingType: z.nativeEnum(FinancingType).optional().nullable(),
  customerName: z.string().min(1, 'Imię i nazwisko klienta jest wymagane'),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable().or(z.literal('')),
  companyName: z.string().optional().nullable(),
  companyNip: z.string().optional().nullable(),
  sourceLeadId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  nextActionType: z.string().optional().nullable(),
  nextActionDueAt: z.string().datetime().optional().nullable(),
  nextActionNote: z.string().optional().nullable(),
});

export const patchOpportunitySchema = z.object({
  clientType: z.nativeEnum(ClientType).optional(),
  financingType: z.nativeEnum(FinancingType).optional().nullable(),
  leadSource: z.nativeEnum(LeadSourceChannel).optional(),
  leadSourceDetail: z.string().optional().nullable(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable().or(z.literal('')),
  companyName: z.string().optional().nullable(),
  companyNip: z.string().optional().nullable(),
  contractSignedAt: z.string().datetime().nullable().optional(),
  contractedApplicationId: z.string().nullable().optional(),
});

export const transitionSchema = z.object({
  targetPhase: z.nativeEnum(PipelinePhase, {
    required_error: 'targetPhase jest wymagana',
  }),
  overridden: z.boolean().optional(),
  overrideReason: z.string().optional(),
});

export const assignSchema = z.object({
  ownerUserId: z.string().nullable(),
  reason: z.enum(['MANUAL', 'ROUND_ROBIN', 'PICKUP']).optional(),
});

export const nextActionSchema = z.object({
  nextActionType: z.string().min(1, 'nextActionType jest wymagany'),
  nextActionDueAt: z.string().datetime().nullable(),
  nextActionNote: z.string().optional().nullable(),
});

export const logContactSchema = z.object({
  channel: z.enum(['CALL', 'EMAIL', 'SMS', 'MEETING']),
  note: z.string().optional().nullable(),
  nextActionType: z.string().optional().nullable(),
  nextActionDueAt: z.string().datetime().optional().nullable(),
  nextActionNote: z.string().optional().nullable(),
});

export const closeWonSchema = z.object({
  // In M1, no commission or application is passed
  comment: z.string().optional(),
});

export const closeLostSchema = z.object({
  reasonCode: z.string().min(1, 'reasonCode jest wymagany'),
  comment: z.string().optional().nullable(),
});

export const qualifyLeadSchema = z.object({
  ownerUserId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().nullable().or(z.literal('')),
  companyName: z.string().optional().nullable(),
  companyNip: z.string().optional().nullable(),
  nextActionType: z.string().optional().nullable(),
  nextActionDueAt: z.string().datetime().optional().nullable(),
  nextActionNote: z.string().optional().nullable(),
  clientType: z.nativeEnum(ClientType).optional(),
  financingType: z.nativeEnum(FinancingType).optional().nullable(),
  leadSource: z.nativeEnum(LeadSourceChannel).optional(),
  leadSourceDetail: z.string().optional().nullable(),
});

export const dismissLeadSchema = z.object({
  comment: z.string().optional().nullable(),
});

export const listOpportunitiesQuerySchema = z.object({
  phase: z.nativeEnum(PipelinePhase).optional(),
  status: z.nativeEnum(OpportunityStatus).optional(),
  ownerUserId: z.string().optional(),
  clientType: z.nativeEnum(ClientType).optional(),
  financingType: z.nativeEnum(FinancingType).optional(),
  leadSource: z.nativeEnum(LeadSourceChannel).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const queueQuerySchema = z.object({
  ownerUserId: z.string().optional(),
  clientType: z.nativeEnum(ClientType).optional(),
  financingType: z.nativeEnum(FinancingType).optional(),
  leadSource: z.nativeEnum(LeadSourceChannel).optional(),
  search: z.string().optional(),
});

// Vehicle candidates
export const addVehicleCandidateSchema = z.object({
  listingId: z.string().optional().nullable(),
  rentalVehicleId: z.string().optional().nullable(),
  customMake: z.string().optional().nullable(),
  customModel: z.string().optional().nullable(),
  customVersion: z.string().optional().nullable(),
  customYear: z.number().int().optional().nullable(),
  priceSnapshotGrosze: z.number().int().optional().nullable(),
  selectionStatus: z.enum(['CANDIDATE', 'SELECTED']).optional(),
});

// Offers
export const createOfferSchema = z.object({
  vehicleCandidateId: z.string().optional().nullable(),
  financingProductId: z.string().optional().nullable(),
  financingType: z.nativeEnum(FinancingType),
  priceGrosze: z.number().int().positive('Cena musi być większa od 0'),
  downPaymentGrosze: z.number().int().min(0).default(0),
  periodMonths: z.number().int().min(1, 'Okres musi wynosić co najmniej 1 miesiąc'),
  monthlyRateGrosze: z.number().int().positive().optional().nullable(),
  finalPaymentGrosze: z.number().int().min(0).optional().nullable(),
  annualMileageKm: z.number().int().optional().nullable(),
});

export const presentOfferSchema = z.object({
  channel: z.enum(['CALL', 'EMAIL', 'SMS']).optional().default('EMAIL'),
});

// Applications & Reroute
export const createApplicationSchema = z.object({
  financierId: z.string().min(1, 'Finansujący jest wymagany'),
  offerId: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable(),
  roundMode: z.enum(['JOIN_CURRENT', 'NEW_ROUND']).optional(),
  rerouteFromId: z.string().optional().nullable(),
});

export const submitApplicationSchema = z.object({
  stage: z.enum(['PRECHECK', 'FULL']),
  externalReference: z.string().optional().nullable(),
});

export const decideApplicationSchema = z.object({
  decision: z.enum(['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED']),
  rejectionReasonCode: z.string().optional().nullable(),
  rejectionComment: z.string().optional().nullable(),
  approvedConditions: z.record(z.any()).optional().nullable(),
});

export const rerouteApplicationSchema = z.object({
  targetFinancierId: z.string().min(1, 'Docelowy finansujący jest wymagany'),
  offerId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

// Documents
export const updateDocumentStatusSchema = z.object({
  status: z.enum(['REQUIRED', 'REQUESTED', 'RECEIVED', 'VERIFIED', 'WAIVED']),
  note: z.string().optional().nullable(),
  requestedVia: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

