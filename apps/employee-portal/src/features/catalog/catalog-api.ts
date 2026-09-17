export interface EmployeeOfferVehicle {
  id?: string;
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
  powerHp?: number | null;
  engineCapacityCm3?: number | null;
  doors?: number | null;
  seats?: number | null;
  color?: string | null;
  paintType?: string | null;
  drive?: string | null;
  equipmentSafety?: string[];
  equipmentComfortExtras?: string[];
  equipmentAudioMultimedia?: string[];
  equipmentOther?: string[];
  additionalInfoHeader?: string | null;
  additionalInfoContent?: string | null;
  specsJson?: any;
}

export interface EmployeeOfferPricing {
  listPricePln: number;
  employeePricePln: number;
  savingsPln: number;
  discountPct: number;
}

export interface EmployeeOfferBenefit {
  name: string;
  moyaCardAmount: number | null;
  fuelDiscount: string | null;
  consultantCare: boolean;
  termsText: string | null;
}

export interface EmployeeFinancingOption {
  productId: string;
  category: string;              // 'LEASING' | 'CREDIT'
  label: string;
  allowedContractParties: string[];
  b2cStatus: string;
  minDownPaymentPct: number;
  maxDownPaymentPct: number;
  maxResidualPct: number;
  periods: number[];
  annualRatePct: number;
}

export interface EmployeeFinancingConfig {
  options: EmployeeFinancingOption[];
}

export interface EmployeeOffer {
  id: string;
  sourceType: string;
  vehicle: EmployeeOfferVehicle;
  pricing: EmployeeOfferPricing;
  benefit: EmployeeOfferBenefit | null;
  financing?: EmployeeFinancingConfig | null;
}

export interface EmployeeCatalogResponse {
  offers: EmployeeOffer[];
  nextCursor: string | null;
}

export interface FetchOffersParams {
  limit?: number;
  cursor?: string;
  search?: string;
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
 * Pobiera listę ofert pracowniczych dla programu zalogowanego użytkownika.
 * Zgodnie z pułapką 1 briefu: credentials: 'same-origin' dla ciasteczka __Host-ep-session.
 */
export async function fetchEmployeeOffers(
  apiUrl: string,
  params: FetchOffersParams = {},
  signal?: AbortSignal
): Promise<EmployeeCatalogResponse> {
  const base = normalizeBaseUrl(apiUrl);
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }

  const queryStr = searchParams.toString();
  const url = `${base}/employee/offers${queryStr ? `?${queryStr}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponseJson<EmployeeCatalogResponse>(res);
}

/**
 * Pobiera szczegóły pojedynczej oferty pracowniczej.
 * Przygotowanie pod kolejny etap (next-steps.md §3: szczegóły oferty, kalkulator raty i formularz zapytania).
 */
export async function fetchEmployeeOfferDetails(
  apiUrl: string,
  offerId: string,
  signal?: AbortSignal
): Promise<EmployeeOffer> {
  const base = normalizeBaseUrl(apiUrl);
  const res = await fetch(`${base}/employee/offers/${encodeURIComponent(offerId)}`, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponseJson<EmployeeOffer>(res);
}
