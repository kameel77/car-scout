import React from 'react';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroBannerCarousel } from './HeroBannerCarousel';

const loaded = vi.hoisted(() => ({ count: 0 }));
vi.mock('./HeroBannerEmbla', () => {
  loaded.count += 1;
  return { default: ({ startIndex }: { startIndex?: number }) => <div data-testid="embla" data-start={String(startIndex)} /> };
});
vi.mock('@/components/OptimizedImage', () => ({
  OptimizedImage: (p: { alt: string; priority?: boolean }) => (
    <img alt={p.alt} data-priority={String(Boolean(p.priority))} />
  ),
}));

const banner = (id: string) => ({
  id, imageUrlDesktop: `/d-${id}.jpg`, imageUrlMobile: null, altText: `alt-${id}`,
  buttonLabel: '', buttonUrl: '', buttonPositionYPct: 50, buttonAlign: 'left', sortOrder: 0,
});

function renderWith(banners: ReturnType<typeof banner>[]) {
  (window as any).__HERO_BANNERS__ = banners;
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HeroBannerCarousel /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { loaded.count = 0; });
afterEach(() => { cleanup(); delete (window as any).__HERO_BANNERS__; vi.useRealTimers(); });

describe('HeroBannerCarousel', () => {
  it('renders the static first banner and never loads the carousel for a single banner', async () => {
    renderWith([banner('a')]);
    const img = screen.getByAltText('alt-a');
    expect(img.getAttribute('data-priority')).toBe('true');
    await new Promise((r) => setTimeout(r, 1700));
    expect(loaded.count).toBe(0);
    expect(screen.queryByTestId('embla')).toBeNull();
  });

  it('shows only the first banner initially and loads the carousel after idle when there are several', async () => {
    renderWith([banner('a'), banner('b')]);
    expect(screen.getByAltText('alt-a')).toBeTruthy();
    expect(screen.queryByAltText('alt-b')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('embla')).toBeTruthy(), { timeout: 3000 });
  });

  it('waits for the window load event before loading the carousel', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    renderWith([banner('a'), banner('b')]);
    await new Promise((r) => setTimeout(r, 1700));
    expect(loaded.count).toBe(0);
    expect(screen.queryByTestId('embla')).toBeNull();
    act(() => { window.dispatchEvent(new Event('load')); });
    await waitFor(() => expect(screen.getByTestId('embla')).toBeTruthy(), { timeout: 3000 });
    readyState.mockRestore();
  });

  it('removes the load listener on unmount', () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderWith([banner('a'), banner('b')]);
    unmount();
    expect(remove).toHaveBeenCalledWith('load', expect.any(Function));
    remove.mockRestore();
    readyState.mockRestore();
  });

  it('passes the dot clicked before the carousel loaded as the initial slide', async () => {
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    renderWith([banner('a'), banner('b'), banner('c')]);
    fireEvent.click(screen.getByLabelText('Slajd 2'));
    const el = await waitFor(() => screen.getByTestId('embla'), { timeout: 3000 });
    expect(el.getAttribute('data-start')).toBe('1');
    readyState.mockRestore();
  });
});
