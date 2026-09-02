export type ScopeType = 'PLATFORM' | 'DEALER_GROUP' | 'DEALER';
export type ClientType = 'B2C' | 'B2B' | 'UNKNOWN';
export type FinancingType = 'LEASING' | 'CREDIT' | 'RENTAL' | 'CASH';
export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST';
export type PipelinePhase =
  | 'INBOX'
  | 'QUALIFICATION'
  | 'SELECTION'
  | 'COMPLETING'
  | 'FINANCIAL_DECISION'
  | 'CONTRACT'
  | 'DELIVERY';

export type LeadSourceChannel =
  | 'TV'
  | 'META'
  | 'GOOGLE'
  | 'ORGANIC'
  | 'REFERRAL'
  | 'DEALER'
  | 'PARTNER'
  | 'OTHER';

export const PIPELINE_PHASES: { id: PipelinePhase; label: string; description: string }[] = [
  { id: 'INBOX', label: 'Inbox', description: 'Nowe zapytania ze strony' },
  { id: 'QUALIFICATION', label: 'Kwalifikacja', description: 'Badanie potrzeb i budżetu' },
  { id: 'SELECTION', label: 'Dobór pojazdu', description: 'Przedstawienie ofert i kalkulacji' },
  { id: 'COMPLETING', label: 'Kompletowanie', description: 'Zbieranie dokumentów do wniosku' },
  { id: 'FINANCIAL_DECISION', label: 'Weryfikacja finansowa', description: 'Proces u finansującego' },
  { id: 'CONTRACT', label: 'Umowa', description: 'Podpisanie umowy leasingu / kredytu' },
  { id: 'DELIVERY', label: 'Odbiór', description: 'Wydanie pojazdu i rozliczenie prowizji' },
];

export const LEAD_SOURCES: { id: LeadSourceChannel; label: string }[] = [
  { id: 'META', label: 'Meta (Facebook / IG)' },
  { id: 'GOOGLE', label: 'Google Ads' },
  { id: 'ORGANIC', label: 'Organiczne / SEO' },
  { id: 'TV', label: 'Kampania TV' },
  { id: 'REFERRAL', label: 'Polecenie' },
  { id: 'DEALER', label: 'Dealer partnerski' },
  { id: 'PARTNER', label: 'Partner zewnętrzny' },
  { id: 'OTHER', label: 'Inne' },
];

export const NEXT_ACTION_TYPES: { id: string; label: string }[] = [
  { id: 'CALL_FIRST', label: '📞 Pierwszy kontakt' },
  { id: 'CALL_FOLLOWUP', label: '📞 Ponowny kontakt' },
  { id: 'OFFER_PREPARE', label: '📄 Przygotowanie oferty' },
  { id: 'OFFER_PRESENT', label: '💬 Prezentacja oferty' },
  { id: 'DOCS_COLLECT', label: '📁 Zbiórka dokumentów' },
  { id: 'APP_SUBMIT', label: '🏦 Złożenie wniosku' },
  { id: 'CONTRACT_SIGN', label: '✍️ Podpisanie umowy' },
  { id: 'DELIVERY_SCHEDULE', label: '🚗 Wydanie pojazdu' },
];

export type CustomerSummary = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  companyNip: string | null;
  clientType: ClientType;
};

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

export type VehicleCandidateSummary = {
  id: string;
  customMake: string | null;
  customModel: string | null;
  customVersion: string | null;
  customYear: number | null;
  priceSnapshotGrosze: number | null;
  listingId: string | null;
  rentalVehicleId: string | null;
  listing?: {
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    pricePln: number | null;
  } | null;
  rentalVehicle?: {
    make: string;
    model: string;
    productionYear: number | null;
  } | null;
};

export type PipelineOpportunitySummary = {
  id: string;
  number: string;
  status: OpportunityStatus;
  phase: PipelinePhase;
  phaseEnteredAt: string;
  firstTouchAt: string;
  firstContactAt: string | null;
  clientType: ClientType;
  financingType: FinancingType | null;
  leadSource: LeadSourceChannel;
  leadSourceDetail: string | null;
  ownerUserId: string | null;
  nextActionType: string | null;
  nextActionNote: string | null;
  nextActionDueAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReasonCode: string | null;
  lostComment: string | null;
  createdAt: string;
  updatedAt: string;
  customer: CustomerSummary;
  owner: UserSummary | null;
  vehicleCandidates?: VehicleCandidateSummary[];
  _count?: {
    vehicleCandidates: number;
    offers: number;
    tasks: number;
  };
};

export type InboxLeadSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  trafficSource: string | null;
  leadType: string;
  createdAt: string;
  listingId: string | null;
  rentalVehicleId: string | null;
  listing?: {
    id: string;
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    pricePln: number | null;
    primaryImageUrl: string | null;
  } | null;
  rentalVehicle?: {
    id: string;
    make: string;
    model: string;
    productionYear: number | null;
  } | null;
};

export type QueueResponse = {
  overdue: PipelineOpportunitySummary[];
  today: PipelineOpportunitySummary[];
  noAction: PipelineOpportunitySummary[];
  inbox: InboxLeadSummary[];
  counts: {
    overdue: number;
    today: number;
    noAction: number;
    inbox: number;
    totalActive: number;
  };
};

export type PipelineEventItem = {
  id: string;
  type: string;
  occurredAt: string;
  actorType: string;
  actorUserId: string | null;
  actorLabel: string | null;
  payload: Record<string, any>;
};

export type OpportunityDetail = PipelineOpportunitySummary & {
  events: PipelineEventItem[];
  offers: unknown[];
  applications: unknown[];
  tasks: unknown[];
  documents: unknown[];
  sourceLead: {
    id: string;
    trafficSource: string | null;
    createdAt: string;
  } | null;
};

export type PipelineDictionaries = {
  lossReasons: Array<{
    code: string;
    label: string;
    category: string;
    requiresComment: boolean;
    sortOrder: number;
  }>;
  financiers: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  phaseRequirements: Array<{
    id: string;
    phase: PipelinePhase;
    code: string;
    label: string;
    isMandatory: boolean;
    sortOrder: number;
  }>;
  users: UserSummary[];
};
