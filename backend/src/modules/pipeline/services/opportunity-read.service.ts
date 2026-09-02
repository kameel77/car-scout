import {
  Prisma,
  PrismaClient,
  ScopeType,
  PipelinePhase,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  OpportunityStatus,
} from '@prisma/client';
import { calculateOpportunityCompleteness } from '../workflow/requirements.js';

export type OpportunityListFilters = {
  scopeType: ScopeType;
  scopeId: string;
  phase?: PipelinePhase;
  status?: OpportunityStatus;
  ownerUserId?: string;
  clientType?: ClientType;
  financingType?: FinancingType;
  leadSource?: LeadSourceChannel;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listOpportunities(
  prisma: PrismaClient,
  filters: OpportunityListFilters
) {
  const where: Prisma.PipelineOpportunityWhereInput = {
    scopeType: filters.scopeType,
    scopeId: filters.scopeId,
  };

  if (filters.phase) {
    where.phase = filters.phase;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.ownerUserId) {
    where.ownerUserId = filters.ownerUserId;
  }
  if (filters.clientType) {
    where.clientType = filters.clientType;
  }
  if (filters.financingType) {
    where.financingType = filters.financingType;
  }
  if (filters.leadSource) {
    where.leadSource = filters.leadSource;
  }
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { customer: { fullName: { contains: q, mode: 'insensitive' } } },
      { customer: { companyName: { contains: q, mode: 'insensitive' } } },
      { customer: { phone: { contains: q, mode: 'insensitive' } } },
      { customer: { email: { contains: q, mode: 'insensitive' } } },
      { customer: { companyNip: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const limit = Math.min(filters.limit ?? 100, 200);
  const offset = filters.offset ?? 0;

  const [rawItems, total, requirements] = await Promise.all([
    prisma.pipelineOpportunity.findMany({
      where,
      orderBy: [{ nextActionDueAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
      include: {
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
      },
    }),
    prisma.pipelineOpportunity.count({ where }),
    prisma.pipelinePhaseRequirement.findMany({
      where: {
        OR: [
          { scopeType: filters.scopeType, scopeId: filters.scopeId },
          { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        ],
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  const items = rawItems.map((item) => ({
    ...item,
    completeness: calculateOpportunityCompleteness(item, requirements),
  }));

  return { items, total };
}

export async function getOpportunityById(
  prisma: PrismaClient,
  id: string,
  scope: { scopeType: ScopeType; scopeId: string }
) {
  const opportunity = await prisma.pipelineOpportunity.findFirst({
    where: {
      id,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
    },
    include: {
      customer: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      vehicleCandidates: {
        orderBy: [{ selectionStatus: 'desc' }, { createdAt: 'desc' }],
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
      },
      offers: {
        orderBy: { versionNumber: 'desc' },
      },
      applications: {
        orderBy: [{ roundNumber: 'desc' }, { createdAt: 'desc' }],
        include: {
          financier: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          rerouteFrom: {
            select: {
              id: true,
              financier: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      documents: {
        orderBy: [{ status: 'asc' }, { code: 'asc' }],
        include: {
          requirement: {
            select: {
              isMandatory: true,
            },
          },
        },
      },
      tasks: {
        where: { completedAt: null },
        orderBy: { dueAt: 'asc' },
      },
      events: {
        orderBy: { occurredAt: 'desc' },
        take: 50,
      },
      sourceLead: {
        select: {
          id: true,
          trafficSource: true,
          createdAt: true,
        },
      },
    },
  });

  return opportunity;
}

export async function getPipelineDictionaries(
  prisma: PrismaClient,
  scope: { scopeType: ScopeType; scopeId: string }
) {
  const [lossReasons, financiers, phaseRequirements, users] = await Promise.all([
    prisma.pipelineLossReason.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.pipelineFinancier.findMany({
      where: {
        OR: [
          { scopeType: scope.scopeType, scopeId: scope.scopeId },
          { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        ],
        isActive: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.pipelinePhaseRequirement.findMany({
      where: {
        OR: [
          { scopeType: scope.scopeType, scopeId: scope.scopeId },
          { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
        ],
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    lossReasons,
    financiers,
    phaseRequirements,
    users,
  };
}
