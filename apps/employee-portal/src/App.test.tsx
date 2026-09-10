import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App, { AppRoutes } from './App';
import { BrandProvider } from './config/BrandContext';
import {
  validateBrandConfig,
  loadPortalConfig,
  resetCachedConfigForTesting,
  defaultBrandConfig,
} from './config/brand';

describe('Employee Portal - P1 Skeleton & Branding Suite', () => {
  beforeEach(() => {
    resetCachedConfigForTesting();
    delete window.__PORTAL_CONFIG__;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetCachedConfigForTesting();
    delete window.__PORTAL_CONFIG__;
  });

  describe('1. Brand Config Loader & Validator Unit Tests', () => {
    it('returns default configuration on null, undefined or non-object input', () => {
      expect(validateBrandConfig(null)).toEqual(defaultBrandConfig);
      expect(validateBrandConfig(undefined)).toEqual(defaultBrandConfig);
      expect(validateBrandConfig('invalid string')).toEqual(defaultBrandConfig);
      expect(validateBrandConfig(12345)).toEqual(defaultBrandConfig);
    });

    it('sanitizes and accepts valid brand fields', () => {
      const valid = {
        brandName: 'Partner Auto Program',
        brandLogoUrl: 'https://cdn.example.com/logo.png',
        portalUrl: 'https://portal.example.com',
        apiUrl: '/api',
      };
      const result = validateBrandConfig(valid);
      expect(result.brandName).toBe('Partner Auto Program');
      expect(result.brandLogoUrl).toBe('https://cdn.example.com/logo.png');
      expect(result.apiUrl).toBe('/api');
    });

    it('rejects invalid or unsafe values and applies defaults', () => {
      const unsafe = {
        brandName: '', // Pusta nazwa -> fallback
        brandLogoUrl: 'javascript:alert(1)', // Niebezpieczny schemat -> fallback
        apiUrl: 'http://malicious-site.com/steal', // Zewnętrzny niezaufany adres -> fallback na /api
      };
      const result = validateBrandConfig(unsafe);
      expect(result.brandName).toBe(defaultBrandConfig.brandName);
      expect(result.brandLogoUrl).toBe(defaultBrandConfig.brandLogoUrl);
      expect(result.apiUrl).toBe('/api');
    });

    it('rejects protocol-relative URL and malformed https URL for brandLogoUrl', () => {
      // Protocol-relative //evil.com/logo.png
      expect(
        validateBrandConfig({ brandLogoUrl: '//evil.com/logo.png' }).brandLogoUrl
      ).toBe(defaultBrandConfig.brandLogoUrl);

      // Malformed https URL
      expect(
        validateBrandConfig({ brandLogoUrl: 'https://' }).brandLogoUrl
      ).toBe(defaultBrandConfig.brandLogoUrl);

      // Valid relative path
      expect(
        validateBrandConfig({ brandLogoUrl: '/images/partner-logo.svg' }).brandLogoUrl
      ).toBe('/images/partner-logo.svg');
    });

    it('loads runtime config from window.__PORTAL_CONFIG__ if injected', async () => {
      window.__PORTAL_CONFIG__ = {
        brandName: 'Wstrzyknięta Marka Partnerska',
      };

      const loaded = await loadPortalConfig();
      expect(loaded.brandName).toBe('Wstrzyknięta Marka Partnerska');
    });

    it('fetches /runtime-config.json when available and caches result', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          brandName: 'Pobrana Marka z JSON',
          brandLogoUrl: '/custom-logo.svg',
        }),
      });
      vi.stubGlobal('fetch', fakeFetch);

      const loaded = await loadPortalConfig();
      expect(loaded.brandName).toBe('Pobrana Marka z JSON');
      expect(loaded.brandLogoUrl).toBe('/custom-logo.svg');
      expect(fakeFetch).toHaveBeenCalledWith('/runtime-config.json', expect.any(Object));
    });

    it('falls back safely to default config on network error or 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const loaded = await loadPortalConfig();
      expect(loaded.brandName).toBe(defaultBrandConfig.brandName);
    });

    it('falls back safely when response.json() hangs or aborts due to timeout', async () => {
      const fakeFetch = vi.fn().mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  new Promise((_r, rej) => {
                    if (init?.signal) {
                      init.signal.addEventListener('abort', () =>
                        rej(new DOMException('Aborted', 'AbortError'))
                      );
                    }
                  }),
              });
            }, 10);
            if (init?.signal) {
              init.signal.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          })
      );
      vi.stubGlobal('fetch', fakeFetch);

      // Uruchamiamy z bardzo krótkim timeoutem 50ms
      const loaded = await loadPortalConfig(50);
      expect(loaded.brandName).toBe(defaultBrandConfig.brandName);
    });
  });

  describe('2. UI & Dynamic Branding Integration Tests', () => {
    it('renders custom brand name and logo when runtime config is provided', async () => {
      const customConfig = {
        brandName: 'Action Auto Benefit',
        brandLogoUrl: 'https://cdn.example.com/action-logo.png',
        portalUrl: 'https://action.motolia.pl',
        apiUrl: '/api',
      };

      render(<App initialConfig={customConfig} />);

      await waitFor(() => {
        expect(screen.getByText('Action Auto Benefit')).toBeInTheDocument();
      });

      const logoImg = screen.getByAltText('Action Auto Benefit');
      expect(logoImg).toHaveAttribute('src', 'https://cdn.example.com/action-logo.png');
    });

    it('displays explicit mock notice and benefit outline on catalog page', async () => {
      render(<App />);
      await waitFor(() => {
        expect(
          screen.getByText(/Makieta etapu P1 - szkielet interfejsu/i)
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Przykładowy pakiet benefitów/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Pakiet paliwowy Moya/i)).toBeInTheDocument();
    });
  });

  describe('3. Routing & Form Mock Status Tests', () => {
    it('renders /logowanie with prominent demo notice and disabled submit', () => {
      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <MemoryRouter initialEntries={['/logowanie']}>
            <AppRoutes />
          </MemoryRouter>
        </BrandProvider>
      );

      expect(screen.getByText(/Zaloguj się do portalu/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Makieta etapu P1 \(Tryb demonstracyjny\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Logowanie nieaktywne w etapie P1/i })
      ).toBeDisabled();
    });

    it('renders /rejestracja with neutral code placeholder and demo notice', () => {
      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <MemoryRouter initialEntries={['/rejestracja']}>
            <AppRoutes />
          </MemoryRouter>
        </BrandProvider>
      );

      expect(screen.getByText(/Aktywuj dostęp pracowniczy/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Makieta etapu P1 \(Tryb demonstracyjny\)/i)
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('KOD-FIRMY-1234')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Rejestracja nieaktywna w etapie P1/i })
      ).toBeDisabled();
    });

    it('renders 404 NotFoundPage for unknown routes', () => {
      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <MemoryRouter initialEntries={['/nieznana-sciezka-xyz']}>
            <AppRoutes />
          </MemoryRouter>
        </BrandProvider>
      );

      expect(screen.getByText(/404 - Nie znaleziono strony/i)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Wróć na stronę główną/i })
      ).toBeInTheDocument();
    });
  });
});
