import React from 'react';
import { useB2BOfferList } from '@/hooks/useB2BOfferList';
import { B2BListingCard } from './B2BListingCard';

interface Props {
  ids?: string[];
  onLoadComplete?: () => void;
}

export function B2BOfferGrid({ ids, onLoadComplete }: Props) {
  const { data, isLoading, error } = useB2BOfferList(ids);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isLoading || error || !data) return;

    if (data.length === 0) {
      onLoadComplete?.();
      return;
    }

    // Wait for all <img> tags inside the grid to finish loading before signaling
    // ready — otherwise Puppeteer may snapshot before thumbnails resolve.
    const imgs = Array.from(
      containerRef.current?.querySelectorAll('img') ?? []
    ) as HTMLImageElement[];
    if (imgs.length === 0) {
      onLoadComplete?.();
      return;
    }

    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) onLoadComplete?.();
    };
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        done();
      } else {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }
    });
  }, [isLoading, error, data, onLoadComplete]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Wczytywanie ofert…</div>;
  }
  if (error || !data || data.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Brak aktualnych ofert.</div>;
  }

  return (
    <section className="mb-8 print:mb-3">
      <h2 className="text-2xl font-bold mb-4 print:text-base print:mb-2">Aktualne oferty</h2>
      <div
        ref={containerRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2"
      >
        {data.map((offer) => (
          <B2BListingCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}
