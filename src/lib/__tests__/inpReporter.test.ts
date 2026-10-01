import { describe, it, expect, afterEach } from 'vitest';
import { buildInpPayload, buildVitalsPayload, generateInpTarget, isLocalHostname, readBuildId } from '@/lib/inpReporter';
import type { CLSMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution } from 'web-vitals/attribution';

function makeScript(overrides: Partial<PerformanceScriptTiming> = {}): PerformanceScriptTiming {
    return {
        startTime: 0,
        duration: 10,
        name: 'script',
        entryType: 'script',
        invokerType: 'classic-script',
        invoker: 'window.onclick',
        executionStart: 0,
        sourceURL: 'https://example.com/app.js',
        sourceFunctionName: 'handleClick',
        sourceCharPosition: 0,
        pauseDuration: 0,
        forcedStyleAndLayoutDuration: 0,
        windowAttribution: 'self',
        ...overrides,
    } as PerformanceScriptTiming;
}

function makeMetric(overrides: {
    longAnimationFrameEntries?: PerformanceLongAnimationFrameTiming[];
    attributionOverrides?: Partial<INPMetricWithAttribution['attribution']>;
} = {}): INPMetricWithAttribution {
    return {
        name: 'INP',
        value: 312.7,
        rating: 'needs-improvement',
        delta: 312.7,
        id: 'v1-123',
        navigationType: 'navigate',
        entries: [],
        attribution: {
            interactionTarget: 'button.cta',
            interactionTime: 1234.5,
            interactionType: 'pointer',
            nextPaintTime: 5678,
            processedEventEntries: [],
            inputDelay: 40,
            processingDuration: 200,
            presentationDelay: 72.4,
            loadState: 'complete',
            longAnimationFrameEntries: overrides.longAnimationFrameEntries || [],
            ...overrides.attributionOverrides,
        },
    } as unknown as INPMetricWithAttribution;
}

describe('buildInpPayload', () => {
    it('picks the longest script across all LoAF entries by duration', () => {
        const loaf1 = { scripts: [makeScript({ duration: 15, sourceFunctionName: 'short' })] } as PerformanceLongAnimationFrameTiming;
        const loaf2 = { scripts: [makeScript({ duration: 80, sourceFunctionName: 'longest' }), makeScript({ duration: 30, sourceFunctionName: 'mid' })] } as PerformanceLongAnimationFrameTiming;

        const payload = buildInpPayload(makeMetric({ longAnimationFrameEntries: [loaf1, loaf2] }));

        expect(payload.script).not.toBeNull();
        expect(payload.script!.fn).toBe('longest');
        expect(payload.script!.duration).toBe(80);
    });

    it('strips the query string from the script src', () => {
        const loaf = { scripts: [makeScript({ sourceURL: 'https://example.com/assets/main.js?v=42&x=1' })] } as PerformanceLongAnimationFrameTiming;

        const payload = buildInpPayload(makeMetric({ longAnimationFrameEntries: [loaf] }));

        expect(payload.script!.src).toBe('https://example.com/assets/main.js');
    });

    it('truncates long strings (target, script src, invoker, fn)', () => {
        const longUrl = `https://example.com/${'a'.repeat(250)}.js`;
        const loaf = {
            scripts: [
                makeScript({
                    sourceURL: longUrl,
                    invoker: 'i'.repeat(200),
                    sourceFunctionName: 'f'.repeat(150),
                }),
            ],
        } as PerformanceLongAnimationFrameTiming;

        const payload = buildInpPayload(
            makeMetric({
                longAnimationFrameEntries: [loaf],
                attributionOverrides: { interactionTarget: 't'.repeat(300) },
            })
        );

        expect(payload.target.length).toBe(200);
        expect(payload.script!.src.length).toBe(200);
        expect(payload.script!.invoker.length).toBe(120);
        expect(payload.script!.fn.length).toBe(80);
    });

    it('reports script: null when there are no LoAF entries', () => {
        const payload = buildInpPayload(makeMetric({ longAnimationFrameEntries: [] }));

        expect(payload.script).toBeNull();
    });

    it('rounds the metric value and presentation delay', () => {
        const payload = buildInpPayload(makeMetric());

        expect(payload.value).toBe(313);
        expect(payload.presentationDelay).toBe(72);
        expect(payload.interactionTime).toBe(1235);
    });
});

