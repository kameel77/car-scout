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
      expect(screen.getByRole('heading', { name: /Dobre rzeczy/i })).toBeInTheDocument();
      expect(screen.getByText(/TWÓJ BENEFIT. TWOJE AUTO./i)).toBeInTheDocument();
      expect(
        screen.getByText(/Najem i leasing auta na warunkach dla pracowników/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Mam kod firmy - aktywuj dostęp/i })
      ).toHaveAttribute('href', '/rejestracja');
      expect(
        screen.getByRole('link', { name: /Jesteś pracodawcą\? Przejdź do oferty dla firm/i })
      ).toHaveAttribute('href', '/dla-firm');
    });

    const loginLinks = screen.getAllByRole('link', { name: /Zaloguj się/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute('href', '/logowanie');
  });

  it('opens employee journey dialog and allows copying HR message', async () => {
    renderLandingPage();

    // Find the CTA "Mojej firmy nie ma w programie"
    const ctaButton = screen.getByRole('button', { name: /Mojej firmy nie ma w programie/i });
    fireEvent.click(ctaButton);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Dobre rzeczy zaczynają się w firmie/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/WIADOMOŚĆ DO HR/i)).toBeInTheDocument();
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
});
