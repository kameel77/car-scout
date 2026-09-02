import {
  Prisma,
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  OpportunityStatus,
} from '@prisma/client';
import { listInboxLeads } from './inbox.service.js';
import { calculateOpportunityCompleteness } from '../workflow/requirements.js';

export type QueueFilters = {
  scopeType: ScopeType;
  scopeId: string;
  ownerUserId?: string | null;
  clientType?: ClientType;
  financingType?: FinancingType;
  leadSource?: LeadSourceChannel;
  search?: string;
};

export async function getAdvisorQueue(
  prisma: PrismaClient,
  filters: QueueFilters
) {
  const now = new Date();
  // Start and end of today in local date
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const baseWhere: Prisma.PipelineOpportunityWhereInput = {
    scopeType: filters.scopeType,
    scopeId: filters.scopeId,
    status: OpportunityStatus.OPEN,
  };

  if (filters.ownerUserId) {
    baseWhere.ownerUserId = filters.ownerUserId;
  }
  if (filters.clientType) {
    baseWhere.clientType = filters.clientType;
  }
  if (filters.financingType) {
    baseWhere.financingType = filters.financingType;
  }
  if (filters.leadSource) {
    baseWhere.leadSource = filters.leadSource;
  }
  if (filters.search) {
    const q = filters.search.trim();
    baseWhere.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      { customer: { phone: { contains: q, mode: 'insensitive' } } },
      { customer: { email: { contains: q, mode: 'insensitive' } } },
      { customer: { companyNip: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const includeRelations: Prisma.PipelineOpportunityInclude = {
    customer: {
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        companyName: true,
        companyNip: true,
        clientType: true,
      },
    },
    owner: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    vehicleCandidates: {
      where: { selectionStatus: 'SELECTED' },
      take: 1,
      select: {
        id: true,
        customMake: true,
        customModel: true,
        customVersion: true,
        customYear: true,
        priceSnapshotGrosze: true,
        listingId: true,
        rentalVehicleId: true,
        listing: {
          select: {
            make: true,
            model: true,
            version: true,
            productionYear: true,
            pricePln: true,
          },
        },
        rentalVehicle: {
          select: {
            make: true,
            model: true,
            productionYear: true,
          },
        },
      },
    },
    offers: {
      where: { status: { not: 'SUPERSEDED' } },
      orderBy: { versionNumber: 'desc' },
      take: 1,
      select: {
        id: true,
        versionNumber: true,
        financingType: true,
        priceGrosze: true,
        monthlyRateGrosze: true,
        periodMonths: true,
        downPaymentGrosze: true,
        status: true,
      },
    },
    applications: {
      where: { state: { not: 'WITHDRAWN' } },
      orderBy: { roundNumber: 'desc' },
      select: {
        id: true,
        roundNumber: true,
        state: true,
        decisionAt: true,
        rejectionReasonCode: true,
        financier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    },
    documents: {
      select: {
        id: true,
        code: true,
        status: true,
      },
    },
    _count: {
      select: {
        vehicleCandidates: true,
        offers: true,
        tasks: true,
        documents: true,
      },
    },
  };

  // 1. Overdue
  const overduePromise = prisma.pipelineOpportunity.findMany({
    where: {
      ...baseWhere,
      nextActionDueAt: { lt: todayStart },
    },
    include: includeRelations,
    orderBy: { nextActionDueAt: 'asc' },
    take: 100,
  });

  // 2. Today
  const todayPromise = prisma.pipelineOpportunity.findMany({
    where: {
      ...baseWhere,
      nextActionDueAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: includeRelations,
    orderBy: { nextActionDueAt: 'asc' },
    take: 100,
  });

  // 3. No next action
  const noActionPromise = prisma.pipelineOpportunity.findMany({
    where: {
      ...baseWhere,
      nextActionDueAt: null,
    },
    include: includeRelations,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // 4. Inbox
  const inboxPromise = listInboxLeads(prisma, {
    scopeType: filters.scopeType,
    scopeId: filters.scopeId,
    limit: 50,
  });

  // 5. Requirements for completeness calculation
  const reqsPromise = prisma.pipelinePhaseRequirement.findMany({
    where: {
      OR: [
        { scopeType: filters.scopeType, scopeId: filters.scopeId },
        { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
      ],
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  const [rawOverdue, rawToday, rawNoAction, inbox, requirements] = await Promise.all([
    overduePromise,
    todayPromise,
    noActionPromise,
    inboxPromise,
    reqsPromise,
  ]);

  const overdue = rawOverdue.map((opp) => ({
    ...opp,
    completeness: calculateOpportunityCompleteness(opp, requirements),
  }));

  const today = rawToday.map((opp) => ({
    ...opp,
    completeness: calculateOpportunityCompleteness(opp, requirements),
  }));

  const noAction = rawNoAction.map((opp) => ({
    ...opp,
    completeness: calculateOpportunityCompleteness(opp, requirements),
  }));

  return {
    overdue,
    today,
    noAction,
    inbox: inbox.leads,
    counts: {
      overdue: overdue.length,
      today: today.length,
      noAction: noAction.length,
      inbox: inbox.total,
      totalActive: overdue.length + today.length + noAction.length,
    },
  };
}
