import { FastifyInstance, FastifyRequest } from 'fastify';

export const ANONYMOUS_DEALER_NAME = 'Zweryfikowany Partner Motolia';

/**
 * Shared authentication helper for public endpoints.
 * Verifies JWT token and checks Redis token blacklist to ensure revoked tokens do not unmask dealer data.
 */
export async function tryAuthenticate(fastify: FastifyInstance, request: FastifyRequest): Promise<boolean> {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

        await request.jwtVerify();

        const token = authHeader.substring(7).trim();
        if (token) {
            const isBlacklisted = await fastify.redis.get(`blacklist:${token}`);
            if (isBlacklisted) return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitizes a dealer object for unauthenticated public responses.
 * Replaces dealer.name with ANONYMOUS_DEALER_NAME ("Zweryfikowany Partner Motolia").
 * Retains id and city. Strips sensitive address & contact fields.
 */
export function sanitizeDealer<T extends Record<string, any>>(dealer: T | null | undefined, isAuthenticated = false): T | null | undefined {
    if (!dealer) return dealer;
    if (isAuthenticated) return dealer;

    const {
        addressLine1,
        addressLine2,
        addressLine3,
        postalCode,
        contactPhone,
        contactEmail,
        nip,
        settings,
        ...safeDealer
    } = dealer;

    return {
        ...safeDealer,
        name: ANONYMOUS_DEALER_NAME,
    } as unknown as T;
}

/**
 * Sanitizes a listing or vehicle object for unauthenticated public responses.
 * Replaces listing.dealer.name and top-level listing.dealerName / dealer_name with ANONYMOUS_DEALER_NAME.
 */
export function sanitizeListing<T extends Record<string, any>>(listing: T | null | undefined, isAuthenticated = false): T | null | undefined {
    if (!listing) return listing;
    if (isAuthenticated) return listing;

    const sanitizedDealer = listing.dealer ? sanitizeDealer(listing.dealer, false) : listing.dealer;

    const {
        availableFrom, available_from,
        ownerRentalCompany, owner_rental_company,
        ownerRentalCompanyId, owner_rental_company_id,
        vin, registrationNumber, registration_number,
        ...safeListing
    } = listing;

    return {
        ...safeListing,
        ...(listing.dealerName !== undefined ? { dealerName: ANONYMOUS_DEALER_NAME } : {}),
        ...(listing.dealer_name !== undefined ? { dealer_name: ANONYMOUS_DEALER_NAME } : {}),
        ...(sanitizedDealer !== undefined ? { dealer: sanitizedDealer } : {}),
    } as unknown as T;
}
