import { useQuery } from '@tanstack/react-query';
import { readSsrJson } from '@/lib/ssrData';

let apiBaseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.MODE === 'development' ? '' : '');
apiBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');

export type FinancingContentType = 'leasing' | 'leasing-konsumencki' | 'kredyt' | 'wynajem';

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
  // SSR (render.ts) embeds the article of the requested pillar path; use it only when it is the same
  // type, so SPA navigation between pillar pages still fetches the other article.
  const ssr = readSsrJson<FinancingArticle & { type?: string }>('financing-article');
  const initialData = ssr && ssr.type === type ? { h1: ssr.h1, html: ssr.html } : undefined;
  return useQuery<FinancingArticle | null>({
    queryKey: ['financing-content', type],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/api/content/financing/${type}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch financing content');
      return res.json();
    },
    enabled: type !== null,
    initialData,
    staleTime: 60 * 60 * 1000,
  });
}
