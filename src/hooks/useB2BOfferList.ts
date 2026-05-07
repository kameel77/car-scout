import { useQuery } from '@tanstack/react-query';

export interface B2BOffer {
  id: string;
  make: string;
  model: string;
  version?: string | null;
  productionYear: number;
  pricePln: number;
  mileageKm: number;
  bodyType?: string | null;
  fuelType?: string | null;
  imageUrls?: string[];
  primaryImageUrl?: string | null;
  isFeatured?: boolean;
  isArchived?: boolean;
  // Backend `Listing` model includes these fields and more (dealer relation included server-side)
  [key: string]: any;
}

export function useB2BOfferList(ids?: string[]) {
  const idsParam = ids && ids.length > 0 ? `?ids=${encodeURIComponent(ids.join(','))}` : '';

  return useQuery({
    queryKey: ['b2b-offers', ids ?? 'default'],
    queryFn: async () => {
      const res = await fetch(`/api/onepager/offers${idsParam}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as { offers: B2BOffer[] };
      return data.offers;
    },
    staleTime: 5 * 60 * 1000,
  });
}
