import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('renders brand logo without secondary brand text next to it', () => {
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
    expect(link?.textContent).toBe(''); // Only the img inside
  });

  it('renders lowercase benefivo fallback text when logo fails to load or is empty', () => {
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
  });

  it('triggers fallback on image error', () => {
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

    // Click to open
    fireEvent.click(userBtn);
    expect(userBtn).toHaveAttribute('aria-expanded', 'true');

    // Check menu items
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
});
