import { Prisma } from '@prisma/client';

export const PUBLIC_LISTING_DISPLAY_MODE_OR: Prisma.ListingWhereInput[] = [
    { specificationId: null },
    { specification: { displayMode: 'ALL' } },
    { AND: [{ specification: { displayMode: 'GROUPED' } }, { isRepresentative: true }] },
];

/**
 * Common Prisma where clause for public listing visibility.
 * Shared between public `/api/listings` (unauthenticated requests)
 * and catalog SSR in `render.ts` (/samochody, /nowe, /uzywane, /search, etc.).
 *
 * Ensures:
 * 1. isArchived is false
 * 2. pricePln > 0 (filters out incomplete/zero-price dealer drafts)
 * 3. displayMode is respected (solo cars, ALL specifications, or GROUPED representative cars)
 */
export function getPublicListingWhere(extraWhere?: Prisma.ListingWhereInput): Prisma.ListingWhereInput {
    return {
        isArchived: false,
        pricePln: { gt: 0 },
        OR: PUBLIC_LISTING_DISPLAY_MODE_OR,
        ...extraWhere,
    };
}
