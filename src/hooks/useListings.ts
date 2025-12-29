import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/services/api';
import { FilterState } from '@/components/FilterPanel';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';
import { useAppSettings } from './useAppSettings';

interface ListingsResponse {
    listings: Listing[];
    count: number;
}

export function useListings(filters: FilterState, sortBy: string) {
    const { data: settings } = useAppSettings();
    const currency = settings?.displayCurrency || 'PLN';

    return useQuery<ListingsResponse>({
        queryKey: ['listings', filters, sortBy, currency, settings?.updatedAt],
        queryFn: async () => {
            const data = await listingsApi.getListings({
                ...filters,
                sortBy,
                currency
            });
            return {
                listings: data.listings.map(mapBackendListingToFrontend),
                count: data.count
            };
        }
    });
}

export function useListing(id: string | undefined) {
    const { data: settings } = useAppSettings();
    return useQuery<{ listing: Listing }>({
        queryKey: ['listing', id, settings?.updatedAt],
        queryFn: async () => {
            if (!id) throw new Error('Listing ID is required');
            const data = await listingsApi.getListing(id);
            return { listing: mapBackendListingToFrontend(data.listing) };
        },
        enabled: !!id
    });
}
