import { describe, it, expect } from 'vitest';
import { buildInpPayload } from '@/lib/inpReporter';
import type { INPMetricWithAttribution } from 'web-vitals/attribution';

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
