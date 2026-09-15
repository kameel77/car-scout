const CATALOG_SELECTOR = '[data-progressive-grid][data-mounted-count]:not([data-mounted-count="0"])';

export const TRACKING_FALLBACK_MS = 3_500;

type ScheduleTrackingOptions = {
  document: Document;
  window: Window & typeof globalThis;
  onInject: () => void;
  fallbackMs?: number;
};

/**
 * Runs tracking once the first client-rendered catalog cards have had a chance
 * to paint. A real interaction remains an intentional fast path, while the
 * fallback keeps tracking bounded on routes without a catalog or with failures.
 */
export function scheduleTrackingAfterCatalogPaint({
  document,
  window,
  onInject,
  fallbackMs = TRACKING_FALLBACK_MS,
}: ScheduleTrackingOptions): () => void {
  let settled = false;
  let fallbackTimer: number | undefined;
  let observer: MutationObserver | undefined;
  const animationFrames = new Set<number>();
  const isCatalog = /^\/(samochody|nowe|uzywane|wynajem-dlugoterminowy|leasing|kredyt)(\/|$)/.test(window.location.pathname);
  const interactionEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];

  const cancelAnimationFrames = () => {
    animationFrames.forEach((frame) => window.cancelAnimationFrame(frame));
    animationFrames.clear();
  };

  const removeInteractions = () => {
    interactionEvents.forEach((eventName) => window.removeEventListener(eventName, onInteraction));
  };

  const cleanup = () => {
    window.removeEventListener('load', afterPaint);
    removeInteractions();
    observer?.disconnect();
    observer = undefined;
    if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
    cancelAnimationFrames();
  };

  const settle = () => {
    if (settled) return;
    settled = true;
    cleanup();
    onInject();
  };

  const onInteraction = () => settle();

  const afterPaint = () => {
    if (settled || animationFrames.size > 0) return;
    const firstFrame = window.requestAnimationFrame(() => {
      animationFrames.delete(firstFrame);
      const secondFrame = window.requestAnimationFrame(() => {
        animationFrames.delete(secondFrame);
        settle();
      });
      animationFrames.add(secondFrame);
    });
    animationFrames.add(firstFrame);
  };

  const checkCatalogReadiness = () => {
    if (document.querySelector(CATALOG_SELECTOR)) afterPaint();
  };

  interactionEvents.forEach((eventName) => {
    window.addEventListener(eventName, onInteraction, { passive: true });
  });

  fallbackTimer = window.setTimeout(settle, fallbackMs);
  if (isCatalog) {
    observer = new window.MutationObserver(checkCatalogReadiness);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mounted-count'] });
    checkCatalogReadiness();
  } else if (document.readyState === 'complete') {
    afterPaint();
  } else {
    window.addEventListener('load', afterPaint, { once: true });
  }

  return () => {
    if (settled) return;
    settled = true;
    cleanup();
  };
}
