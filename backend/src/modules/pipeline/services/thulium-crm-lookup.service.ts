import { PrismaClient, PipelinePhase, PipelineApplicationState } from '@prisma/client';
import { isUnmatchablePhone, normalizePhone } from './customer.service.js';

export type ThuliumCrmCustomer = {
  name: string;
  surname: string;
  phone_number: string[];
  email: string | null;
  nip: string | null;
  identifier: string | null;
  custom_fields: Record<string, string>;
};

const PHASE_LABELS_PL: Record<PipelinePhase, string> = {
  INBOX: 'Inbox',
  QUALIFICATION: 'Kwalifikacja',
  SELECTION: 'Wybór pojazdu',
  COMPLETING: 'Kompletowanie',
  FINANCIAL_DECISION: 'Decyzja finansowa',
  CONTRACT: 'Umowa',
  DELIVERY: 'Wydanie',
};

const APPLICATION_STATE_LABELS_PL: Partial<Record<PipelineApplicationState, string>> = {
  DRAFT: 'szkic',
  PRECHECK_SUBMITTED: 'wstępny złożony',
  PRECHECK_APPROVED: 'wstępnie zaakceptowany',
  FULL_SUBMITTED: 'pełny wniosek w analizie',
  CONDITIONALLY_APPROVED: 'warunkowo zaakceptowany',
  APPROVED: 'zaakceptowany',
  REJECTED: 'odrzucony',
  EXPIRED: 'wygasły',
};

function splitFullName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [first, ...rest] = parts;
  return { name: first ?? '', surname: rest.join(' ') };
}

function formatZloty(grosze: number): string {
  const zloty = Math.round(grosze / 100);
  const withSpaces = zloty.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} zł/mies.`;
}

type SelectedVehicleCandidate = {
  customMake: string | null;
  customModel: string | null;
  customYear: number | null;
  listing: { make: string; model: string; productionYear: number } | null;
  rentalVehicle: { make: string; model: string; productionYear: number | null } | null;
};

function buildVehicleLabel(candidate: SelectedVehicleCandidate | undefined): string | null {
  if (!candidate) return null;
  const make = candidate.listing?.make ?? candidate.rentalVehicle?.make ?? candidate.customMake ?? null;
  const model = candidate.listing?.model ?? candidate.rentalVehicle?.model ?? candidate.customModel ?? null;
  const year =
    candidate.listing?.productionYear ?? candidate.rentalVehicle?.productionYear ?? candidate.customYear ?? null;
  const parts = [make, model, year != null ? String(year) : null].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' ') : null;
}

export async function lookupCustomerByPhone(
  prisma: PrismaClient,
  phoneNumber: string
): Promise<ThuliumCrmCustomer | null> {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized || isUnmatchablePhone(normalized)) {
    return null;
  }

  const customer = await prisma.pipelineCustomer.findFirst({
    where: { phone: normalized },
    orderBy: { updatedAt: 'desc' },
  });
  if (!customer) {
    return null;
  }

  const opportunityInclude = {
    owner: {
      select: { name: true, email: true },
    },
    vehicleCandidates: {
      where: { selectionStatus: 'SELECTED' as const },
      take: 1,
      select: {
        customMake: true,
        customModel: true,
        customYear: true,
        listing: { select: { make: true, model: true, productionYear: true } },
        rentalVehicle: { select: { make: true, model: true, productionYear: true } },
      },
    },
    offers: {
      where: { status: { not: 'SUPERSEDED' } },
      orderBy: { versionNumber: 'desc' as const },
      take: 1,
      select: { monthlyRateGrosze: true },
    },
    applications: {
      where: { state: { not: PipelineApplicationState.WITHDRAWN } },
      orderBy: { roundNumber: 'desc' as const },
      select: {
        roundNumber: true,
        state: true,
        financier: { select: { name: true } },
      },
    },
    documents: {
      select: {
        code: true,
        status: true,
        requirement: { select: { isMandatory: true, label: true } },
      },
    },
  };

  const [openOpportunity, openCount] = await Promise.all([
    prisma.pipelineOpportunity.findFirst({
      where: { customerId: customer.id, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      include: opportunityInclude,
    }),
    prisma.pipelineOpportunity.count({
      where: { customerId: customer.id, status: 'OPEN' },
    }),
  ]);

  const opportunity =
    openOpportunity ??
    (await prisma.pipelineOpportunity.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: opportunityInclude,
    }));

  const { name, surname } = splitFullName(customer.fullName);

  const customFields: Record<string, string> = {};

  if (opportunity) {
    customFields['Sprawa'] = `${opportunity.number} — ${PHASE_LABELS_PL[opportunity.phase]}`;

    const latestApplication = opportunity.applications[0];
    customFields['Status wniosku'] = latestApplication
      ? `${latestApplication.financier.name} — ${
          APPLICATION_STATE_LABELS_PL[latestApplication.state] ?? latestApplication.state
        } (runda ${latestApplication.roundNumber})`
      : 'brak wniosku';

    const vehicleLabel = buildVehicleLabel(opportunity.vehicleCandidates[0]);
    if (vehicleLabel) {
      customFields['Pojazd'] = vehicleLabel;
    }

    const latestOffer = opportunity.offers[0];
    if (latestOffer) {
      customFields['Rata'] = formatZloty(latestOffer.monthlyRateGrosze);
    }

    const missingDocuments = opportunity.documents
      .filter(
        (doc) => doc.requirement?.isMandatory === true && (doc.status === 'REQUIRED' || doc.status === 'REQUESTED')
      )
      // Etykieta z wymagania, nie surowy kod — konsultant w Thulium ma przeczytać
      // "Wpis CEIDG / KRS", a nie "COMPANY_REGISTRY".
      .map((doc) => doc.requirement?.label || doc.code);
    customFields['Brakujące dokumenty'] = missingDocuments.length > 0 ? missingDocuments.join(', ') : 'komplet';

    if (opportunity.owner) {
      const advisor = opportunity.owner.name || opportunity.owner.email;
      if (advisor) {
        customFields['Doradca'] = advisor;
      }
    }

    customFields['Link do sprawy'] =
      `${process.env.PUBLIC_APP_URL ?? 'https://motolia.pl'}/admin/pipeline?opp=${opportunity.id}`;

    if (openCount > 1) {
      customFields['Otwarte sprawy'] = String(openCount);
    }
  }

  return {
    name,
    surname,
    phone_number: [normalized],
    email: customer.email ?? null,
    nip: customer.companyNip ?? null,
    identifier: opportunity?.number ?? null,
    custom_fields: customFields,
  };
}
