import {
  Prisma,
  PrismaClient,
  ScopeType,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  PipelinePhase,
  OpportunityStatus,
} from '@prisma/client';

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

  if (filters.phase) where.phase = filters.phase;
  if (filters.status) where.status = filters.status;
  if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
  if (filters.clientType) where.clientType = filters.clientType;
  if (filters.financingType) where.financingType = filters.financingType;
  if (filters.leadSource) where.leadSource = filters.leadSource;

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

  const [items, total] = await Promise.all([
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
        _count: {
          select: {
            vehicleCandidates: true,
            offers: true,
            tasks: true,
          },
        },
      },
    }),
    prisma.pipelineOpportunity.count({ where }),
  ]);

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
        include: {
          financier: true,
        },
        orderBy: { attemptSequence: 'desc' },
      },
      tasks: {
        orderBy: { dueAt: 'asc' },
      },
      documents: {
        include: {
          requirement: true,
        },
      },
      sourceLead: {
        select: {
          id: true,
          trafficSource: true,
          createdAt: true,
        },
      },
      events: {
        orderBy: { occurredAt: 'desc' },
        take: 100,
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
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.pipelinePhaseRequirement.findMany({
      where: {
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
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
