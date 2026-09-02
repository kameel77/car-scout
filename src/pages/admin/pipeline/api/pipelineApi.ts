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
  VehicleCandidateSummary,
  PipelineOfferSummary,
  PipelineApplicationSummary,
  PipelineDocumentSummary,
  PipelineDocumentStatus,
} from '../types';

const API_BASE = '/api/pipeline';

export class ApiError extends Error {
  statusCode: number;
  data: any;
  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

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
    throw new ApiError(
      errorBody.message || errorBody.error || `Request failed with status ${res.status}`,
      res.status,
      errorBody
    );
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
      note?: string | null;
      nextActionType?: string | null;
      nextActionDueAt?: string | null;
      nextActionNote?: string | null;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/log-contact`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async closeWon(
    id: string,
    data?: { comment?: string }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/won`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async closeLost(
    id: string,
    data: { reasonCode: string; comment?: string | null }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}/lost`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  async patchOpportunity(
    id: string,
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
      contractSignedAt?: string | null;
      contractedApplicationId?: string | null;
    }
  ): Promise<PipelineOpportunitySummary> {
    const res = await fetch(`${API_BASE}/opportunities/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOpportunitySummary>(res);
  },

  // Vehicle candidates
  async addVehicleCandidate(
    opportunityId: string,
    data: {
      listingId?: string | null;
      rentalVehicleId?: string | null;
      customMake?: string | null;
      customModel?: string | null;
      customVersion?: string | null;
      customYear?: number | null;
      priceSnapshotGrosze?: number | null;
      selectionStatus?: 'CANDIDATE' | 'SELECTED';
    }
  ): Promise<VehicleCandidateSummary> {
    const res = await fetch(`${API_BASE}/opportunities/${opportunityId}/candidates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<VehicleCandidateSummary>(res);
  },

  async selectVehicleCandidate(
    opportunityId: string,
    candidateId: string
  ): Promise<VehicleCandidateSummary> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/candidates/${candidateId}/select`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse<VehicleCandidateSummary>(res);
  },

  async removeVehicleCandidate(
    opportunityId: string,
    candidateId: string
  ): Promise<{ success: boolean }> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/candidates/${candidateId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse<{ success: boolean }>(res);
  },

  // Offers
  async createOrUpdateOffer(
    opportunityId: string,
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
    }
  ): Promise<PipelineOfferSummary> {
    const res = await fetch(`${API_BASE}/opportunities/${opportunityId}/offers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineOfferSummary>(res);
  },

  async supersedeOffer(
    opportunityId: string,
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
    }
  ): Promise<PipelineOfferSummary> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/offers/supersede`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse<PipelineOfferSummary>(res);
  },

  async presentOffer(
    opportunityId: string,
    offerId: string,
    data: { channel?: 'CALL' | 'EMAIL' | 'SMS' }
  ): Promise<PipelineOfferSummary> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/offers/${offerId}/present`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse<PipelineOfferSummary>(res);
  },

  async acceptOffer(
    opportunityId: string,
    offerId: string
  ): Promise<PipelineOfferSummary> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/offers/${offerId}/accept`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse<PipelineOfferSummary>(res);
  },

  // Applications
  async createApplication(
    opportunityId: string,
    data: {
      financierId: string;
      offerId?: string | null;
      externalReference?: string | null;
      roundMode?: 'JOIN_CURRENT' | 'NEW_ROUND';
    }
  ): Promise<PipelineApplicationSummary> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/applications`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse<PipelineApplicationSummary>(res);
  },

  async submitApplication(
    applicationId: string,
    data: {
      stage: 'PRECHECK' | 'FULL';
      externalReference?: string | null;
    }
  ): Promise<PipelineApplicationSummary> {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/submit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineApplicationSummary>(res);
  },

  async decideApplication(
    applicationId: string,
    data: {
      decision: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED';
      rejectionReasonCode?: string | null;
      rejectionComment?: string | null;
      approvedConditions?: Record<string, unknown> | null;
    }
  ): Promise<PipelineApplicationSummary> {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/decide`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineApplicationSummary>(res);
  },

  async rerouteApplication(
    applicationId: string,
    data: {
      targetFinancierId: string;
      offerId?: string | null;
      note?: string | null;
    }
  ): Promise<PipelineApplicationSummary> {
    const res = await fetch(`${API_BASE}/applications/${applicationId}/reroute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineApplicationSummary>(res);
  },

  // Documents
  async materializeDocuments(
    opportunityId: string
  ): Promise<PipelineDocumentSummary[]> {
    const res = await fetch(
      `${API_BASE}/opportunities/${opportunityId}/documents/materialize`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse<PipelineDocumentSummary[]>(res);
  },

  async updateDocumentStatus(
    documentId: string,
    data: {
      status: PipelineDocumentStatus;
      note?: string | null;
      requestedVia?: string | null;
      reason?: string | null;
    }
  ): Promise<PipelineDocumentSummary> {
    const res = await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<PipelineDocumentSummary>(res);
  },

  // Inbox
  async getInbox(params?: { limit?: number; offset?: number }): Promise<{ items: InboxLeadSummary[]; total: number }> {
    const sp = new URLSearchParams();
    if (params?.limit) sp.append('limit', String(params.limit));
    if (params?.offset) sp.append('offset', String(params.offset));
    const qs = sp.toString();
    const res = await fetch(`${API_BASE}/inbox${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    return handleResponse<{ items: InboxLeadSummary[]; total: number }>(res);
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
  ): Promise<{ opportunity: PipelineOpportunitySummary }> {
    const res = await fetch(`${API_BASE}/inbox/${leadId}/qualify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<{ opportunity: PipelineOpportunitySummary }>(res);
  },

  async dismissLeadAsSpam(
    leadId: string,
    data?: { comment?: string | null }
  ): Promise<{ lead: InboxLeadSummary }> {
    const res = await fetch(`${API_BASE}/inbox/${leadId}/dismiss`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse<{ lead: InboxLeadSummary }>(res);
  },

  // Dictionaries
  async getDictionaries(): Promise<PipelineDictionaries> {
    const res = await fetch(`${API_BASE}/dictionaries`, {
      headers: getHeaders(),
    });
    return handleResponse<PipelineDictionaries>(res);
  },
};
