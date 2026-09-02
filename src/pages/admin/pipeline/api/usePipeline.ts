import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, QueueFilterParams } from './pipelineApi';
import {
  PipelinePhase,
  ClientType,
  FinancingType,
  LeadSourceChannel,
  PipelineDocumentStatus,
} from '../types';

export const PIPELINE_KEYS = {
  all: ['pipeline'] as const,
  queue: (filters?: QueueFilterParams) => [...PIPELINE_KEYS.all, 'queue', filters] as const,
  opportunities: (filters?: Record<string, unknown>) => [...PIPELINE_KEYS.all, 'opportunities', filters] as const,
  opportunity: (id: string) => [...PIPELINE_KEYS.all, 'opportunity', id] as const,
  inbox: (params?: { limit?: number; offset?: number }) => [...PIPELINE_KEYS.all, 'inbox', params] as const,
  dictionaries: () => [...PIPELINE_KEYS.all, 'dictionaries'] as const,
};

export function useAdvisorQueue(filters?: QueueFilterParams) {
  return useQuery({
    queryKey: PIPELINE_KEYS.queue(filters),
    queryFn: () => pipelineApi.getQueue(filters),
    refetchInterval: 30000, // Background refresh every 30s
  });
}

export function useOpportunities(filters?: {
  phase?: PipelinePhase;
  status?: 'OPEN' | 'WON' | 'LOST';
  ownerUserId?: string;
  clientType?: ClientType;
  financingType?: FinancingType;
  leadSource?: LeadSourceChannel;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: PIPELINE_KEYS.opportunities(filters),
    queryFn: () => pipelineApi.listOpportunities(filters),
  });
}

export function useOpportunityDetails(id: string | null) {
  return useQuery({
    queryKey: PIPELINE_KEYS.opportunity(id ?? ''),
    queryFn: () => pipelineApi.getOpportunity(id!),
    enabled: Boolean(id),
  });
}

