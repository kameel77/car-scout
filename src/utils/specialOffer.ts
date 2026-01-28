// Re-export unified offer parser
export { parseOfferParam, OFFER_PARAM } from './offerParser';

export const SPECIAL_OFFER_COOKIE = 'special_offer_discount';
const SPECIAL_OFFER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

export const parseDiscountValue = (value?: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
};

/**
 * Parse discount from offer parameter (special offers only, not CRM tracking)
 * @deprecated Use parseOfferParam instead for type-safe parsing
 */
export const parseDiscountFromOfferParam = (value?: string | null): number | null => {
    const parsed = parseOfferParam(value);
    if (parsed.type === 'special_offer') {
        return parsed.discount;
    }
    return null;
};

export const applySpecialOfferDiscount = (price: number, discount: number): number => {
    if (!Number.isFinite(price) || price <= 0) return 0;
    if (!Number.isFinite(discount) || discount <= 0) return Math.round(price);
    return Math.max(0, Math.round(price - discount));
};

export const readSpecialOfferDiscount = (): number | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const cookie = cookies.find((item) => item.startsWith(`${SPECIAL_OFFER_COOKIE}=`));
    if (!cookie) return null;
    const value = decodeURIComponent(cookie.split('=').slice(1).join('='));
    return parseDiscountValue(value);
};

export const writeSpecialOfferDiscount = (discount: number): void => {
    if (typeof document === 'undefined') return;
    const normalized = Math.max(0, Math.round(discount));
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${SPECIAL_OFFER_COOKIE}=${encodeURIComponent(normalized)}; Max-Age=${SPECIAL_OFFER_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};
