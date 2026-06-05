import { describe, it, expect } from 'vitest';
import { getFinancingBasePrice } from '../listingPrice';

describe('getFinancingBasePrice', () => {
    it('returns pricePln (the financing price) directly', () => {
        const result = getFinancingBasePrice({ pricePln: 100000 });
        expect(result).toBe(100000);
    });
});
