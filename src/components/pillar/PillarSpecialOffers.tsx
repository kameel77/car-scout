import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listingsApi } from '@/services/api';
import { mapBackendListingToFrontend } from '@/utils/listingMapper';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { PILLAR_OFFERS, type PillarType } from './pillarContent';

const OFFERS_COUNT = 4;

/**
 * 4 „oferty specjalne” na nowe auta — ta sama zasada co elementy promowane na stronie głównej:
 * sort `recommended` stawia wyróżnione (isFeatured) na górze, resztę uzupełnia najnowszymi.
 */
export function usePillarSpecialOffers(type: PillarType) {
  const { data, isLoading } = useQuery({
    queryKey: ['pillar-special-offers', type],
    queryFn: async () => {
      const res = await listingsApi.getListings({
        statuses: ['NEW'],
        sortBy: 'recommended',
        currency: 'PLN',
        page: 1,
        perPage: OFFERS_COUNT,
      }, null);
      return (res.listings ?? []).map(mapBackendListingToFrontend).filter(Boolean);
    },
    staleTime: 5 * 60 * 1000,
  });
  return { listings: (data ?? []).slice(0, OFFERS_COUNT), isLoading };
}

export function PillarSpecialOffers({ type }: { type: PillarType }) {
  const copy = PILLAR_OFFERS[type];
  const { listings, isLoading } = usePillarSpecialOffers(type);
  if (!isLoading && listings.length === 0) return null;

  return (
    <section aria-labelledby="oferty-specjalne-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 id="oferty-specjalne-title" className="text-2xl font-bold">{copy.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{copy.text}</p>
        </div>
        <Link to={copy.moreHref} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Sprawdź więcej <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {isLoading
          ? Array.from({ length: OFFERS_COUNT }).map((_, i) => <ListingCardSkeleton key={i} />)
          : listings.map((listing: any, index: number) => (
              <ListingCard key={listing.listing_id} listing={listing} index={index} />
            ))}
      </div>
    </section>
  );
}
