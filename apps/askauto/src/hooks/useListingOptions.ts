import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '../services/api';

export interface ListingOptions {
    makes: string[];
    models: { make: string; model: string }[];
}

export function useListingOptions() {
    return useQuery<ListingOptions>({
        queryKey: ['listingOptions'],
        queryFn: listingsApi.getListingOptions,
        staleTime: 1000 * 60 * 60, // 1 hour (options don't change often)
        refetchOnWindowFocus: false,
    });
}
