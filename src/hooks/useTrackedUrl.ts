import { useSearchParams } from 'react-router-dom';

const UTM = {
  utm_source: 'partner_mailing',
  utm_medium: 'pdf',
  utm_campaign: 'link4',
} as const;

export function useTrackedUrl(url: string): string {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';
  if (!isPrintMode) return url;

  // Handle relative URLs by anchoring to a dummy origin
  const isRelative = url.startsWith('/');
  const base = isRelative ? 'http://_local' : window.location.origin;
  const u = new URL(url, base);
  for (const [k, v] of Object.entries(UTM)) {
    u.searchParams.set(k, v);
  }
  return isRelative ? `${u.pathname}${u.search}${u.hash}` : u.toString();
}
