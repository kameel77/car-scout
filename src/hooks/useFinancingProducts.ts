import { useQuery } from '@tanstack/react-query';
import { financingApi } from '@/services/api';
import type { FinancingProduct } from '@/types/financing';

export function useFinancingProducts(): FinancingProduct[] {
  const { data } = useQuery({
    queryKey: ['financing-calculator'],
    queryFn: () => financingApi.listPublic(),
    staleTime: 5 * 60 * 1000,
  });
  return (data?.products ?? []) as FinancingProduct[];
}
