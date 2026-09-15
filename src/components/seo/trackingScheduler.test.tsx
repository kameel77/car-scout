import { cleanup, render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACKING_FALLBACK_MS, scheduleTrackingAfterCatalogPaint } from './trackingScheduler';

const useQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({ useQuery }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ data: undefined }) }));
vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => ({ config: { name: 'Motolia' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'pl' } }) }));
vi.mock('@/services/api', () => ({ seoApi: { getConfig: vi.fn() } }));

describe('scheduleTrackingAfterCatalogPaint', () => {
  beforeEach(() => {
    history.replaceState({}, '', '/samochody');
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => window.clearTimeout(handle));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    document.head.querySelectorAll('script[src*="googletagmanager.com"]').forEach((script) => script.remove());
    delete (window as any)._gtmLoaded;
    delete window.dataLayer;
    history.replaceState({}, '', '/');
  });

  it('waits for mounted catalog content and two frames before injecting', async () => {
    const onInject = vi.fn();
    scheduleTrackingAfterCatalogPaint({ document, window, onInject });

    document.body.innerHTML = '<div data-progressive-grid data-mounted-count="2"><article>offer</article></div>';
    await Promise.resolve();
    expect(onInject).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    expect(onInject).toHaveBeenCalledTimes(1);
  });

  it('injects early for a real interaction and does so exactly once', () => {
    const onInject = vi.fn();
    scheduleTrackingAfterCatalogPaint({ document, window, onInject });

    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(TRACKING_FALLBACK_MS);

    expect(onInject).toHaveBeenCalledTimes(1);
  });

  it('uses the bounded fallback when catalog content never appears', () => {
    const onInject = vi.fn();
    scheduleTrackingAfterCatalogPaint({ document, window, onInject, fallbackMs: 25 });

    vi.advanceTimersByTime(24);
    expect(onInject).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onInject).toHaveBeenCalledTimes(1);
  });

  it('does not wait for a catalog on the homepage', async () => {
    history.replaceState({}, '', '/');
    const onInject = vi.fn();
    scheduleTrackingAfterCatalogPaint({ document, window, onInject });
    window.dispatchEvent(new Event('load'));
    await vi.advanceTimersByTimeAsync(10);
    expect(onInject).toHaveBeenCalledTimes(1);
  });

  it('removes interactions, timers, observers and animation frames on cleanup', async () => {
    const onInject = vi.fn();
    const stop = scheduleTrackingAfterCatalogPaint({ document, window, onInject });
    document.body.innerHTML = '<div data-progressive-grid data-mounted-count="1"><article>offer</article></div>';
    await Promise.resolve();

    stop();
    window.dispatchEvent(new Event('pointerdown'));
    await vi.runAllTimersAsync();
    document.body.append(document.createElement('div'));
    await Promise.resolve();

    expect(onInject).not.toHaveBeenCalled();
  });
});

describe('SeoManager GTM scheduling', () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('script[src*="googletagmanager.com"]').forEach(script => script.remove());
    delete (window as any)._gtmLoaded;
    delete window.dataLayer;
    history.replaceState({}, '', '/');
  });
  beforeEach(() => {
    useQuery.mockReturnValue({ data: { gtmId: 'GTM-TEST' } });
    document.head.append(document.createElement('script'));
  });

  it('pushes the consent default before immediate Tag Assistant injection and retains queued events', async () => {
    history.replaceState({}, '', '/?gtm_debug=1');
    window.dataLayer = [{ event: 'queued_conversion' }];
    const { SeoManager } = await import('./SeoManager');

    render(<HelmetProvider><SeoManager /></HelmetProvider>);

    const layer = window.dataLayer!;
    expect(layer[0]).toEqual({ event: 'queued_conversion' });
    expect(Array.from(layer[1] as IArguments).slice(0, 2)).toEqual(['consent', 'default']);
    expect(layer[4]).toMatchObject({ event: 'gtm.js' });
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtm.js?id=GTM-TEST"]')).toHaveLength(1);
  });

  it('does not duplicate GTM when the effect is mounted again', async () => {
    history.replaceState({}, '', '/?gtm_debug=1');
    const { SeoManager } = await import('./SeoManager');
    const view = render(<HelmetProvider><SeoManager /></HelmetProvider>);

    view.unmount();
    render(<HelmetProvider><SeoManager /></HelmetProvider>);

    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtm.js?id=GTM-TEST"]')).toHaveLength(1);
  });
});
