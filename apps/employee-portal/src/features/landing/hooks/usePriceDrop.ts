import { useCallback, useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Progress 0 → 1 (ease-out cubic) once the element enters the viewport.
 * Starts at 1 (final state) so no-JS-animation environments and reduced motion show final values.
 */
export function usePriceDrop(durationMs = 1800, delayMs = 500) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(1);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) clearTimeout(timer.current);
    frame.current = null;
    timer.current = null;
  };

  const play = useCallback(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setProgress(1);
      return;
    }
    stop();
    setProgress(0);
    timer.current = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        setProgress(1 - Math.pow(1 - t, 3));
        frame.current = t < 1 ? requestAnimationFrame(tick) : null;
      };
      frame.current = requestAnimationFrame(tick);
    }, delayMs);
  }, [durationMs, delayMs]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        play();
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [play]);

  return { ref, progress, replay: play };
}
