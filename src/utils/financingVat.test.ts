import { describe, it, expect } from 'vitest';
import { getInstallmentVatMultiplier } from './financingVat';

describe('getInstallmentVatMultiplier', () => {
  it('VAT-marża + kredyt: mnożnik 1 (rata brutto = rata od partnera)', () => {
    expect(getInstallmentVatMultiplier(true, 'CREDIT')).toBe(1);
  });

  it('VAT-marża + leasing: 1,23 (brutto = netto × 1,23)', () => {
    expect(getInstallmentVatMultiplier(true, 'LEASING')).toBe(1.23);
    expect(Math.round(1000 * getInstallmentVatMultiplier(true, 'LEASING'))).toBe(1230);
  });

  it('bez VAT-marży: 1,23 dla kredytu i leasingu', () => {
    expect(getInstallmentVatMultiplier(false, 'CREDIT')).toBe(1.23);
    expect(getInstallmentVatMultiplier(false, 'LEASING')).toBe(1.23);
  });
});
