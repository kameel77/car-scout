import { parseDiscountValue } from '@/utils/specialOffer';

const CRM_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

export const CRM_OFFER_PARAM = 'offer';
export const CRM_UUID_COOKIE = 'crm_tracking_uuid';
export const CRM_SESSION_COOKIE = 'crm_tracking_session';
export const CRM_OFFER_DISCOUNT_COOKIE = 'crm_offer_discount';

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

export const parseOfferPayload = (value?: string | null): URLSearchParams | null => {
    if (!value) return null;
    const decoded = decodeBase64Url(value);
    if (!decoded) return null;
    return new URLSearchParams(decoded);
};

export const parseOfferDiscount = (value?: string | null): number | null => {
    return parseDiscountValue(value);
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
    return parseOfferDiscount(value);
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
