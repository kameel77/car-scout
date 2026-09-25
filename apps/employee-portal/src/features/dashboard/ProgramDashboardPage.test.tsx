import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProgramDashboardPage } from './ProgramDashboardPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from '../auth/auth-api';

const mockConfig = {
  brandName: 'Benefivo',
  brandLogoUrl: '/static/logo-dark.svg',
  portalUrl: '',
  apiUrl: '/api',
};

const mockEmployeeUser: authApi.EmployeeUser = {
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

describe('ProgramDashboardPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders employee program status, benefits, and quick access cards', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockEmployeeUser);

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <ProgramDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      expect(
        screen.getByText(/Program aktywny dla organizacji Action S\.A\./i)
      ).toBeInTheDocument();
    });

    // Heading
    expect(
      screen.getByRole('heading', {
        name: 'Dedykowana oferta samochodów dla pracowników',
        level: 1,
      })
    ).toBeInTheDocument();

    // Benefits
    expect(screen.getByText(/Pakiet benefitów w Twoim programie/i)).toBeInTheDocument();
    expect(screen.getAllByText('Rabat od ceny katalogowej')[0]).toBeInTheDocument();
    expect(screen.getByText('Karta Moya')).toBeInTheDocument();
    expect(screen.getByText('Opieka doradcy Motolii')).toBeInTheDocument();

    // Quick access cards & links
    const carsLink = screen.getByRole('link', { name: /Przeglądaj samochody/i });
    expect(carsLink).toHaveAttribute('href', '/katalog');

    const rentalLink = screen.getByRole('link', { name: /Przeglądaj najem/i });
    expect(rentalLink).toHaveAttribute('href', '/najem');

    const inquiriesLink = screen.getByRole('link', { name: /Zobacz zapytania/i });
    expect(inquiriesLink).toHaveAttribute('href', '/zapytania');

    // How it works section
    expect(
      screen.getByRole('heading', {
        name: /Jak działa program partnerski Benefivo\?/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Rabat od ceny katalogowej')).toHaveLength(2);
    expect(screen.getByText('Wybór B2B lub prywatnie')).toBeInTheDocument();
    expect(screen.getByText('0 zł ukrytych opłat')).toBeInTheDocument();
    expect(screen.getByText('Dedykowany doradca')).toBeInTheDocument();

    // 4 Steps
    expect(
      screen.getByRole('heading', {
        name: /Krok po kroku: Jak odebrać auto\?/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Wybór auta i kalkulacja')).toBeInTheDocument();
    expect(screen.getByText('Bezpłatne zapytanie online')).toBeInTheDocument();
    expect(screen.getByText('Rozmowa z doradcą w 24h')).toBeInTheDocument();
    expect(screen.getByText('Podpisanie umowy i odbiór')).toBeInTheDocument();

    // Support section
    expect(screen.getByText('kontakt@benefivo.pl')).toBeInTheDocument();
  });

  it('renders fallback company and program name when user data is generic', async () => {
    const genericUser: authApi.EmployeeUser = {
      ...mockEmployeeUser,
      company: { id: 'c2', name: '', slug: '' },
      program: { id: 'p2', name: '', slug: '' },
    };
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(genericUser);

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <ProgramDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Program aktywny dla organizacji Twojej firmy/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Pakiet benefitów w Twoim programie/i)
      ).toBeInTheDocument();
    });
  });

  it('renders custom brand name and support email from brand config', async () => {
    const customConfig = {
      ...mockConfig,
      brandName: 'PartnerAuto',
      b2bEmail: 'pomoc@partnerauto.pl',
    };
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockEmployeeUser);

    render(
      <BrandProvider initialConfig={customConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <ProgramDashboardPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: /Jak działa program partnerski PartnerAuto\?/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText('pomoc@partnerauto.pl')).toBeInTheDocument();
    });
  });
});
