import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '@/services/api';
import { FilterState, ListingFacets } from '@/components/FilterPanel';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';
import { useAppSettings } from './useAppSettings';
import { useAuth } from '@/contexts/AuthContext';

export type { ListingFacets };

interface ListingsResponse {
    listings: Listing[];
    count: number;
    byCondition?: { NEW: number; USED: number };
    facets?: ListingFacets;
    page?: number;
    perPage?: number;
    totalPages?: number;
}

interface AdminListingFilters {
    entrySource?: 'CSV' | 'CSFLOW' | 'MANUAL' | 'AGENT';
    lastManualEditBefore?: string;
}

export function useListings(
    filters: FilterState,
    sortBy: string,
    page: number,
    perPage: number,
    adminFilters?: AdminListingFilters,
    scoped: boolean = false,
    waitForSettings: boolean = false,
) {
    const { data: settings } = useAppSettings();
    const { token, activeContext } = useAuth();
    const currency = settings?.displayCurrency || 'PLN';

    const authToken = scoped ? token : null;
    const scopeKey = scoped ? `${activeContext.scopeType}:${activeContext.scopeId}` : null;

    return useQuery<ListingsResponse>({
        queryKey: ['listings', filters, sortBy, page, perPage, currency, adminFilters, scopeKey],
        queryFn: async () => {
            try {
                const data = await listingsApi.getListings({
                    ...filters,
                    sortBy,
                    currency,
                    page,
                    perPage,
                    ...adminFilters,
                }, authToken);

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

                } catch (error) {
                    console.error('Failed to map listings:', error);
                    mappedListings = [];
                }

                return {
                    listings: mappedListings,
                    count: data.count,
                    byCondition: data.byCondition,
                    facets: data.facets,
                    page: data.page,
                    perPage: data.perPage,
                    totalPages: data.totalPages
                };
            } catch (error) {
                console.error('Failed to fetch listings:', error);
                throw error;
            }
        },
        enabled: !waitForSettings || (settings !== undefined),
    });
}

export interface UseListingResult {
    listing: Listing;
    isRecentlySold?: boolean;
    similarListings?: any[];
    isLongGone?: boolean;
    redirectUrl?: string | null;
}

export function useListing(id: string | undefined) {
    return useQuery<UseListingResult>({
        queryKey: ['listing', id],
        queryFn: async () => {
            if (!id) throw new Error('Listing ID is required');
            const data = await listingsApi.getListing(id);
            if (!data?.listing) {
                if (data?.isLongGone) {
                    return {
                        listing: null as any,
                        isLongGone: true,
                        redirectUrl: data.redirectUrl || null,
                    };
                }
                throw new Error('Failed to map listing data');
            }
            const mapped = mapBackendListingToFrontend(data.listing);
            if (!mapped) {
                throw new Error('Failed to map listing data');
            }
            return {
                listing: mapped,
                isRecentlySold: data.isRecentlySold || mapped.is_archived,
                similarListings: data.similarListings || [],
            };
        },
        enabled: !!id
    });
}
