import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/services/api';
import { FilterState } from '@/components/FilterPanel';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';

interface ListingsResponse {
    listings: Listing[];
    count: number;
}

export function useListings(filters: FilterState, sortBy: string) {
    return useQuery<ListingsResponse>({
        queryKey: ['listings', filters, sortBy],
        queryFn: async () => {
            const data = await listingsApi.getListings({
                ...filters,
                sortBy
            });
            return {
                listings: data.listings.map(mapBackendListingToFrontend),
                count: data.count
            };
        }
    });
}

export function useListing(id: string | undefined) {
    return useQuery<{ listing: Listing }>({
        queryKey: ['listing', id],
        queryFn: async () => {
            if (!id) throw new Error('Listing ID is required');
            const data = await listingsApi.getListing(id);
            return { listing: mapBackendListingToFrontend(data.listing) };
        },
        enabled: !!id
    });
}
