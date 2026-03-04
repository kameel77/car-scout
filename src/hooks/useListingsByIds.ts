import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/services/api';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';

interface ListingsByIdsResponse {
    listings: Listing[];
}

export function useListingsByIds(ids: string[]) {
    return useQuery<ListingsByIdsResponse>({
        queryKey: ['listings-by-ids', ids],
        queryFn: async () => {
            const data = await listingsApi.getListingsByIds(ids);

            const mappedListings = (data.listings || [])
                .map((listing: any) => mapBackendListingToFrontend(listing))
                .filter((listing: any): listing is Listing => listing !== null);

            return { listings: mappedListings };
        },
        enabled: ids.length > 0,
    });
}
