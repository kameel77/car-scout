import {
  QueueResponse,
  PipelineOpportunitySummary,
  OpportunityDetail,
  PipelineDictionaries,
  InboxLeadSummary,
  PipelinePhase,
  ClientType,
  FinancingType,
  LeadSourceChannel,
} from '../types';

const API_BASE = '/api/pipeline';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorBody.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export type QueueFilterParams = {
  ownerUserId?: string;
  clientType?: ClientType;
  financingType?: FinancingType;
  leadSource?: LeadSourceChannel;
  search?: string;
};

export const pipelineApi = {
  // Queue
  async getQueue(params?: QueueFilterParams): Promise<QueueResponse> {
    const sp = new URLSearchParams();
    if (params?.ownerUserId) sp.append('ownerUserId', params.ownerUserId);
    if (params?.clientType) sp.append('clientType', params.clientType);
    if (params?.financingType) sp.append('financingType', params.financingType);
    if (params?.leadSource) sp.append('leadSource', params.leadSource);
    if (params?.search) sp.append('search', params.search);

    const qs = sp.toString();
    const res = await fetch(`${API_BASE}/queue${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    return handleResponse<QueueResponse>(res);
  },

  // Opportunities
  async listOpportunities(params?: {
    phase?: PipelinePhase;
    status?: 'OPEN' | 'WON' | 'LOST';
    ownerUserId?: string;
    clientType?: ClientType;
    financingType?: FinancingType;
    leadSource?: LeadSourceChannel;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PipelineOpportunitySummary[]; total: number }> {
    const sp = new URLSearchParams();
    if (params?.phase) sp.append('phase', params.phase);
    if (params?.status) sp.append('status', params.status);
    if (params?.ownerUserId) sp.append('ownerUserId', params.ownerUserId);
    if (params?.clientType) sp.append('clientType', params.clientType);
    if (params?.financingType) sp.append('financingType', params.financingType);
    if (params?.leadSource) sp.append('leadSource', params.leadSource);
    if (params?.search) sp.append('search', params.search);
    if (params?.limit) sp.append('limit', String(params.limit));
    if (params?.offset) sp.append('offset', String(params.offset));

    const qs = sp.toString();
    const res = await fetch(`${API_BASE}/opportunities${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    return handleResponse<{ items: PipelineOpportunitySummary[]; total: number }>(res);
  },

  async getOpportunity(id: string): Promise<OpportunityDetail> {
    const res = await fetch(`${API_BASE}/opportunities/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse<OpportunityDetail>(res);
  },

  async createOpportunity(data: {
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    companyName?: string | null;
    companyNip?: string | null;
    clientType?: ClientType;
    financingType?: FinancingType | null;
    leadSource: LeadSourceChannel;
    leadSourceDetail?: string | null;
    ownerUserId?: string | null;
    initialPhase?: PipelinePhase;
    nextActionType?: string | null;
    nextActionDueAt?: string | null;
    nextActionNote?: string | null;
  }): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async transitionPhase(
    id: string,
    data: {
      targetPhase: PipelinePhase;
      overridden?: boolean;
      overrideReason?: string;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/transition`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async assignOwner(
    id: string,
    data: {
      ownerUserId: string | null;
      reason?: 'MANUAL' | 'ROUND_ROBIN' | 'PICKUP';
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/assign`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async setNextAction(
    id: string,
    data: {
      nextActionType: string;
      nextActionDueAt: string | null;
      nextActionNote?: string | null;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/next-action`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async logContact(
    id: string,
    data: {
      channel: 'CALL' | 'EMAIL' | 'SMS' | 'MEETING';
      note?: string;
      nextActionType?: string;
      nextActionDueAt?: string | null;
      nextActionNote?: string;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/log-contact`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async closeOpportunity(
    id: string,
    data: {
      status: 'WON' | 'LOST';
      reasonCode?: string;
      comment?: string;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/close`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async patchOpportunity(
    id: string,
    data: Partial<{
      clientType: ClientType;
      financingType: FinancingType | null;
      leadSource: LeadSourceChannel;
      leadSourceDetail: string | null;
      customerName: string;
      customerPhone: string | null;
      customerEmail: string | null;
      companyName: string | null;
      companyNip: string | null;
    }>
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  // Inbox
  async getInbox(params?: { limit?: number; offset?: number }): Promise<{
    leads: InboxLeadSummary[];
    total: number;
    cutoffDate: string;
  }> {
    const sp = new URLSearchParams();
    if (params?.limit) sp.append('limit', String(params.limit));
    if (params?.offset) sp.append('offset', String(params.offset));

    const qs = sp.toString();
    const res = await fetch(`${API_BASE}/inbox${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    return handleResponse<{ leads: InboxLeadSummary[]; total: number; cutoffDate: string }>(res);
  },

  async qualifyLead(
    leadId: string,
    data: {
      ownerUserId?: string | null;
      nextActionType?: string | null;
      nextActionDueAt?: string | null;
      nextActionNote?: string | null;
      clientType?: ClientType;
      financingType?: FinancingType | null;
      leadSource?: LeadSourceChannel;
      leadSourceDetail?: string | null;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/inbox/${leadId}/qualify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async dismissLead(
    leadId: string,
    data?: { comment?: string }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/inbox/${leadId}/dismiss`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data ?? {}),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  // Dictionaries
  async getDictionaries(): Promise<PipelineDictionaries> {
    const res = await fetch(`${API_BASE}/dictionaries`, {
      headers: getHeaders(),
    });
    return handleResponse<PipelineDictionaries>(res);
  },
};
