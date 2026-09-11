import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App, { AppRoutes } from './App';
import { BrandProvider } from './config/BrandContext';
import { AuthProvider } from './features/auth/AuthContext';
import {
  validateBrandConfig,
  loadPortalConfig,
  resetCachedConfigForTesting,
  defaultBrandConfig,
} from './config/brand';
import * as authApi from './features/auth/auth-api';

describe('Employee Portal - Frontend Integration Suite', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
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
        brandName: '',
        brandLogoUrl: 'javascript:alert(1)',
        apiUrl: 'http://malicious-site.com/steal',
      };
      const result = validateBrandConfig(unsafe);
      expect(result.brandName).toBe(defaultBrandConfig.brandName);
      expect(result.brandLogoUrl).toBe(defaultBrandConfig.brandLogoUrl);
      expect(result.apiUrl).toBe('/api');
    });

    it('rejects protocol-relative URL and malformed https URL for brandLogoUrl', () => {
      expect(
        validateBrandConfig({ brandLogoUrl: '//evil.com/logo.png' }).brandLogoUrl
      ).toBe(defaultBrandConfig.brandLogoUrl);

      expect(
        validateBrandConfig({ brandLogoUrl: 'https://' }).brandLogoUrl
      ).toBe(defaultBrandConfig.brandLogoUrl);

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

      const loaded = await loadPortalConfig(50);
      expect(loaded.brandName).toBe(defaultBrandConfig.brandName);
    });
  });

  describe('2. UI & Dynamic Branding Integration Tests', () => {
    it('renders custom brand name and redirects unauthenticated user to login', async () => {
      vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

      const customConfig = {
        brandName: 'Action Auto Benefit',
        brandLogoUrl: 'https://cdn.example.com/action-logo.png',
        portalUrl: 'https://action.motolia.pl',
        apiUrl: '/api',
      };

      render(<App initialConfig={customConfig} />);

      await waitFor(() => {
        expect(screen.getByText('Action Auto Benefit')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Zaloguj się do portalu/i })).toBeInTheDocument();
      });
    });

    it('displays honest catalog placeholder and header when authenticated', async () => {
      vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue({
        id: 'acc_1',
        email: 'jan@firma.pl',
        firstName: 'Jan',
        lastName: 'Kowalski',
        company: { id: 'c1', name: 'Firma S.A.', slug: 'firma' },
        program: { id: 'p1', name: 'Program Flotowy', slug: 'flota' },
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Katalog pojazdów w przygotowaniu/i })).toBeInTheDocument();
        expect(screen.getByText(/Trwa integracja ofert dedykowanych/i)).toBeInTheDocument();
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      });
    });
  });

  describe('3. Routing & Protected Access Tests', () => {
    it('renders /logowanie form with active credentials inputs and submit button', () => {
      vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/logowanie']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </BrandProvider>
      );

      expect(screen.getByRole('heading', { name: /Zaloguj się do portalu/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Hasło/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Zaloguj się/i })).not.toBeDisabled();
    });

    it('renders /rejestracja with company access code check step', () => {
      vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/rejestracja']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </BrandProvider>
      );

      expect(screen.getByRole('heading', { name: /Aktywuj dostęp pracowniczy/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Kod dostępu firmy/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sprawdź kod/i })).toBeInTheDocument();
    });

    it('renders 404 NotFoundPage for unknown routes', () => {
      render(
        <BrandProvider initialConfig={defaultBrandConfig}>
          <AuthProvider>
            <MemoryRouter initialEntries={['/nieznana-sciezka-xyz']}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </BrandProvider>
      );

      expect(screen.getByText(/404 - Nie znaleziono strony/i)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /Wróć na stronę główną/i })
      ).toBeInTheDocument();
    });
  });
});
