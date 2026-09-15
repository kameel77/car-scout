import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContextModule from './AuthContext';

describe('ProtectedRoute component', () => {
  it('renders loading spinner/indicator while auth state is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isServiceUnavailable: false,
      sessionError: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/katalog']}>
        <Routes>
          <Route
            path="/katalog"
            element={
              <ProtectedRoute>
                <div>Katalog chroniony</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Weryfikacja sesji pracowniczej/i)).toBeInTheDocument();
    expect(screen.queryByText('Katalog chroniony')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /logowanie with return redirect', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isServiceUnavailable: false,
      sessionError: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/katalog']}>
        <Routes>
          <Route
            path="/katalog"
            element={
              <ProtectedRoute>
                <div>Katalog chroniony</div>
              </ProtectedRoute>
            }
          />
          <Route path="/logowanie" element={<div>Strona logowania</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Strona logowania')).toBeInTheDocument();
    expect(screen.queryByText('Katalog chroniony')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'acc_1',
        email: 'jan@firma.pl',
        firstName: 'Jan',
        lastName: 'Kowalski',
        company: { id: 'c1', name: 'Firma', slug: 'firma' },
        program: { id: 'p1', name: 'Program', slug: 'program' },
      },
      isAuthenticated: true,
      isLoading: false,
      isServiceUnavailable: false,
      sessionError: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/katalog']}>
        <Routes>
          <Route
            path="/katalog"
            element={
              <ProtectedRoute>
                <div>Katalog chroniony</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Katalog chroniony')).toBeInTheDocument();
  });

  it('renders outage screen with retry button when service is unavailable (does not redirect)', () => {
    const refreshSessionSpy = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isServiceUnavailable: true,
      sessionError: 'Awaria serwera (503)',
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshSession: refreshSessionSpy,
    });

    render(
      <MemoryRouter initialEntries={['/katalog']}>
        <Routes>
          <Route
            path="/katalog"
            element={
              <ProtectedRoute>
                <div>Katalog chroniony</div>
              </ProtectedRoute>
            }
          />
          <Route path="/logowanie" element={<div>Strona logowania</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Strona logowania')).not.toBeInTheDocument();
    expect(screen.queryByText('Katalog chroniony')).not.toBeInTheDocument();
    expect(screen.getByText('Usługa tymczasowo niedostępna')).toBeInTheDocument();
    expect(screen.getByText('Awaria serwera (503)')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /Spróbuj ponownie/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(refreshSessionSpy).toHaveBeenCalled();
  });
});
