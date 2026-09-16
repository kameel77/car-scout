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

    const result = await fetchEmployeeRentalOfferDetails('/api', 'rental-clx123');
    expect(result).toEqual(mockDetails);
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/rental-offers/rental-clx123', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });
});
