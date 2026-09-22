import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchEmployeeRentalOffers, fetchEmployeeRentalOfferDetails } from './rental-api';

describe('Employee Portal Rental API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchEmployeeRentalOffers calls GET /api/employee/rental-offers with same-origin credentials', async () => {
    const mockResponse = {
      offers: [
        {
          id: 'rental-clx123',
          sourceType: 'RENTAL',
          vehicle: {
            id: 'veh_1',
            make: 'Toyota',
            model: 'Corolla',
            version: 'Comfort',
            productionYear: 2025,
            fuelType: 'HYBRID',
            transmission: 'AUTOMATIC',
            bodyType: 'SEDAN',
            primaryImageUrl: 'https://img.test/corolla.jpg',
            imageUrls: ['https://img.test/corolla.jpg'],
          },
          rentalCompany: {
            id: 'comp_1',
            name: 'Arval',
            logoUrl: null,
          },
          rateSource: 'PARTNER_MATRIX',
          minMonthlyRateNet: 1450,
          minMonthlyRateGross: 1783.5,
          optionsCount: 12,
        },
      ],
      nextCursor: 'next_cuid',
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const result = await fetchEmployeeRentalOffers('/api', { limit: 12, search: 'corolla' });
    expect(result).toEqual(mockResponse);
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/rental-offers?limit=12&search=corolla', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('fetchEmployeeRentalOffers handles pagination cursor', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ offers: [], nextCursor: null }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await fetchEmployeeRentalOffers('/api/', { cursor: 'cursor_123', limit: 20 });
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/rental-offers?limit=20&cursor=cursor_123', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('fetchEmployeeRentalOffers throws on non-ok response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Brak uprawnień lub program nieaktywny' }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await expect(fetchEmployeeRentalOffers('/api')).rejects.toThrow('Brak uprawnień lub program nieaktywny');
  });

  it('fetchEmployeeRentalOfferDetails calls GET /api/employee/rental-offers/:id', async () => {
    const mockDetails = {
      id: 'rental-clx123',
      sourceType: 'RENTAL',
      vehicle: {
        id: 'veh_1',
        make: 'Skoda',
        model: 'Octavia',
        version: 'Style',
        productionYear: 2026,
        fuelType: 'BENZYNA',
        transmission: 'DSG',
        bodyType: 'KOMBI',
        primaryImageUrl: null,
        imageUrls: [],
      },
      rentalCompany: {
        id: 'comp_2',
        name: 'Athlon',
        logoUrl: null,
      },
      rateSource: 'PUBLIC_MATRIX',
      contractMonthsOptions: [24, 36],
      annualMileageOptions: [10000, 20000],
      downPaymentPctOptions: [0, 10],
      rentalOptions: [
        {
          assignmentId: 'comp_2',
          contractMonths: 36,
          annualMileage: 20000,
          downPaymentPct: 10,
          downPaymentAmountPln: 14000,
          monthlyRateNet: 1620,
          monthlyRateGross: 1992.6,
          rateSource: 'PUBLIC_MATRIX',
        },
      ],
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockDetails,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const testOfferId = 'rental-clx123'; // gitleaks:allow
    const result = await fetchEmployeeRentalOfferDetails('/api', testOfferId);
    expect(result).toEqual(mockDetails);
    expect(fakeFetch).toHaveBeenCalledWith(`/api/employee/rental-offers/${testOfferId}`, {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('normalizes raw matrix rows with different initial payment amounts (0 zł vs 20 000 zł) without overwriting', async () => {
    const rawBackendPayload = {
      id: 'rental-kuga123',
      sourceType: 'RENTAL',
      vehicle: {
        id: 'veh_kuga',
        make: 'Ford',
        model: 'Kuga',
        version: 'ST-Line',
        productionYear: 2026,
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'SUV',
        primaryImageUrl: null,
        imageUrls: [],
      },
      rentalOptions: [
        {
          assignmentId: 'asg_arval',
          rentalCompanyName: 'Arval',
          rentalCompanyLogoUrl: null,
          rateSource: 'PUBLIC_MATRIX',
          rows: [
            {
              contractMonths: 36,
              annualMileageKm: 10000,
              initialPaymentPct: 0,
              initialPaymentAmountNet: 0,
              initialPaymentAmountGross: 0,
              monthlyRateNet: 3389,
              monthlyRateGross: 4169,
            },
            {
              contractMonths: 36,
              annualMileageKm: 10000,
              initialPaymentPct: 0,
              initialPaymentAmountNet: 20000,
              initialPaymentAmountGross: 24600,
              monthlyRateNet: 2789,
              monthlyRateGross: 3430,
            },
          ],
        },
      ],
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawBackendPayload,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const testOfferId = 'rental-kuga123'; // gitleaks:allow
    const result = await fetchEmployeeRentalOfferDetails('/api', testOfferId);
    expect(result.rentalOptions).toHaveLength(2);
    expect(result.downPaymentOptions).toHaveLength(2);
    expect(result.downPaymentOptions?.[0]).toEqual({
      pct: 0,
      amountNet: 0,
      amountGross: 0,
      label: '0 zł',
    });
    expect(result.downPaymentOptions?.[1]).toEqual({
      pct: 0,
      amountNet: 20000,
      amountGross: 24600,
      label: '20 000 zł',
    });

    const optZero = result.rentalOptions.find((o) => o.downPaymentAmountPln === 0);
    const optTwenty = result.rentalOptions.find((o) => o.downPaymentAmountPln === 20000);
    expect(optZero?.monthlyRateNet).toBe(3389);
    expect(optZero?.monthlyRateGross).toBe(4169);
    expect(optTwenty?.monthlyRateNet).toBe(2789);
    expect(optTwenty?.monthlyRateGross).toBe(3430);
  });

  it('fetchEmployeeRentalOffers does not infer isB2b from EMPLOYEE_MATRIX and keeps supplier anonymous', async () => {
    const rawPayload = {
      offers: [
        {
          id: 'offer_consumer_matrix',
          sourceType: 'RENTAL',
          vehicle: {
            id: 'v1',
            make: 'Kia',
            model: 'Sportage',
            version: 'L',
            productionYear: 2026,
            fuelType: 'HYBRID',
            transmission: 'AUTOMATIC',
            bodyType: 'SUV',
            primaryImageUrl: null,
            imageUrls: [],
          },
          rental: {
            rateSource: 'EMPLOYEE_MATRIX',
            fromMonthlyRateGross: 2000,
            isB2b: false,
          },
        },
        {
          id: 'offer_b2b_only',
          sourceType: 'RENTAL',
          vehicle: {
            id: 'v2',
            make: 'Audi',
            model: 'A4',
            version: 'S-Line',
            productionYear: 2026,
            fuelType: 'DIESEL',
            transmission: 'AUTOMATIC',
            bodyType: 'SEDAN',
            primaryImageUrl: null,
            imageUrls: [],
          },
          rental: {
            rateSource: 'EMPLOYEE_MATRIX',
            fromMonthlyRateGross: 3000,
            isB2b: true,
          },
        },
      ],
      nextCursor: null,
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawPayload,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const res = await fetchEmployeeRentalOffers('/api');
    expect(res.offers).toHaveLength(2);

    // First offer has EMPLOYEE_MATRIX rateSource, but isB2b is false
    expect(res.offers[0].rateSource).toBe('PARTNER_MATRIX');
    expect(res.offers[0].isB2b).toBe(false);
    expect(res.offers[0].rentalCompany.name).toBe('Motolia');

    // Second offer is B2B
    expect(res.offers[1].rateSource).toBe('PARTNER_MATRIX');
    expect(res.offers[1].isB2b).toBe(true);
    expect(res.offers[1].rentalCompany.name).toBe('Motolia');
  });

  it('fetchEmployeeRentalOfferDetails strictly uses server isB2b and masks supplier name', async () => {
    const rawDetail = {
      id: 'offer_det_1',
      sourceType: 'RENTAL',
      vehicle: {
        id: 'v_det',
        make: 'Skoda',
        model: 'Superb',
        version: 'Laurlin & Klement',
        productionYear: 2026,
        fuelType: 'DIESEL',
        transmission: 'AUTOMATIC',
        bodyType: 'KOMBI',
        primaryImageUrl: null,
        imageUrls: [],
      },
      isB2b: false,
      rentalOptions: [
        {
          assignmentId: 'asg_secret_supplier',
          rateSource: 'EMPLOYEE_MATRIX',
          rows: [
            {
              contractMonths: 36,
              annualMileageKm: 15000,
              initialPaymentPct: 10,
              initialPaymentAmountNet: 15000,
              initialPaymentAmountGross: 18450,
              monthlyRateNet: 2200,
              monthlyRateGross: 2706,
            },
          ],
        },
      ],
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rawDetail,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const res = await fetchEmployeeRentalOfferDetails('/api', 'offer_det_1');
    expect(res.isB2b).toBe(false);
    expect(res.rateSource).toBe('PARTNER_MATRIX');
    expect(res.rentalCompany.name).toBe('Motolia');
    expect((res.rentalOptions[0] as any).rentalCompanyName).toBeUndefined();
  });
});
