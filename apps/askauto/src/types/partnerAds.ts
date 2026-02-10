export type AdPlacement = 'SEARCH_GRID' | 'SEARCH_TOP' | 'DETAIL_SIDEBAR';

export interface PartnerAd {
    id: string;
    placement: AdPlacement;
    title?: string;
    titleEn?: string;
    titleDe?: string;
    description?: string;
    descriptionEn?: string;
    descriptionDe?: string;
    subtitle?: string;
    subtitleEn?: string;
    subtitleDe?: string;
    ctaText?: string;
    ctaTextEn?: string;
    ctaTextDe?: string;
    url: string;
    imageUrl?: string;
    mobileImageUrl?: string;
    hideUiElements: boolean;
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
    titleEn?: string;
    titleDe?: string;
    description?: string;
    descriptionEn?: string;
    descriptionDe?: string;
    subtitle?: string;
    subtitleEn?: string;
    subtitleDe?: string;
    ctaText?: string;
    ctaTextEn?: string;
    ctaTextDe?: string;
    url: string;
    imageUrl?: string;
    mobileImageUrl?: string;
    hideUiElements?: boolean;
    brandName?: string;
    features?: string[];
    priority?: number;
    isActive?: boolean;
    overlayOpacity?: number;
}
