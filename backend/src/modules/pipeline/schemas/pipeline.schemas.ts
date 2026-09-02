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
