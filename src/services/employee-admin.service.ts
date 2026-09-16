let API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
if (API_BASE_URL.endsWith('/api')) API_BASE_URL = API_BASE_URL.slice(0, -4);
if (API_BASE_URL.endsWith('/api/')) API_BASE_URL = API_BASE_URL.slice(0, -5);

export interface EmployeeProgramSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  defaultDiscountPct: string | null;
  scopeIncludeNew?: boolean;
  scopeIncludeRental?: boolean;
  scopeDiscountPct?: string | null;
  _count: {
    registrationCodes: number;
    offers: number;
    memberships: number;
  };
}

export interface EmployeeCompanyItem {
  id: string;
  name: string;
  slug: string;
  nip: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  programs: EmployeeProgramSummary[];
  _count?: {
    registrationCodes: number;
    memberships: number;
  };
}

export interface EmployeeRegistrationCode {
  id: string;
  companyId?: string;
  programId?: string;
  label: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface EmployeeBenefitPolicy {
  id: string;
  programId?: string;
  name: string;
  moyaCardAmount: number | null;
  fuelDiscount: string | null;
  consultantCare: boolean;
  termsText: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface EmployeeProgramOffer {
  id: string;
  programId: string;
  sourceType: 'FINANCING' | 'RENTAL';
  listingId: string | null;
  customPricePln: number | null;
  discountPct: string | null;
  benefitPolicyId: string | null;
  isExcluded?: boolean;
  isActive: boolean;
  createdAt: string;
  listing?: {
    id: string;
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    pricePln: number;
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    images?: string[];
    fuelType?: string | null;
    transmission?: string | null;
  } | null;
  benefitPolicy?: EmployeeBenefitPolicy | null;
}

export interface AvailableListing {
  id: string;
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  pricePln: number;
  primaryImageUrl?: string | null;
  imageUrls?: string[];
  images?: string[];
  fuelType?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
}

export interface EmployeeMatrixVersionSummary {
  id: string;
  versionNumber: number;
  label: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  createdAt: string;
  _count: { rows: number };
}

export interface EmployeeMatrixSet {
  id: string;
  rentalCompanyId: string;
  name: string;
  description: string | null;
  rentalCompany: { id: string; name: string };
  versions: EmployeeMatrixVersionSummary[];
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errMsg = `Błąd żądania (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || data.message || errMsg;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const employeeAdminApi = {
  // Companies
  listCompanies: (params: { page?: number; limit?: number; search?: string } = {}, token: string) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    return request<{
      companies: EmployeeCompanyItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/employee-programs/companies?${q.toString()}`, {}, token);
  },

  getCompany: (companyId: string, token: string) => {
    return request<{ company: EmployeeCompanyItem }>(`/api/admin/employee-programs/companies/${companyId}`, {}, token);
  },

