export interface EmployeeOfferVehicle {
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

export interface EmployeeOffer {
  id: string;
  sourceType: string;
  vehicle: EmployeeOfferVehicle;
  pricing: EmployeeOfferPricing;
  benefit: EmployeeOfferBenefit | null;
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
