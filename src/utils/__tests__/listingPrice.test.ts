import { describe, it, expect } from 'vitest';
import { getFinancingBasePrice } from '../listingPrice';

describe('getFinancingBasePrice', () => {
    it('returns brokerPricePln when financingPriceBase is BROKER_PRICE_PLN', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: 103500,
            financingPriceBase: 'BROKER_PRICE_PLN',
        });
        expect(result).toBe(103500);
    });

    it('returns pricePln when financingPriceBase is PRICE_PLN', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: 103500,
            financingPriceBase: 'PRICE_PLN',
        });
        expect(result).toBe(100000);
    });

    it('falls back to pricePln when brokerPricePln is null', () => {
        const result = getFinancingBasePrice({
            pricePln: 100000,
            brokerPricePln: null as any,
            financingPriceBase: 'BROKER_PRICE_PLN',
        });
        expect(result).toBe(100000);
    });
});
