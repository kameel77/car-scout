import { PrismaClient } from '@prisma/client';
import { toNumeric } from './employee-pricing.utils.js';

export type ProductAvailabilityStatus = 'AVAILABLE' | 'REQUIRES_CONFIRMATION' | 'UNAVAILABLE';
export type ContractPartyOption = 'CONSUMER' | 'EMPLOYEE_B2B' | 'EMPLOYER_COMPANY';

export interface EmployeeFinancingOption {
  productId: string;
  category: string;              // 'LEASING' | 'CREDIT'
  label: string;                 // product.name ?? etykieta kategorii
  allowedContractParties: ContractPartyOption[];
  b2cStatus: ProductAvailabilityStatus;
  minDownPaymentPct: number;
  maxDownPaymentPct: number;
  maxResidualPct: number;
  periods: number[];             // rosnąco, bez duplikatów
  annualRatePct: number;
}

export interface EmployeeFinancingConfig {
  options: EmployeeFinancingOption[];
}

function categoryLabel(category: string): string {
  if (category === 'LEASING') return 'Leasing operacyjny';
  if (category === 'CREDIT') return 'Kredyt / finansowanie konsumenckie';
  return category;
}

export async function resolveProgramFinancingConfig(
  prisma: PrismaClient,
  programId: string
): Promise<EmployeeFinancingConfig | null> {
  const overrides = await prisma.employeeProductOverride.findMany({
    where: { programId, isEnabled: true },
    include: { financingProduct: true }
  });

  if (overrides.length === 0) {
    return null;
  }

  // Wpisy pośrednie zachowują priority produktu wyłącznie do sortowania (§ Zakres 1 pkt 8),
  // pole nie jest częścią publicznego kształtu EmployeeFinancingOption.
  const ranked: Array<{ option: EmployeeFinancingOption; priority: number }> = [];

  for (const override of overrides) {
    const product = override.financingProduct;

    if (override.b2cStatus === 'UNAVAILABLE') continue;
    if (override.allowedContractParties.length === 0) continue;
    if (product.category === 'RENT') continue;

    const minDownPaymentPct = toNumeric(override.minDownPaymentPct) ?? 0;
    const maxDownPaymentPct = Math.min(
      toNumeric(override.maxDownPaymentPct) ?? product.maxInitialPayment,
      product.maxInitialPayment
    );

    if (minDownPaymentPct > maxDownPaymentPct) {
      console.warn(
        `[employee-financing-config] Pomijam produkt ${product.id} programu ${programId}: ` +
        `minDownPaymentPct (${minDownPaymentPct}) > maxDownPaymentPct (${maxDownPaymentPct})`
      );
      continue;
    }

    const maxResidualPct = product.hasBalloonPayment ? product.maxFinalPayment : 0;

    let periods: number[];
    if (override.allowedPeriods.length > 0) {
      periods = override.allowedPeriods.filter(
        (p) => p >= product.minInstallments && p <= product.maxInstallments
      );
    } else {
      periods = [];
      for (let p = 12; p <= product.maxInstallments; p += 12) {
        if (p >= product.minInstallments) periods.push(p);
      }
    }
    periods = Array.from(new Set(periods)).sort((a, b) => a - b);

    if (periods.length === 0) {
      console.warn(
        `[employee-financing-config] Pomijam produkt ${product.id} programu ${programId}: brak dozwolonych okresów w zakresie produktu`
      );
      continue;
    }

    const referenceRate = toNumeric(product.referenceRate) ?? 0;
    const margin = toNumeric(product.margin) ?? 0;
    const annualRatePct = Math.round((referenceRate + margin) * 100) / 100;

    ranked.push({
      priority: product.priority,
      option: {
        productId: product.id,
        category: product.category,
        label: product.name ?? categoryLabel(product.category),
        allowedContractParties: override.allowedContractParties as ContractPartyOption[],
        b2cStatus: override.b2cStatus,
        minDownPaymentPct,
        maxDownPaymentPct,
        maxResidualPct,
        periods,
        annualRatePct
      }
    });
  }

  // Sortowanie: priority malejąco, potem category rosnąco.
  ranked.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.option.category.localeCompare(b.option.category);
  });

  return { options: ranked.map((r) => r.option) };
}
