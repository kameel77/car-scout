import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, QueueFilterParams } from './pipelineApi';
import { PipelinePhase, ClientType, FinancingType, LeadSourceChannel } from '../types';

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
        note?: string;
        nextActionType?: string;
        nextActionDueAt?: string | null;
        nextActionNote?: string;
      };
    }) => pipelineApi.logContact(id, data),
    onSuccess: invalidateAll,
  });

  const closeOpportunity = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { status: 'WON' | 'LOST'; reasonCode?: string; comment?: string };
    }) => pipelineApi.closeOpportunity(id, data),
    onSuccess: invalidateAll,
  });

  const patchOpportunity = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof pipelineApi.patchOpportunity>[1];
    }) => pipelineApi.patchOpportunity(id, data),
    onSuccess: invalidateAll,
  });

  const qualifyLead = useMutation({
    mutationFn: ({
      leadId,
      data,
    }: {
      leadId: string;
      data: Parameters<typeof pipelineApi.qualifyLead>[1];
    }) => pipelineApi.qualifyLead(leadId, data),
    onSuccess: invalidateAll,
  });

  const dismissLead = useMutation({
    mutationFn: ({
      leadId,
      data,
    }: {
      leadId: string;
      data?: { comment?: string };
    }) => pipelineApi.dismissLead(leadId, data),
    onSuccess: invalidateAll,
  });

  return {
    createOpportunity,
    transitionPhase,
    assignOwner,
    setNextAction,
    logContact,
    closeOpportunity,
    patchOpportunity,
    qualifyLead,
    dismissLead,
  };
}
