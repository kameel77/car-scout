import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { B2BListingCard } from '../B2BListingCard';

const mockOffer = {
  id: 'abc12345abc12345abc12345',
  make: 'BMW',
  model: 'X5',
  version: 'xDrive40i',
  productionYear: 2024,
  pricePln: 250000,
  mileageKm: 5000,
  bodyType: 'suv',
  fuelType: 'benzyna',
  imageUrls: ['/test.jpg'],
  primaryImageUrl: '/primary.jpg',
};

afterEach(cleanup);

describe('B2BListingCard', () => {
  it('renders make/model/year/price', () => {
    render(
      <MemoryRouter>
        <B2BListingCard offer={mockOffer as any} />
      </MemoryRouter>
    );
    expect(screen.getByText(/BMW X5/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/250.000/)).toBeInTheDocument();
  });

  it('renders link to offer detail page', () => {
    render(
      <MemoryRouter>
        <B2BListingCard offer={mockOffer as any} />
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /Zobacz ofertę/i });
    // getListingUrlPath returns /kredyt/<slug>-<id> (default financing type)
    expect(link.getAttribute('href')).toMatch(/^\/(oferta|kredyt|leasing|wynajem-dlugoterminowy)\/.+abc12345abc12345abc12345$/);
  });

  it('shows approximate kredyt and leasing rates', () => {
    render(
      <MemoryRouter>
        <B2BListingCard offer={mockOffer as any} />
      </MemoryRouter>
    );
    // 250000 * 0.014 = 3500; 250000 * 0.012 = 3000
    const kredytEl = screen.getByTestId('kredyt-rate');
    const leasingEl = screen.getByTestId('leasing-rate');
    expect(kredytEl.textContent).toMatch(/Kredyt od/i);
    expect(kredytEl.textContent).toMatch(/3.?500/);
    expect(leasingEl.textContent).toMatch(/Leasing od/i);
    expect(leasingEl.textContent).toMatch(/3.?000/);
  });
});
