import { describe, it, expect } from 'vitest';
import { calculateOfferPricing } from '../employee-pricing.utils.js';
import { Prisma } from '@prisma/client';

describe('calculateOfferPricing — 5-tier priority hierarchy (§2.1)', () => {
  const listPrice = 100000;

  it('Tier 1: customPricePln takes absolute precedence over all discounts', () => {
    const result = calculateOfferPricing(
      listPrice,
      80000, // customPrice (20% effective discount)
      15, // exception discountPct
      5, // program defaultDiscountPct
      10 // scopeDiscountPct
    );
    expect(result.employeePricePln).toBe(80000);
    expect(result.savingsPln).toBe(20000);
    expect(result.discountPct).toBe(20);
  });

  it('Tier 2: exception discountPct takes precedence over scopeDiscountPct and defaultDiscountPct', () => {
    const result = calculateOfferPricing(
      listPrice,
      null, // no custom price
      15, // exception discountPct (15%)
      5, // program defaultDiscountPct (5%)
      10 // scopeDiscountPct (10%)
    );
    expect(result.employeePricePln).toBe(85000);
    expect(result.savingsPln).toBe(15000);
    expect(result.discountPct).toBe(15);
  });

  it('Tier 3: scopeDiscountPct takes precedence over defaultDiscountPct when no exception is set', () => {
    const result = calculateOfferPricing(
      listPrice,
      null,
      null,
      5, // program defaultDiscountPct (5%)
      12 // scopeDiscountPct (12%)
    );
    expect(result.employeePricePln).toBe(88000);
    expect(result.savingsPln).toBe(12000);
    expect(result.discountPct).toBe(12);
  });

  it('Tier 4: defaultDiscountPct used when scopeDiscountPct is null', () => {
    const result = calculateOfferPricing(
      listPrice,
      null,
      null,
      7, // program defaultDiscountPct (7%)
      null // no scopeDiscountPct
    );
    expect(result.employeePricePln).toBe(93000);
    expect(result.savingsPln).toBe(7000);
    expect(result.discountPct).toBe(7);
  });

  it('Tier 5: listPrice returned with 0% discount when no discounts or custom prices are defined', () => {
    const result = calculateOfferPricing(
      listPrice,
      null,
      null,
      null,
      null
    );
    expect(result.employeePricePln).toBe(100000);
    expect(result.savingsPln).toBe(0);
    expect(result.discountPct).toBe(0);
  });

  it('Supports Prisma.Decimal for scopeDiscountPct and defaultDiscountPct', () => {
    const result = calculateOfferPricing(
      listPrice,
      null,
      null,
      new Prisma.Decimal('5.50'),
      new Prisma.Decimal('8.25')
    );
    expect(result.employeePricePln).toBe(91750);
    expect(result.savingsPln).toBe(8250);
    expect(result.discountPct).toBe(8.25);
  });

  it('Correctly rounds decimal prices and clamps bounds', () => {
    // Clamping max
    const highCustom = calculateOfferPricing(50000, 60000, null, 10, null);
    expect(highCustom.employeePricePln).toBe(50000); // cannot exceed listPrice
    expect(highCustom.savingsPln).toBe(0);

    // Clamping min
    const negativePrice = calculateOfferPricing(50000, -1000, null, 10, null);
    expect(negativePrice.employeePricePln).toBe(0);
  });
});
