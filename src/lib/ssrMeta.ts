// SSR→client meta handoff. Backend (render.ts) injects window.__SSR_META__ with the exact
// title/description/canonical/ogImage it rendered for the requested URL. react-helmet-async's
// data-rh dedupe (patrz seo-meta.ts injectHead) replaces SSR head tags with whatever the client
// computes on first render — for routes without their own page-level description (np. /dla-firm)
// or where it can resolve empty (np. /oferta/:slug bez CMS szablonu w wariancie gotówka), that
// would silently downgrade to SeoManager's home defaults. getSsrMeta() lets MetaHead/SeoManager
// prefer the SSR values on the very first paint of the URL that was actually server-rendered.
export interface SsrMeta {
    path: string;
    title: string;
    description: string;
    canonical?: string;
    ogImage?: string;
}

declare global {
    interface Window {
        __SSR_META__?: SsrMeta;
    }
}

// Ta sama normalizacja co backendowy cacheKey (renderAndCache w render.ts: `page > 1 ?
// \`${path}?page=${page}\` : path`) i window.__SSR_META__.path — bo SSR HTML jest cache'owane
// per path+page NIEZALEŻNIE od reszty query stringa. Ignorujemy więc utm/gclid/filtry i
// porównujemy tylko pathname + ewentualne ?page=N (ten sam clamp 1..10000 co backend), inaczej
// SSR meta wygenerowane dla pierwszego odwiedzającego z np. ?utm_source=x nigdy by nie pasowało
// kolejnym gościom tego samego path+page, którym backend serwuje ten sam cache'owany HTML.
function normalizedCurrentPath(): string {
    const params = new URLSearchParams(window.location.search);
    const parsed = parseInt(params.get('page') ?? '1', 10);
    const page = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 10000) : 1;
    return page > 1 ? `${window.location.pathname}?page=${page}` : window.location.pathname;
}

// Nie usuwamy window.__SSR_META__ po pierwszym użyciu — porównujemy path przy każdym wywołaniu,
// więc podwójny render Reacta (StrictMode) jest bezpieczny. Gdy user nawiguje w SPA na inną
// trasę, znormalizowana ścieżka przestaje pasować i funkcja zwraca null — SSR meta dotyczy
// wyłącznie URL-a, z którym przyszedł initial load.
export function getSsrMeta(): SsrMeta | null {
    if (typeof window === 'undefined') return null;
    const meta = window.__SSR_META__;
    if (!meta) return null;
    return meta.path === normalizedCurrentPath() ? meta : null;
}
