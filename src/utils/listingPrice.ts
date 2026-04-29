import type { Listing } from '@/data/mockData';

export function getFinancingBasePrice(listing: Pick<Listing, 'pricePln' | 'brokerPricePln' | 'financingPriceBase'>): number {
    if (listing.financingPriceBase === 'PRICE_PLN') {
        return listing.pricePln;
    }
    return listing.brokerPricePln ?? listing.pricePln;
}
