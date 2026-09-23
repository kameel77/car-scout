let resetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Resets the mobile viewport scale to 100% (1.0) when an input field loses focus (active -> inactive).
 *
 * In iOS Safari, focusing on an input element with font-size < 16px or manual pinch-zooming
 * alters the visual viewport scale. Safari does not restore the viewport scale upon blur.
 * Temporarily applying `maximum-scale=1.0` forces WebKit / mobile browsers to clamp
 * the viewport scale back to 1.0 (100% width). We then restore the standard scalable
 * configuration after layout adjustment so pinch-to-zoom accessibility remains functional.
 */
export function resetViewportScale(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewportMeta) return;

  // Clear any pending timer to debounce rapid blurs and prevent race conditions
  if (resetTimer !== null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  // Force scale back to 1.0 (100% width)
  viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0';

  // Always restore standard scalable viewport after layout engine settles
  resetTimer = setTimeout(() => {
    viewportMeta.content = 'width=device-width, initial-scale=1.0';
    resetTimer = null;
  }, 300);
}
