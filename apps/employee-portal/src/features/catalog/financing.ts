import { EmployeeFinancingConfig, EmployeeOffer } from './catalog-api';

export interface InstallmentCalculationParams {
  employeePriceGrossPln: number;
  contractType: 'CONSUMER' | 'LEASING_B2B';
  months: number;
  downPaymentPct: number;
  residualPct: number;
  annualRatePct?: number;
}

export interface InstallmentCalculationResult {
  basePrice: number;
  employeeNet: number;
  employeeGross: number;
  initialPaymentAmount: number;
  residualAmount: number;
  amountToFinance: number;
  installmentNet: number;
  installmentGross: number;
}

export function nearestPeriodTo36(periods: number[]): number {
  if (periods.length === 0) return 36;
  return periods.reduce((best, p) => (Math.abs(p - 36) < Math.abs(best - 36) ? p : best), periods[0]);
}

/**
 * Standardowy algorytm leasingowy/kredytowy PMT używany w platformie Motolia / Benefivo.
 * Czysta funkcja współdzielona pomiędzy widokiem detalu (NewCarOfferDetailPage) i filtrem raty (CatalogPage).
 */
export function calculateInstallment(params: InstallmentCalculationParams): InstallmentCalculationResult {
  const {
    employeePriceGrossPln: employeeGross,
    contractType,
    months,
    downPaymentPct,
    residualPct,
    annualRatePct = 7.5
  } = params;

  const employeeNet = Math.round(employeeGross / 1.23);
  const basePrice = contractType === 'LEASING_B2B' ? employeeNet : employeeGross;
  const initialPaymentAmount = Math.round((basePrice * downPaymentPct) / 100);
  const residualAmount = Math.round((basePrice * residualPct) / 100);
  const amountToFinance = Math.max(0, basePrice - initialPaymentAmount);

  const annualRate = annualRatePct;
  const monthlyRate = annualRate / 100 / 12;

  let monthlyInstallment = 0;
  if (monthlyRate === 0) {
    monthlyInstallment = (amountToFinance - residualAmount) / (months || 1);
  } else {
    const pow = Math.pow(1 + monthlyRate, months);
    monthlyInstallment = (amountToFinance * monthlyRate - (residualAmount * monthlyRate) / pow) / (1 - 1 / pow);
  }

  const installmentRounded = Math.max(0, Math.round(monthlyInstallment));
  const installmentNet = contractType === 'LEASING_B2B' ? installmentRounded : Math.round(installmentRounded / 1.23);
  const installmentGross = contractType === 'LEASING_B2B' ? Math.round(installmentRounded * 1.23) : installmentRounded;

  return {
    basePrice,
    employeeNet,
    employeeGross,
    initialPaymentAmount,
    residualAmount,
    amountToFinance,
    installmentNet,
    installmentGross
  };
}

/**
 * Wylicza domyślną ratę miesięczną dla oferty nowego samochodu w katalogu (dla filtrowania i sortowania).
 * Domyślnie kalkulacja wariantu konsumenckiego (brutto).
 */
export function calculateDefaultOfferInstallment(
  offer: EmployeeOffer,
  financingConfig?: EmployeeFinancingConfig | null
): InstallmentCalculationResult {
  const options = financingConfig?.options ?? offer.financing?.options ?? [];
  const creditOption = options.find((opt) => opt.category === 'CREDIT') ?? options[0];

  const annualRatePct = creditOption ? creditOption.annualRatePct : 7.5;
  const periods = creditOption ? creditOption.periods : [24, 36, 48, 60];
  const months = nearestPeriodTo36(periods);

  const minDown = creditOption ? creditOption.minDownPaymentPct : 0;
  const maxDown = creditOption ? creditOption.maxDownPaymentPct : 45;
  const downPaymentPct = Math.min(Math.max(20, minDown), maxDown);

  const maxResidual = creditOption ? creditOption.maxResidualPct : 30;
  const residualPct = Math.min(20, maxResidual);

  return calculateInstallment({
    employeePriceGrossPln: offer.pricing.employeePricePln,
    contractType: 'CONSUMER',
    months,
    downPaymentPct,
    residualPct,
    annualRatePct
  });
}
