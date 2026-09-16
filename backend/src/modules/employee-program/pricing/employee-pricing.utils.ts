export interface CalculatedPricing {
  listPricePln: number;
  employeePricePln: number;
  savingsPln: number;
  discountPct: number;
}

export function calculateOfferPricing(
  listPrice: number,
  customPricePln: number | null | undefined,
  discountPct: number | { toNumber(): number } | null | undefined,
  defaultDiscountPct: number | { toNumber(): number } | null | undefined
): CalculatedPricing {
  const safeListPrice = Math.max(0, listPrice);
  let employeePrice = safeListPrice;

  const customPrice = customPricePln !== null && customPricePln !== undefined ? customPricePln : null;
  const discount = discountPct !== null && discountPct !== undefined
    ? (typeof discountPct === 'number' ? discountPct : discountPct.toNumber())
    : null;
  const defaultDiscount = defaultDiscountPct !== null && defaultDiscountPct !== undefined
    ? (typeof defaultDiscountPct === 'number' ? defaultDiscountPct : defaultDiscountPct.toNumber())
    : null;

  if (customPrice !== null) {
    employeePrice = customPrice;
  } else if (discount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - discount / 100));
  } else if (defaultDiscount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - defaultDiscount / 100));
  } else {
    employeePrice = safeListPrice;
  }

  // Clamping: employeePrice never > listPrice and never < 0
  employeePrice = Math.min(safeListPrice, Math.max(0, employeePrice));
  const savingsPln = Math.max(0, safeListPrice - employeePrice);
  const actualDiscountPct = safeListPrice > 0
    ? parseFloat((((safeListPrice - employeePrice) / safeListPrice) * 100).toFixed(2))
    : 0;

  return {
    listPricePln: safeListPrice,
    employeePricePln: employeePrice,
    savingsPln,
    discountPct: actualDiscountPct
  };
}

export interface FormattedBenefit {
  name: string;
  moyaCardAmount: number | null;
  fuelDiscount: string | null;
  consultantCare: boolean;
  termsText: string | null;
}

export interface FormattedVehicle {
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
}

export interface FormattedOffer {
  id: string;
  sourceType: string;
  vehicle: FormattedVehicle;
  pricing: CalculatedPricing;
  benefit: FormattedBenefit | null;
}
