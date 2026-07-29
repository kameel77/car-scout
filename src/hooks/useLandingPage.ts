import { useQuery } from '@tanstack/react-query';
import { landingPagesApi } from '@/services/api';
import { Listing } from '@/data/mockData';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';

export interface LpSectionsData {
    callback?: { enabled: boolean; title?: string; description?: string };
    listings?: { enabled: boolean; title?: string };
    trustBar?: { enabled: boolean; items?: string[] };
    howItWorks?: { enabled: boolean; steps?: { title: string; text: string }[] };
    faq?: { enabled: boolean; items?: { q: string; a: string }[] };
    urgency?: { enabled: boolean; text?: string };
}

export interface LandingPageData {
    id: string;
    slug: string;
    name: string;
    audience?: string;
    isActive: boolean;
    isIndexable: boolean;
    validFrom?: string;
    validTo?: string;
    heroTitle: string;
    heroSubtitle?: string;
    heroBadge?: string;
    heroImageUrl?: string;
    ctaLabel: string;
    theme?: 'dark' | 'light';
    heroPosition?: 'before' | 'after';
    contactPhone?: string;
    discount?: number;
    initialPayment?: number;
    selectionMode: 'MANUAL' | 'FILTERED';
    sections?: LpSectionsData;
    metaTitle?: string;
    metaDescription?: string;
    listings: Listing[];
    rentalVehicles?: any[];
}

export function useLandingPage(slug: string | undefined) {
    return useQuery<{ landingPage: LandingPageData }, any>({
        queryKey: ['landing-page-public', slug],
        queryFn: async () => {
            if (!slug) throw new Error('Missing slug');
            const data = await landingPagesApi.getPublic(slug);
            const rawListings = data.landingPage?.listings || [];
            const mappedListings = rawListings
                .map((l: any) => mapBackendListingToFrontend(l))
                .filter((l: any): l is Listing => l !== null);

            return {
                landingPage: {
                    ...data.landingPage,
                    listings: mappedListings,
                },
            };
        },
        enabled: Boolean(slug),
        retry: (failureCount, error: any) => {
            if (error?.status === 404 || error?.status === 410) return false;
            return failureCount < 2;
        },
    });
}
