import { describe, it } from 'node:test';
import * as assert from 'node:assert';
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.data?.initialPaymentAmountGross, 1230);
            assert.strictEqual(result.data?.initialPaymentAmountNet, 1000);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.data?.initialPaymentAmountGross, 1230);
            assert.strictEqual(result.data?.initialPaymentAmountNet, 1000);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.data?.initialPaymentAmountGross, 1230);
            assert.strictEqual(result.data?.initialPaymentAmountNet, 1000);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.data?.initialPaymentAmountGross, 0);
            assert.strictEqual(result.data?.initialPaymentAmountNet, 0);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.entries[0].initialPaymentAmountGross, 1230);
            assert.strictEqual(result.entries[0].initialPaymentAmountNet, 1000);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.entries[0].initialPaymentAmountGross, 1230);
            assert.strictEqual(result.entries[0].initialPaymentAmountNet, 1000);
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
            assert.strictEqual(result.error, null);
            assert.strictEqual(result.entries[0].initialPaymentAmountGross, 1230);
            assert.strictEqual(result.entries[0].initialPaymentAmountNet, 1000);
        });
    });
});
