import { useQuery } from '@tanstack/react-query';
import { readSsrJson } from '@/lib/ssrData';

let apiBaseUrl = import.meta.env.VITE_API_URL ?? '';
apiBaseUrl = apiBaseUrl.replace(/\/api\/?$/, '');

export interface GuideArticle {
  path: string;
  h1: string;
  title: string;
  description: string;
  breadcrumb: string;
  hub: string;
  author: { name: string; bio: string };
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  ogImage: string;
  readingMinutes: number;
  leadHtml: string;
  html: string;
  toc: Array<{ id: string; text: string }>;
  faq: Array<{ question: string; answer: string }>;
  sourcesHtml: string;
  disclaimer: string;
}

/**
 * Treść poradnika: SSR (render.ts) wstrzykuje ją jako blok JSON `guide-article` dla żądanej ścieżki,
 * więc pierwszy render nie czeka na API. Nawigacja w SPA dociąga treść z /api/content/guide.
 */
export function useGuideArticle(path: string) {
  const ssr = readSsrJson<GuideArticle>('guide-article');
  const initialData = ssr && ssr.path === path ? ssr : undefined;
  return useQuery<GuideArticle | null>({
    queryKey: ['guide-content', path],
    queryFn: async () => {
      const res = await fetch(`${apiBaseUrl}/api/content/guide?path=${encodeURIComponent(path)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch guide content');
      return res.json();
    },
    initialData,
    staleTime: 60 * 60 * 1000,
  });
}
