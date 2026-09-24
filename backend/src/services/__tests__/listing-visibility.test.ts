import { describe, it, expect } from 'vitest';
import { getPublicListingWhere, PUBLIC_LISTING_DISPLAY_MODE_OR } from '../listing-visibility.service.js';

describe('listing-visibility.service', () => {
    it('returns standard public visibility where conditions', () => {
        const where = getPublicListingWhere();
        expect(where.isArchived).toBe(false);
        expect(where.pricePln).toEqual({ gt: 0 });
        expect(where.OR).toEqual(PUBLIC_LISTING_DISPLAY_MODE_OR);
    });

    it('merges extraWhere conditions cleanly', () => {
        const where = getPublicListingWhere({ condition: 'NEW' });
        expect(where.isArchived).toBe(false);
        expect(where.pricePln).toEqual({ gt: 0 });
        expect(where.condition).toBe('NEW');
        expect(where.OR).toEqual(PUBLIC_LISTING_DISPLAY_MODE_OR);
    });
});
