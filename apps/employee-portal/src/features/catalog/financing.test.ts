import { describe, it, expect } from 'vitest';
import {
  calculateInstallment,
  calculateDefaultOfferInstallment,
  nearestPeriodTo36
} from './financing';
import { EmployeeOffer } from './catalog-api';

describe('Financing calculations (financing.ts)', () => {
  it('calculates consumer installment correctly for standard parameters', () => {
    const result = calculateInstallment({
      employeePriceGrossPln: 100000,
      contractType: 'CONSUMER',
      months: 36,
      downPaymentPct: 20,
      residualPct: 20,
      annualRatePct: 7.5
    });

    expect(result.employeeGross).toBe(100000);
    expect(result.initialPaymentAmount).toBe(20000);
    expect(result.residualAmount).toBe(20000);
    expect(result.amountToFinance).toBe(80000);
    // Rata brutto konsumencka
    expect(result.installmentGross).toBeGreaterThan(1500);
    expect(result.installmentGross).toBeLessThan(2500);
    expect(result.installmentNet).toBe(Math.round(result.installmentGross / 1.23));
  });

  it('calculates B2B leasing installment correctly with net base price', () => {
    const result = calculateInstallment({
      employeePriceGrossPln: 123000,
      contractType: 'LEASING_B2B',
      months: 36,
      downPaymentPct: 20,
      residualPct: 20,
      annualRatePct: 7.5
    });

    expect(result.employeeGross).toBe(123000);
    expect(result.employeeNet).toBe(100000);
    expect(result.basePrice).toBe(100000);
    expect(result.initialPaymentAmount).toBe(20000);
    expect(result.residualAmount).toBe(20000);
    expect(result.amountToFinance).toBe(80000);
    expect(result.installmentNet).toBeGreaterThan(1500);
    expect(result.installmentGross).toBe(Math.round(result.installmentNet * 1.23));
  });

  it('handles 0% interest rate without divide-by-zero errors', () => {
    const result = calculateInstallment({
      employeePriceGrossPln: 100000,
      contractType: 'CONSUMER',
      months: 20,
      downPaymentPct: 20,
      residualPct: 20,
      annualRatePct: 0
    });

    // 80 000 - 20 000 = 60 000 / 20 = 3000
    expect(result.installmentGross).toBe(3000);
  });

  it('nearestPeriodTo36 finds the closest period to 36 months', () => {
    expect(nearestPeriodTo36([])).toBe(36);
    expect(nearestPeriodTo36([12, 24, 48])).toBe(24);
    expect(nearestPeriodTo36([24, 36, 48])).toBe(36);
    expect(nearestPeriodTo36([48, 60])).toBe(48);
  });

  it('calculateDefaultOfferInstallment falls back to standard financing when no custom financing config or options provided', () => {
    const mockOffer: EmployeeOffer = {
      id: 'off_1',
      sourceType: 'FINANCING',
      vehicle: {
        make: 'Toyota',
        model: 'Corolla',
        version: 'Comfort',
        productionYear: 2025,
        fuelType: 'HYBRID',
        transmission: 'AUTOMATIC',
        bodyType: 'Sedan',
        primaryImageUrl: null,
        imageUrls: []
      },
      pricing: {
        listPricePln: 120000,
        employeePricePln: 110000,
        savingsPln: 10000,
        discountPct: 8.3
      },
      benefit: null
    };

    const resNull = calculateDefaultOfferInstallment(mockOffer, null);
    expect(resNull).not.toBeNull();
    expect(resNull.installmentGross).toBeGreaterThan(0);
    expect(resNull.installmentNet).toBeGreaterThan(0);

    const resEmpty = calculateDefaultOfferInstallment(mockOffer, { options: [] });
    expect(resEmpty.installmentGross).toBe(resNull.installmentGross);

    const resLowRate = calculateDefaultOfferInstallment(mockOffer, {
      options: [
        {
          productId: 'p1',
          category: 'CREDIT',
          label: 'Kredyt promocyjny',
          allowedContractParties: ['CONSUMER'],
          b2cStatus: 'AVAILABLE',
          minDownPaymentPct: 10,
          maxDownPaymentPct: 30,
          maxResidualPct: 25,
          periods: [24, 36, 48],
          annualRatePct: 5.0
        }
      ]
    });
    expect(resLowRate).not.toBeNull();
    expect(resLowRate!.installmentGross).toBeGreaterThan(0);

    const resHighRate = calculateDefaultOfferInstallment(mockOffer, {
      options: [
        {
          productId: 'p2',
          category: 'CREDIT',
          label: 'Kredyt standardowy',
          allowedContractParties: ['CONSUMER'],
          b2cStatus: 'AVAILABLE',
          minDownPaymentPct: 10,
          maxDownPaymentPct: 30,
          maxResidualPct: 25,
          periods: [24, 36, 48],
          annualRatePct: 9.0
        }
      ]
    });
    expect(resHighRate).not.toBeNull();
    // Niższa stopa (5.0% vs 9.0%) powinna dać niższą ratę
    expect(resLowRate!.installmentGross).toBeLessThan(resHighRate!.installmentGross);
  });
});
