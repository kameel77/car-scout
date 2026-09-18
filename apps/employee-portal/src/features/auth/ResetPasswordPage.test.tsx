import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResetPasswordPage } from './ResetPasswordPage';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from './auth-api';

const mockConfig = {
  brandName: 'Action Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

describe('ResetPasswordPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders error state when token is missing in URL', () => {
    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/reset-hasla']}>
          <ResetPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    expect(screen.getByRole('heading', { name: /Nieprawidłowy link resetu/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Wyślij nowy link do resetu/i })).toBeInTheDocument();
  });

  it('renders reset password form when token is present', () => {
    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/reset-hasla?token=valid_token_123']}>
          <ResetPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    expect(screen.getByRole('heading', { name: /Ustaw nowe hasło/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nowe hasło$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Powtórz nowe hasło/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zapisz nowe hasło/i })).toBeInTheDocument();
  });

  it('validates password minimum length and matching passwords', async () => {
    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/reset-hasla?token=valid_token_123']}>
          <ResetPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    fireEvent.change(screen.getByLabelText(/^Nowe hasło$/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Powtórz nowe hasło/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz nowe hasło/i }));

    expect(await screen.findByText(/Hasło musi mieć co najmniej 8 znaków/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Nowe hasło$/i), { target: { value: 'ValidPass123!' } });
    fireEvent.change(screen.getByLabelText(/Powtórz nowe hasło/i), { target: { value: 'DifferentPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz nowe hasło/i }));

    expect(await screen.findByText(/Wprowadzone hasła nie są identyczne/i)).toBeInTheDocument();
  });

  it('submits successfully and navigates to login with success message', async () => {
    const resetSpy = vi.spyOn(authApi, 'resetEmployeePassword').mockResolvedValue({
      message: 'Hasło zostało zmienione.'
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/reset-hasla?token=valid_token_123']}>
          <Routes>
            <Route path="/reset-hasla" element={<ResetPasswordPage />} />
            <Route path="/logowanie" element={<div>Strona Logowania</div>} />
          </Routes>
        </MemoryRouter>
      </BrandProvider>
    );

    fireEvent.change(screen.getByLabelText(/^Nowe hasło$/i), { target: { value: 'ValidPass123!' } });
    fireEvent.change(screen.getByLabelText(/Powtórz nowe hasło/i), { target: { value: 'ValidPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Zapisz nowe hasło/i }));

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith('/api', {
        token: 'valid_token_123',
        password: 'ValidPass123!'
      });
    });

    expect(await screen.findByText(/Strona Logowania/i)).toBeInTheDocument();
  });
});
