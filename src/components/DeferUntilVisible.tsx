import React, { useEffect, useRef, useState } from 'react';

interface DeferUntilVisibleProps {
  /** Klasy placeholdera (np. min-h-[24rem]) — rezerwuje miejsce do czasu zamontowania dzieci. */
  placeholderClassName?: string;
  rootMargin?: string;
  children: React.ReactNode;
}

/**
 * Montuje dzieci dopiero, gdy placeholder zbliży się do viewportu.
 * Bez IntersectionObserver renderuje dzieci od razu.
 */
export function DeferUntilVisible({
  placeholderClassName,
  rootMargin = '800px 0px',
  children,
}: DeferUntilVisibleProps) {
  const hasObserver = typeof IntersectionObserver !== 'undefined';
  const [visible, setVisible] = useState(!hasObserver);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;
  return <div ref={ref} className={placeholderClassName} />;
}
