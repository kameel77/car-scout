import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Listing } from '@/data/mockData';
import { ListingCard } from './ListingCard';

const calls = vi.hoisted(() => ({ settings: vi.fn(() => ({ data: { displayCurrency: 'PLN' } })) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSettings: calls.settings }));
vi.mock('@/contexts/PriceSettingsContext', () => ({ usePriceSettings: () => ({ priceType: 'gross' }) }));
vi.mock('@/contexts/SpecialOfferContext', () => ({ useSpecialOffer: () => ({ discount: 0, hasSpecialOffer: false }) }));
vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => ({ config: { id: 'motolia' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'pl' } }) }));
vi.mock('@/components/ImageSwiper', () => ({ ImageSwiper: () => <div data-testid="image" /> }));
vi.mock('@/lib/analytics', () => ({ trackSelectItem: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const listing = {
  listing_id: 'performance-test', make: 'Toyota', model: 'Corolla',
  production_year: 2025, price_pln: 100000, mileage_km: 10000,
  referenceCreditInstallment: 1000, referenceLeasingInstallment: 900,
  image_urls: [],
} as unknown as Listing;

function Harness({ value, item = listing }: { value: number; item?: Listing }) {
  return <MemoryRouter><TooltipProvider delayDuration={0}>
    <span>{value}</span><ListingCard listing={item} index={0} />
  </TooltipProvider></MemoryRouter>;
}

describe('ListingCard render budget', () => {
  it('does not rerender a card when only unrelated parent state changes', () => {
    const { rerender } = render(<Harness value={0} />);
    const initial = calls.settings.mock.calls.length;
    expect(initial).toBeGreaterThan(0);
    rerender(<Harness value={1} />);
    expect(calls.settings.mock.calls.length).toBe(initial);
  });

  it('rerenders when listing data changes', () => {
    const { rerender } = render(<Harness value={0} />);
    const initial = calls.settings.mock.calls.length;
    rerender(<Harness value={0} item={{ ...listing, price_pln: 120000 }} />);
    expect(calls.settings.mock.calls.length).toBeGreaterThan(initial);
  });
});
