export interface RentalVehicle {
  id: string;
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
}

export interface RentalCompanySummary {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface EmployeeRentalOfferSummary {
  id: string;
  sourceType: 'RENTAL';
  vehicle: RentalVehicle;
  rentalCompany: RentalCompanySummary;
  rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX';
  minMonthlyRateNet: number;
  minMonthlyRateGross: number;
  optionsCount: number;
}

export interface RentalOptionItem {
  contractMonths: number;
  annualMileage: number;
  downPaymentPct: number;
  downPaymentAmountPln: number;
  monthlyRateNet: number;
  monthlyRateGross: number;
  rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX';
}

export interface EmployeeRentalOfferDetails {
  id: string;
  sourceType: 'RENTAL';
  vehicle: RentalVehicle;
  rentalCompany: RentalCompanySummary;
  rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX';
  contractMonthsOptions: number[];
  annualMileageOptions: number[];
  downPaymentPctOptions: number[];
  rentalOptions: RentalOptionItem[];
}

export interface EmployeeRentalCatalogResponse {
  offers: EmployeeRentalOfferSummary[];
  nextCursor: string | null;
}

export interface FetchRentalOffersParams {
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
 * Pobiera listę ofert najmu długoterminowego dla programu pracowniczego.
 * Zgodnie z ADR-07: credentials: 'same-origin' dla ciasteczka __Host-ep-session.
 */
export async function fetchEmployeeRentalOffers(
  apiUrl: string,
  params: FetchRentalOffersParams = {},
  signal?: AbortSignal
): Promise<EmployeeRentalCatalogResponse> {
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
  const url = `${base}/employee/rental-offers${queryStr ? `?${queryStr}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponseJson<EmployeeRentalCatalogResponse>(res);
}

/**
 * Pobiera szczegóły pojedynczej oferty najmu długoterminowego z siatką stawek.
 */
export async function fetchEmployeeRentalOfferDetails(
  apiUrl: string,
  offerId: string,
  signal?: AbortSignal
): Promise<EmployeeRentalOfferDetails> {
  const base = normalizeBaseUrl(apiUrl);
  const res = await fetch(`${base}/employee/rental-offers/${encodeURIComponent(offerId)}`, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
    headers: {
      'Accept': 'application/json',
    },
  });

  return handleResponseJson<EmployeeRentalOfferDetails>(res);
}
