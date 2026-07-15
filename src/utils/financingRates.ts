// Static approximations matching B2B onepager card.
// Real rates available on offer detail page.
// Kredyt: ~1.4%/mc on gross price (36mc, 10% wkład, ~9% APR)
// Leasing: ~1.2%/mc on net price (36mc, 20% wkład, ~6.5% APR)
export const KREDYT_FACTOR = 0.014;
export const LEASING_FACTOR = 0.012;
export const VAT = 1.23;

/** Przybliżone raty poglądowe liczone z ceny brutto (PLN). Zwraca null dla ceny <= 0. */
export function computeMonthlyRates(pricePln: number): { kredytGross: number; leasingNet: number } | null {
  if (!pricePln || pricePln <= 0) return null;
  const kredytGross = Math.round(pricePln * KREDYT_FACTOR);
  const leasingNet = Math.round((pricePln / VAT) * LEASING_FACTOR);
  return { kredytGross, leasingNet };
}
