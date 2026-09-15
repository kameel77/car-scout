import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from './AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from './auth-api';

const mockConfig = {
  brandName: 'Action Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form with inputs and validation', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/logowanie']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    expect(screen.getByRole('heading', { name: /Zaloguj się do portalu/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Hasło/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zaloguj się/i })).toBeInTheDocument();
  });

  it('submits form successfully and navigates to /katalog', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    const loginSpy = vi.spyOn(authApi, 'loginEmployee').mockResolvedValue({
      id: 'acc_1',
      email: 'jan@action.pl',
      firstName: 'Jan',
      lastName: 'Kowalski',
      company: { id: 'c1', name: 'Action', slug: 'action' },
      program: { id: 'p1', name: 'Action Prog', slug: 'prog' },
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/logowanie']}>
            <Routes>
              <Route path="/logowanie" element={<LoginPage />} />
              <Route path="/katalog" element={<div>Widok Katalogu</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const emailInput = screen.getByLabelText(/Adres e-mail/i);
    const passwordInput = screen.getByLabelText(/Hasło/i);
    const submitBtn = screen.getByRole('button', { name: /Zaloguj się/i });

    fireEvent.change(emailInput, { target: { value: 'jan@action.pl' } });
    fireEvent.change(passwordInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('/api', {
        email: 'jan@action.pl',
        password: 'SuperSecret123!',
      });
      expect(screen.getByText('Widok Katalogu')).toBeInTheDocument();
    });
  });

  it('displays error message when login fails', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    vi.spyOn(authApi, 'loginEmployee').mockRejectedValue(new Error('Nieprawidłowy login lub hasło'));

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/logowanie']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const emailInput = screen.getByLabelText(/Adres e-mail/i);
    const passwordInput = screen.getByLabelText(/Hasło/i);
    const submitBtn = screen.getByRole('button', { name: /Zaloguj się/i });

    fireEvent.change(emailInput, { target: { value: 'jan@action.pl' } });
    fireEvent.change(passwordInput, { target: { value: 'BadPassword123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Nieprawidłowy login lub hasło')).toBeInTheDocument();
    });
  });

  it('validates minimum password length before submitting', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    const loginSpy = vi.spyOn(authApi, 'loginEmployee');

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/logowanie']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const emailInput = screen.getByLabelText(/Adres e-mail/i);
    const passwordInput = screen.getByLabelText(/Hasło/i);
    const submitBtn = screen.getByRole('button', { name: /Zaloguj się/i });

    fireEvent.change(emailInput, { target: { value: 'jan@action.pl' } });
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Hasło musi mieć co najmniej 8 znaków/i)).toBeInTheDocument();
    });
    expect(loginSpy).not.toHaveBeenCalled();
  });
});
