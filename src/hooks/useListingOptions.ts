import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '../services/api';

export interface ListingOptions {
    makes: string[];
    models: { make: string; model: string }[];
    bodyTypes: string[];
}

/** `status` narrows the options to one condition (e.g. only makes that have used listings). */
export function useListingOptions(status?: 'new' | 'used') {
    return useQuery<ListingOptions>({
        queryKey: ['listingOptions', status ?? 'all'],
        queryFn: () => listingsApi.getListingOptions(status),
        staleTime: 1000 * 60 * 60, // 1 hour (options don't change often)
        refetchOnWindowFocus: false,
    });
}
