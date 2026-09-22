export interface AnalyticsEventPayload {
  eventName: string;
  path?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 100% Cookieless and privacy-friendly analytics tracker.
 * Does not read or write cookies or local storage identifiers.
 * Emits events via sendBeacon or fetch keepalive when enabled.
 */
export function trackEvent(
  eventName: string,
  metadata?: Record<string, unknown>,
  apiUrl = '/api',
  analyticsEnabled = false
): void {
  if (!analyticsEnabled) return;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  const payload: AnalyticsEventPayload = {
    eventName,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
    metadata,
  };

  try {
    const cleanApiUrl = apiUrl.replace(/\/+$/, '');
    const endpoint = `${cleanApiUrl}/analytics/event`;

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Ignorujemy błędy telemetryczne
    });
  } catch {
    // Fail silently without disrupting UI
  }
}
