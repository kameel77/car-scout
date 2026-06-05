export function getFinancingBasePrice(listing: { pricePln: number }): number {
    return listing.pricePln;
}

// Cena widoczna klientowi jako główna ("Cena pojazdu" / cena na karcie).
// Per-pojazd flaga displaySalePrice decyduje: true → cena w finansowaniu + rabat Motolia (cena sprzedaży),
// false (domyślnie) → sama cena w finansowaniu. Kalkulator rat zawsze liczy z price_pln.
export function getDisplayPrice(listing: { price_pln: number; motoliaDiscountPln?: number | null; displaySalePrice?: boolean }): number {
    return listing.price_pln + (listing.displaySalePrice ? (listing.motoliaDiscountPln ?? 0) : 0);
}
