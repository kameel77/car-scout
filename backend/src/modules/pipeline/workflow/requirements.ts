import { Prisma, PipelinePhase, ScopeType, ClientType, FinancingType } from '@prisma/client';
import { PIPELINE_PHASES } from './phases.js';

export type RequirementMiss = {
  fieldPath: string;
  label: string;
  enforcement: string; // 'HARD' | 'SOFT'
};

export type EvaluationResult = {
  allowed: boolean;
  unmetHard: RequirementMiss[];
  unmetSoft: RequirementMiss[];
  completenessPct: number;
};

export class StageGateViolationError extends Error {
  statusCode = 422;
  currentPhase: PipelinePhase;
  targetPhase: PipelinePhase;
  missing: Array<{ fieldPath: string; label: string }>;

  constructor(
    currentPhase: PipelinePhase,
    targetPhase: PipelinePhase,
    missing: Array<{ fieldPath: string; label: string }>
  ) {
    super(
      `Brak spełnienia wymagań etapu ${targetPhase}: ${missing.map((m) => m.label).join(', ')}`
    );
    this.name = 'StageGateViolationError';
    this.currentPhase = currentPhase;
    this.targetPhase = targetPhase;
    this.missing = missing;
  }
}

/**
 * Resolves a field path value from the opportunity aggregate according to M2 & Parallel Applications specification.
 *
 * Prefixes:
 * - opportunity.* -> opportunity row
 * - customer.* -> customer row
 * - offer.* -> current active offer (highest versionNumber whose status is not SUPERSEDED)
 * - application.* -> satisfied if ANY non-WITHDRAWN application satisfies the property
 * - commission.* -> single non-REVERSED commission record
 */
export function resolveFieldValue(aggregate: any, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  const prefix = parts[0];
  const property = parts.slice(1).join('.');

  let targetObject: any = null;

  switch (prefix) {
    case 'opportunity':
      targetObject = aggregate;
      break;
    case 'customer':
      targetObject = aggregate?.customer ?? null;
      break;
    case 'offer': {
      const offers = (aggregate?.offers as any[]) ?? [];
      const activeOffers = offers
        .filter((o) => o.status !== 'SUPERSEDED')
        .sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0));
      targetObject = activeOffers[0] ?? null;
      break;
    }
    case 'application': {
      const applications = (aggregate?.applications as any[]) ?? [];
      const activeApps = applications.filter((a) => a.state !== 'WITHDRAWN');
      if (!property) {
        return activeApps.length > 0 ? activeApps : null;
      }
      // For parallel applications: requirement is met if ANY active application satisfies property
      const matchedApp = activeApps.find((app) => {
        const val = getNestedProperty(app, property);
        return isRequirementSatisfied(val);
      });
      return matchedApp ? getNestedProperty(matchedApp, property) : null;
    }
    case 'commission': {
      const commissions = (aggregate?.commissions as any[]) ?? [];
      const activeCommissions = commissions.filter((c) => c.status !== 'REVERSED');
      targetObject = activeCommissions[0] ?? null;
      break;
    }
    case 'selectedVehicle': {
      const vehicles = (aggregate?.vehicleCandidates as any[]) ?? [];
      const selected = vehicles.find((v) => v.selectionStatus === 'SELECTED');
      targetObject = selected ?? null;
      break;
    }
    default:
      targetObject = aggregate;
      break;
  }

  if (!targetObject) {
    return null;
  }

  if (!property) {
    return targetObject;
  }

  return getNestedProperty(targetObject, property);
}

function getNestedProperty(obj: any, path: string): unknown {
  if (!obj) return null;
  const subParts = path.split('.');
  let current: any = obj;
  for (const part of subParts) {
    if (current === null || current === undefined) return null;
    current = current[part];
  }
  return current;
}

/**
 * Checks if a resolved value satisfies the requirement.
 */
