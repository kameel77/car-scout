import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useListings } from '../useListings';
import { listingsApi } from '@/services/api';

vi.mock('../useAppSettings', () => ({ useAppSettings: () => ({ data: { displayCurrency: 'PLN' } }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: null, activeContext: { scopeType: 'x', scopeId: 'y' } }),
}));
vi.mock('@/utils/listingMapper', () => ({ mapBackendListingToFrontend: (l: any) => l }));
vi.mock('@/services/api', () => ({ listingsApi: { getListings: vi.fn() } }));

describe('useListings', () => {
  it('keeps previous data while the next filter set is loading', async () => {
    const getListings = listingsApi.getListings as unknown as ReturnType<typeof vi.fn>;
    getListings.mockResolvedValueOnce({ listings: [{ listing_id: 'a' }], count: 1 });
    let resolveSecond: (v: any) => void = () => {};
    getListings.mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ f }) => useListings(f as any, 'newest', 1, 10),
      { wrapper, initialProps: { f: { makes: [] } } },
    );
    await waitFor(() => expect(result.current.data?.listings).toHaveLength(1));

    rerender({ f: { makes: ['BMW'] } });
    await waitFor(() => expect(getListings).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.listings[0].listing_id).toBe('a');

    resolveSecond({ listings: [{ listing_id: 'b' }], count: 1 });
    await waitFor(() => expect(result.current.data?.listings[0].listing_id).toBe('b'));
  });
});
