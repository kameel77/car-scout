/**
 * Real-user INP attribution reporting. No cookies, no identifiers — just the
 * interaction shape (type/target/timings/longest script) so we can see which
 * interactions make p75 INP bad. Sent to backend/src/routes/rum.ts.
 */
import type { INPMetricWithAttribution } from 'web-vitals/attribution';

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
}

function truncate(value: string, maxLength: number): string {
    return value.slice(0, maxLength);
}

function stripQueryString(url: string): string {
    const queryIndex = url.indexOf('?');
    return queryIndex === -1 ? url : url.slice(0, queryIndex);
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
    };
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
    if (navigator.webdriver || !navigator.sendBeacon) return;

    const startWhenIdle = () => {
        const load = () => {
            import('web-vitals/attribution')
                .then(({ onINP }) => {
                    onINP(report);
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
