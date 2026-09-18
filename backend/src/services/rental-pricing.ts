export type InsuranceExcessOption = '1000' | '500' | '0';

export interface RentalRateOptions {
  /** '1000' (default) = base excess, no surcharge. '500' -> insuranceExcess500. '0' -> insuranceNoLimit. */
  insuranceExcess?: InsuranceExcessOption;
  /** true -> add tiresNoLimit */
  tiresNoLimit?: boolean;
}

export interface RentalRateBreakdown {
  baseNet: number;
  baseGross: number;
  /** premium from entry.insuranceNet after applying insuranceAddMode; 0 when absent or INSURANCE_INCLUDED */
  insuranceNet: number;
  insuranceGross: number;
  /** optional surcharge for lowering the excess; 23% VAT */
  excessSurchargeNet: number;
  /** optional surcharge for unlimited tyres; 23% VAT */
  tiresNet: number;
  monthlyRateNet: number;
  monthlyRateGross: number;
  servicesIncluded: string[];
  insuranceAddMode: string;
}

const resolveAssignmentConfig = (assignment: any): { insuranceAddMode: string; servicesIncluded: string[] } => {
    const insuranceAddMode = assignment.insuranceAddModeOverride || assignment.rentalCompany?.insuranceAddMode || 'INSURANCE_23';
    const servicesIncluded = (assignment.includedServicesOverride && assignment.includedServicesOverride.length > 0)
        ? assignment.includedServicesOverride
        : (assignment.rentalCompany?.includedServices && assignment.rentalCompany.includedServices.length > 0
            ? assignment.rentalCompany.includedServices
            : []);
    return { insuranceAddMode, servicesIncluded };
};

export const calculateRentalRate = (
    entry: any,
    assignment: any,
    options: RentalRateOptions = {}
): RentalRateBreakdown => {
    const { insuranceAddMode, servicesIncluded: resolvedServicesIncluded } = resolveAssignmentConfig(assignment);
    const servicesIncluded = resolvedServicesIncluded.length > 0 ? resolvedServicesIncluded : (entry.servicesIncluded || []);

    const baseNet = entry.monthlyRateNet;
    const baseGross = entry.monthlyRateGross;

    let insuranceNet = 0;
    let insuranceGross = 0;
    if (entry.insuranceNet) {
        if (insuranceAddMode === 'INSURANCE_23') {
            insuranceNet = entry.insuranceNet;
            insuranceGross = entry.insuranceNet * 1.23;
        } else if (insuranceAddMode === 'INSURANCE_0') {
            insuranceNet = entry.insuranceNet;
            insuranceGross = entry.insuranceNet;
        } else if (insuranceAddMode === 'INSURANCE_INCLUDED') {
            // Insurance is already included in monthlyRateNet & monthlyRateGross
            insuranceNet = 0;
            insuranceGross = 0;
        }
    }

    let excessSurchargeNet = 0;
    if (options.insuranceExcess === '500') {
        excessSurchargeNet = entry.insuranceExcess500 ?? 0;
    } else if (options.insuranceExcess === '0') {
        excessSurchargeNet = entry.insuranceNoLimit ?? 0;
    }

    const tiresNet = options.tiresNoLimit ? (entry.tiresNoLimit ?? 0) : 0;

    const monthlyRateNet = baseNet + insuranceNet + excessSurchargeNet + tiresNet;
    const monthlyRateGross = baseGross + insuranceGross + (excessSurchargeNet + tiresNet) * 1.23;

    return {
        baseNet,
        baseGross,
        insuranceNet,
        insuranceGross,
        excessSurchargeNet,
        tiresNet,
        monthlyRateNet,
        monthlyRateGross,
        servicesIncluded,
        insuranceAddMode
    };
};

export const calculateRatesWithInsurance = (entry: any, assignment: any) => {
    const result = calculateRentalRate(entry, assignment);
    return {
        ...entry,
        monthlyRateNet: result.monthlyRateNet,
        monthlyRateGross: result.monthlyRateGross,
        servicesIncluded: result.servicesIncluded
    };
};
