import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinancingArticle } from '../useFinancingArticle';
import { clearSsrDataCache } from '@/lib/ssrData';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useFinancingArticle SSR initialData', () => {
  beforeEach(() => {
    clearSsrDataCache();
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'financing-article';
    el.textContent = JSON.stringify({ type: 'leasing', h1: 'SSR H1', html: '<p>SSR lead</p>' });
    document.head.appendChild(el);
  });
  afterEach(() => {
    document.getElementById('financing-article')?.remove();
    clearSsrDataCache();
    vi.unstubAllGlobals();
  });

  it('uses the SSR block for the matching type without fetching', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFinancingArticle('leasing'), { wrapper });
    expect(result.current.data).toEqual({ h1: 'SSR H1', html: '<p>SSR lead</p>' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores the SSR block for another type and fetches it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ h1: 'Kredyt H1', html: '<p>k</p>' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFinancingArticle('kredyt'), { wrapper });
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.h1).toBe('Kredyt H1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
