import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  },
];

describe('RentalCatalogPage Component (E3 Long-term Rental)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    expect(screen.getByRole('link', { name: /Katalog ofert/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Najem długoterminowy/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Moje zapytania/i })).toBeInTheDocument();
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

  it('renders rental offers list with rates and badges', async () => {
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
      expect(screen.getByText('Skoda Octavia')).toBeInTheDocument();
    });

    expect(screen.getByText('Stawka partnerska')).toBeInTheDocument();
    expect(screen.getByText('Stawka katalogowa')).toBeInTheDocument();
    expect(screen.getByText(/od 1\s?450 zł/)).toBeInTheDocument();
    expect(screen.getByText(/od 1\s?620 zł/)).toBeInTheDocument();
    expect(screen.getByText('Dostawca: Arval')).toBeInTheDocument();
    expect(screen.getByText('Dostawca: Athlon')).toBeInTheDocument();
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
});
