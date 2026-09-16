export type ContractPartyOption = 'CONSUMER' | 'EMPLOYEE_B2B' | 'EMPLOYER_COMPANY';
export type RentalRateSource = 'EMPLOYEE_MATRIX' | 'PUBLIC_MATRIX';

export interface EmployeeRentalCalculatedRow {
  contractMonths: number;
  annualMileageKm: number;
  initialPaymentPct: number;
  initialPaymentAmountNet: number;
  monthlyRateNet: number;
  monthlyRateGross: number;
  offerType: string;
  servicesIncluded: string[];
}

export interface ResolvedRentalRateSource {
  rateSource: RentalRateSource;
  matrixVersionId: string | null;
  allowedContractParties: string[];
  rentalCompanyName: string;
  rows: EmployeeRentalCalculatedRow[];
}

export function calculateRatesWithInsurance<T extends {
  monthlyRateNet: number;
  monthlyRateGross: number;
  insuranceNet?: number | null;
  servicesIncluded?: string[];
  [key: string]: any;
}>(
  entry: T,
  assignment: {
    insuranceAddModeOverride?: string | null;
    includedServicesOverride?: string[] | null;
    rentalCompany?: {
      insuranceAddMode?: string | null;
      includedServices?: string[] | null;
    } | null;
  }
): T & {
  monthlyRateNet: number;
  monthlyRateGross: number;
  servicesIncluded: string[];
} {
  const insuranceAddMode =
    assignment.insuranceAddModeOverride ||
    assignment.rentalCompany?.insuranceAddMode ||
    'INSURANCE_23';

  const servicesIncluded =
    assignment.includedServicesOverride && assignment.includedServicesOverride.length > 0
      ? assignment.includedServicesOverride
      : assignment.rentalCompany?.includedServices && assignment.rentalCompany.includedServices.length > 0
      ? assignment.rentalCompany.includedServices
      : entry.servicesIncluded || [];

  let finalNet = entry.monthlyRateNet;
  let finalGross = entry.monthlyRateGross;

  if (entry.insuranceNet) {
    if (insuranceAddMode === 'INSURANCE_23') {
      finalNet += entry.insuranceNet;
      finalGross += entry.insuranceNet * 1.23;
    } else if (insuranceAddMode === 'INSURANCE_0') {
      finalNet += entry.insuranceNet;
      finalGross += entry.insuranceNet;
    } else if (insuranceAddMode === 'INSURANCE_INCLUDED') {
      // Insurance is already included
    }
  }

  return {
    ...entry,
    monthlyRateNet: Math.round(finalNet),
    monthlyRateGross: Math.round(finalGross),
    servicesIncluded
  };
}

export interface ResolveRentalRateSourceOptions {
  assignment: {
    id: string;
    rentalCompanyId: string;
    rentalCompany?: {
      name?: string;
      insuranceAddMode?: string | null;
      includedServices?: string[] | null;
    } | null;
    insuranceAddModeOverride?: string | null;
    includedServicesOverride?: string[] | null;
    matrixEntries?: any[];
    employeeMatrixRows?: any[];
  };
  programMatrixSets?: Array<{
    matrixSet: {
      id: string;
      rentalCompanyId: string;
      allowedContractParties: string[];
      versions?: Array<{
        id: string;
        status: string;
        versionNumber: number;
        effectiveFrom?: Date | string | null;
        effectiveTo?: Date | string | null;
        rows?: any[];
      }>;
    };
  }> | null;
  contractParty?: ContractPartyOption | null;
  now?: Date;
}

