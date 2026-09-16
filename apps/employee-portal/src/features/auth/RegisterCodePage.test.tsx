import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RegisterCodePage } from './RegisterCodePage';
import { AuthProvider } from './AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from './auth-api';

const mockConfig = {
  brandName: 'Action Auto Program',
  brandLogoUrl: '/logo.svg',
  portalUrl: '',
  apiUrl: '/api',
};

describe('RegisterCodePage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders step 1 with company code input', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/rejestracja']}>
            <RegisterCodePage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    expect(screen.getByRole('heading', { name: /Aktywuj dostęp pracowniczy/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Kod dostępu firmy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sprawdź kod/i })).toBeInTheDocument();
  });

  it('validates company code and advances to step 2 registration form', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    const validateSpy = vi.spyOn(authApi, 'validateCompanyCode').mockResolvedValue({
      valid: true,
      companyId: 'c1',
      companyName: 'Action S.A.',
      programId: 'p1',
      programName: 'Action Auto Program',
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/rejestracja']}>
            <RegisterCodePage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    const codeInput = screen.getByLabelText(/Kod dostępu firmy/i);
    const submitBtn = screen.getByRole('button', { name: /Sprawdź kod/i });

    fireEvent.change(codeInput, { target: { value: 'ACTION-2026' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith('/api', 'ACTION-2026');
      expect(screen.getByText('Action S.A.')).toBeInTheDocument();
      expect(screen.getAllByText('Action Auto Program').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/Imię/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nazwisko/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Hasło/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Utwórz konto/i })).toBeInTheDocument();
    });
  });

  it('submits registration successfully and navigates to /katalog', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    vi.spyOn(authApi, 'validateCompanyCode').mockResolvedValue({
      valid: true,
      companyId: 'c1',
      companyName: 'Action S.A.',
      programId: 'p1',
      programName: 'Action Auto Program',
    });
    const registerSpy = vi.spyOn(authApi, 'registerEmployee').mockResolvedValue({
      id: 'acc_1',
      email: 'jan.kowalski@action.pl',
      firstName: 'Jan',
      lastName: 'Kowalski',
      phone: '+48123456789',
      company: { id: 'c1', name: 'Action S.A.', slug: 'action' },
      program: { id: 'p1', name: 'Action Auto Program', slug: 'action-auto' },
    });

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/rejestracja']}>
            <Routes>
              <Route path="/rejestracja" element={<RegisterCodePage />} />
              <Route path="/katalog" element={<div>Widok Katalogu</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    // Step 1
    fireEvent.change(screen.getByLabelText(/Kod dostępu firmy/i), { target: { value: 'ACTION-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Sprawdź kod/i }));

    // Step 2
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Utwórz konto/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Imię/i), { target: { value: 'Jan' } });
    fireEvent.change(screen.getByLabelText(/Nazwisko/i), { target: { value: 'Kowalski' } });
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), { target: { value: 'jan.kowalski@action.pl' } });
    fireEvent.change(screen.getByLabelText(/Numer telefonu/i), { target: { value: '+48123456789' } });
    fireEvent.change(screen.getByLabelText(/Hasło/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /Utwórz konto/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith('/api', {
        code: 'ACTION-2026',
        email: 'jan.kowalski@action.pl',
        password: 'Password123!',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '+48123456789',
      });
      expect(screen.getByText('Widok Katalogu')).toBeInTheDocument();
    });
  });

  it('shows error when invalid code is submitted', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
    vi.spyOn(authApi, 'validateCompanyCode').mockRejectedValue(new Error('Nieprawidłowy lub nieaktywny kod firmy'));

    render(
      <BrandProvider initialConfig={mockConfig}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/rejestracja']}>
            <RegisterCodePage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );

    fireEvent.change(screen.getByLabelText(/Kod dostępu firmy/i), { target: { value: 'BAD-CODE' } });
    fireEvent.click(screen.getByRole('button', { name: /Sprawdź kod/i }));

    await waitFor(() => {
      expect(screen.getByText('Nieprawidłowy lub nieaktywny kod firmy')).toBeInTheDocument();
    });
  });
});
