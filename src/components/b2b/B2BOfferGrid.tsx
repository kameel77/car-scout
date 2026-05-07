import React from 'react';
import { useB2BOfferList } from '@/hooks/useB2BOfferList';
import { B2BListingCard } from './B2BListingCard';

interface Props {
  ids?: string[];
  onLoadComplete?: () => void;
}

export function B2BOfferGrid({ ids, onLoadComplete }: Props) {
  const { data, isLoading, error } = useB2BOfferList(ids);

  React.useEffect(() => {
    if (!isLoading && !error && data) {
      onLoadComplete?.();
    }
  }, [isLoading, error, data, onLoadComplete]);

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Wczytywanie ofert…</div>;
  }
  if (error || !data || data.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">Brak aktualnych ofert.</div>;
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-4">Aktualne oferty</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((offer) => (
          <B2BListingCard key={offer.id} offer={offer} />
        ))}
      </div>
    </section>
  );
}
