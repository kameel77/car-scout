import {
  ClientType,
  FinancingType,
  OpportunityStatus,
  PipelinePhase,
  LeadSourceChannel,
  CommissionStatus,
  PipelineOffer,
} from '@prisma/client';

export type AggregateType =
  | 'OPPORTUNITY'
  | 'OFFER'
  | 'APPLICATION'
  | 'CUSTOMER'
  | 'TASK'
  | 'DOCUMENT'
  | 'COMMISSION';

export type OfferDiffFields = Pick<
  PipelineOffer,
  | 'priceGrosze'
  | 'downPaymentGrosze'
  | 'periodMonths'
  | 'monthlyRateGrosze'
  | 'finalPaymentGrosze'
  | 'annualMileageKm'
  | 'taxMode'
  | 'financingType'
>;

export type ApplicationWithdrawalReason =
  | 'CONTRACTED_ELSEWHERE' // Excluded from failure counts! (Won at another financier)
  | 'CUSTOMER_RESIGNED'
  | 'EXPIRED'
  | 'SUPERSEDED_BY_NEW_OFFER'
  | 'OTHER';

export type PipelineEventPayloadMap = {
  // Opportunity
  OPPORTUNITY_CREATED: {
    number: string;
    leadSource: LeadSourceChannel;
    leadSourceDetail?: string | null;
    sourceLeadId?: string | null;
    clientType: ClientType;
    createdFrom: 'INBOX' | 'MANUAL' | 'THULIUM';
  };
  OPPORTUNITY_PHASE_CHANGED: {
    before: PipelinePhase;
    after: PipelinePhase;
    durationSeconds: number;
    overridden: boolean;
    unmetRequirements?: string[];
  };
  OPPORTUNITY_OWNER_CHANGED: {
    before: string | null;
    after: string;
    reason: 'MANUAL' | 'ROUND_ROBIN' | 'PICKUP';
  };
  OPPORTUNITY_NEXT_ACTION_SET: {
    before?: { type: string; dueAt: string | null } | null;
    after: { type: string; dueAt: string | null; note?: string | null };
  };
  OPPORTUNITY_FIRST_CONTACT: {
    at: string;
    channel: string;
    secondsFromFirstTouch: number;
  };
  OPPORTUNITY_WON: {
    phase: PipelinePhase;
    applicationId?: string | null;
    commissionGrosze?: number | null;
  };
  OPPORTUNITY_LOST: {
    phase: PipelinePhase;
    reasonCode: string;
    comment?: string | null;
    daysOpen: number;
  };
  OPPORTUNITY_REOPENED: {
    previousStatus: OpportunityStatus;
    reason: string;
  };
  OPPORTUNITY_CLIENT_TYPE_SET: {
    before: ClientType;
    after: ClientType;
  };
  OPPORTUNITY_SLA_BREACHED: {
    slaCode: string;
    phase: PipelinePhase;
    dueAt: string;
    overdueSeconds: number;
  };

  // Vehicle & offer
  VEHICLE_CANDIDATE_ADDED: {
    candidateId: string;
    listingId?: string | null;
    rentalVehicleId?: string | null;
    label: string;
    priceSnapshotGrosze?: number | null;
  };
  VEHICLE_SELECTED: {
    candidateId: string;
    previousCandidateId?: string | null;
  };
  OFFER_CREATED: {
    versionNumber: number;
    financingType: FinancingType;
    priceGrosze: number;
    monthlyRateGrosze: number;
    periodMonths: number;
  };
  OFFER_UPDATED: {
    before: Partial<OfferDiffFields>;
    after: Partial<OfferDiffFields>;
  };
  OFFER_PRESENTED: {
    channel: 'CALL' | 'EMAIL' | 'SMS';
    at: string;
  };
  OFFER_ACCEPTED: {
    at: string;
  };
  OFFER_SUPERSEDED: {
    bySupersedingOfferId: string;
    versionNumber: number;
  };

  // Financing application — parallel rounds and reroute chain
  APPLICATION_CREATED: {
    financierCode: string;
    roundNumber: number;
    offerId?: string | null;
    rerouteFromId?: string | null;
    recommenderRank?: number | null;
    recommenderScore?: number | null;
  };
  APPLICATION_SUBMITTED: {
    stage: 'PRECHECK' | 'FULL';
    financierCode: string;
    externalReference?: string | null;
  };
  APPLICATION_DECIDED: {
    financierCode: string;
    decision: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED';
    reasonCode?: string | null;
    conditions?: unknown;
    decisionDays?: number | null;
  };
  APPLICATION_REROUTED: {
    fromFinancierCode: string;
    toFinancierCode: string;
    fromApplicationId: string;
    rejectionReasonCode?: string | null;
  };
  APPLICATION_WITHDRAWN: {
    financierCode: string;
    reason: ApplicationWithdrawalReason;
    comment?: string | null;
  };

  // Documents, tasks, commission
  DOCUMENT_REQUESTED: {
    code: string;
    label: string;
    requestedVia: string;
  };
  DOCUMENT_RECEIVED: {
    code: string;
    hoursSinceRequest?: number | null;
  };
  DOCUMENT_VERIFIED: {
    code: string;
  };
  DOCUMENT_WAIVED: {
    code: string;
    reason: string;
  };
  TASK_CREATED: {
    title: string;
    kind: string;
    dueAt?: string | null;
    assignedUserId?: string | null;
    createdBy: 'USER' | 'AUTOMATION';
    ruleCode?: string | null;
  };
  TASK_COMPLETED: {
    title: string;
    kind: string;
    overdueSeconds?: number | null;
  };
  COMMISSION_ESTIMATED: {
    basisGrosze: number;
    ratePct: number;
    amountGrosze: number;
    source: 'PRODUCT' | 'FINANCIER' | 'MATRIX';
  };
  COMMISSION_STATUS_CHANGED: {
    before: CommissionStatus;
    after: CommissionStatus;
    amountGrosze: number;
    invoiceNumber?: string | null;
  };
  COMMISSION_OVERRIDDEN: {
    before: number;
    after: number;
    reason: string;
  };

  // Communication (ingested, not authored here)
  CALL_LOGGED: {
    thuliumConnectionId: string;
    direction: string;
    durationSeconds: number;
    agentName?: string | null;
    recordingUrl?: string | null;
    topic?: string | null;
  };
  EMAIL_LOGGED: {
    thuliumTicketId: number;
    direction: string;
    subject?: string | null;
  };
  TICKET_LINKED: {
    thuliumTicketId: number;
    thuliumCustomerId?: number | null;
  };
  THULIUM_CUSTOMER_LINKED: {
    thuliumCustomerId: number;
  };
  NOTE_ADDED: {
    content: string;
  };
};

export type PipelineEventType = keyof PipelineEventPayloadMap;