export function resolveRentalRateSource({
  assignment,
  programMatrixSets,
  contractParty,
  now
}: ResolveRentalRateSourceOptions): ResolvedRentalRateSource {
  const checkDate = now || new Date();
  const rentalCompanyName = assignment.rentalCompany?.name || '';

  // 1. Check if program has linked EmployeeMatrixSet for assignment.rentalCompanyId
  const matchingSet = (programMatrixSets || []).find(
    (pms) => pms.matrixSet?.rentalCompanyId === assignment.rentalCompanyId
  )?.matrixSet;

  if (matchingSet) {
    // 2. Check if matrixSet has a PUBLISHED version valid at checkDate
    const publishedVersions = (matchingSet.versions || [])
      .filter((v) => {
        if (v.status !== 'PUBLISHED') return false;
        if (v.effectiveFrom && new Date(v.effectiveFrom) > checkDate) return false;
        if (v.effectiveTo && new Date(v.effectiveTo) < checkDate) return false;
        return true;
      })
      .sort((a, b) => b.versionNumber - a.versionNumber);

    let activeVersion: (typeof publishedVersions)[number] | null = null;
    let matchingRows: any[] = [];

    for (const version of publishedVersions) {
      const vRows = (version.rows || []).filter((r) => r.assignmentId === assignment.id);
      if (vRows.length > 0) {
        activeVersion = version;
        matchingRows = vRows;
        break;
      }
    }

    if (!activeVersion && publishedVersions.length > 0 && assignment.employeeMatrixRows && assignment.employeeMatrixRows.length > 0) {
      const candidateVersionIds = new Set(publishedVersions.map((v) => v.id));
      const candidateRows = assignment.employeeMatrixRows.filter((r) => candidateVersionIds.has(r.versionId));
      if (candidateRows.length > 0) {
        for (const version of publishedVersions) {
          const vRows = candidateRows.filter((r) => r.versionId === version.id);
          if (vRows.length > 0) {
            activeVersion = version;
            matchingRows = vRows;
            break;
          }
        }
      }
    }

    // 4. Check if contractParty is in allowedContractParties
    const allowedParties = matchingSet.allowedContractParties || ['EMPLOYEE_B2B', 'EMPLOYER_COMPANY'];
    const isPartyAllowed = !contractParty || allowedParties.includes(contractParty);

    if (activeVersion && matchingRows.length > 0 && isPartyAllowed) {
      const rows: EmployeeRentalCalculatedRow[] = matchingRows.map((r) => ({
        contractMonths: r.contractMonths,
        annualMileageKm: r.annualMileageKm,
        initialPaymentPct: Number(r.initialPaymentPct),
        initialPaymentAmountNet: Math.round(Number(r.initialPaymentAmountNet || 0)),
        monthlyRateNet: Math.round(Number(r.monthlyRateNet)),
        monthlyRateGross: Math.round(Number(r.monthlyRateGross)),
        offerType: 'all',
        servicesIncluded: r.servicesIncluded || []
      }));

      return {
        rateSource: 'EMPLOYEE_MATRIX',
        matrixVersionId: activeVersion.id,
        allowedContractParties: allowedParties,
        rentalCompanyName,
        rows
      };
    }
  }

  // Fallback to PUBLIC_MATRIX
  const publicRows: EmployeeRentalCalculatedRow[] = (assignment.matrixEntries || []).map((entry) => {
    const calculated = calculateRatesWithInsurance(entry, assignment);
    return {
      contractMonths: calculated.contractMonths,
      annualMileageKm: calculated.annualMileageKm,
      initialPaymentPct: Number(calculated.initialPaymentPct),
      initialPaymentAmountNet: calculated.initialPaymentAmountNet ? Math.round(Number(calculated.initialPaymentAmountNet)) : 0,
      monthlyRateNet: Math.round(calculated.monthlyRateNet),
      monthlyRateGross: Math.round(calculated.monthlyRateGross),
      offerType: calculated.offerType || 'all',
      servicesIncluded: calculated.servicesIncluded || []
    };
  });

  return {
    rateSource: 'PUBLIC_MATRIX',
    matrixVersionId: null,
    allowedContractParties: ['CONSUMER', 'EMPLOYEE_B2B', 'EMPLOYER_COMPANY'],
    rentalCompanyName,
    rows: publicRows
  };
}

export function getLowestRateGross(rows: EmployeeRentalCalculatedRow[]): number | null {
  if (!rows || rows.length === 0) return null;
  const allRows = rows.filter((r) => !r.offerType || r.offerType === 'all');
  const candidates = allRows.length > 0 ? allRows : rows;
  return Math.min(...candidates.map((r) => r.monthlyRateGross));
}
