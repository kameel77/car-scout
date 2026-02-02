export type AdPlacement = 'SEARCH_GRID' | 'SEARCH_TOP' | 'DETAIL_SIDEBAR';

export interface PartnerAd {
    id: string;
    placement: AdPlacement;
    title?: string;
    description?: string;
    subtitle?: string;
    ctaText?: string;
    url: string;
    imageUrl?: string;
    brandName?: string;
    features: string[];
    priority: number;
    isActive: boolean;
    overlayOpacity: number;
    createdAt: string;
    updatedAt: string;
}

export interface PartnerAdPayload {
    placement: AdPlacement;
    title?: string;
    description?: string;
    subtitle?: string;
    ctaText?: string;
    url: string;
    imageUrl?: string;
    brandName?: string;
    features?: string[];
    priority?: number;
    isActive?: boolean;
    overlayOpacity?: number;
}
