import type { FinancingProduct } from '@/types/financing';

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

export const REFERENCE_MONTHS = 60;
export const REFERENCE_INITIAL_PCT = 25;
export const REFERENCE_FINAL_PCT = 35;

/** Formuła PMT identyczna z FinancingCalculator (OWN). Kwoty wpłaty/wykupu zaokrąglane jak w kalkulatorze. */
export function pmtInstallment(price: number, opts: { downPct: number; finalPct: number; months: number; annualRatePct: number }): number {
  const initial = Math.round(price * opts.downPct / 100);
  const finalAmount = Math.round(price * opts.finalPct / 100);
  const amountToFinance = price - initial;
  const monthlyRate = opts.annualRatePct / 100 / 12;
  let pmt: number;
  if (monthlyRate === 0) {
    pmt = (amountToFinance - finalAmount) / opts.months;
  } else {
    const pow = Math.pow(1 + monthlyRate, opts.months);
    pmt = (amountToFinance * monthlyRate - finalAmount * monthlyRate / pow) / (1 - 1 / pow);
  }
  return Math.round(pmt);
}

/** Produkt referencyjny dla kategorii: listing-specific gdy pasuje, inaczej domyślny (priority desc, potem isDefault desc). */
export function selectReferenceProduct(products: FinancingProduct[], category: 'CREDIT' | 'LEASING', listingProductId?: string | null): FinancingProduct | null {
  if (listingProductId) {
    const f = products.find(p => p.id === listingProductId && p.category === category);
    if (f) return f;
  }
  const cands = products.filter(p => p.category === category)
    .sort((a, b) => (b.priority - a.priority) || (Number(b.isDefault) - Number(a.isDefault)));
  return cands[0] ?? null;
}

/** Rata referencyjna dla produktu przy parametrach 25/35/60 (clamp do limitów produktu). price w walucie właściwej dla kategorii (kredyt=brutto, leasing=netto). */
export function referenceInstallment(product: FinancingProduct | null | undefined, price: number, category: 'CREDIT' | 'LEASING'): number | null {
  if (!product || !price || price <= 0) return null;
  const months = Math.min(Math.max(REFERENCE_MONTHS, product.minInstallments), product.maxInstallments);
  const downPct = Math.min(REFERENCE_INITIAL_PCT, product.maxInitialPayment);
  const finalPct = category === 'CREDIT'
    ? (product.hasBalloonPayment ? Math.min(REFERENCE_FINAL_PCT, product.maxFinalPayment) : 0)
    : Math.min(REFERENCE_FINAL_PCT, product.maxFinalPayment);
  return pmtInstallment(price, { downPct, finalPct, months, annualRatePct: product.referenceRate + product.margin });
}
