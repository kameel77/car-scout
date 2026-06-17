import { describe, it, expect } from 'vitest';
import { getFinancingBasePrice } from '../listingPrice';

describe('getFinancingBasePrice', () => {
    it('returns price_pln (the financing price) directly', () => {
        const result = getFinancingBasePrice({ price_pln: 100000 });
        expect(result).toBe(100000);
    });
});
