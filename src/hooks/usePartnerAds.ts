import { useQuery } from '@tanstack/react-query';
import { partnerAdsApi } from '@/services/api';
import { AdPlacement } from '@/types/partnerAds';

export function usePartnerAds(placement?: AdPlacement) {
    return useQuery({
        queryKey: ['partner-ads', placement],
        queryFn: () => partnerAdsApi.list(placement),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
