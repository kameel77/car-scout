import { formatPln } from '../catalog/financing';
import { EmployeeOfferBenefit } from '../catalog/catalog-api';

export interface RentalVehicle {
  id: string;
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  catalogPrice?: number | null;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
  powerHp?: number | null;
  engineCapacityCm3?: number | null;
  doors?: number | null;
  seats?: number | null;
  drive?: string | null;
  color?: string | null;
  equipmentSafety?: string[];
  equipmentComfortExtras?: string[];
  equipmentAudioMultimedia?: string[];
  equipmentOther?: string[];
  additionalInfoHeader?: string | null;
  additionalInfoContent?: string | null;
  specsJson?: any;
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
  isB2b?: boolean;
  benefit?: EmployeeOfferBenefit | null;
}

export interface RentalInitialPaymentOption {
  pct: number;
  amountNet: number;
  amountGross: number;
  label: string;
}

export interface RentalOptionItem {
  assignmentId: string;
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
  downPaymentOptions?: RentalInitialPaymentOption[];
  rentalOptions: RentalOptionItem[];
  isB2b?: boolean;
  benefit?: EmployeeOfferBenefit | null;
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

  const raw = await handleResponseJson<any>(res);
  const offers: EmployeeRentalOfferSummary[] = (raw.offers || []).map((o: any) => {
    if (o.rentalCompany && o.minMonthlyRateGross !== undefined) {
      return o as EmployeeRentalOfferSummary;
    }
    const rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX' =
      o.rental?.rateSource === 'EMPLOYEE_MATRIX' ? 'PARTNER_MATRIX' : 'PUBLIC_MATRIX';
    const minGross = Number(o.rental?.fromMonthlyRateGross || 0);
    const minNet = Math.round(minGross / 1.23);
    const isB2b = Boolean(o.rental?.isB2b ?? o.isB2b ?? false);

    return {
      id: o.id,
      sourceType: 'RENTAL' as const,
      vehicle: o.vehicle,
      rentalCompany: {
        id: o.id,
        name: 'Motolia',
        logoUrl: null,
      },
      rateSource,
      minMonthlyRateNet: minNet,
      minMonthlyRateGross: minGross,
      optionsCount: 1,
      isB2b,
    };
  });

  return {
    offers,
    nextCursor: raw.nextCursor ?? null,
  };
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

  const raw = await handleResponseJson<any>(res);
  if (raw.contractMonthsOptions && raw.rentalOptions && raw.rentalCompany) {
    const normalizedOptions = raw.rentalOptions.map((o: any) => ({
      ...o,
      assignmentId: o.assignmentId || raw.rentalCompany?.id || 'default_assignment'
    }));
    return {
      ...raw,
      rentalOptions: normalizedOptions
    } as EmployeeRentalOfferDetails;
  }

  // Surowy backend zwraca rentalOptions jako tablicę grup dostawców z wierszami `rows: [...]`
  const assignmentGroups = Array.isArray(raw.rentalOptions) ? raw.rentalOptions : [];
  const primaryGroup = assignmentGroups[0] || null;
  const allRows = assignmentGroups.flatMap((g: any) =>
    (g.rows || []).map((r: any) => ({
      ...r,
      assignmentId: g.assignmentId,
      rateSource: g.rateSource === 'EMPLOYEE_MATRIX' ? 'PARTNER_MATRIX' : 'PUBLIC_MATRIX',
    }))
  );

  // Gdy kilku dostawców oferuje ten sam wariant (miesiące, przebieg, wpłata procentowa + kwotowa), wybieramy ten z niższą ratą brutto
  const optionMap = new Map<string, any>();
  for (const r of allRows) {
    const downAmountNet = Math.round(Number(r.initialPaymentAmountNet || 0));
    const key = `${r.contractMonths}-${r.annualMileageKm}-${r.initialPaymentPct}-${downAmountNet}`;
    const existing = optionMap.get(key);
    if (!existing || Number(r.monthlyRateGross) < Number(existing.monthlyRateGross)) {
      optionMap.set(key, r);
    }
  }
  const bestRows = Array.from(optionMap.values());

  const contractMonthsSet = new Set<number>();
  const annualMileageSet = new Set<number>();
  const downPaymentPctSet = new Set<number>();
  const downPaymentMap = new Map<string, RentalInitialPaymentOption>();

  const flattenedOptions: RentalOptionItem[] = bestRows.map((r: any) => {
    const months = Number(r.contractMonths);
    const mileage = Number(r.annualMileageKm);
    const downPct = Number(r.initialPaymentPct);
    const downAmountNet = Math.round(Number(r.initialPaymentAmountNet || 0));
    const downAmountGross = Math.round(Number(r.initialPaymentAmountGross || downAmountNet * 1.23));

    contractMonthsSet.add(months);
    annualMileageSet.add(mileage);
    downPaymentPctSet.add(downPct);

    const downKey = `${downPct}-${downAmountNet}`;
    if (!downPaymentMap.has(downKey)) {
      let label = `${formatPln(downAmountNet)} zł`;
      if (downAmountNet === 0 && downPct > 0) {
        label = `${downPct}%`;
      } else if (downAmountNet === 0 && downPct === 0) {
        label = '0 zł';
      }
      downPaymentMap.set(downKey, {
        pct: downPct,
        amountNet: downAmountNet,
        amountGross: downAmountGross,
        label
      });
    }

    return {
      assignmentId: r.assignmentId || primaryGroup?.assignmentId || '',
      contractMonths: months,
      annualMileage: mileage,
      downPaymentPct: downPct,
      downPaymentAmountPln: downAmountNet,
      monthlyRateNet: Number(r.monthlyRateNet),
      monthlyRateGross: Number(r.monthlyRateGross),
      rateSource: r.rateSource as 'PARTNER_MATRIX' | 'PUBLIC_MATRIX',
    };
  });

  const contractMonthsOptions = Array.from(contractMonthsSet).sort((a, b) => a - b);
  const annualMileageOptions = Array.from(annualMileageSet).sort((a, b) => a - b);
  const downPaymentPctOptions = Array.from(downPaymentPctSet).sort((a, b) => a - b);
  const downPaymentOptions = Array.from(downPaymentMap.values()).sort((a, b) => {
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.amountNet - b.amountNet;
  });

  const rateSource: 'PARTNER_MATRIX' | 'PUBLIC_MATRIX' =
    primaryGroup?.rateSource === 'EMPLOYEE_MATRIX' ? 'PARTNER_MATRIX' : 'PUBLIC_MATRIX';
  const isB2b = Boolean(raw.isB2b ?? false);

  return {
    id: raw.id,
    sourceType: 'RENTAL' as const,
    vehicle: raw.vehicle,
    rentalCompany: {
      id: primaryGroup?.assignmentId || 'motolia',
      name: 'Motolia',
      logoUrl: null,
    },
    rateSource,
    contractMonthsOptions,
    annualMileageOptions,
    downPaymentPctOptions,
    downPaymentOptions,
    rentalOptions: flattenedOptions,
    isB2b,
  };
}