export function usePipelineDictionaries() {
  return useQuery({
    queryKey: PIPELINE_KEYS.dictionaries(),
    queryFn: () => pipelineApi.getDictionaries(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useInboxLeads(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: PIPELINE_KEYS.inbox(params),
    queryFn: () => pipelineApi.getInbox(params),
  });
}

// Mutations
export function usePipelineMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: PIPELINE_KEYS.all });
  };

  const createOpportunity = useMutation({
    mutationFn: pipelineApi.createOpportunity,
    onSuccess: invalidateAll,
  });

  const transitionPhase = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { targetPhase: PipelinePhase; overridden?: boolean; overrideReason?: string };
    }) => pipelineApi.transitionPhase(id, data),
    onSuccess: invalidateAll,
  });

  const assignOwner = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { ownerUserId: string | null; reason?: 'MANUAL' | 'ROUND_ROBIN' | 'PICKUP' };
    }) => pipelineApi.assignOwner(id, data),
    onSuccess: invalidateAll,
  });

  const setNextAction = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { nextActionType: string; nextActionDueAt: string | null; nextActionNote?: string | null };
    }) => pipelineApi.setNextAction(id, data),
    onSuccess: invalidateAll,
  });

  const logContact = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        channel: 'CALL' | 'EMAIL' | 'SMS' | 'MEETING';
        note?: string | null;
        nextActionType?: string | null;
        nextActionDueAt?: string | null;
        nextActionNote?: string | null;
      };
    }) => pipelineApi.logContact(id, data),
    onSuccess: invalidateAll,
  });

  const closeWon = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { comment?: string } }) =>
      pipelineApi.closeWon(id, data),
    onSuccess: invalidateAll,
  });

  const closeLost = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { reasonCode: string; comment?: string | null };
    }) => pipelineApi.closeLost(id, data),
    onSuccess: invalidateAll,
  });

  const patchOpportunity = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        clientType?: ClientType;
        financingType?: FinancingType | null;
        leadSource?: LeadSourceChannel;
        leadSourceDetail?: string | null;
        customerName?: string;
        customerPhone?: string | null;
        customerEmail?: string | null;
        companyName?: string | null;
        companyNip?: string | null;
      };
    }) => pipelineApi.patchOpportunity(id, data),
    onSuccess: invalidateAll,
  });

  // Vehicles
  const addVehicleCandidate = useMutation({
    mutationFn: ({
      opportunityId,
      data,
    }: {
      opportunityId: string;
      data: {
        listingId?: string | null;
        rentalVehicleId?: string | null;
        customMake?: string | null;
        customModel?: string | null;
        customVersion?: string | null;
        customYear?: number | null;
        priceSnapshotGrosze?: number | null;
        selectionStatus?: 'CANDIDATE' | 'SELECTED';
      };
    }) => pipelineApi.addVehicleCandidate(opportunityId, data),
    onSuccess: invalidateAll,
  });

  const selectVehicleCandidate = useMutation({
    mutationFn: ({
      opportunityId,
      candidateId,
    }: {
      opportunityId: string;
      candidateId: string;
    }) => pipelineApi.selectVehicleCandidate(opportunityId, candidateId),
    onSuccess: invalidateAll,
  });

  const removeVehicleCandidate = useMutation({
    mutationFn: ({
      opportunityId,
      candidateId,
    }: {
      opportunityId: string;
      candidateId: string;
    }) => pipelineApi.removeVehicleCandidate(opportunityId, candidateId),
    onSuccess: invalidateAll,
  });

  // Offers
  const createOrUpdateOffer = useMutation({
    mutationFn: ({
      opportunityId,
      data,
    }: {
      opportunityId: string;
      data: {
        vehicleCandidateId?: string | null;
        financingProductId?: string | null;
        financingType: FinancingType;
        priceGrosze: number;
        downPaymentGrosze?: number;
        periodMonths: number;
        monthlyRateGrosze?: number | null;
        finalPaymentGrosze?: number | null;
        annualMileageKm?: number | null;
      };
    }) => pipelineApi.createOrUpdateOffer(opportunityId, data),
    onSuccess: invalidateAll,
  });

  const supersedeOffer = useMutation({
    mutationFn: ({
      opportunityId,
      data,
    }: {
      opportunityId: string;
      data: {
        vehicleCandidateId?: string | null;
        financingProductId?: string | null;
        financingType: FinancingType;
        priceGrosze: number;
        downPaymentGrosze?: number;
        periodMonths: number;
        monthlyRateGrosze?: number | null;
        finalPaymentGrosze?: number | null;
        annualMileageKm?: number | null;
      };
    }) => pipelineApi.supersedeOffer(opportunityId, data),
    onSuccess: invalidateAll,
  });

  const presentOffer = useMutation({
    mutationFn: ({
      opportunityId,
      offerId,
      data,
    }: {
      opportunityId: string;
      offerId: string;
      data: { channel?: 'CALL' | 'EMAIL' | 'SMS' };
    }) => pipelineApi.presentOffer(opportunityId, offerId, data),
    onSuccess: invalidateAll,
  });

  const acceptOffer = useMutation({
    mutationFn: ({
      opportunityId,
      offerId,
    }: {
      opportunityId: string;
      offerId: string;
    }) => pipelineApi.acceptOffer(opportunityId, offerId),
    onSuccess: invalidateAll,
  });

  // Applications
  const createApplication = useMutation({
    mutationFn: ({
      opportunityId,
      data,
    }: {
      opportunityId: string;
      data: {
        financierId: string;
        offerId?: string | null;
        externalReference?: string | null;
      };
    }) => pipelineApi.createApplication(opportunityId, data),
    onSuccess: invalidateAll,
  });

  const submitApplication = useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: {
        stage: 'PRECHECK' | 'FULL';
        externalReference?: string | null;
      };
    }) => pipelineApi.submitApplication(applicationId, data),
    onSuccess: invalidateAll,
  });

  const decideApplication = useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: {
        decision: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED';
        rejectionReasonCode?: string | null;
        rejectionComment?: string | null;
        approvedConditions?: Record<string, unknown> | null;
      };
    }) => pipelineApi.decideApplication(applicationId, data),
    onSuccess: invalidateAll,
  });

  const rerouteApplication = useMutation({
    mutationFn: ({
      applicationId,
      data,
    }: {
      applicationId: string;
      data: {
        targetFinancierId: string;
        offerId?: string | null;
        note?: string | null;
      };
    }) => pipelineApi.rerouteApplication(applicationId, data),
    onSuccess: invalidateAll,
  });

  // Documents
  const materializeDocuments = useMutation({
    mutationFn: (opportunityId: string) => pipelineApi.materializeDocuments(opportunityId),
    onSuccess: invalidateAll,
  });

  const updateDocumentStatus = useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: {
        status: PipelineDocumentStatus;
        note?: string | null;
        requestedVia?: string | null;
        reason?: string | null;
      };
    }) => pipelineApi.updateDocumentStatus(documentId, data),
    onSuccess: invalidateAll,
  });

  // Inbox
  const qualifyLead = useMutation({
    mutationFn: ({
      leadId,
      data,
    }: {
      leadId: string;
      data: {
        ownerUserId?: string | null;
        customerName?: string | null;
        customerPhone?: string | null;
        customerEmail?: string | null;
        companyName?: string | null;
        companyNip?: string | null;
        nextActionType?: string | null;
        nextActionDueAt?: string | null;
        nextActionNote?: string | null;
        clientType?: ClientType;
        financingType?: FinancingType | null;
        leadSource?: LeadSourceChannel;
        leadSourceDetail?: string | null;
      };
    }) => pipelineApi.qualifyLead(leadId, data),
    onSuccess: invalidateAll,
  });

  const dismissLeadAsSpam = useMutation({
    mutationFn: ({
      leadId,
      data,
    }: {
      leadId: string;
      data?: { comment?: string | null };
    }) => pipelineApi.dismissLeadAsSpam(leadId, data),
    onSuccess: invalidateAll,
  });

  return {
    createOpportunity,
    transitionPhase,
    assignOwner,
    setNextAction,
    logContact,
    closeWon,
    closeLost,
    patchOpportunity,
    addVehicleCandidate,
    selectVehicleCandidate,
    removeVehicleCandidate,
    createOrUpdateOffer,
    supersedeOffer,
    presentOffer,
    acceptOffer,
    createApplication,
    submitApplication,
    decideApplication,
    rerouteApplication,
    materializeDocuments,
    updateDocumentStatus,
    qualifyLead,
    dismissLeadAsSpam,
  };
}
