/**
 * Real-user INP attribution reporting. No cookies, no identifiers — just the
 * interaction shape (type/target/timings/longest script) so we can see which
 * interactions make p75 INP bad. Sent to backend/src/routes/rum.ts.
 */
import type { CLSMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution } from 'web-vitals/attribution';

export interface InpPayload {
    path: string;
    value: number;
    rating: string;
    navigationType: string;
    type: string;
    target: string;
    inputDelay: number;
    processingDuration: number;
    presentationDelay: number;
    loadState: string;
    interactionTime: number;
    script: {
        src: string;
        invoker: string;
        fn: string;
        duration: number;
        forced: number;
    } | null;
    gtmLoaded: boolean;
    cpu: number | null;
    mem: number | null;
    net: string | null;
    vw: number;
    build: string | null;
}

/**
 * LCP/CLS beacon, sent to /api/rum/vitals. `value` is in ms for LCP and in
 * milli-CLS for CLS (raw score * 1000, rounded) because the backend sanitizer
 * rounds every number to an integer. The same goes for `shiftValue`.
 */
export interface VitalsPayload {
    metric: 'LCP' | 'CLS';
    path: string;
    value: number;
    rating: string;
    navigationType: string;
    build: string | null;
    net: string | null;
    vw: number;
    cpu: number | null;
    mem: number | null;
    target: string;
    // LCP only
    url?: string | null;
    ttfb?: number;
    loadDelay?: number;
    loadDuration?: number;
    renderDelay?: number;
    // CLS only
    shiftValue?: number;
    shiftTime?: number;
    loadState?: string | null;
}

function truncate(value: string, maxLength: number): string {
    return value.slice(0, maxLength);
}

function stripQueryString(url: string): string {
    const queryIndex = url.indexOf('?');
    return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

const INTERACTIVE_SELECTOR = 'button,a,[role=button],[role=tab],[role=slider],[role=option],label,input,select,textarea,summary';

function collapseWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

/**
 * Used as web-vitals' `generateTarget` option: receives the real DOM node at
 * interaction time and returns a human-readable label instead of the default
 * CSS selector (which for Tailwind-heavy markup is unreadable class soup).
 * Returns undefined to let web-vitals fall back to its own selector.
 */
export function generateInpTarget(node: Node | null): string | undefined {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return undefined;

    const original = node as Element;
    const el = original.closest(INTERACTIVE_SELECTOR) ?? original;
    const tag = el.tagName.toLowerCase();

    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const type = (el as HTMLInputElement).type || 'text';
        const name = el.getAttribute('name') || el.getAttribute('placeholder') || el.getAttribute('aria-label') || '';
        const label = `${tag}[${type}] ${name}`.trim();
        return label ? truncate(label, 60) : undefined;
    }

    const text = el.getAttribute('aria-label') || collapseWhitespace(el.textContent || '');
    if (!text) return undefined;

    return truncate(`${tag} ${text}`, 60);
}

/** `index-<HASH>.js` of the main entry script -> `<HASH>`; null when not found. */
export function readBuildId(): string | null {
    const src = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src');
    const match = src?.match(/\/index-([^/.]+)\.js/);
    return match ? match[1] : null;
}

let cachedBuild: string | null | undefined;

function getBuildId(): string | null {
    if (cachedBuild === undefined) cachedBuild = readBuildId();
    return cachedBuild;
}

export function isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

function pickLongestScript(metric: INPMetricWithAttribution): InpPayload['script'] {
    const longAnimationFrameEntries = metric.attribution.longAnimationFrameEntries || [];
    let longest: PerformanceScriptTiming | null = null;

    for (const entry of longAnimationFrameEntries) {
        for (const script of entry.scripts || []) {
            if (!longest || script.duration > longest.duration) {
                longest = script;
            }
        }
    }

    if (!longest) return null;

    return {
        src: truncate(stripQueryString(longest.sourceURL || ''), 200),
        invoker: truncate(longest.invoker || '', 120),
        fn: truncate(longest.sourceFunctionName || '', 80),
        duration: longest.duration,
        forced: longest.forcedStyleAndLayoutDuration,
    };
}

