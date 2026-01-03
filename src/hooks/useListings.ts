import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/services/api';
import { FilterState } from '@/components/FilterPanel';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';
import { useAppSettings } from './useAppSettings';

interface ListingsResponse {
    listings: Listing[];
    count: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
}

export function useListings(filters: FilterState, sortBy: string, page: number, perPage: number) {
    const { data: settings } = useAppSettings();
    const currency = settings?.displayCurrency || 'PLN';

    return useQuery<ListingsResponse>({
        queryKey: ['listings', filters, sortBy, page, perPage, currency],
        queryFn: async () => {
            console.log('Fetching listings with filters:', filters, 'sortBy:', sortBy, 'page:', page);
            try {
                const data = await listingsApi.getListings({
                    ...filters,
                    sortBy,
                    currency,
                    page,
                    perPage
                });
                console.log('API response received:', {
                    hasData: !!data,
                    listingsCount: data?.listings?.length || 0,
                    totalCount: data?.count || 0
                });
                console.log('Raw API response:', data);

                let mappedListings: any[] = [];
                try {
                    mappedListings = data.listings
                        .map((listing: any, index: number) => {
                            const mapped = mapBackendListingToFrontend(listing);
                            if (!mapped) {
                                console.warn(`Failed to map listing ${index}:`, listing);
                            }
                            return mapped;
                        })
                        .filter((listing: any) => listing !== null); // Filter out failed mappings

                    console.log(`Successfully mapped ${mappedListings.length} out of ${data.listings.length} listings`);
                } catch (error) {
                    console.error('Failed to map listings:', error);
                    mappedListings = [];
                }

                return {
                    listings: mappedListings,
                    count: data.count,
                    page: data.page,
                    perPage: data.perPage,
                    totalPages: data.totalPages
                };
            } catch (error) {
                console.error('Failed to fetch listings:', error);
                throw error;
            }
        }
    });
}

export function useListing(id: string | undefined) {
    return useQuery<{ listing: Listing }>({
        queryKey: ['listing', id],
        queryFn: async () => {
            if (!id) throw new Error('Listing ID is required');
            const data = await listingsApi.getListing(id);
            const mapped = mapBackendListingToFrontend(data.listing);
            if (!mapped) {
                throw new Error('Failed to map listing data');
            }
            return { listing: mapped };
        },
        enabled: !!id
    });
}
