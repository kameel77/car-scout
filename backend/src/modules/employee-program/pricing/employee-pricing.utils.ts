export interface CalculatedPricing {
  listPricePln: number;
  employeePricePln: number;
  savingsPln: number;
  discountPct: number;
}

function toNumeric(val: number | { toNumber(): number } | string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof (val as any).toNumber === 'function') return (val as any).toNumber();
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function calculateOfferPricing(
  listPrice: number,
  customPricePln: number | null | undefined,
  discountPct: number | { toNumber(): number } | string | null | undefined,
  defaultDiscountPct: number | { toNumber(): number } | string | null | undefined,
  scopeDiscountPct?: number | { toNumber(): number } | string | null | undefined
): CalculatedPricing {
  const safeListPrice = Math.max(0, listPrice);
  let employeePrice = safeListPrice;

  const customPrice = customPricePln !== null && customPricePln !== undefined ? customPricePln : null;
  const discount = toNumeric(discountPct);
  const defaultDiscount = toNumeric(defaultDiscountPct);
  const scopeDiscount = toNumeric(scopeDiscountPct);

  // Hierarchia priorytetów (§2.1):
  // 1. wyjątek.customPricePln
  // 2. wyjątek.discountPct
  // 3. reguła.scopeDiscountPct
  // 4. program.defaultDiscountPct
  // 5. cena katalogowa
  if (customPrice !== null) {
    employeePrice = customPrice;
  } else if (discount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - discount / 100));
  } else if (scopeDiscount !== null) {
    employeePrice = Math.round(safeListPrice * (1 - scopeDiscount / 100));
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
  id?: string;
  make: string;
  model: string;
  version: string | null;
  productionYear: number;
  fuelType: string | null;
  transmission: string | null;
  bodyType: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
  powerHp?: number | null;
  engineCapacityCm3?: number | null;
  doors?: number | null;
  seats?: number | null;
  color?: string | null;
  paintType?: string | null;
  drive?: string | null;
  equipmentSafety?: string[];
  equipmentComfortExtras?: string[];
  equipmentAudioMultimedia?: string[];
  equipmentOther?: string[];
  additionalInfoHeader?: string | null;
  additionalInfoContent?: string | null;
  specsJson?: any;
}

export interface FormattedOffer {
  id: string;
  sourceType: string;
  vehicle: FormattedVehicle;
  pricing: CalculatedPricing;
  benefit: FormattedBenefit | null;
}
