import { describe, it, expect } from 'vitest';
import { mapCSVRowToMatrixEntry, mapProviderCSVRow, RentalMatrixCSVRow, ProviderCSVRow } from '../rental-csv-mapper.js';

describe('rental-csv-mapper', () => {
    describe('mapCSVRowToMatrixEntry (internal format)', () => {
        it('should correctly calculate net and gross initial payments when amounts_type is gross', () => {
            const row: RentalMatrixCSVRow = {
                vehicle_id: '123',
                annual_mileage_km: '10000',
                contract_months: '36',
                initial_payment_pct: '10',
                initial_payment_amount: '1230',
                amounts_type: 'gross',
                monthly_rate_net: '1000',
                monthly_rate_gross: '1230'
            };

            const result = mapCSVRowToMatrixEntry(row, 1);
            expect(result.error).toBe(null);
            expect(result.data?.initialPaymentAmountGross).toBe(1230);
            expect(result.data?.initialPaymentAmountNet).toBe(1000);
        });

        it('should correctly calculate net and gross initial payments when amounts_type is net', () => {
            const row: RentalMatrixCSVRow = {
                vehicle_id: '123',
                annual_mileage_km: '10000',
                contract_months: '36',
                initial_payment_pct: '10',
                initial_payment_amount: '1000',
                amounts_type: 'net',
                monthly_rate_net: '1000',
                monthly_rate_gross: '1230'
            };

            const result = mapCSVRowToMatrixEntry(row, 1);
            expect(result.error).toBe(null);
            expect(result.data?.initialPaymentAmountGross).toBe(1230);
            expect(result.data?.initialPaymentAmountNet).toBe(1000);
        });

        it('should default to net when amounts_type is not provided', () => {
            const row: RentalMatrixCSVRow = {
                vehicle_id: '123',
                annual_mileage_km: '10000',
                contract_months: '36',
                initial_payment_pct: '10',
                initial_payment_amount: '1000',
                monthly_rate_net: '1000',
                monthly_rate_gross: '1230'
            };

            const result = mapCSVRowToMatrixEntry(row, 1);
            expect(result.error).toBe(null);
            expect(result.data?.initialPaymentAmountGross).toBe(1230);
            expect(result.data?.initialPaymentAmountNet).toBe(1000);
        });
        
        it('should handle missing initial payment amount gracefully', () => {
            const row: RentalMatrixCSVRow = {
                vehicle_id: '123',
                annual_mileage_km: '10000',
                contract_months: '36',
                initial_payment_pct: '10',
                monthly_rate_net: '1000',
                monthly_rate_gross: '1230'
            };

            const result = mapCSVRowToMatrixEntry(row, 1);
            expect(result.error).toBe(null);
            expect(result.data?.initialPaymentAmountGross).toBe(0);
            expect(result.data?.initialPaymentAmountNet).toBe(0);
        });
    });

    describe('mapProviderCSVRow (provider format)', () => {
        it('should correctly calculate net and gross initial payments when amounts_type is gross', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                initial_payment_amount: '1230',
                amounts_type: 'gross'
            };

            const result = mapProviderCSVRow(row, 1);
            expect(result.error).toBe(null);
            expect(result.entries[0].initialPaymentAmountGross).toBe(1230);
            expect(result.entries[0].initialPaymentAmountNet).toBe(1000);
        });

        it('should correctly calculate net and gross initial payments when amounts_type is net', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                initial_payment_amount: '1000',
                amounts_type: 'net'
            };

            const result = mapProviderCSVRow(row, 1);
            expect(result.error).toBe(null);
            expect(result.entries[0].initialPaymentAmountGross).toBe(1230);
            expect(result.entries[0].initialPaymentAmountNet).toBe(1000);
        });

        it('should default to net when amounts_type is not provided', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                initial_payment_amount: '1000'
            };

            const result = mapProviderCSVRow(row, 1);
            expect(result.error).toBe(null);
            expect(result.entries[0].initialPaymentAmountGross).toBe(1230);
            expect(result.entries[0].initialPaymentAmountNet).toBe(1000);
        });

        it('should only include services that have explicit inclusion strings, not numeric values', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                insurance_net: '382.08',
                tires_net: '172.00',
                service_net: 'I',
                other_cost_net: 'tak'
            };

            const result = mapProviderCSVRow(row, 1);
            expect(result.error).toBe(null);
            expect(result.entries[0].servicesIncluded).toEqual(['service', 'other']);
        });
    });
});