export function isRequirementSatisfied(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * Calculates requirements completeness for the NEXT phase of an opportunity in list/queue views.
 */
export function calculateOpportunityCompleteness(
  opportunity: any,
  allRequirementsForScope: any[]
): { met: number; total: number; percentage: number; nextPhase: PipelinePhase | null } {
  const currentIdx = PIPELINE_PHASES.indexOf(opportunity.phase);
  if (currentIdx === -1 || currentIdx >= PIPELINE_PHASES.length - 1) {
    return { met: 0, total: 0, percentage: 100, nextPhase: null };
  }
  const nextPhase = PIPELINE_PHASES[currentIdx + 1];

  const matchingReqs = allRequirementsForScope.filter((req) => {
    if (req.targetPhase !== nextPhase || !req.isActive) return false;
    if (req.clientType && req.clientType !== opportunity.clientType) return false;
    if (req.financingType && req.financingType !== opportunity.financingType) return false;
    return true;
  });

  if (matchingReqs.length === 0) {
    return { met: 0, total: 0, percentage: 100, nextPhase };
  }

  let metCount = 0;
  for (const req of matchingReqs) {
    if (req.fieldPath === 'customer.companyNip' && opportunity.clientType !== ClientType.B2B) {
      metCount++;
      continue;
    }
    const val = resolveFieldValue(opportunity, req.fieldPath);
    if (isRequirementSatisfied(val)) {
      metCount++;
    }
  }

  const percentage = Math.round((metCount / matchingReqs.length) * 100);
  return {
    met: metCount,
    total: matchingReqs.length,
    percentage,
    nextPhase,
  };
}

/**
 * Evaluates all requirements for a target phase transition against an opportunity aggregate.
 */
export async function evaluatePhaseRequirements(
  tx: Prisma.TransactionClient,
  scope: { scopeType: ScopeType; scopeId: string },
  opportunityId: string,
  targetPhase: PipelinePhase
): Promise<EvaluationResult> {
  const opportunity = await tx.pipelineOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      customer: true,
      vehicleCandidates: true,
      offers: {
        orderBy: { versionNumber: 'desc' },
      },
      applications: {
        orderBy: { roundNumber: 'desc' },
        include: {
          financier: true,
        },
      },
      documents: true,
      commissions: true,
    },
  });

  if (!opportunity) {
    throw new Error(`Nie znaleziono sprawy ${opportunityId}`);
  }

  // Fetch requirement definitions for this scope or platform fallback
  const requirements = await tx.pipelinePhaseRequirement.findMany({
    where: {
      OR: [
        { scopeType: scope.scopeType, scopeId: scope.scopeId },
        { scopeType: ScopeType.PLATFORM, scopeId: 'PLATFORM' },
      ],
      targetPhase,
      isActive: true,
      AND: [
        {
          OR: [
            { clientType: null },
            { clientType: opportunity.clientType },
          ],
        },
        {
          OR: [
            { financingType: null },
            { financingType: opportunity.financingType },
          ],
        },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });

  const unmetHard: RequirementMiss[] = [];
  const unmetSoft: RequirementMiss[] = [];
  let satisfiedCount = 0;

  for (const req of requirements) {
    // Check specific condition if clientType is B2B for customer.companyNip
    if (req.fieldPath === 'customer.companyNip' && opportunity.clientType !== ClientType.B2B) {
      satisfiedCount++;
      continue;
    }

    const value = resolveFieldValue(opportunity, req.fieldPath);
    const satisfied = isRequirementSatisfied(value);

    if (satisfied) {
      satisfiedCount++;
    } else {
      const miss: RequirementMiss = {
        fieldPath: req.fieldPath,
        label: req.label,
        enforcement: req.enforcement,
      };
      if (req.enforcement === 'HARD') {
        unmetHard.push(miss);
      } else {
        unmetSoft.push(miss);
      }
    }
  }

  const completenessPct =
    requirements.length > 0 ? Math.round((satisfiedCount / requirements.length) * 100) : 100;

  return {
    allowed: unmetHard.length === 0,
    unmetHard,
    unmetSoft,
    completenessPct,
  };
}