  createCompany: (
    data: { name: string; nip?: string | null; programName?: string; defaultDiscountPct?: number | null; description?: string | null },
    token: string
  ) => {
    return request<{ company: EmployeeCompanyItem }>(
      '/api/admin/employee-programs/companies',
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
  },

  updateCompany: (companyId: string, data: { name?: string; nip?: string | null; isActive?: boolean }, token: string) => {
    return request<{ company: EmployeeCompanyItem }>(
      `/api/admin/employee-programs/companies/${companyId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token
    );
  },

  updateProgram: (
    programId: string,
    data: {
      name?: string;
      description?: string | null;
      defaultDiscountPct?: number | null;
      scopeIncludeNew?: boolean;
      scopeIncludeRental?: boolean;
      scopeDiscountPct?: number | null;
      isActive?: boolean;
    },
    token: string
  ) => {
    return request<{ program: any }>(
      `/api/admin/employee-programs/programs/${programId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token
    );
  },

  // Codes
  listCodes: (programId: string, params: { page?: number; limit?: number } = {}, token: string) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return request<{
      codes: EmployeeRegistrationCode[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/employee-programs/programs/${programId}/registration-codes?${q.toString()}`, {}, token);
  },

  createCode: (programId: string, data: { label?: string | null; customCode?: string; expiresAt?: string | null }, token: string) => {
    return request<{ code: EmployeeRegistrationCode; rawCode: string }>(
      `/api/admin/employee-programs/programs/${programId}/registration-codes`,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
  },

  deactivateCode: (codeId: string, token: string) => {
    return request<{ code: EmployeeRegistrationCode }>(
      `/api/admin/employee-programs/registration-codes/${codeId}/deactivate`,
      { method: 'POST' },
      token
    );
  },

  // Benefit Policies
  listBenefitPolicies: (programId: string, token: string) => {
    return request<{ policies: EmployeeBenefitPolicy[] }>(
      `/api/admin/employee-programs/programs/${programId}/benefit-policies`,
      {},
      token
    );
  },

  createBenefitPolicy: (
    programId: string,
    data: { name: string; moyaCardAmount?: number | null; fuelDiscount?: string | null; consultantCare?: boolean; termsText?: string | null },
    token: string
  ) => {
    return request<{ policy: EmployeeBenefitPolicy }>(
      `/api/admin/employee-programs/programs/${programId}/benefit-policies`,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
  },

  updateBenefitPolicy: (
    policyId: string,
    data: { name?: string; moyaCardAmount?: number | null; fuelDiscount?: string | null; consultantCare?: boolean; termsText?: string | null; isActive?: boolean },
    token: string
  ) => {
    return request<{ policy: EmployeeBenefitPolicy }>(
      `/api/admin/employee-programs/benefit-policies/${policyId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token
    );
  },

  deleteBenefitPolicy: (policyId: string, token: string) => {
    return request<{ success: boolean }>(
      `/api/admin/employee-programs/benefit-policies/${policyId}`,
      { method: 'DELETE' },
      token
    );
  },

  // Available Listings (for offer picker)
  listAvailableListings: (programId: string, search: string = '', token: string) => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    return request<{ listings: AvailableListing[] }>(
      `/api/admin/employee-programs/available-listings?${q.toString()}`,
      {},
      token
    );
  },

  // Offers
  listOffers: (programId: string, params: { page?: number; limit?: number } = {}, token: string) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return request<{
      offers: EmployeeProgramOffer[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/employee-programs/programs/${programId}/offers?${q.toString()}`, {}, token);
  },

  createOffer: (
    programId: string,
    data: { listingId: string; customPricePln?: number | null; discountPct?: number | null; benefitPolicyId?: string | null; isExcluded?: boolean },
    token: string
  ) => {
    return request<{ offer: EmployeeProgramOffer }>(
      `/api/admin/employee-programs/programs/${programId}/offers`,
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
  },

  updateOffer: (
    offerId: string,
    data: { customPricePln?: number | null; discountPct?: number | null; benefitPolicyId?: string | null; isExcluded?: boolean; isActive?: boolean },
    token: string
  ) => {
    return request<{ offer: EmployeeProgramOffer }>(
      `/api/admin/employee-programs/offers/${offerId}`,
      { method: 'PATCH', body: JSON.stringify(data) },
      token
    );
  },

  deleteOffer: (offerId: string, token: string) => {
    return request<{ success: boolean }>(
      `/api/admin/employee-programs/offers/${offerId}`,
      { method: 'DELETE' },
      token
    );
  },

  // Matrix Sets
  listMatrixSets: (token: string) => {
    return request<{ matrixSets: EmployeeMatrixSet[] }>('/api/admin/employee-programs/matrix-sets', {}, token);
  },

  createMatrixSet: (data: { rentalCompanyId: string; name: string; description?: string | null }, token: string) => {
    return request<{ matrixSet: EmployeeMatrixSet }>(
      '/api/admin/employee-programs/matrix-sets',
      { method: 'POST', body: JSON.stringify(data) },
      token
    );
  },

  importMatrixCSV: async (setId: string, file: File, label: string = '', token: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const q = label ? `?label=${encodeURIComponent(label)}` : '';

    const res = await fetch(`${API_BASE_URL}/api/admin/employee-programs/matrix-sets/${setId}/import${q}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      let errMsg = `Błąd importu CSV (${res.status})`;
      try {
        const data = await res.json();
        errMsg = data.error || data.message || errMsg;
      } catch {
        // fallback
      }
      throw new Error(errMsg);
    }

    return res.json();
  },

  publishMatrixVersion: (versionId: string, token: string) => {
    return request<{ version: any }>(
      `/api/admin/employee-programs/matrix-versions/${versionId}/publish`,
      { method: 'POST' },
      token
    );
  },

  previewMatrixVersion: (versionId: string, token: string) => {
    return request<{ version: any; sampleRows: any[] }>(
      `/api/admin/employee-programs/matrix-versions/${versionId}/preview`,
      {},
      token
    );
  }
};
