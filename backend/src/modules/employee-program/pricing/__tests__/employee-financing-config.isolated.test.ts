import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveProgramFinancingConfig } from '../employee-financing-config.utils.js';

function makeProduct(overrides: Partial<any> = {}) {
  return {
    id: 'prod_1',
    category: 'CREDIT',
    name: 'Kredyt Standard',
    currency: 'PLN',
    referenceRate: 5.5,
    margin: 2.0,
    commission: 1.5,
    maxInitialPayment: 45,
    maxFinalPayment: 30,
    minInstallments: 12,
    maxInstallments: 60,
    isDefault: false,
    provider: 'OWN',
    priority: 0,
    minAmount: null,
    maxAmount: null,
    providerConfig: { secretApiKey: 'do-not-leak' },
    hasBalloonPayment: true,
    ...overrides
  };
}

function makeOverride(overrides: Partial<any> = {}) {
  return {
    id: 'override_1',
    programId: 'prog_1',
    financingProductId: 'prod_1',
    isEnabled: true,
    b2cStatus: 'AVAILABLE',
    allowedContractParties: ['EMPLOYEE_B2B', 'EMPLOYER_COMPANY'],
    minDownPaymentPct: null,
    maxDownPaymentPct: null,
    allowedPeriods: [],
    financingProduct: makeProduct(),
    ...overrides
  };
}

describe('resolveProgramFinancingConfig (E2 §Zakres 1)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns null when program has no enabled overrides', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result).toBeNull();
    expect(fakePrisma.employeeProductOverride.findMany).toHaveBeenCalledWith({
      where: { programId: 'prog_1', isEnabled: true },
      include: { financingProduct: true }
    });
  });

  it('computes annualRatePct as referenceRate + margin, rounded to 2 decimals', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          financingProduct: makeProduct({ referenceRate: 5.123, margin: 2.001 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(1);
    expect(result!.options[0].annualRatePct).toBe(7.12);
  });

  it('filters out UNAVAILABLE, empty allowedContractParties, and RENT category', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [
          makeOverride({ id: 'o1', financingProductId: 'p1', b2cStatus: 'UNAVAILABLE', financingProduct: makeProduct({ id: 'p1' }) }),
          makeOverride({ id: 'o2', financingProductId: 'p2', allowedContractParties: [], financingProduct: makeProduct({ id: 'p2' }) }),
          makeOverride({ id: 'o3', financingProductId: 'p3', financingProduct: makeProduct({ id: 'p3', category: 'RENT' }) }),
          makeOverride({ id: 'o4', financingProductId: 'p4', financingProduct: makeProduct({ id: 'p4' }) })
        ])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(1);
    expect(result!.options[0].productId).toBe('p4');
  });

  it('clamps maxDownPaymentPct to product.maxInitialPayment and defaults minDownPaymentPct to 0', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          minDownPaymentPct: null,
          maxDownPaymentPct: 90, // above product limit of 45
          financingProduct: makeProduct({ maxInitialPayment: 45 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result!.options[0].minDownPaymentPct).toBe(0);
    expect(result!.options[0].maxDownPaymentPct).toBe(45);
  });

  it('skips a product when min > max down payment, without throwing (logs a warning)', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [
          makeOverride({ id: 'bad', financingProductId: 'pbad', minDownPaymentPct: 50, maxDownPaymentPct: 20, financingProduct: makeProduct({ id: 'pbad' }) }),
          makeOverride({ id: 'ok', financingProductId: 'pok', financingProduct: makeProduct({ id: 'pok' }) })
        ])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result!.options).toHaveLength(1);
    expect(result!.options[0].productId).toBe('pok');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('filters allowedPeriods to the product installment range', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          allowedPeriods: [6, 24, 36, 96],
          financingProduct: makeProduct({ minInstallments: 12, maxInstallments: 60 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result!.options[0].periods).toEqual([24, 36]);
  });

  it('falls back to multiples of 12 within product range when allowedPeriods is empty', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          allowedPeriods: [],
          financingProduct: makeProduct({ minInstallments: 24, maxInstallments: 60 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result!.options[0].periods).toEqual([24, 36, 48, 60]);
  });

  it('skips a product when the resulting periods list is empty, without throwing (logs a warning)', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          allowedPeriods: [6, 96],
          financingProduct: makeProduct({ minInstallments: 12, maxInstallments: 60 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result).toEqual({ options: [] });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('sets maxResidualPct to 0 when the product has no balloon payment', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride({
          financingProduct: makeProduct({ hasBalloonPayment: false, maxFinalPayment: 30 })
        })])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    expect(result!.options[0].maxResidualPct).toBe(0);
  });

  it('sorts options by product priority descending, then category ascending', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [
          makeOverride({ id: 'o1', financingProductId: 'low', financingProduct: makeProduct({ id: 'low', category: 'LEASING', priority: 1 }) }),
          makeOverride({ id: 'o2', financingProductId: 'high', financingProduct: makeProduct({ id: 'high', category: 'CREDIT', priority: 10 }) }),
          makeOverride({ id: 'o3', financingProductId: 'tie', financingProduct: makeProduct({ id: 'tie', category: 'CREDIT', priority: 1 }) })
        ])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    // priority desc first (high=10 before the two priority=1 entries), then category asc for the tie (CREDIT < LEASING)
    expect(result!.options.map((o) => o.productId)).toEqual(['high', 'tie', 'low']);
  });

  it('never includes margin, commission, provider, or providerConfig in the resolved options', async () => {
    const fakePrisma: any = {
      employeeProductOverride: {
        findMany: vi.fn(async () => [makeOverride()])
      }
    };
    const result = await resolveProgramFinancingConfig(fakePrisma, 'prog_1');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('margin');
    expect(serialized).not.toContain('commission');
    expect(serialized).not.toContain('provider');
    expect(serialized).not.toContain('do-not-leak');
  });
});
