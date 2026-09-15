import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { BrandProvider } from '../../config/BrandContext';
import * as authApi from './auth-api';

const mockEmployee: authApi.EmployeeUser = {
  id: 'acc_123',
  email: 'jan@firma.pl',
  firstName: 'Jan',
  lastName: 'Kowalski',
  phone: '+48123456789',
  company: { id: 'c1', name: 'Firma Sp. z o.o.', slug: 'firma' },
  program: { id: 'p1', name: 'Program Flotowy', slug: 'flota' },
};

const TestConsumer: React.FC = () => {
  const { user, isAuthenticated, isLoading, isServiceUnavailable, sessionError, login, register, logout, refreshSession } = useAuth();
  return (
    <div>
      {isLoading && <div>Ładowanie sesji...</div>}
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="service-status">{isServiceUnavailable ? 'unavailable' : 'available'}</div>
      {sessionError && <div data-testid="session-error">{sessionError}</div>}
      {user && <div data-testid="user-email">{user.email}</div>}
      <button onClick={() => login({ email: 'jan@firma.pl', password: 'Password123!' }).catch(() => {})}>
        Zaloguj
      </button>
      <button
        onClick={() =>
          register({
            code: 'COMP123',
            email: 'jan@firma.pl',
            password: 'Password123!',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123456789',
          }).catch(() => {})
        }
      >
        Zarejestruj
      </button>
      <button onClick={() => logout().catch(() => {})}>Wyloguj</button>
      <button onClick={() => refreshSession().catch(() => {})}>Odswiez</button>
    </div>
  );
};

describe('AuthContext - Session Bootstrap, Concurrency & Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes session via GET /api/employee/auth/me and provides user data', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    expect(screen.getByText('Ładowanie sesji...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('jan@firma.pl');
      expect(screen.getByTestId('service-status')).toHaveTextContent('available');
    });
  });

  it('sets isAuthenticated=false if session bootstrap returns null (401 unauthenticated)', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(null);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
      expect(screen.getByTestId('service-status')).toHaveTextContent('available');
    });
  });

  it('flags isServiceUnavailable when bootstrap fails due to 5xx / network error', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockRejectedValue(new Error('Serwer niedostępny (503)'));

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('service-status')).toHaveTextContent('unavailable');
      expect(screen.getByTestId('session-error')).toHaveTextContent('Serwer niedostępny (503)');
    });
  });

  it('logout does NOT clear user and sets sessionError on 5xx server failure', async () => {
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValue(mockEmployee);
    vi.spyOn(authApi, 'logoutEmployee').mockRejectedValue(new Error('Błąd serwera (500)'));

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Wyloguj' }).click();
    });

    await waitFor(() => {
      // Local state is preserved to avoid silent desync / re-appearing sessions
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('session-error')).toHaveTextContent('Błąd serwera (500)');
    });
  });

  it('prevents race conditions where a stale bootstrap overwrites an explicit login', async () => {
    let resolveBootstrap: (value: authApi.EmployeeUser | null) => void = () => {};
    const bootstrapPromise = new Promise<authApi.EmployeeUser | null>((resolve) => {
      resolveBootstrap = resolve;
    });

    vi.spyOn(authApi, 'fetchCurrentEmployee').mockImplementation(() => bootstrapPromise);
    vi.spyOn(authApi, 'loginEmployee').mockResolvedValue(mockEmployee);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    // Fast user login during pending slow bootstrap
    await act(async () => {
      screen.getByRole('button', { name: 'Zaloguj' }).click();
    });

    // Stale bootstrap finishes later with null (unauthenticated)
    await act(async () => {
      resolveBootstrap(null);
    });

    await waitFor(() => {
      // User must remain authenticated from explicit login
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('jan@firma.pl');
    });
  });

  it('prevents race condition where refreshSession triggered DURING pending login resolves AFTER login and overwrites auth state', async () => {
    let resolveLogin: (value: authApi.EmployeeUser) => void = () => {};
    const loginPromise = new Promise<authApi.EmployeeUser>((resolve) => {
      resolveLogin = resolve;
    });

    let resolveRefresh: (value: authApi.EmployeeUser | null) => void = () => {};
    const refreshPromise = new Promise<authApi.EmployeeUser | null>((resolve) => {
      resolveRefresh = resolve;
    });

    // Initial bootstrap succeeds/finishes
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValueOnce(null);
    vi.spyOn(authApi, 'loginEmployee').mockImplementation(() => loginPromise);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });

    // 1. Start login (pending)
    act(() => {
      screen.getByRole('button', { name: 'Zaloguj' }).click();
    });

    // Mock next fetchCurrentEmployee for refreshSession
    vi.spyOn(authApi, 'fetchCurrentEmployee').mockImplementation(() => refreshPromise);

    // 2. Trigger refreshSession while login is in-flight
    act(() => {
      screen.getByRole('button', { name: 'Odswiez' }).click();
    });

    // 3. Login resolves and sets authenticated user
    await act(async () => {
      resolveLogin(mockEmployee);
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    // 4. In-flight refresh (started during login) resolves AFTER login with null
    await act(async () => {
      resolveRefresh(null);
    });

    // Regression check: The refresh started during mutation must NOT overwrite login state with null!
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('jan@firma.pl');
    });
  });

  it('prevents race condition where refresh triggered during pending register resolves after register and overwrites auth state', async () => {
    let resolveRegister: (value: authApi.EmployeeUser) => void = () => {};
    const registerPromise = new Promise<authApi.EmployeeUser>((resolve) => {
      resolveRegister = resolve;
    });

    let resolveRefresh: (value: authApi.EmployeeUser | null) => void = () => {};
    const refreshPromise = new Promise<authApi.EmployeeUser | null>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValueOnce(null);
    vi.spyOn(authApi, 'registerEmployee').mockImplementation(() => registerPromise);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });

    // Start register
    act(() => {
      screen.getByRole('button', { name: 'Zarejestruj' }).click();
    });

    vi.spyOn(authApi, 'fetchCurrentEmployee').mockImplementation(() => refreshPromise);

    // Trigger refresh during pending register
    act(() => {
      screen.getByRole('button', { name: 'Odswiez' }).click();
    });

    // Register resolves
    await act(async () => {
      resolveRegister(mockEmployee);
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    // Refresh resolves after register
    await act(async () => {
      resolveRefresh(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent('jan@firma.pl');
    });
  });

  it('prevents race condition where refresh triggered during pending logout overwrites logged out state', async () => {
    let resolveLogout: () => void = () => {};
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });

    let resolveRefresh: (value: authApi.EmployeeUser | null) => void = () => {};
    const refreshPromise = new Promise<authApi.EmployeeUser | null>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.spyOn(authApi, 'fetchCurrentEmployee').mockResolvedValueOnce(mockEmployee);
    vi.spyOn(authApi, 'logoutEmployee').mockImplementation(() => logoutPromise);

    render(
      <BrandProvider initialConfig={{ brandName: 'Test', brandLogoUrl: '', portalUrl: '', apiUrl: '/api' }}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Start logout
    act(() => {
      screen.getByRole('button', { name: 'Wyloguj' }).click();
    });

    vi.spyOn(authApi, 'fetchCurrentEmployee').mockImplementation(() => refreshPromise);

    // Trigger refresh during pending logout
    act(() => {
      screen.getByRole('button', { name: 'Odswiez' }).click();
    });

    // Logout resolves
    await act(async () => {
      resolveLogout();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');

    // Stale refresh resolves returning previous user
    await act(async () => {
      resolveRefresh(mockEmployee);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    });
  });
});
