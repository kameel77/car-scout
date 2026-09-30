import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../Header';

vi.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ data: { navItemsVisibility: ['samochody'], enabledLanguages: ['pl'] }, isLoading: false }),
}));
vi.mock('@/contexts/PersonalOfferContext', () => ({ usePersonalOffer: () => ({ hasPersonalOffer: false }) }));
vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => ({ config: { name: 'Motolia', logo: {} } }) }));
vi.mock('@/lib/analytics', () => ({ trackPhoneClick: vi.fn() }));

describe('Header mobile menu', () => {
  afterEach(cleanup);

  it('opens on "Menu główne" click, shows nav links, and closes on link click', async () => {
    render(<MemoryRouter><Header /></MemoryRouter>);
    fireEvent.click(screen.getByLabelText('Menu główne'));

    const dialog = await screen.findByRole('dialog');
    const link = await within(dialog).findByText('Znajdź auto');
    expect(link).toBeInTheDocument();

    fireEvent.click(link);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
