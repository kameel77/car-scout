import { useSearchParams } from 'react-router-dom';

const UTM = {
  utm_source: 'partner_mailing',
  utm_medium: 'pdf',
  utm_campaign: 'link4',
} as const;

/**
 * In print mode (`?print=1`), appends UTM params and — when `publicBase` query
 * param is provided — rewrites relative URLs as absolute against that public
 * domain. Without `publicBase`, returns the URL as a relative path so PDF
 * readers resolve against the document's base URL.
 */
export function useTrackedUrl(url: string): string {
  const [params] = useSearchParams();
  const isPrintMode = params.get('print') === '1';
  if (!isPrintMode) return url;

  const publicBase = params.get('publicBase');
  const isRelative = url.startsWith('/');

  if (isRelative && publicBase) {
    try {
      const u = new URL(url, publicBase);
      for (const [k, v] of Object.entries(UTM)) {
        u.searchParams.set(k, v);
      }
      return u.toString();
    } catch {
      // fall through to relative handling on malformed publicBase
    }
  }

  if (isRelative) {
    const u = new URL(url, 'http://_local');
    for (const [k, v] of Object.entries(UTM)) {
      u.searchParams.set(k, v);
    }
    return `${u.pathname}${u.search}${u.hash}`;
  }

  const u = new URL(url);
  for (const [k, v] of Object.entries(UTM)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}
