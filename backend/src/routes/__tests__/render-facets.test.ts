import { describe, it, expect } from 'vitest';
import { hasSamochodyFacetParams } from '../render';

const q = (s: string) => new URLSearchParams(s);

describe('hasSamochodyFacetParams (KAM-17)', () => {
    it('ignores pagination and tracking params', () => {
        expect(hasSamochodyFacetParams(q('page=3'))).toBe(false);
        expect(hasSamochodyFacetParams(q('utm_source=google&utm_campaign=x&gclid=1&fbclid=2&_gl=3'))).toBe(false);
        expect(hasSamochodyFacetParams(q('make='))).toBe(false);
    });

    it('treats any filter as a facet', () => {
        expect(hasSamochodyFacetParams(q('make=MG,JAC&page=11'))).toBe(true);
        expect(hasSamochodyFacetParams(q('fuelType=diesel'))).toBe(true);
        expect(hasSamochodyFacetParams(q('priceMax=100000&utm_source=x'))).toBe(true);
    });
});