describe('generateInpTarget', () => {
    it('returns null for a missing element', () => {
        expect(generateInpTarget(null)).toBeUndefined();
    });

    it('labels a button using its text content', () => {
        const button = document.createElement('button');
        button.textContent = '  Wszystkie   filtry  ';

        expect(generateInpTarget(button)).toBe('button Wszystkie filtry');
    });

    it('prefers aria-label over text content', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Zamknij panel');
        button.textContent = 'X';

        expect(generateInpTarget(button)).toBe('button Zamknij panel');
    });

    it('never exposes an input value', () => {
        const input = document.createElement('input');
        input.type = 'tel';
        input.name = 'phone';
        input.value = '600123456';

        const label = generateInpTarget(input);

        expect(label).toBe('input[tel] phone');
        expect(label).not.toContain('600123456');
    });

    it('uses the closest interactive ancestor when the target is an inner svg/span', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-label', 'Leasing');
        const span = document.createElement('span');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        span.appendChild(svg);
        button.appendChild(span);

        expect(generateInpTarget(svg)).toBe('button Leasing');
    });
});

describe('readBuildId', () => {
    afterEach(() => {
        document.head.innerHTML = '';
    });

    it('extracts the hash from the main entry script filename', () => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/assets/index-Ab3_x-9Z.js';
        document.head.appendChild(script);

        expect(readBuildId()).toBe('Ab3_x-9Z');
    });

    it('returns null when the entry script is absent', () => {
        expect(readBuildId()).toBeNull();
    });
});

describe('isLocalHostname', () => {
    it('detects local hosts', () => {
        for (const host of ['localhost', '127.0.0.1', '[::1]', 'app.localhost']) {
            expect(isLocalHostname(host)).toBe(true);
        }
    });

    it('lets real hosts through', () => {
        expect(isLocalHostname('motolia.pl')).toBe(false);
        expect(isLocalHostname('dev.motolia.pl')).toBe(false);
    });
});

describe('buildVitalsPayload', () => {
    it('builds an LCP payload with rounded timings and the url query stripped', () => {
        const metric = {
            name: 'LCP',
            value: 2412.6,
            rating: 'needs-improvement',
            navigationType: 'navigate',
            attribution: {
                target: 'img.hero',
                url: 'https://motolia.pl/img/hero.webp?w=800&q=80',
                timeToFirstByte: 410.4,
                resourceLoadDelay: 120.5,
                resourceLoadDuration: 900.2,
                elementRenderDelay: 33.7,
            },
        } as unknown as LCPMetricWithAttribution;

        const payload = buildVitalsPayload(metric);

        expect(payload.metric).toBe('LCP');
        expect(payload.value).toBe(2413);
        expect(payload.target).toBe('img.hero');
        expect(payload.url).toBe('https://motolia.pl/img/hero.webp');
        expect(payload.ttfb).toBe(410);
        expect(payload.loadDelay).toBe(121);
        expect(payload.loadDuration).toBe(900);
        expect(payload.renderDelay).toBe(34);
    });

    it('reports url: null for a text LCP', () => {
        const metric = {
            name: 'LCP',
            value: 1000,
            rating: 'good',
            navigationType: 'navigate',
            attribution: { target: 'h1', timeToFirstByte: 1, resourceLoadDelay: 0, resourceLoadDuration: 0, elementRenderDelay: 5 },
        } as unknown as LCPMetricWithAttribution;

        expect(buildVitalsPayload(metric).url).toBeNull();
    });

    it('builds a CLS payload converting scores to integer milli-CLS', () => {
        const metric = {
            name: 'CLS',
            value: 0.1234,
            rating: 'needs-improvement',
            navigationType: 'reload',
            attribution: {
                largestShiftTarget: 'div.banner',
                largestShiftValue: 0.0876,
                largestShiftTime: 1500.4,
                loadState: 'loading',
            },
        } as unknown as CLSMetricWithAttribution;

        const payload = buildVitalsPayload(metric);

        expect(payload.metric).toBe('CLS');
        expect(payload.value).toBe(123);
        expect(payload.shiftValue).toBe(88);
        expect(payload.shiftTime).toBe(1500);
        expect(payload.target).toBe('div.banner');
        expect(payload.loadState).toBe('loading');
        expect(payload.navigationType).toBe('reload');
    });
});
