import {
  Prisma,
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  PipelineOpportunity,
} from '@prisma/client';
import { createOpportunity, closeLost, ActorContext } from './opportunity.service.js';

export const DEFAULT_INBOX_CUTOFF_DATE = new Date('2026-01-01T00:00:00.000Z');

export function getInboxCutoffDate(): Date {
  const envCutoff = process.env.PIPELINE_INBOX_CUTOFF_DATE;
  if (envCutoff) {
    const parsed = new Date(envCutoff);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return DEFAULT_INBOX_CUTOFF_DATE;
}

export type ListInboxParams = {
  scopeType: ScopeType;
  scopeId: string;
  limit?: number;
  offset?: number;
  cutoffDate?: Date;
  leadType?: string;
};

export async function listInboxLeads(
  prisma: PrismaClient | Prisma.TransactionClient,
  params: ListInboxParams
) {
  const cutoffDate = params.cutoffDate ?? getInboxCutoffDate();
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = params.offset ?? 0;

  const where: Prisma.LeadWhereInput = {
    pipelineOpportunity: { is: null },
    createdAt: { gte: cutoffDate },
    ...(params.leadType ? { leadType: params.leadType } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        listing: {
          select: {
            id: true,
            make: true,
            model: true,
            version: true,
            productionYear: true,
            pricePln: true,
            primaryImageUrl: true,
          },
        },
        rentalVehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            productionYear: true,
          },
        },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    leads,
    total,
    cutoffDate,
  };
}

export type QualifyLeadInput = {
  leadId: string;
  scopeType: ScopeType;
  scopeId: string;
  ownerUserId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  companyName?: string | null;
  companyNip?: string | null;
  nextActionType?: string | null;
  nextActionDueAt?: Date | null;
  nextActionNote?: string | null;
  clientType?: ClientType;
  financingType?: FinancingType | null;
  leadSource?: LeadSourceChannel;
  leadSourceDetail?: string | null;
  actor: ActorContext;
};

