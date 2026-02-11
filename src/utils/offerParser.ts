/**
 * Unified parser for the 'offer' query parameter.
 * Handles both special offers and CRM tracking offers.
 * 
 * Special offer format: offerDiscount=<amount>
 * CRM tracking format: offerDiscount=<amount>&uuid=<client-uuid>
 */

const decodeBase64Url = (value: string): string | null => {
    if (!value) return null;
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');

    try {
        // Browser
        if (typeof window !== 'undefined' && typeof window.atob === 'function') {
            return window.atob(padded);
        }
        // Node / Modern JS environments
        if (typeof atob === 'function') {
            return atob(padded);
        }
        // Node legacy
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(padded, 'base64').toString('utf-8');
        }
        return null;
    } catch (error) {
        return null;
    }
};

const parseDiscountValue = (value?: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
};

export type OfferType =
    | { type: 'special_offer'; discount: number; initialPayment?: number }
    | { type: 'crm_tracking'; uuid: string; discount: number; initialPayment?: number }
    | { type: 'invalid' };

/**
 * Parse the offer parameter from URL query string.
 * Automatically detects whether it's a special offer or CRM tracking offer.
 * 
 * @param value - Base64URL encoded offer parameter
 * @returns Parsed offer with discriminated type
 */
export const parseOfferParam = (value?: string | null): OfferType => {
    if (!value) return { type: 'invalid' };

    const decoded = decodeBase64Url(value);
    if (!decoded) return { type: 'invalid' };

    const params = new URLSearchParams(decoded);
    const uuid = params.get('uuid');
    const discount = parseDiscountValue(params.get('offerDiscount') || params.get('discount'));
    const initialPayment = parseDiscountValue(params.get('initialPayment')); // Reuse parseDiscountValue as it parses positive integers

    // CRM tracking: has UUID + discount
    if (uuid && discount !== null) {
        return {
            type: 'crm_tracking',
            uuid,
            discount,
            initialPayment: initialPayment ?? undefined
        };
    }

    // Special offer: has discount but no UUID
    if (!uuid && discount !== null) {
        return {
            type: 'special_offer',
            discount,
            initialPayment: initialPayment ?? undefined
        };
    }

    return { type: 'invalid' };
};

/**
 * Shared query parameter name for both special offers and CRM tracking
 */
export const OFFER_PARAM = 'offer';
