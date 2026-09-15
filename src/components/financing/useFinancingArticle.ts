import { useQuery } from '@tanstack/react-query';

let apiBaseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.MODE === 'development' ? '' : '');
apiBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');

export type FinancingContentType = 'leasing' | 'kredyt' | 'wynajem';

export interface FinancingArticle {
  h1: string;
  html: string;
}

/**
 * Lightweight shared query for the pillar article. Keeping it independent from the
 * below-the-fold FAQ renderer lets SearchPage retain its H1 and lead without loading
 * accordion, markdown, and CMS FAQ dependencies.
 */
export function useFinancingArticle(type: FinancingContentType | null) {
  return useQuery<FinancingArticle | null>({
    queryKey: ['financing-content', type],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/api/content/financing/${type}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch financing content');
      return res.json();
    },
    enabled: type !== null,
    staleTime: 60 * 60 * 1000,
  });
}
