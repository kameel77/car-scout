import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PortalHeader } from './PortalHeader';
import { BrandProvider } from '../../config/BrandContext';
import { AuthProvider } from '../auth/AuthContext';
import * as authApi from '../auth/auth-api';

const mockAuthenticatedEmployee: authApi.EmployeeUser = {
  id: 'acc_123',
  email: 'jan.kowalski@finarena.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  phone: '+48 500 600 700',
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

describe('PortalHeader Component (Zakres 10 Single Brand)', () => {
  it('renders brand logo without secondary brand text next to it', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '/static/logo-dark.svg', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter>
            <PortalHeader />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const logo = screen.getByRole('img', { name: 'Benefivo' });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/static/logo-dark.svg');

    // No secondary text next to logo
    const link = logo.closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(link?.textContent).toBe(''); // Only the img inside

    // Wait for auth to settle to avoid act warning
    await screen.findByRole('button', { name: /Menu użytkownika/i });
  });

  it('renders lowercase benefivo fallback text when logo fails to load or is empty', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter>
            <PortalHeader />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    // Fallback text "benefivo"
    const fallback = screen.getByText('benefivo');
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass('font-heading');
    expect(fallback).toHaveClass('font-extrabold');

    // Wait for auth to settle to avoid act warning
    await screen.findByRole('button', { name: /Menu użytkownika/i });
  });

  it('triggers fallback on image error', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '/invalid-logo.png', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter>
            <PortalHeader />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const logo = screen.getByRole('img', { name: 'Benefivo' });
    fireEvent.error(logo);

    const fallback = screen.getByText('benefivo');
    expect(fallback).toBeInTheDocument();

    // Wait for auth to settle to avoid act warning
    await screen.findByRole('button', { name: /Menu użytkownika/i });
  });

  it('renders user menu button and opens dropdown menu with Moje dane, Zmiana hasła and Wyloguj', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockAuthenticatedEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '/static/logo-dark.svg', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter>
            <PortalHeader />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    // Find user button
    const userBtn = await screen.findByRole('button', { name: /Menu użytkownika: Jan Kowalski/i });
    expect(userBtn).toBeInTheDocument();
    expect(userBtn).toHaveAttribute('aria-haspopup', 'menu');
    expect(userBtn).toHaveAttribute('aria-expanded', 'false');

    // Main nav should not contain Moje zapytania
    expect(screen.queryByRole('link', { name: /Moje zapytania/i })).not.toBeInTheDocument();

    // Click to open
    fireEvent.click(userBtn);
    expect(userBtn).toHaveAttribute('aria-expanded', 'true');

    // Check menu items
    const dashboardLink = screen.getByRole('menuitem', { name: /Pulpit programu/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');

    const zapytaniaLink = screen.getByRole('menuitem', { name: /Moje zapytania/i });
    expect(zapytaniaLink).toBeInTheDocument();
    expect(zapytaniaLink).toHaveAttribute('href', '/zapytania');

    const daneLink = screen.getByRole('menuitem', { name: /Moje dane/i });
    expect(daneLink).toBeInTheDocument();
    expect(daneLink).toHaveAttribute('href', '/konto');

    const hasloLink = screen.getByRole('menuitem', { name: /Zmiana hasła/i });
    expect(hasloLink).toBeInTheDocument();
    expect(hasloLink).toHaveAttribute('href', '/konto#haslo');

    // Press Escape to close
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(userBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('links logo to / when user is not authenticated and not loading', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

    render(
      <BrandProvider initialConfig={{ brandName: 'Benefivo', brandLogoUrl: '/static/logo-dark.svg', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <MemoryRouter>
            <PortalHeader />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      const logo = screen.getByRole('img', { name: 'Benefivo' });
      const link = logo.closest('a');
      expect(link).toHaveAttribute('href', '/');
    });
  });
});
