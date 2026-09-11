import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchCsrfToken,
  validateCompanyCode,
  loginEmployee,
  registerEmployee,
  fetchCurrentEmployee,
  logoutEmployee,
} from './auth-api';

describe('Employee Portal Auth API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchCsrfToken calls GET /api/employee/auth/csrf and returns token', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ csrfToken: 'test-csrf-123', headerName: 'X-CSRF-Token' }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const token = await fetchCsrfToken('/api');
    expect(token).toBe('test-csrf-123');
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/auth/csrf', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('validateCompanyCode sends POST with code and returns validation details', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        valid: true,
        companyId: 'comp_1',
        companyName: 'Action S.A.',
        programId: 'prog_1',
        programName: 'Action Auto Program',
      }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const result = await validateCompanyCode('/api', 'ACTION-2026');
    expect(result).toEqual({
      valid: true,
      companyId: 'comp_1',
      companyName: 'Action S.A.',
      programId: 'prog_1',
      programName: 'Action Auto Program',
    });
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/auth/validate-code', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ code: 'ACTION-2026' }),
    });
  });

  it('loginEmployee sends credentials and X-CSRF-Token, returns employee object', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'csrf-abc', headerName: 'X-CSRF-Token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          employee: {
            id: 'acc_123',
            email: 'jan@action.pl',
            firstName: 'Jan',
            lastName: 'Kowalski',
            phone: '+48123456789',
            company: { id: 'c1', name: 'Action S.A.', slug: 'action' },
            program: { id: 'p1', name: 'Action Program', slug: 'action-prog' },
          },
        }),
      });
    vi.stubGlobal('fetch', fakeFetch);

    const employee = await loginEmployee('/api', {
      email: 'jan@action.pl',
      password: 'Password123!',
    });

    expect(employee.email).toBe('jan@action.pl');
    expect(fakeFetch).toHaveBeenCalledTimes(2);
    expect(fakeFetch).toHaveBeenNthCalledWith(1, '/api/employee/auth/csrf', expect.anything());
    expect(fakeFetch).toHaveBeenNthCalledWith(2, '/api/employee/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': 'csrf-abc',
      },
      body: JSON.stringify({
        email: 'jan@action.pl',
        password: 'Password123!',
      }),
    });
  });

  it('registerEmployee sends registration payload and X-CSRF-Token, returns employee', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'csrf-xyz', headerName: 'X-CSRF-Token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          employee: {
            id: 'acc_456',
            email: 'adam@action.pl',
            firstName: 'Adam',
            lastName: 'Nowak',
            phone: '+48987654321',
            company: { id: 'c1', name: 'Action S.A.', slug: 'action' },
            program: { id: 'p1', name: 'Action Program', slug: 'action-prog' },
          },
        }),
      });
    vi.stubGlobal('fetch', fakeFetch);

    const employee = await registerEmployee('/api', {
      code: 'ACTION-2026',
      email: 'adam@action.pl',
      password: 'Password123!',
      firstName: 'Adam',
      lastName: 'Nowak',
      phone: '+48987654321',
    });

    expect(employee.id).toBe('acc_456');
    expect(fakeFetch).toHaveBeenNthCalledWith(2, '/api/employee/auth/register', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': 'csrf-xyz',
      },
      body: JSON.stringify({
        code: 'ACTION-2026',
        email: 'adam@action.pl',
        password: 'Password123!',
        firstName: 'Adam',
        lastName: 'Nowak',
        phone: '+48987654321',
      }),
    });
  });

  it('fetchCurrentEmployee calls GET /api/employee/auth/me and returns employee on 200', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        employee: {
          id: 'acc_123',
          email: 'jan@action.pl',
          firstName: 'Jan',
          lastName: 'Kowalski',
          phone: '+48123456789',
          company: { id: 'c1', name: 'Action S.A.', slug: 'action' },
          program: { id: 'p1', name: 'Action Program', slug: 'action-prog' },
        },
      }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const employee = await fetchCurrentEmployee('/api');
    expect(employee?.email).toBe('jan@action.pl');
    expect(fakeFetch).toHaveBeenCalledWith('/api/employee/auth/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
      },
    });
  });

  it('fetchCurrentEmployee returns null on 401 Unauthorized', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const employee = await fetchCurrentEmployee('/api');
    expect(employee).toBeNull();
  });

  it('logoutEmployee fetches CSRF and calls POST /api/employee/auth/logout', async () => {
    const fakeFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfToken: 'csrf-logout', headerName: 'X-CSRF-Token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Wylogowano pomyślnie' }),
      });
    vi.stubGlobal('fetch', fakeFetch);

    await logoutEmployee('/api');
    expect(fakeFetch).toHaveBeenNthCalledWith(2, '/api/employee/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-Token': 'csrf-logout',
      },
    });
  });

  it('throws descriptive error on API failure', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Nieprawidłowy login lub hasło' }),
    });
    vi.stubGlobal('fetch', fakeFetch);

    await expect(loginEmployee('/api', { email: 'wrong@test.pl', password: 'bad' })).rejects.toThrow(
      'Nieprawidłowy login lub hasło'
    );
  });
});
