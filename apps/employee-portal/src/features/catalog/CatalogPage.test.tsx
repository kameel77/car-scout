import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CatalogPage } from './CatalogPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from '../auth/auth-api';
import * as catalogApi from './catalog-api';

const mockConfig = {
  brandName: 'Action Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

const mockAuthenticatedEmployee: authApi.EmployeeUser = {
  id: 'acc_123',
  email: 'jan.kowalski@action.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  company: {
    id: 'c1',
    name: 'Action S.A.',
    slug: 'action',
  },
  program: {
    id: 'p1',
    name: 'Action Flota Plus',
    slug: 'action-flota',
  },
};

const mockOffersList: catalogApi.EmployeeOffer[] = [
  {
    id: 'offer_yaris',
    sourceType: 'FINANCING',
    vehicle: {
      make: 'Toyota',
      model: 'Yaris',
      version: 'Yaris Hybrid 1.5 Comfort',
      productionYear: 2026,
      fuelType: 'HYBRID',
      transmission: 'AUTOMATIC',
      bodyType: 'HATCHBACK',
      primaryImageUrl: 'https://images.motolia.pl/yaris.jpg',
      imageUrls: ['https://images.motolia.pl/yaris.jpg'],
    },
    pricing: {
      listPricePln: 71900,
      employeePricePln: 66148,
      savingsPln: 5752,
      discountPct: 8.0,
    },
    benefit: {
      name: 'Pakiet Powitalny Moya',
      moyaCardAmount: 500,
      fuelDiscount: '15 gr/l',
      consultantCare: true,
      termsText: null,
    },
  },
  {
    id: 'offer_tayron',
    sourceType: 'FINANCING',
    vehicle: {
      make: 'Volkswagen',
      model: 'Tayron',
      version: 'Tayron 1.5 eTSI Elegance',
      productionYear: 2026,
      fuelType: 'MILD_HYBRID',
      transmission: 'AUTOMATIC',
      bodyType: 'SUV',
      primaryImageUrl: null,
      imageUrls: [],
    },
    pricing: {
      listPricePln: 173900,
      employeePricePln: 159988,
      savingsPln: 13912,
      discountPct: 8.0,
    },
    benefit: null,
  },
];

describe('CatalogPage Component (P3b Private Employee Catalog)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders employee info and company/program badges in header', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: mockOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      expect(screen.getAllByText('Action S.A.').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Action Flota Plus').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders live offers list with exact pricing, discount badges, and benefit packages', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: mockOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('catalog-offers-grid')).toBeInTheDocument();
    });

    // Toyota Yaris
    expect(screen.getByText(/Toyota Yaris/i)).toBeInTheDocument();
    expect(screen.getByText(/Yaris Hybrid 1.5 Comfort/i)).toBeInTheDocument();
    expect(screen.getByText(/66[\s\u00a0]148[\s\u00a0]zł/)).toBeInTheDocument();
    expect(screen.getByText(/71[\s\u00a0]900[\s\u00a0]zł/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Oszczędzasz') && content.includes('5') && content.includes('752'))).toBeInTheDocument();
    expect(screen.getByText(/Pakiet Powitalny Moya/i)).toBeInTheDocument();
    expect(screen.getByText(/Karta 500 zł/i)).toBeInTheDocument();

    // Volkswagen Tayron
    expect(screen.getByText(/Volkswagen Tayron/i)).toBeInTheDocument();
    expect(screen.getByText(/Tayron 1.5 eTSI Elegance/i)).toBeInTheDocument();
    expect(screen.getByText(/159[\s\u00a0]988[\s\u00a0]zł/)).toBeInTheDocument();
    expect(screen.getByText(/173[\s\u00a0]900[\s\u00a0]zł/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Oszczędzasz') && content.includes('13') && content.includes('912'))).toBeInTheDocument();

    // Discount badges (-8%)
    expect(screen.getAllByText(/-8%/i).length).toBe(2);
  });

  it('renders empty state when program has no assigned offers (no "w przygotowaniu")', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: [],
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Brak ofert przypisanych do Twojego programu/i })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/W tej chwili w Twoim programie partnerskim nie ma dostępnych ofert specjalnych/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/w przygotowaniu/i)).not.toBeInTheDocument();
  });

  it('renders error state when fetch fails and allows retry via "Spróbuj ponownie"', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    const fetchOffersSpy = vi
      .spyOn(catalogApi, 'fetchEmployeeOffers')
      .mockRejectedValueOnce(new Error('Błąd połączenia z serwerem'))
      .mockResolvedValueOnce({
        offers: mockOffersList,
        nextCursor: null,
      });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Nie udało się załadować ofert/i })).toBeInTheDocument();
      expect(screen.getByText('Błąd połączenia z serwerem')).toBeInTheDocument();
    });

    // Retry button click
    const retryBtn = screen.getByRole('button', { name: /Spróbuj ponownie/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('catalog-offers-grid')).toBeInTheDocument();
      expect(screen.getByText(/Toyota Yaris/i)).toBeInTheDocument();
    });

    expect(fetchOffersSpy).toHaveBeenCalledTimes(2);
  });

  it('handles logout button click successfully', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: [],
      nextCursor: null,
    });
    const logoutSpy = vi.spyOn(authApi, 'logoutEmployee').mockResolvedValue();

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Wyloguj/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Wyloguj/i }));

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledWith('/api');
    });
  });

  it('displays error banner when logout fails and retains authenticated user view', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: [],
      nextCursor: null,
    });
    vi.spyOn(authApi, 'logoutEmployee').mockRejectedValue(new Error('Nie udało się wylogować (500)'));

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Wyloguj/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Wyloguj/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Nie udało się wylogować \(500\)/i)).toBeInTheDocument();
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    });
  });

  it('opens InquiryModal when clicking Zapytaj o tę ofertę button on offer card', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
    vi.spyOn(catalogApi, 'fetchEmployeeOffers').mockResolvedValue({
      offers: mockOffersList,
      nextCursor: null,
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter>
            <CatalogPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Toyota Yaris')).toBeInTheDocument();
    });

    const inquiryButtons = screen.getAllByRole('button', { name: /Zapytaj o tę ofertę/i });
    expect(inquiryButtons.length).toBeGreaterThan(0);
    fireEvent.click(inquiryButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Zapytaj o tę ofertę/i })).toBeInTheDocument();
    });
  });
});
