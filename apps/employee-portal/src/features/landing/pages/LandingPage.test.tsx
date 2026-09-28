import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { BrandProvider } from '../../../config/BrandContext';
import { AuthProvider } from '../../auth/AuthContext';
import * as authApi from '../../auth/auth-api';

describe('Benefivo LandingPage Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);
  });

  const renderLandingPage = () => {
    return render(
      <BrandProvider>
        <AuthProvider>
          <MemoryRouter>
            <LandingPage />
          </MemoryRouter>
        </AuthProvider>
      </BrandProvider>
    );
  };

  it('renders landing page hero with key value propositions and navigation links', async () => {
    renderLandingPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Nowe auto na warunkach dla pracowników/i })).toBeInTheDocument();
      expect(screen.getByText(/PROGRAM PRACOWNICZY/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Nowe auto w najmie lub w finansowaniu, z rabatem/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Mam kod firmy/i })
      ).toHaveAttribute('href', '/rejestracja');
      expect(
        screen.getByRole('link', { name: /Odpowiadasz za benefity\? Oferta dla firm/i })
      ).toHaveAttribute('href', '/dla-firm');
    });

    const loginLinks = screen.getAllByRole('link', { name: /Zaloguj się/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute('href', '/logowanie');
  });

  it('opens employee journey dialog and allows copying HR message', async () => {
    renderLandingPage();

    // Find the CTA "Moja firma nie ma jeszcze Benefivo"
    const ctaButton = screen.getByRole('button', { name: /Moja firma nie ma Benefivo/i });
    fireEvent.click(ctaButton);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dobre rzeczy zaczynają się w firmie/i })
      ).toBeInTheDocument();
      expect(screen.getByText('WIADOMOŚĆ DO HR')).toBeInTheDocument();
    });

    // Mock clipboard API
    const clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardSpy,
      },
    });

    const copyButton = screen.getByRole('button', { name: /Kopiuj wiadomość/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Skopiowano treść wiadomości/i)).toBeInTheDocument();
    });
  });

  it('opens rental details modal from offer section', async () => {
    renderLandingPage();

    const rentalTrigger = screen.getByRole('button', { name: /Poznaj najem długoterminowy/i });
    fireEvent.click(rentalTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Auto na Twoją codzienność/i })
      ).toBeInTheDocument();
    });
  });

  it('opens leasing details modal', async () => {
    renderLandingPage();

    const leasingTrigger = screen.getByRole('button', { name: /Poznaj leasing samochodów/i });
    fireEvent.click(leasingTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Twoje plany. Twoje warunki/i })
      ).toBeInTheDocument();
    });
  });

  it('opens about program modal from footer', async () => {
    renderLandingPage();

    const aboutTrigger = screen.getByRole('button', { name: /O programie/i });
    fireEvent.click(aboutTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Nowoczesny benefit motoryzacyjny/i })
      ).toBeInTheDocument();
      expect(screen.getByText('O PROGRAMIE BENEFIVO')).toBeInTheDocument();
    });
  });

  it('toggles mobile menu drawer', async () => {
    renderLandingPage();

    const menuButton = screen.getByRole('button', { name: /Menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders dashboard CTA buttons for authenticated user', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue({
      id: 'acc_123',
      email: 'jan@firma.pl',
      firstName: 'Jan',
      lastName: 'Kowalski',
      company: { id: 'c1', name: 'Firma Sp. z o.o.', slug: 'firma' },
      program: { id: 'p1', name: 'Flota', slug: 'flota' },
    });

    renderLandingPage();

    await waitFor(() => {
      const dashboardLinks = screen.getAllByRole('link', { name: /Pulpit|Przejdź do ofert/i });
      expect(dashboardLinks.length).toBeGreaterThan(0);
      expect(dashboardLinks.some((l) => l.getAttribute('href') === '/dashboard')).toBe(true);
    });
  });

  it('sends an employee interest lead from the "Moja firma nie ma Benefivo" dialog without exposing employee data to the company', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lead: { id: 'l1', referenceNumber: 'BNF-1', status: 'new' } }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    renderLandingPage();
    fireEvent.click(screen.getByRole('button', { name: /Moja firma nie ma Benefivo/i }));

    fireEvent.change(await screen.findByLabelText(/Nazwa firmy/i), { target: { value: 'Acme S.A.' } });
    fireEvent.change(screen.getByLabelText(/Twój e-mail/i), { target: { value: 'jan@acme.pl' } });
    fireEvent.click(screen.getByLabelText(/Zgadzam się na kontakt/i));
    fireEvent.click(screen.getByRole('button', { name: /Powiadom mnie/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/leads'));
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body);
      expect(body.leadType).toBe('employer_b2b');
      expect(body.trafficSource).toBe('benefivo_employee_interest');
      expect(body.email).toBe('jan@acme.pl');
      expect(body.metadata.companyName).toBe('Acme S.A.');
      expect(screen.getByText(/Damy znać, gdy program ruszy/i)).toBeInTheDocument();
    });
  });

  it('unblurs sample offer prices after a valid company code and offers registration with the code', async () => {
    vi.spyOn(authApi, 'validateCompanyCode').mockResolvedValue({
      valid: true,
      companyId: 'c1',
      companyName: 'Acme',
      programId: 'p1',
      programName: 'Program',
    });

    renderLandingPage();

    expect(await screen.findByRole('heading', { name: /Twoje ceny czekają za kodem firmy/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Cena widoczna po podaniu kodu firmy/i).length).toBe(3);

    fireEvent.change(screen.getByLabelText(/Kod dostępu firmy/i), { target: { value: 'acme-2026' } });
    fireEvent.click(screen.getByRole('button', { name: /Odblokuj ceny/i }));

    await waitFor(() => {
      expect(authApi.validateCompanyCode).toHaveBeenCalledWith('/api', 'ACME-2026');
      expect(screen.queryByText(/Cena widoczna po podaniu kodu firmy/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Załóż konto/i })).toBeInTheDocument();
    });
  });
});
