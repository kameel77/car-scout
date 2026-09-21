import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EmployerB2bPage } from './EmployerB2bPage';
import { BrandProvider } from '../../../config/BrandContext';
import { AuthProvider } from '../../auth/AuthContext';
import * as authApi from '../../auth/auth-api';

describe('EmployerB2bPage Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
  });

  const renderB2bPage = () => {
    return render(
      <BrandProvider>
        <AuthProvider>
          <MemoryRouter>
            <EmployerB2bPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders employer B2B page with value pillars and lead form', async () => {
    renderB2bPage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Nowoczesny benefit motoryzacyjny/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Zero kosztów wdrożenia dla Twojej firmy/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Imię i nazwisko \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nazwa firmy \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Służbowy adres e-mail \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Numer telefonu \*/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Wyślij zapytanie o program/i })
      ).toBeInTheDocument();
    });
  });

  it('shows validation error when required consent checkbox is not checked', async () => {
    renderB2bPage();

    fireEvent.change(screen.getByLabelText(/Imię i nazwisko \*/i), {
      target: { value: 'Jan Kowalski' },
    });
    fireEvent.change(screen.getByLabelText(/Nazwa firmy \*/i), {
      target: { value: 'Acme Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Służbowy adres e-mail \*/i), {
      target: { value: 'jan@acme.com' },
    });
    fireEvent.change(screen.getByLabelText(/Numer telefonu \*/i), {
      target: { value: '500600700' },
    });

    const consentCheckbox = screen.getByRole('checkbox');
    expect(consentCheckbox).not.toBeChecked();

    const submitButton = screen.getByRole('button', { name: /Wyślij zapytanie o program/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Wymagana jest akceptacja polityki prywatności/i)
      ).toBeInTheDocument();
    });
  });

  it('successfully submits lead to POST /api/leads with employer_b2b type and displays confirmation', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        lead: { id: 'lead_b2b_123', referenceNumber: 'B2B-1001' },
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderB2bPage();

    fireEvent.change(screen.getByLabelText(/Imię i nazwisko \*/i), {
      target: { value: 'Anna Nowak' },
    });
    fireEvent.change(screen.getByLabelText(/Nazwa firmy \*/i), {
      target: { value: 'Tech Solutions Sp. z o.o.' },
    });
    fireEvent.change(screen.getByLabelText(/NIP firmy/i), {
      target: { value: '5252525252' },
    });
    fireEvent.change(screen.getByLabelText(/Służbowy adres e-mail \*/i), {
      target: { value: 'anna.nowak@techsolutions.pl' },
    });
    fireEvent.change(screen.getByLabelText(/Numer telefonu \*/i), {
      target: { value: '+48 501 234 567' },
    });
    fireEvent.change(screen.getByLabelText(/Szacowana wielkość zespołu/i), {
      target: { value: '50 - 200 pracowników' },
    });
    fireEvent.change(screen.getByLabelText(/Model programu/i), {
      target: { value: 'Dostęp pracowniczy (bez kosztów firmy)' },
    });

    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);
    expect(consentCheckbox).toBeChecked();

    const submitButton = screen.getByRole('button', { name: /Wyślij zapytanie o program/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
      const calls = fetchSpy.mock.calls;
      const leadsCall = calls.find(([url]) => (url as string).includes('/leads'));
      expect(leadsCall).toBeDefined();

      const [, options] = leadsCall!;
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body as string);
      expect(body.leadType).toBe('employer_b2b');
      expect(body.trafficSource).toBe('benefivo_b2b');
      expect(body.name).toBe('Anna Nowak');
      expect(body.email).toBe('anna.nowak@techsolutions.pl');
      expect(body.phone).toBe('+48 501 234 567');
      expect(body.message).toContain('Wielkość zespołu: 50 - 200 pracowników');
      expect(body.metadata).toEqual({
        companyName: 'Tech Solutions Sp. z o.o.',
        companyNip: '5252525252',
        teamSize: '50 - 200 pracowników',
        benefitModel: 'Dostęp pracowniczy (bez kosztów firmy)'
      });

      expect(
        screen.getByRole('heading', { name: /Dziękujemy za kontakt!/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/B2B-1001/i)).toBeInTheDocument();
    });
  });

  it('displays server error message when API fails', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Niezgodność zabezpieczenia antyspamowego' }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderB2bPage();

    fireEvent.change(screen.getByLabelText(/Imię i nazwisko \*/i), {
      target: { value: 'Jan Kowalski' },
    });
    fireEvent.change(screen.getByLabelText(/Nazwa firmy \*/i), {
      target: { value: 'Acme Corp' },
    });
    fireEvent.change(screen.getByLabelText(/Służbowy adres e-mail \*/i), {
      target: { value: 'jan@acme.com' },
    });
    fireEvent.change(screen.getByLabelText(/Numer telefonu \*/i), {
      target: { value: '500600700' },
    });

    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);

    const submitButton = screen.getByRole('button', { name: /Wyślij zapytanie o program/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Niezgodność zabezpieczenia antyspamowego/i)
      ).toBeInTheDocument();
    });
  });
});
