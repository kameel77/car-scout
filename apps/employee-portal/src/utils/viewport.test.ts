import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetViewportScale } from './viewport';

describe('resetViewportScale', () => {
  let meta: HTMLMetaElement;

  beforeEach(() => {
    vi.useFakeTimers();
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    document.head.appendChild(meta);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (meta.parentNode) {
      meta.parentNode.removeChild(meta);
    }
  });

  it('sets maximum-scale=1.0 and then restores scalable viewport after delay', () => {
    resetViewportScale();

    expect(meta.content).toBe('width=device-width, initial-scale=1.0, maximum-scale=1.0');

    vi.advanceTimersByTime(300);

    expect(meta.content).toBe('width=device-width, initial-scale=1.0');
  });

  it('correctly debounces and restores scalable viewport when called multiple times in rapid succession', () => {
    resetViewportScale();
    expect(meta.content).toBe('width=device-width, initial-scale=1.0, maximum-scale=1.0');

    vi.advanceTimersByTime(100);
    // Second rapid call before the first timer completes
    resetViewportScale();
    expect(meta.content).toBe('width=device-width, initial-scale=1.0, maximum-scale=1.0');

    vi.advanceTimersByTime(200);
    // Still within the 300ms window from second call
    expect(meta.content).toBe('width=device-width, initial-scale=1.0, maximum-scale=1.0');

    vi.advanceTimersByTime(100);
    // 300ms elapsed since second call -> restored to scalable
    expect(meta.content).toBe('width=device-width, initial-scale=1.0');
  });

  it('gracefully handles missing viewport meta element', () => {
    if (meta.parentNode) {
      meta.parentNode.removeChild(meta);
    }

    expect(() => resetViewportScale()).not.toThrow();
  });
});
