const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const normalizeBase = (base: string) => base.replace(/\/+$/, '');

const apiBaseWithoutApi = () => {
  const base = normalizeBase(API_BASE_URL);
  const trimmed = base.replace(/\/api$/i, '');
  return trimmed === '/api' ? '' : trimmed;
};

export function buildAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;

  const base = apiBaseWithoutApi();
  if (!base) return url;

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  return `${base}${normalizedUrl}`;
}
