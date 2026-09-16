import { fetchCsrfToken } from '../auth/auth-api';

export type ContractPartyOption = 'CONSUMER' | 'EMPLOYEE_B2B' | 'EMPLOYER_COMPANY';

export interface RentalSelection {
  contractMonths: number;
  annualMileage: number;
  downPaymentPct: number;
}

export interface InquiryRentalDetails {
  contractMonths: number;
  annualMileage: number;
  downPaymentPct: number;
  downPaymentAmountPln: number;
  monthlyRateNetPln: number;
  monthlyRateGrossPln: number;
  rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX';
  rentalCompanyName: string;
}

export interface CreateInquiryPayload {
  offerId: string;
  idempotencyKey: string;
  contractParty: ContractPartyOption;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  nip?: string;
  notes?: string;
  consentPrivacy: boolean;
  rentalSelection?: RentalSelection;
}

export interface InquiryVehicle {
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  primaryImageUrl: string | null;
}

export interface InquiryPricing {
  listPricePln: number;
  employeePricePln: number;
  savingsPln: number;
  discountPct: number;
}

export interface InquiryBenefit {
  name: string;
  moyaCardAmount: number | null;
  fuelDiscount: string | null;
  consultantCare: boolean;
  termsText: string | null;
}

export interface EmployeeInquiryItem {
  id: string;
  sourceType?: 'FINANCING' | 'RENTAL';
  status: string;
  referenceNumber: string | null;
  contractParty: ContractPartyOption;
  createdAt: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  nip: string | null;
  notes: string | null;
  vehicle: InquiryVehicle | null;
  pricing: InquiryPricing | null;
  benefit: InquiryBenefit | null;
  rental?: InquiryRentalDetails | null;
}

export interface CreateInquiryResponse {
  inquiry: {
    id: string;
    status: string;
    referenceNumber: string | null;
    createdAt: string;
    vehicle: InquiryVehicle | null;
    pricing: InquiryPricing | null;
  };
}

export interface InquiriesListResponse {
  inquiries: EmployeeInquiryItem[];
  nextCursor: string | null;
}

export interface FetchInquiriesParams {
  limit?: number;
  cursor?: string;
}

function normalizeBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function handleResponseJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string')
      ? data.message
      : `Błąd serwera (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

/**
 * Wysyła zapytanie pracownika o ofertę do API.
 * Wymaga tokena CSRF oraz ciasteczka sesyjnego via credentials: 'same-origin'.
 */
export async function submitEmployeeInquiry(
  apiUrl: string,
  payload: CreateInquiryPayload,
  signal?: AbortSignal
): Promise<CreateInquiryResponse> {
  const base = normalizeBaseUrl(apiUrl);
  const csrfToken = await fetchCsrfToken(apiUrl);

  const res = await fetch(`${base}/employee/inquiries`, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(payload)
  });

  return handleResponseJson<CreateInquiryResponse>(res);
}

/**
 * Pobiera listę zgłoszeń zalogowanego pracownika.
 */
export async function fetchEmployeeInquiries(
  apiUrl: string,
  params: FetchInquiriesParams = {},
  signal?: AbortSignal
): Promise<InquiriesListResponse> {
  const base = normalizeBaseUrl(apiUrl);
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  const queryStr = searchParams.toString();
  const url = `${base}/employee/inquiries${queryStr ? `?${queryStr}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      'Accept': 'application/json'
    }
  });

  return handleResponseJson<InquiriesListResponse>(res);
}
