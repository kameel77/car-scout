import { describe, it, expect } from 'vitest';
import { calculateRentalRate } from '../../../../services/rental-pricing.js';

describe('rental-pricing.calculateRentalRate', () => {
  it('INSURANCE_0: base 1000/1230, insuranceNet 350, no options -> net 1350, gross 1580', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      insuranceNet: 350
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_0' }
    };

    const result = calculateRentalRate(entry, assignment);
    expect(result.monthlyRateNet).toBe(1350);
    expect(result.monthlyRateGross).toBe(1580);
  });

  it('INSURANCE_23: base 1000/1230, insuranceNet 350, no options -> net 1350, gross 1660.5', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      insuranceNet: 350
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_23' }
    };

    const result = calculateRentalRate(entry, assignment);
    expect(result.monthlyRateNet).toBe(1350);
    expect(result.monthlyRateGross).toBe(1660.5);
  });

  it('INSURANCE_INCLUDED: insuranceNet 350 set but not added twice -> net 1000, gross 1230', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      insuranceNet: 350
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_INCLUDED' }
    };

    const result = calculateRentalRate(entry, assignment);
    expect(result.monthlyRateNet).toBe(1000);
    expect(result.monthlyRateGross).toBe(1230);
  });

  it('Ayvens shape: no insuranceNet, insuranceExcess500 61, base 1000/1230, insuranceExcess "500" -> net 1061, gross 1305.03', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      insuranceExcess500: 61
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_23' }
    };

    const result = calculateRentalRate(entry, assignment, { insuranceExcess: '500' });
    expect(result.monthlyRateNet).toBe(1061);
    expect(result.monthlyRateGross).toBeCloseTo(1305.03, 2);
  });

  it('combined case: INSURANCE_0 + insuranceNet 350 + insuranceExcess "0" (insuranceNoLimit 180) -> net 1530, gross 1801.4', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      insuranceNet: 350,
      insuranceNoLimit: 180
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_0' }
    };

    const result = calculateRentalRate(entry, assignment, { insuranceExcess: '0' });
    expect(result.monthlyRateNet).toBe(1530);
    expect(result.monthlyRateGross).toBeCloseTo(1801.4, 2);
  });

  it('tiresNoLimit adds tiresNoLimit surcharge at 23% VAT', () => {
    const entry = {
      monthlyRateNet: 1000,
      monthlyRateGross: 1230,
      tiresNoLimit: 120
    };
    const assignment = {
      rentalCompany: { insuranceAddMode: 'INSURANCE_23' }
    };

    const result = calculateRentalRate(entry, assignment, { tiresNoLimit: true });
    expect(result.tiresNet).toBe(120);
    expect(result.monthlyRateNet).toBe(1120);
    expect(result.monthlyRateGross).toBeCloseTo(1377.6, 2);
  });

  describe('insuranceMissing flag', () => {
    it('is true for INSURANCE_23 when insuranceNet is null/undefined/zero', () => {
      const entryNoIns = { monthlyRateNet: 1000, monthlyRateGross: 1230 };
      const assignment23 = { rentalCompany: { insuranceAddMode: 'INSURANCE_23' } };
      expect(calculateRentalRate(entryNoIns, assignment23).insuranceMissing).toBe(true);

      const entryZeroIns = { monthlyRateNet: 1000, monthlyRateGross: 1230, insuranceNet: 0 };
      expect(calculateRentalRate(entryZeroIns, assignment23).insuranceMissing).toBe(true);
    });

    it('is true for INSURANCE_0 when insuranceNet is null/undefined/zero', () => {
      const entryNoIns = { monthlyRateNet: 1000, monthlyRateGross: 1230 };
      const assignment0 = { rentalCompany: { insuranceAddMode: 'INSURANCE_0' } };
      expect(calculateRentalRate(entryNoIns, assignment0).insuranceMissing).toBe(true);
    });

    it('is false for INSURANCE_INCLUDED even when insuranceNet is absent in matrix', () => {
      const entryNoIns = { monthlyRateNet: 1000, monthlyRateGross: 1230 };
      const assignmentInc = { rentalCompany: { insuranceAddMode: 'INSURANCE_INCLUDED' } };
      expect(calculateRentalRate(entryNoIns, assignmentInc).insuranceMissing).toBe(false);
    });

    it('is false for INSURANCE_23 or INSURANCE_0 when insuranceNet > 0 is present', () => {
      const entryWithIns = { monthlyRateNet: 1000, monthlyRateGross: 1230, insuranceNet: 350 };
      const assignment23 = { rentalCompany: { insuranceAddMode: 'INSURANCE_23' } };
      const assignment0 = { rentalCompany: { insuranceAddMode: 'INSURANCE_0' } };
      expect(calculateRentalRate(entryWithIns, assignment23).insuranceMissing).toBe(false);
      expect(calculateRentalRate(entryWithIns, assignment0).insuranceMissing).toBe(false);
    });
  });
});
