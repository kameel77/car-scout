import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RentalCatalogPage } from './RentalCatalogPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from '../auth/auth-api';
import * as rentalApi from './rental-api';

const mockConfig = {
  brandName: 'Finarena Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

const mockAuthenticatedEmployee: authApi.EmployeeUser = {
  id: 'acc_123',
  email: 'jan.kowalski@finarena.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  company: {
    id: 'c1',
    name: 'Finarena Sp. z o.o.',
    slug: 'finarena',
  },
  program: {
    id: 'p1',
    name: 'Program Samochodowy Finarena',
    slug: 'glowny',
  },
};

const mockRentalOffersList: rentalApi.EmployeeRentalOfferSummary[] = [
  {
    id: 'rental-offer-1',
    sourceType: 'RENTAL',
    vehicle: {
      id: 'veh-1',
      make: 'Toyota',
      model: 'Corolla',
      version: '1.8 Hybrid Comfort',
      productionYear: 2026,
      fuelType: 'HYBRID',
      transmission: 'AUTOMATIC',
      bodyType: 'KOMBI',
      primaryImageUrl: 'https://images.motolia.pl/corolla.jpg',
      imageUrls: ['https://images.motolia.pl/corolla.jpg'],
    },
    rentalCompany: {
      id: 'comp-1',
      name: 'Arval',
      logoUrl: null,
    },
    rateSource: 'PARTNER_MATRIX',
    minMonthlyRateNet: 1450,
    minMonthlyRateGross: 1783.5,
    optionsCount: 18,
    isB2b: true,
  },
  {
    id: 'rental-offer-2',
    sourceType: 'RENTAL',
    vehicle: {
      id: 'veh-2',
      make: 'Skoda',
      model: 'Octavia',
      version: '2.0 TDI Style',
      productionYear: 2025,
      fuelType: 'DIESEL',
      transmission: 'DSG',
      bodyType: 'LIFTBACK',
      primaryImageUrl: null,
      imageUrls: [],
    },
    rentalCompany: {
      id: 'comp-2',
      name: 'Athlon',
      logoUrl: null,
    },
    rateSource: 'PUBLIC_MATRIX',
    minMonthlyRateNet: 1620,
    minMonthlyRateGross: 1992.6,
    optionsCount: 12,
    isB2b: false,
  },
];