export async function qualifyLead(
  tx: Prisma.TransactionClient,
  input: QualifyLeadInput
): Promise<PipelineOpportunity> {
  const lead = await tx.lead.findUnique({
    where: { id: input.leadId },
    include: {
      listing: true,
      rentalVehicle: true,
      pipelineOpportunity: true,
    },
  });

  if (!lead) {
    throw new Error(`Lead ${input.leadId} nie istnieje`);
  }

  if (lead.pipelineOpportunity) {
    throw new Error(`Lead ${input.leadId} jest już powiązany ze sprawą ${lead.pipelineOpportunity.number}`);
  }

  // Extract metadata if present
  const meta = (lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : null) as {
    companyName?: string;
    companyNip?: string;
  } | null;

  // Determine lead source
  let leadSource: LeadSourceChannel = input.leadSource ?? LeadSourceChannel.ORGANIC;
  let leadSourceDetail: string | null = input.leadSourceDetail ?? lead.trafficSource ?? null;

  if (!input.leadSource) {
    if (lead.leadType === 'employer_b2b') {
      leadSource = LeadSourceChannel.PARTNER;
      leadSourceDetail = input.leadSourceDetail ?? 'benefivo_b2b';
    } else {
      const src = lead.trafficSource?.toLowerCase() || '';
      if (src.includes('meta') || src.includes('facebook')) {
        leadSource = LeadSourceChannel.META;
      } else if (src.includes('google')) {
        leadSource = LeadSourceChannel.GOOGLE;
      } else if (src.includes('dealer')) {
        leadSource = LeadSourceChannel.DEALER;
      } else if (src.includes('partner')) {
        leadSource = LeadSourceChannel.PARTNER;
      } else if (src.includes('tv')) {
        leadSource = LeadSourceChannel.TV;
      } else if (src) {
        leadSource = LeadSourceChannel.OTHER;
      } else {
        leadSource = LeadSourceChannel.ORGANIC;
      }
    }
  }

  // Determine customer client type if possible
  const clientType = input.clientType ?? (lead.leadType === 'employer_b2b' ? ClientType.B2B : ClientType.B2C);

  // Create Opportunity
  const opportunity = await createOpportunity(tx, {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    leadSource,
    leadSourceDetail,
    clientType,
    financingType: input.financingType ?? null,
    customerName: (input.customerName && input.customerName.trim()) || lead.name || 'Klient z formularza',
    customerPhone: input.customerPhone !== undefined ? input.customerPhone : lead.phone,
    customerEmail: input.customerEmail !== undefined ? input.customerEmail : lead.email,
    companyName: input.companyName !== undefined ? input.companyName : (meta?.companyName ?? null),
    companyNip: input.companyNip !== undefined ? input.companyNip : (meta?.companyNip ?? null),
    sourceLeadId: lead.id,
    ownerUserId: input.ownerUserId ?? null,
    nextActionType: input.nextActionType ?? 'CALL_FIRST',
    nextActionDueAt: input.nextActionDueAt ?? new Date(),
    nextActionNote: input.nextActionNote ?? null,
    actor: input.actor,
  });

  // Attach vehicle candidate if lead had a listing or rental vehicle
  if (lead.listingId && lead.listing) {
    await tx.pipelineVehicleCandidate.create({
      data: {
        opportunityId: opportunity.id,
        listingId: lead.listingId,
        customMake: lead.listing.make,
        customModel: lead.listing.model,
        customVersion: lead.listing.version ?? null,
        customYear: lead.listing.productionYear ?? null,
        priceSnapshotGrosze: lead.listing.pricePln ? Math.round(Number(lead.listing.pricePln) * 100) : null,
        selectionStatus: 'SELECTED',
      },
    });
  } else if (lead.rentalVehicleId && lead.rentalVehicle) {
    await tx.pipelineVehicleCandidate.create({
      data: {
        opportunityId: opportunity.id,
        rentalVehicleId: lead.rentalVehicleId,
        customMake: lead.rentalVehicle.make,
        customModel: lead.rentalVehicle.model,
        customVersion: lead.rentalVehicle.version ?? null,
        customYear: lead.rentalVehicle.productionYear ?? null,
        selectionStatus: 'SELECTED',
      },
    });
  }

  return opportunity;
}

export async function dismissLeadAsSpam(
  tx: Prisma.TransactionClient,
  input: {
    leadId: string;
    scopeType: ScopeType;
    scopeId: string;
    comment?: string | null;
    actor: ActorContext;
  }
): Promise<PipelineOpportunity> {
  const lead = await tx.lead.findUnique({
    where: { id: input.leadId },
    include: { pipelineOpportunity: true },
  });

  if (!lead) {
    throw new Error(`Lead ${input.leadId} nie istnieje`);
  }
  if (lead.pipelineOpportunity) {
    throw new Error(`Lead ${input.leadId} jest już powiązany ze sprawą`);
  }

  const opp = await createOpportunity(tx, {
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    leadSource: LeadSourceChannel.OTHER,
    leadSourceDetail: lead.trafficSource ?? 'INBOX_DISMISSED',
    customerName: lead.name || 'Spam Lead',
    customerPhone: lead.phone,
    customerEmail: lead.email,
    sourceLeadId: lead.id,
    actor: input.actor,
  });

  const closedOpp = await closeLost(tx, {
    id: opp.id,
    reasonCode: 'QUAL_SPAM',
    comment: input.comment ?? 'Odrzucony z Inboxu jako spam',
    actor: input.actor,
  });

  return closedOpp;
}

export async function executeQualifyLead(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: QualifyLeadInput
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => qualifyLead(tx, input))
    : qualifyLead(prisma as Prisma.TransactionClient, input);
}

export async function executeDismissLeadAsSpam(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: Parameters<typeof dismissLeadAsSpam>[1]
) {
  return '$transaction' in prisma
    ? (prisma as PrismaClient).$transaction((tx: Prisma.TransactionClient) => dismissLeadAsSpam(tx, input))
    : dismissLeadAsSpam(prisma as Prisma.TransactionClient, input);
}
