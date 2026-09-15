import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CatalogPage } from './CatalogPage';
import { AuthProvider } from '../auth/AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from '../auth/auth-api';

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

describe('CatalogPage Component (Authenticated & Honest Placeholder)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders employee info and company/program badges in header', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

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

  it('renders honest catalog placeholder behind authentication (no false live listings)', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

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
      expect(screen.getByRole('heading', { name: /Katalog pojazdów w przygotowaniu/i })).toBeInTheDocument();
      expect(screen.getByText(/Trwa integracja ofert dedykowanych/i)).toBeInTheDocument();
    });
  });

  it('handles logout button click successfully', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);
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
      // User must remain on screen
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    });
  });
});
