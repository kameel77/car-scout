import { useQuery } from '@tanstack/react-query';
import { seoContentApi } from '../services/api';
import type { PublicSeoContent } from '../types/seo-content';

// Treść CMS (F2) dla stron marek/modeli (/samochody/:marka[/:model]) — tylko opublikowana.
export function useSeoContent(path: string | undefined) {
    return useQuery<PublicSeoContent | null>({
        queryKey: ['seo-content', path],
        queryFn: () => seoContentApi.getPublic(path!),
        enabled: !!path,
        staleTime: 60 * 1000,
    });
}
