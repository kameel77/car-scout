export type ConsentChoice = {
    analytics: boolean;
    marketing: boolean;
    timestamp: number;
    version: string;
};

export const CONSENT_BANNER_VERSION = '1.0';
const STORAGE_KEY = 'consent_v1';
const COOKIE_NAME = 'consent_v1';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

let API_BASE_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.MODE === 'development' ? '' : '');
if (API_BASE_URL.endsWith('/api')) API_BASE_URL = API_BASE_URL.slice(0, -4);
if (API_BASE_URL.endsWith('/api/')) API_BASE_URL = API_BASE_URL.slice(0, -5);

export function loadConsent(): ConsentChoice | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ConsentChoice;
        if (parsed.version !== CONSENT_BANNER_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function saveConsent(choice: Omit<ConsentChoice, 'timestamp' | 'version'>): ConsentChoice {
    const full: ConsentChoice = {
        ...choice,
        timestamp: Date.now(),
        version: CONSENT_BANNER_VERSION,
    };
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
        const value = encodeURIComponent(JSON.stringify({ a: full.analytics ? 1 : 0, m: full.marketing ? 1 : 0 }));
        document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`;
    } catch {
        /* ignore — storage may be disabled */
    }
    return full;
}

type GtagConsentState = 'granted' | 'denied';
type GtagConsentPayload = {
    analytics_storage: GtagConsentState;
    ad_storage: GtagConsentState;
    ad_user_data: GtagConsentState;
    ad_personalization: GtagConsentState;
    security_storage: GtagConsentState;
};

function toGtagPayload(analytics: boolean, marketing: boolean): GtagConsentPayload {
    return {
        analytics_storage: analytics ? 'granted' : 'denied',
        ad_storage: marketing ? 'granted' : 'denied',
        ad_user_data: marketing ? 'granted' : 'denied',
        ad_personalization: marketing ? 'granted' : 'denied',
        security_storage: 'granted',
    };
}

declare global {
    interface Window {
        dataLayer?: unknown[];
    }
}

function pushDataLayer(args: unknown[]) {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(args);
}

export function pushConsentDefault(analytics: boolean, marketing: boolean) {
    pushDataLayer(['consent', 'default', toGtagPayload(analytics, marketing)]);
}

export function pushConsentUpdate(analytics: boolean, marketing: boolean) {
    pushDataLayer(['consent', 'update', toGtagPayload(analytics, marketing)]);
}

// Geo detection — cached for the session
let geoPromise: Promise<{ country: string | null; isEEA: boolean }> | null = null;

export function fetchGeo(): Promise<{ country: string | null; isEEA: boolean }> {
    if (geoPromise) return geoPromise;
    geoPromise = (async () => {
        try {
            const cached = window.sessionStorage.getItem('consent_geo');
            if (cached) return JSON.parse(cached);
        } catch { /* ignore */ }
        try {
            const r = await fetch(`${API_BASE_URL}/api/geo`);
            if (!r.ok) throw new Error('geo failed');
            const data = (await r.json()) as { country: string | null; isEEA: boolean };
            try { window.sessionStorage.setItem('consent_geo', JSON.stringify(data)); } catch { /* ignore */ }
            return data;
        } catch {
            return { country: null, isEEA: true };
        }
    })();
    return geoPromise;
}

export async function persistConsentToBackend(payload: {
    analytics: boolean;
    marketing: boolean;
    brandId?: string;
}) {
    try {
        await fetch(`${API_BASE_URL}/api/consent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...payload,
                bannerVersion: CONSENT_BANNER_VERSION,
            }),
        });
    } catch {
        /* ignore — best-effort audit log */
    }
}

// Simple reactive store
type Listener = (choice: ConsentChoice | null) => void;
const listeners = new Set<Listener>();

export function subscribeConsent(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function emit(choice: ConsentChoice | null) {
    listeners.forEach((fn) => {
        try { fn(choice); } catch { /* ignore */ }
    });
}

export function commitConsent(
    choice: Omit<ConsentChoice, 'timestamp' | 'version'>,
    opts: { brandId?: string; persistRemote?: boolean } = {},
): ConsentChoice {
    const saved = saveConsent(choice);
    pushConsentUpdate(saved.analytics, saved.marketing);
    if (opts.persistRemote !== false) {
        void persistConsentToBackend({
            analytics: saved.analytics,
            marketing: saved.marketing,
            brandId: opts.brandId,
        });
    }
    emit(saved);
    return saved;
}
