import { describe, it, expect } from 'vitest';
import {
  calculateRatesWithInsurance,
  resolveRentalRateSource,
  getLowestRateGross
} from '../employee-rental-pricing.utils.js';

describe('employee-rental-pricing.utils', () => {
  describe('calculateRatesWithInsurance', () => {
    it('applies INSURANCE_23 correctly', () => {
      const entry = {
        monthlyRateNet: 1000,
        monthlyRateGross: 1230,
        insuranceNet: 100
      };
      const assignment = {
        rentalCompany: { insuranceAddMode: 'INSURANCE_23' }
      };

      const result = calculateRatesWithInsurance(entry, assignment);
      expect(result.monthlyRateNet).toBe(1100);
      expect(result.monthlyRateGross).toBe(1353); // 1230 + 123
    });

    it('applies INSURANCE_0 correctly', () => {
      const entry = {
        monthlyRateNet: 1000,
        monthlyRateGross: 1230,
        insuranceNet: 100
      };
      const assignment = {
        rentalCompany: { insuranceAddMode: 'INSURANCE_0' }
      };

      const result = calculateRatesWithInsurance(entry, assignment);
      expect(result.monthlyRateNet).toBe(1100);
      expect(result.monthlyRateGross).toBe(1330); // 1230 + 100
    });

    it('respects INSURANCE_INCLUDED', () => {
      const entry = {
        monthlyRateNet: 1000,
        monthlyRateGross: 1230,
        insuranceNet: 100
      };
      const assignment = {
        rentalCompany: { insuranceAddMode: 'INSURANCE_INCLUDED' }
      };

      const result = calculateRatesWithInsurance(entry, assignment);
      expect(result.monthlyRateNet).toBe(1000);
      expect(result.monthlyRateGross).toBe(1230);
    });

    it('assignment override takes precedence over rentalCompany', () => {
      const entry = {
        monthlyRateNet: 1000,
        monthlyRateGross: 1230,
        insuranceNet: 100
      };
      const assignment = {
        insuranceAddModeOverride: 'INSURANCE_0',
        rentalCompany: { insuranceAddMode: 'INSURANCE_23' }
      };

      const result = calculateRatesWithInsurance(entry, assignment);
      expect(result.monthlyRateGross).toBe(1330);
    });
  });

  describe('resolveRentalRateSource', () => {
    const mockAssignment = {
      id: 'asg-1',
      rentalCompanyId: 'rc-1',
      rentalCompany: { name: 'Ayvens Flota' },
      matrixEntries: [
        {
          contractMonths: 36,
          annualMileageKm: 15000,
          initialPaymentPct: 10,
          monthlyRateNet: 1500,
          monthlyRateGross: 1845,
          offerType: 'all',
          servicesIncluded: ['serwis']
        }
      ]
    };

    const mockPrivateVersion = {
      id: 'ver-1',
      status: 'PUBLISHED',
      versionNumber: 1,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-12-31'),
      rows: [
        {
          assignmentId: 'asg-1',
          contractMonths: 36,
          annualMileageKm: 15000,
          initialPaymentPct: 10,
          initialPaymentAmountNet: 0,
          monthlyRateNet: 1400,
          monthlyRateGross: 1722,
          servicesIncluded: ['serwis', 'opony']
        }
      ]
    };

    const mockProgramMatrixSets = [
      {
        matrixSet: {
          id: 'set-1',
          rentalCompanyId: 'rc-1',
          allowedContractParties: ['EMPLOYEE_B2B', 'EMPLOYER_COMPANY'],
          versions: [mockPrivateVersion]
        }
      }
    ];

    it('resolves EMPLOYEE_MATRIX when all 4 conditions are met for EMPLOYEE_B2B', () => {
      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: mockProgramMatrixSets,
        contractParty: 'EMPLOYEE_B2B',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('EMPLOYEE_MATRIX');
      expect(res.matrixVersionId).toBe('ver-1');
      expect(res.rentalCompanyName).toBe('Ayvens Flota');
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].monthlyRateGross).toBe(1722);
      expect(res.rows[0].monthlyRateNet).toBe(1400);
      expect(typeof res.rows[0].monthlyRateGross).toBe('number');
    });

    it('falls back to PUBLIC_MATRIX for CONSUMER when CONSUMER is not in allowedContractParties', () => {
      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: mockProgramMatrixSets,
        contractParty: 'CONSUMER',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('PUBLIC_MATRIX');
      expect(res.matrixVersionId).toBeNull();
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].monthlyRateGross).toBe(1845);
    });

    it('falls back to PUBLIC_MATRIX when matrix version is DRAFT', () => {
      const draftSets = [
        {
          matrixSet: {
            id: 'set-1',
            rentalCompanyId: 'rc-1',
            allowedContractParties: ['EMPLOYEE_B2B'],
            versions: [{ ...mockPrivateVersion, status: 'DRAFT' }]
          }
        }
      ];

      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: draftSets,
        contractParty: 'EMPLOYEE_B2B',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('PUBLIC_MATRIX');
    });

    it('falls back to PUBLIC_MATRIX when matrix version has expired (effectiveTo in past)', () => {
      const expiredSets = [
        {
          matrixSet: {
            id: 'set-1',
            rentalCompanyId: 'rc-1',
            allowedContractParties: ['EMPLOYEE_B2B'],
            versions: [
              {
                ...mockPrivateVersion,
                effectiveTo: new Date('2025-12-31')
              }
            ]
          }
        }
      ];

      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: expiredSets,
        contractParty: 'EMPLOYEE_B2B',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('PUBLIC_MATRIX');
    });

    it('falls back to PUBLIC_MATRIX when set has no rows for given assignmentId', () => {
      const noRowsSets = [
        {
          matrixSet: {
            id: 'set-1',
            rentalCompanyId: 'rc-1',
            allowedContractParties: ['EMPLOYEE_B2B'],
            versions: [
              {
                ...mockPrivateVersion,
                rows: [{ ...mockPrivateVersion.rows[0], assignmentId: 'other-asg' }]
              }
            ]
          }
        }
      ];

      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: noRowsSets,
        contractParty: 'EMPLOYEE_B2B',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('PUBLIC_MATRIX');
    });

    it('falls back to PUBLIC_MATRIX when program has no matrix set for rentalCompanyId', () => {
      const res = resolveRentalRateSource({
        assignment: mockAssignment,
        programMatrixSets: [],
        contractParty: 'EMPLOYEE_B2B',
        now: new Date('2026-06-01')
      });

      expect(res.rateSource).toBe('PUBLIC_MATRIX');
    });
  });

  describe('getLowestRateGross', () => {
    it('returns minimum gross rate from all rows', () => {
      const rows = [
        {
          contractMonths: 36,
          annualMileageKm: 15000,
          initialPaymentPct: 10,
          initialPaymentAmountNet: 0,
          monthlyRateNet: 1500,
          monthlyRateGross: 1845,
          offerType: 'all',
          servicesIncluded: []
        },
        {
          contractMonths: 48,
          annualMileageKm: 10000,
          initialPaymentPct: 10,
          initialPaymentAmountNet: 0,
          monthlyRateNet: 1400,
          monthlyRateGross: 1722,
          offerType: 'all',
          servicesIncluded: []
        },
        {
          contractMonths: 24,
          annualMileageKm: 20000,
          initialPaymentPct: 0,
          initialPaymentAmountNet: 0,
          monthlyRateNet: 2000,
          monthlyRateGross: 2460,
          offerType: 'business',
          servicesIncluded: []
        }
      ];

      expect(getLowestRateGross(rows)).toBe(1722);
    });

    it('returns null for empty rows', () => {
      expect(getLowestRateGross([])).toBeNull();
    });
  });
});
