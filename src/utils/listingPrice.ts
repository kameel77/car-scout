import type { FinancingType } from './url-utils';

export interface ListingPriceOverrides {
    price_pln: number;
    price_private_credit_pln?: number | null;
    price_private_leasing_pln?: number | null;
    price_company_credit_pln?: number | null;
    price_company_leasing_pln?: number | null;
}

export function getFinancingBasePrice(
    listing: ListingPriceOverrides,
    financingType?: FinancingType,
    customerType: 'gross' | 'net' = 'gross'
): number {
    if (!financingType || financingType === 'gotowka') {
        return listing.price_pln;
    }

    if (financingType === 'kredyt') {
        if (customerType === 'gross' && listing.price_private_credit_pln != null) {
            return listing.price_private_credit_pln;
        }
        if (customerType === 'net' && listing.price_company_credit_pln != null) {
            return listing.price_company_credit_pln;
        }
    }

    if (financingType === 'leasing') {
        if (customerType === 'gross' && listing.price_private_leasing_pln != null) {
            return listing.price_private_leasing_pln;
        }
        if (customerType === 'net' && listing.price_company_leasing_pln != null) {
            return listing.price_company_leasing_pln;
        }
    }

    return listing.price_pln;
}
// Cena widoczna klientowi jako główna ("Cena pojazdu" / cena na karcie).
// Per-pojazd flaga displaySalePrice decyduje: true → cena w finansowaniu + rabat Motolia (cena sprzedaży),
// false (domyślnie) → sama cena w finansowaniu. Kalkulator rat zawsze liczy z price_pln.
export function getDisplayPrice(listing: { price_pln: number; motoliaDiscountPln?: number | null; displaySalePrice?: boolean }): number {
    return listing.price_pln + (listing.displaySalePrice ? (listing.motoliaDiscountPln ?? 0) : 0);
}
