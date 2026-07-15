import { useQuery } from '@tanstack/react-query';
import type { B2BOffer } from './useB2BOfferList';

export function useBusinessOfferList() {
  return useQuery({
    queryKey: ['business-offers'],
    queryFn: async () => {
      const res = await fetch('/api/business/offers');
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as { offers: B2BOffer[] };
      return data.offers;
    },
    staleTime: 5 * 60 * 1000,
  });
}
