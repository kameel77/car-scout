export const SPECIAL_OFFER_QUERY_PARAM = 'offer';
export const SPECIAL_OFFER_COOKIE = 'special_offer_discount';
const SPECIAL_OFFER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

export const parseDiscountValue = (value?: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
};

const decodeBase64Url = (value: string): string | null => {
    if (!value) return null;
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
    try {
        return typeof window !== 'undefined' ? window.atob(padded) : null;
    } catch (error) {
        return null;
    }
};

export const parseDiscountFromOfferParam = (value?: string | null): number | null => {
    if (!value) return null;
    const decoded = decodeBase64Url(value);
    if (!decoded) return null;
    const params = new URLSearchParams(decoded);
    if (params.get('uuid')) return null;
    const direct = parseDiscountValue(params.get('offerDiscount'));
    if (direct !== null) return direct;
    return parseDiscountValue(params.get('discount'));
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
