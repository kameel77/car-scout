// Re-export unified offer parser
export { parseOfferParam, OFFER_PARAM } from './offerParser';

const CRM_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

export const CRM_UUID_COOKIE = 'crm_tracking_uuid';
export const CRM_SESSION_COOKIE = 'crm_tracking_session';
export const CRM_OFFER_DISCOUNT_COOKIE = 'crm_offer_discount';

const parseDiscountValue = (value?: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
};

const readCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const cookie = cookies.find((item) => item.startsWith(`${name}=`));
    if (!cookie) return null;
    return decodeURIComponent(cookie.split('=').slice(1).join('='));
};

export const readCrmUuid = (): string | null => {
    return readCookie(CRM_UUID_COOKIE);
};

export const readCrmSessionId = (): string | null => {
    return readCookie(CRM_SESSION_COOKIE);
};

export const readCrmOfferDiscount = (): number | null => {
    const value = readCookie(CRM_OFFER_DISCOUNT_COOKIE);
    return parseDiscountValue(value);
};

const writeCookie = (name: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${CRM_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};

export const writeCrmUuid = (value: string): void => {
    writeCookie(CRM_UUID_COOKIE, value);
};

export const writeCrmSessionId = (value: string): void => {
    writeCookie(CRM_SESSION_COOKIE, value);
};

export const writeCrmOfferDiscount = (value: number): void => {
    const normalized = Math.max(0, Math.round(value));
    writeCookie(CRM_OFFER_DISCOUNT_COOKIE, String(normalized));
};

export const generateSessionId = (): string => {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
};
