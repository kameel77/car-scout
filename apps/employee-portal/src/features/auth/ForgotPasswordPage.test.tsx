import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from './auth-api';

const mockConfig = {
  brandName: 'Action Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

describe('ForgotPasswordPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders forgot password form', () => {
    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/zapomnialem-hasla']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    expect(screen.getByRole('heading', { name: /Nie pamiętasz hasła\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wyślij link do resetu/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty', async () => {
    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/zapomnialem-hasla']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Wyślij link do resetu/i }));

    expect(await screen.findByText(/Podaj adres e-mail/i)).toBeInTheDocument();
  });

  it('submits form successfully and shows confirmation message', async () => {
    const requestSpy = vi.spyOn(authApi, 'requestPasswordReset').mockResolvedValue({
      message: 'Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.'
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/zapomnialem-hasla']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: 'jan.kowalski@firma.pl' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij link do resetu/i }));

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith('/api', 'jan.kowalski@firma.pl');
    });

    expect(await screen.findByText(/Sprawdź swoją skrzynkę odbiorczą/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Powrót do logowania/i })).toBeInTheDocument();
  });

  it('displays error message if request fails', async () => {
    vi.spyOn(authApi, 'requestPasswordReset').mockRejectedValue(new Error('Serwer niedostępny'));

    render(
      <BrandProvider initialConfig={mockConfig}>
        <MemoryRouter initialEntries={['/zapomnialem-hasla']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </BrandProvider>
    );

    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: 'jan.kowalski@firma.pl' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Wyślij link do resetu/i }));

    expect(await screen.findByText(/Serwer niedostępny/i)).toBeInTheDocument();
  });
});
