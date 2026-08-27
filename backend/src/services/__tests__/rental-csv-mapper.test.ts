import { describe, it, expect } from 'vitest';
import { mapCSVRowToMatrixEntry, mapProviderCSVRow, parseFeePct, RentalMatrixCSVRow, ProviderCSVRow } from '../rental-csv-mapper.js';

describe('rental-csv-mapper', () => {
    describe('parseFeePct', () => {
        it('should parse canonical numeric values in range 0-30', () => {
            expect(parseFeePct('6.5').value).toBe(6.5);
            expect(parseFeePct('7').value).toBe(7.0);
            expect(parseFeePct('8.0').value).toBe(8.0);
            expect(parseFeePct('0').value).toBe(0.0);
            expect(parseFeePct('30').value).toBe(30.0);
        });

        it('should normalize defensively comma and percentage signs', () => {
            expect(parseFeePct('6,5').value).toBe(6.5);
            expect(parseFeePct('7%').value).toBe(7.0);
            expect(parseFeePct('6,5%').value).toBe(6.5);
            expect(parseFeePct(' 8.5 % ').value).toBe(8.5);
        });

        it('should return null when value is empty, undefined or null', () => {
            expect(parseFeePct(undefined).value).toBeNull();
            expect(parseFeePct(null).value).toBeNull();
            expect(parseFeePct('').value).toBeNull();
            expect(parseFeePct('   ').value).toBeNull();
        });

        it('should reject ambiguous values strictly below 1 without %', () => {
            const res1 = parseFeePct('0.065');
            expect(res1.value).toBeNull();
            expect(res1.error).toContain('ambiguous fee_pct');

            const res2 = parseFeePct('0.07', 5);
            expect(res2.value).toBeNull();
            expect(res2.error).toContain('Row 5: ambiguous fee_pct');
        });

        it('should reject values out of range 0-30', () => {
            const res1 = parseFeePct('35');
            expect(res1.value).toBeNull();
            expect(res1.error).toContain('out of range 0-30%');

            const res2 = parseFeePct('-1');
            expect(res2.value).toBeNull();
            expect(res2.error).toContain('out of range 0-30%');

            const res3 = parseFeePct('50%');
            expect(res3.value).toBeNull();
            expect(res3.error).toContain('out of range 0-30%');
        });

        it('should reject non-numeric invalid strings and junk inputs', () => {
            expect(parseFeePct('abc').value).toBeNull();
            expect(parseFeePct('abc').error).toContain('invalid fee_pct');

            // Excel thousand separators, unit suffix, multiple dots/commas
            expect(parseFeePct('1,234.5').value).toBeNull();
            expect(parseFeePct('1,234.5').error).toContain('invalid fee_pct');

            expect(parseFeePct('7zl').value).toBeNull();
            expect(parseFeePct('7zl').error).toContain('invalid fee_pct');

            expect(parseFeePct('7.5.5').value).toBeNull();
            expect(parseFeePct('7.5.5').error).toContain('invalid fee_pct');

            expect(parseFeePct('1,2,3').value).toBeNull();
            expect(parseFeePct('1,2,3').error).toContain('invalid fee_pct');
        });
    });

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
                monthly_rate_gross: '1230',
                fee_pct: '7.5'
            };

            const result = mapCSVRowToMatrixEntry(row, 1);
            expect(result.error).toBe(null);
            expect(result.data?.initialPaymentAmountGross).toBe(1230);
            expect(result.data?.initialPaymentAmountNet).toBe(1000);
            expect(result.data?.feePct).toBe(7.5);
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
            expect(result.data?.feePct).toBeNull();
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

        it('should return error when fee_pct is invalid', () => {
            const row: RentalMatrixCSVRow = {
                vehicle_id: '123',
                annual_mileage_km: '10000',
                contract_months: '36',
                initial_payment_pct: '10',
                monthly_rate_net: '1000',
                monthly_rate_gross: '1230',
                fee_pct: '0.07'
            };

            const result = mapCSVRowToMatrixEntry(row, 2);
            expect(result.data).toBeNull();
            expect(result.error).toContain('Row 2: ambiguous fee_pct "0.07"');
        });
    });

    describe('mapProviderCSVRow (provider format)', () => {
        it('should correctly calculate net and gross initial payments when amounts_type is gross and map fee_pct', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                initial_payment_amount: '1230',
                amounts_type: 'gross',
                fee_pct: '6.5'
            };

            const result = mapProviderCSVRow(row, 1);
            expect(result.error).toBe(null);
            expect(result.entries[0].initialPaymentAmountGross).toBe(1230);
            expect(result.entries[0].initialPaymentAmountNet).toBe(1000);
            expect(result.entries[0].feePct).toBe(6.5);
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
            expect(result.entries[0].feePct).toBeNull();
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

        it('should return error when provider row has invalid fee_pct', () => {
            const row: ProviderCSVRow = {
                car_id: '123',
                term_months: '36',
                mileage_yearly: '10000',
                monthly_cost_net: '1000',
                fee_pct: '45'
            };

            const result = mapProviderCSVRow(row, 3);
            expect(result.entries.length).toBe(0);
            expect(result.error).toContain('Row 3: fee_pct out of range 0-30% ("45")');
        });
    });
});

