import { useQuery } from '@tanstack/react-query';
import { partnerAdsApi } from '@/services/api';
import { AdPlacement, AdPageContext } from '@/types/partnerAds';

export function usePartnerAds(placement?: AdPlacement, pageContext?: AdPageContext) {
    return useQuery({
        queryKey: ['partner-ads', placement, pageContext],
        queryFn: () => partnerAdsApi.list(placement, pageContext),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
