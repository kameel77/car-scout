import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Listing } from '@/data/mockData';
import { ListingCard } from './ListingCard';
import { CARD_ICON_SPRITE_ID, ensureCardIconSprite } from '@/components/icons/cardIconSprite';

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
  fuel_type: 'Benzyna', transmission: 'Automatic', engine_power_hp: 150, dealer_city: 'Warszawa',
  listing_id: 'performance-test', make: 'Toyota', model: 'Corolla',
  production_year: 2025, price_pln: 100000, mileage_km: 10000,
  referenceCreditInstallment: 1000, referenceLeasingInstallment: 900,
  image_urls: [],
} as unknown as Listing;


function Harness() {
  return <MemoryRouter><ListingCard listing={listing} index={0} /></MemoryRouter>;
}

describe('ListingCard icons', () => {
  it('renders every icon as <use> pointing to an existing sprite symbol', () => {
    const { container } = render(<Harness />);
    const uses = Array.from(container.querySelectorAll('use'));
    expect(uses.length).toBe(8);
    for (const use of uses) {
      const id = use.getAttribute('href')!.slice(1);
      expect(id).toMatch(/^lc-/);
      expect(document.querySelectorAll(`symbol#${id}`).length).toBe(1);
    }
    console.log('CARD_NODES', container.querySelectorAll('*').length);
  });

  it('mounts the sprite exactly once', () => {
    ensureCardIconSprite();
    ensureCardIconSprite();
    expect(document.querySelectorAll(`#${CARD_ICON_SPRITE_ID}`).length).toBe(1);
  });
});
