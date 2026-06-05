export function getFinancingBasePrice(listing: { pricePln: number }): number {
    return listing.pricePln;
}

// Cena widoczna klientowi jako główna ("Cena pojazdu" / cena na karcie) = cena sprzedaży (gotówkowa)
// = cena w finansowaniu (price_pln) + rabat Motolia. Cena w finansowaniu pozostaje bazą kalkulatora rat.
export function getDisplaySalePrice(listing: { price_pln: number; motoliaDiscountPln?: number | null }): number {
    return listing.price_pln + (listing.motoliaDiscountPln ?? 0);
}
