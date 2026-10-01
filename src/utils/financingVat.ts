/**
 * Mnożnik netto → brutto dla RATY (nie podstawy kalkulacji).
 * VAT-marża: kredyt — netto i brutto to ta sama kwota (mnożnik 1); leasing — brutto = netto + 23% VAT.
 * Oferty bez VAT-marży: zawsze 1,23.
 */
export function getInstallmentVatMultiplier(vatMargin: boolean, category: string): number {
  return vatMargin && category !== 'LEASING' ? 1 : 1.23;
}
