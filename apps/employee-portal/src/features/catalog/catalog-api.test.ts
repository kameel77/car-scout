import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchEmployeeOffers, fetchEmployeeOfferDetails } from './catalog-api';

describe('Employee Portal Catalog API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchEmployeeOffers calls GET /api/employee/offers with same-origin credentials', async () => {
    const mockResponse = {
      offers: [
        {
          id: 'offer_1',
          sourceType: 'FINANCING',
          vehicle: {
            make: 'Toyota',
            model: 'Yaris',
            version: 'Hybrid Comfort',
            productionYear: 2026,
            fuelType: 'HYBRID',
            transmission: 'AUTOMATIC',
            bodyType: 'HATCHBACK',
            primaryImageUrl: 'https://img.test/yaris.jpg',
            imageUrls: ['https://img.test/yaris.jpg'],
          },
          pricing: {
            listPricePln: 71900,
            employeePricePln: 66148,
            savingsPln: 5752,
            discountPct: 8.0,
          },
          benefit: {
            name: 'Pakiet Moya',
            moyaCardAmount: 500,
            fuelDiscount: '15 gr/l',
            consultantCare: true,
            termsText: null,
          },
        },
      ],
      nextCursor: 'offer_2',
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const result = await fetchEmployeeOffers('/api', { limit: 24, search: 'yaris' });
    expect(result).toEqual(mockResponse);
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/offers?limit=24&search=yaris', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('fetchEmployeeOffers handles query params with cursor and limit', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ offers: [], nextCursor: null }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await fetchEmployeeOffers('/api/', { cursor: 'clx123', limit: 10 });
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/offers?limit=10&cursor=clx123', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('fetchEmployeeOffers throws friendly error when server returns non-ok response', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Wystąpił wewnętrzny błąd serwera' }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await expect(fetchEmployeeOffers('/api')).rejects.toThrow('Wystąpił wewnętrzny błąd serwera');
  });

  it('fetchEmployeeOfferDetails calls GET /api/employee/offers/:id', async () => {
    const mockOffer = {
      id: 'offer_123',
      sourceType: 'FINANCING',
      vehicle: {
        make: 'Volkswagen',
        model: 'Tayron',
        version: null,
        productionYear: 2026,
        fuelType: null,
        transmission: null,
        bodyType: null,
        primaryImageUrl: null,
        imageUrls: [],
      },
      pricing: {
        listPricePln: 173900,
        employeePricePln: 159988,
        savingsPln: 13912,
        discountPct: 8.0,
      },
      benefit: null,
    };

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOffer,
    });
    vi.stubGlobal('fetch', fakeFetch);

    const result = await fetchEmployeeOfferDetails('/api', 'offer_123');
    expect(result).toEqual(mockOffer);
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/offers/offer_123', {
      method: 'GET',
      credentials: 'same-origin',
      signal: undefined,
      headers: {
        'Accept': 'application/json',
      },
    });
  });
});