describe('RentalCatalogPage Component (E3 Long-term Rental)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.scrollTo = vi.fn();
  });

  it('renders employee info and navigation tabs in header', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: mockRentalOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      expect(screen.getByText('Finarena Sp. z o.o.')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /Samochody/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Najem długoterminowy/i })).toBeInTheDocument();

    // Open user menu to find Moje zapytania
    const userBtn = screen.getByRole('button', { name: /Menu użytkownika/i });
    fireEvent.click(userBtn);
    expect(screen.getByRole('menuitem', { name: /Moje zapytania/i })).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching offers', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockImplementation(() => new Promise(() => {}));

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('rental-skeleton')).toBeInTheDocument();
    });
  });

  it('renders rental offers list with rates and badges without Dostawca', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: mockRentalOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
      expect(screen.getByText('Škoda Octavia')).toBeInTheDocument();
    });

    expect(screen.getByText('Tylko B2B')).toBeInTheDocument();
    expect(screen.getByText('Stawka partnerska')).toBeInTheDocument();
    expect(screen.queryByText('Stawka katalogowa')).not.toBeInTheDocument();
    expect(screen.getByText(/od 1\s?450 zł/)).toBeInTheDocument();
    expect(screen.getByText(/od 1\s?620 zł/)).toBeInTheDocument();
    expect(screen.queryByText(/Dostawca:/i)).not.toBeInTheDocument();
  });

  it('renders empty state when no offers are available', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: [],
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Brak dostępnych ofert najmu')).toBeInTheDocument();
    });
  });

  it('renders error state and retries on button click', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    const mockFetch = vi
      .spyOn(rentalApi, 'fetchEmployeeRentalOffers')
      .mockRejectedValueOnce(new Error('Błąd połączenia z serwerem'))
      .mockResolvedValueOnce({ offers: mockRentalOffersList, nextCursor: null });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Nie udało się pobrać ofert najmu')).toBeInTheDocument();
      expect(screen.getByText('Błąd połączenia z serwerem')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Spróbuj ponownie/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('displays all rental offers with Tylko B2B badge on B2B offers without filter toggle', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: mockRentalOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
      expect(screen.getByText('Škoda Octavia')).toBeInTheDocument();
    });

    // Toyota Corolla has isB2b: true -> has "Tylko B2B" badge
    expect(screen.getByText('Tylko B2B')).toBeInTheDocument();

    // Click Więcej filtrów
    const moreBtn = screen.getByRole('button', { name: /Więcej filtrów/i });
    fireEvent.click(moreBtn);

    // There should NOT be any "Tylko B2B" or "Opcja B2B" filter button in filters
    expect(screen.queryByRole('button', { name: /Tylko B2B/i })).not.toBeInTheDocument();
  });

  it('filters rental offers by monthly rate preset', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: [
        {
          ...mockRentalOffersList[0],
          minMonthlyRateGross: 1350,
        },
        {
          ...mockRentalOffersList[1],
          minMonthlyRateGross: 2200,
        },
      ],
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
      expect(screen.getByText('Škoda Octavia')).toBeInTheDocument();
    });

    // Toyota Corolla minMonthlyRateGross = 1350 (< 1500)
    // Škoda Octavia minMonthlyRateGross = 2200 (1500 - 2500)
    fireEvent.click(screen.getByRole('button', { name: '< 1500' }));

    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    expect(screen.queryByText('Škoda Octavia')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1500 - 2500' }));
    expect(screen.queryByText('Toyota Corolla')).not.toBeInTheDocument();
    expect(screen.getByText('Škoda Octavia')).toBeInTheDocument();
  });

  it('renders search input inside filters card and filters offers by search term', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: mockRentalOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
      expect(screen.getByText('Škoda Octavia')).toBeInTheDocument();
    });

    const filtersCard = screen.getByTestId('filters-card');
    expect(filtersCard).toBeInTheDocument();

    const searchInput = within(filtersCard).getByPlaceholderText(/Szukaj po marce lub modelu/i);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('aria-label', 'Szukaj po marce lub modelu');

    fireEvent.change(searchInput, { target: { value: 'Corolla' } });

    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    expect(screen.queryByText('Škoda Octavia')).not.toBeInTheDocument();
  });

  it('normalizes brands and deduplicates casing variants in brand select filter', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: [
        {
          ...mockRentalOffersList[0],
          id: 'rental-hyundai-1',
          vehicle: { ...mockRentalOffersList[0].vehicle, id: 'v-h1', make: 'HYUNDAI', model: 'Tucson' },
        },
        {
          ...mockRentalOffersList[0],
          id: 'rental-hyundai-2',
          vehicle: { ...mockRentalOffersList[0].vehicle, id: 'v-h2', make: 'Hyundai', model: 'i30' },
        },
        {
          ...mockRentalOffersList[0],
          id: 'rental-merc-1',
          vehicle: { ...mockRentalOffersList[0].vehicle, id: 'v-m1', make: 'MERCEDES-BENZ', model: 'CLA' },
        },
        {
          ...mockRentalOffersList[0],
          id: 'rental-merc-2',
          vehicle: { ...mockRentalOffersList[0].vehicle, id: 'v-m2', make: 'Mercedes-Benz', model: 'GLA' },
        },
      ],
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Hyundai Tucson')).toBeInTheDocument();
    });

    const makeSelect = screen.getByLabelText(/Marka/i) as HTMLSelectElement;
    const options = Array.from(makeSelect.options).map((o) => o.text);

    // Both HYUNDAI/Hyundai and MERCEDES-BENZ/Mercedes-Benz must be normalized to single canonical entries
    const hyundaiOptions = options.filter((t) => t.toLowerCase() === 'hyundai');
    expect(hyundaiOptions).toEqual(['Hyundai']);

    const mercedesOptions = options.filter((t) => t.toLowerCase().includes('mercedes'));
    expect(mercedesOptions).toEqual(['Mercedes-Benz']);
  });

  it('includes all brands from backend availableMakes in filter dropdown even if not on first page', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: [mockRentalOffersList[0]], // Only Toyota
      availableMakes: ['BMW', 'Škoda', 'Toyota', 'Volkswagen'],
      totalCount: 4,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    });

    const makeSelect = screen.getByLabelText(/Marka/i) as HTMLSelectElement;
    const options = Array.from(makeSelect.options).map((o) => o.text);

    // Brands from availableMakes must appear in select dropdown
    expect(options).toContain('BMW');
    expect(options).toContain('Škoda');
    expect(options).toContain('Volkswagen');
    expect(options).toContain('Toyota');
  });

  it('paginates offers with 12 items per page and navigates between pages', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    // Create 15 distinct offers (12 for page 1, 3 for page 2)
    const fifteenOffers: rentalApi.EmployeeRentalOfferSummary[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockRentalOffersList[0],
      id: `rental-page-test-${i + 1}`,
      vehicle: {
        ...mockRentalOffersList[0].vehicle,
        id: `veh-p-${i + 1}`,
        model: `Model ${i + 1}`,
      },
    }));

    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: fifteenOffers,
      totalCount: 15,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    // Page 1 should show Model 1 to Model 12, but NOT Model 13
    await waitFor(() => {
      expect(screen.getByText('Toyota Model 1')).toBeInTheDocument();
      expect(screen.getByText('Toyota Model 12')).toBeInTheDocument();
    });
    expect(screen.queryByText('Toyota Model 13')).not.toBeInTheDocument();

    const paginationNav = screen.getByTestId('pagination-nav');
    expect(paginationNav).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Poprzednia strona/i });
    const nextBtn = screen.getByRole('button', { name: /Następna strona/i });

    // On page 1, prev is disabled, next is enabled
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Navigate to page 2
    fireEvent.click(nextBtn);

    // Page 2 should now show Model 13 to Model 15, but NOT Model 1
    await waitFor(() => {
      expect(screen.getByText('Toyota Model 13')).toBeInTheDocument();
      expect(screen.getByText('Toyota Model 15')).toBeInTheDocument();
    });
    expect(screen.queryByText('Toyota Model 1')).not.toBeInTheDocument();
    expect(prevBtn).toBeEnabled();
    expect(nextBtn).toBeDisabled();

    // Verify window.scrollTo was called
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('resets pagination to page 1 when any filter is changed', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    const fifteenOffers: rentalApi.EmployeeRentalOfferSummary[] = Array.from({ length: 15 }, (_, i) => ({
      ...mockRentalOffersList[0],
      id: `rental-reset-test-${i + 1}`,
      vehicle: {
        ...mockRentalOffersList[0].vehicle,
        id: `veh-r-${i + 1}`,
        model: `Model ${i + 1}`,
      },
    }));

    vi.spyOn(rentalApi, 'fetchEmployeeRentalOffers').mockResolvedValue({
      offers: fifteenOffers,
      totalCount: 15,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <RentalCatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Model 1')).toBeInTheDocument();
    });

    // Go to page 2
    const nextBtn = screen.getByRole('button', { name: /Następna strona/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Toyota Model 13')).toBeInTheDocument();
    });

    // Change search term to 'Toyota' (matches all 15 offers)
    const filtersCard = screen.getByTestId('filters-card');
    const searchInput = within(filtersCard).getByPlaceholderText(/Szukaj po marce lub modelu/i);
    fireEvent.change(searchInput, { target: { value: 'Toyota' } });

    // Should reset to page 1, showing Model 1 and disabling previous page button
    await waitFor(() => {
      expect(screen.getByText('Toyota Model 1')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Poprzednia strona/i })).toBeDisabled();
    expect(screen.queryByText('Toyota Model 13')).not.toBeInTheDocument();
  });
});

