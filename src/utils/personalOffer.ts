const PERSONAL_OFFER_COOKIE = 'crm_selected_ids';
const PERSONAL_OFFER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10; // 10 years

/**
 * Read saved personal offer listing IDs from cookie.
 */
export const readPersonalOfferIds = (): string[] => {
    if (typeof document === 'undefined') return [];
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const cookie = cookies.find((item) => item.startsWith(`${PERSONAL_OFFER_COOKIE}=`));
    if (!cookie) return [];

    try {
        const value = decodeURIComponent(cookie.split('=').slice(1).join('='));
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
        }
        return [];
    } catch {
        return [];
    }
};

/**
 * Write personal offer listing IDs to cookie.
 */
export const writePersonalOfferIds = (ids: string[]): void => {
    if (typeof document === 'undefined') return;
    const unique = [...new Set(ids.filter(id => id.trim().length > 0))];
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PERSONAL_OFFER_COOKIE}=${encodeURIComponent(JSON.stringify(unique))}; Max-Age=${PERSONAL_OFFER_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
};

/**
 * Clear personal offer cookie.
 */
export const clearPersonalOfferIds = (): void => {
    if (typeof document === 'undefined') return;
    document.cookie = `${PERSONAL_OFFER_COOKIE}=; Max-Age=0; Path=/`;
};
