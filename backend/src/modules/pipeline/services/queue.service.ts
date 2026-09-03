import {
  Prisma,
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  OpportunityStatus,
  PipelineApplicationState,
  PipelineDocumentStatus,
} from '@prisma/client';
import { listInboxLeads } from './inbox.service.js';
import { calculateOpportunityCompleteness } from '../workflow/requirements.js';

// Po ilu dniach brak decyzji finansującego albo brak dokumentu od klienta uznajemy sprawę za "czekającą".
const WAITING_THRESHOLD_DAYS = 3;

export type QueueFilters = {
  scopeType: ScopeType;
  scopeId: string;
  ownerUserId?: string | null;
  clientType?: ClientType;
  financingType?: FinancingType;
  leadSource?: LeadSourceChannel;
  search?: string;
};

export type WaitingReason = 'APPLICATION_PENDING' | 'DOCUMENT_PENDING';

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
        submittedFirstAt: true,
        submittedFullAt: true,
        decisionAt: true,
        rejectionReasonCode: true,
        withdrawalReasonCode: true,
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
        requestedAt: true,
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

  // 4. Waiting (wniosek bez decyzji lub dokument nieotrzymany dłużej niż WAITING_THRESHOLD_DAYS)
  const waitingThreshold = new Date(now.getTime() - WAITING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const waitingPromise = prisma.pipelineOpportunity.findMany({
    where: {
      ...baseWhere,
      // AND (zamiast nadpisania OR) — baseWhere.OR bywa już zajęty przez filtr wyszukiwania.
      AND: [
        {
          OR: [
            {
              applications: {
                some: {
                  state: { in: [PipelineApplicationState.PRECHECK_SUBMITTED, PipelineApplicationState.FULL_SUBMITTED] },
                  decisionAt: null,
                  OR: [
                    { submittedFullAt: { lt: waitingThreshold } },
                    { submittedFullAt: null, submittedFirstAt: { lt: waitingThreshold } },
                  ],
                },
              },
            },
            {
              documents: {
                some: {
                  status: PipelineDocumentStatus.REQUESTED,
                  requestedAt: { lt: waitingThreshold },
                },
              },
            },
          ],
        },
      ],
    },
    include: includeRelations,
    take: 100,
  });

  // 5. Inbox
  const inboxPromise = listInboxLeads(prisma, {
    scopeType: filters.scopeType,
    scopeId: filters.scopeId,
    limit: 50,
  });

  // 6. Requirements for completeness calculation
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

  const [rawOverdue, rawToday, rawNoAction, rawWaiting, inbox, requirements] = await Promise.all([
    overduePromise,
    todayPromise,
    noActionPromise,
    waitingPromise,
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

  // Sprawy już widoczne w overdue/today nie mogą się zduplikować w waiting.
  const dedupedIds = new Set([...overdue, ...today].map((opp) => opp.id));

  const waiting = rawWaiting
    .filter((opp) => !dedupedIds.has(opp.id))
    .map((opp) => {
      let reason: WaitingReason | null = null;
      let since: Date | null = null;

      for (const app of opp.applications) {
        if (
          (app.state === PipelineApplicationState.PRECHECK_SUBMITTED ||
            app.state === PipelineApplicationState.FULL_SUBMITTED) &&
          app.decisionAt === null
        ) {
          const submittedAt = app.submittedFullAt ?? app.submittedFirstAt;
          if (submittedAt && submittedAt < waitingThreshold) {
            if (!since || submittedAt < since) {
              since = submittedAt;
              reason = 'APPLICATION_PENDING';
            }
          }
        }
      }

      for (const doc of opp.documents) {
        if (doc.status === PipelineDocumentStatus.REQUESTED && doc.requestedAt && doc.requestedAt < waitingThreshold) {
          if (!since || doc.requestedAt < since) {
            since = doc.requestedAt;
            reason = 'DOCUMENT_PENDING';
          }
        }
      }

      return {
        ...opp,
        completeness: calculateOpportunityCompleteness(opp, requirements),
        waitingReason: reason as WaitingReason,
        waitingSince: (since as Date).toISOString(),
      };
    })
    .sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());

  // Waiting ma zniknąć z noAction — to jest właśnie informacja, której tam brakowało.
  const waitingIds = new Set(waiting.map((opp) => opp.id));
  const noAction = rawNoAction
    .filter((opp) => !waitingIds.has(opp.id))
    .map((opp) => ({
      ...opp,
      completeness: calculateOpportunityCompleteness(opp, requirements),
    }));

  return {
    overdue,
    today,
    waiting,
    noAction,
    inbox: inbox.leads,
    counts: {
      overdue: overdue.length,
      today: today.length,
      waiting: waiting.length,
      noAction: noAction.length,
      inbox: inbox.total,
      totalActive: overdue.length + today.length + waiting.length + noAction.length,
    },
  };
}
