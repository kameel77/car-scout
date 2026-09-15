import React from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';

const BATCH_SIZE = 2;
const MOBILE_QUERY = '(max-width: 639px)';

type Props = { children: React.ReactNode; className?: string };

// Keys reset the mount budget on pagination, sorting or a different result set.
export function ProgressiveListingGrid({ children, className }: Props) {
  const items = React.Children.toArray(children);
  const identity = items.map((item, index) => React.isValidElement(item) ? item.key ?? index : index).join('|');
  return <Grid key={identity} items={items} className={className} />;
}

function Grid({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const { t } = useTranslation();
  const [mobile, setMobile] = React.useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && typeof IntersectionObserver !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );
  const [count, setCount] = React.useState(() => mobile ? BATCH_SIZE : items.length);
  const [showAll, setShowAll] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const [cardHeight, setCardHeight] = React.useState(560);
  const grid = React.useRef<HTMLDivElement>(null);
  const sentinel = React.useRef<HTMLDivElement>(null);
  const visible = mobile && !printing ? Math.min(count, items.length) : items.length;
  const remaining = items.length - visible;

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => {
      const nextMobile = media.matches && typeof IntersectionObserver !== 'undefined';
      if (!nextMobile) setCount(items.length);
      setMobile(nextMobile);
    };
    media.addEventListener('change', update);
    const beforePrint = () => flushSync(() => setPrinting(true));
    const afterPrint = () => setPrinting(false);
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [items.length]);

  React.useEffect(() => {
    if (!mobile || !remaining || printing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer !== undefined) return;
      timer = setTimeout(() => setCount(n => Math.min(n + BATCH_SIZE, items.length)), 50);
    };
    if (showAll) schedule();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) schedule();
    }, { rootMargin: '600px 0px' });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => { observer.disconnect(); if (timer !== undefined) clearTimeout(timer); };
  }, [mobile, remaining, printing, showAll, items.length]);

  React.useEffect(() => {
    const first = grid.current?.firstElementChild;
    if (!first || !mobile) return;
    const measure = () => {
      const height = first.getBoundingClientRect().height;
      if (height > 0) setCardHeight(height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(first);
    return () => observer.disconnect();
  }, [mobile]);

  return <div ref={grid} className={className} data-progressive-grid data-mounted-count={visible}>
    {items.slice(0, visible)}
    {remaining > 0 && <>
      <div ref={sentinel} className="col-span-full" data-progressive-sentinel>
        <button type="button" className="w-full rounded-md border p-3 text-sm" onClick={() => setShowAll(true)} disabled={showAll}>
          {showAll
            ? t('progressiveGrid.loading', 'Wczytywanie kolejnych ofert…')
            : t('progressiveGrid.showAll', 'Pokaż wszystkie oferty na tej stronie ({{count}})', { count: items.length })}
        </button>
      </div>
      <div aria-hidden="true" className="col-span-full" style={{ height: Math.max(0, remaining * (cardHeight + 16) - 64) }} />
    </>}
  </div>;
}