export function buildInpPayload(metric: INPMetricWithAttribution): InpPayload {
    const { attribution } = metric;

    return {
        path: location.pathname,
        value: Math.round(metric.value),
        rating: metric.rating,
        navigationType: metric.navigationType,
        type: attribution.interactionType,
        target: truncate(attribution.interactionTarget || '', 200),
        inputDelay: attribution.inputDelay,
        processingDuration: attribution.processingDuration,
        presentationDelay: Math.round(attribution.presentationDelay),
        loadState: attribution.loadState,
        interactionTime: Math.round(attribution.interactionTime),
        script: pickLongestScript(metric),
        gtmLoaded: !!(window as any)._gtmLoaded,
        cpu: navigator.hardwareConcurrency ?? null,
        mem: (navigator as any).deviceMemory ?? null,
        net: (navigator as any).connection?.effectiveType ?? null,
        vw: window.innerWidth,
        build: getBuildId(),
    };
}

export function buildVitalsPayload(metric: LCPMetricWithAttribution | CLSMetricWithAttribution): VitalsPayload {
    const common = {
        path: location.pathname,
        rating: metric.rating,
        navigationType: metric.navigationType,
        build: getBuildId(),
        net: (navigator as any).connection?.effectiveType ?? null,
        vw: window.innerWidth,
        cpu: navigator.hardwareConcurrency ?? null,
        mem: (navigator as any).deviceMemory ?? null,
    };

    if (metric.name === 'LCP') {
        const { attribution } = metric;
        return {
            ...common,
            metric: 'LCP',
            value: Math.round(metric.value),
            target: truncate(attribution.target || '', 200),
            url: attribution.url ? truncate(stripQueryString(attribution.url), 200) : null,
            ttfb: Math.round(attribution.timeToFirstByte),
            loadDelay: Math.round(attribution.resourceLoadDelay),
            loadDuration: Math.round(attribution.resourceLoadDuration),
            renderDelay: Math.round(attribution.elementRenderDelay),
        };
    }

    const { attribution } = metric;
    return {
        ...common,
        metric: 'CLS',
        value: Math.round(metric.value * 1000),
        target: truncate(attribution.largestShiftTarget || '', 200),
        shiftValue: Math.round((attribution.largestShiftValue ?? 0) * 1000),
        shiftTime: Math.round(attribution.largestShiftTime ?? 0),
        loadState: attribution.loadState ?? null,
    };
}

function reportVitals(metric: LCPMetricWithAttribution | CLSMetricWithAttribution): void {
    try {
        const payload = buildVitalsPayload(metric);
        navigator.sendBeacon('/api/rum/vitals', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {
        // Never let RUM reporting break the page.
    }
}

function report(metric: INPMetricWithAttribution): void {
    try {
        const payload = buildInpPayload(metric);
        navigator.sendBeacon('/api/rum/inp', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {
        // Never let RUM reporting break the page.
    }
}

export function startInpReporting(): void {
    if (navigator.webdriver || !navigator.sendBeacon || isLocalHostname(location.hostname)) return;

    const startWhenIdle = () => {
        const load = () => {
            import('web-vitals/attribution')
                .then(({ onINP, onLCP, onCLS }) => {
                    onINP(report, { generateTarget: generateInpTarget });
                    // Buffered observers: registering after load still captures LCP/CLS; they report on page hide.
                    onLCP(reportVitals, { generateTarget: generateInpTarget });
                    onCLS(reportVitals, { generateTarget: generateInpTarget });
                })
                .catch(() => {
                    // Chunk failed to load — reporting is best-effort.
                });
        };
        // Called via window — a detached requestIdleCallback throws "Illegal invocation".
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(load);
        } else {
            setTimeout(load, 1);
        }
    };

    if (document.readyState === 'complete') {
        startWhenIdle();
    } else {
        window.addEventListener('load', startWhenIdle, { once: true });
    }
}
