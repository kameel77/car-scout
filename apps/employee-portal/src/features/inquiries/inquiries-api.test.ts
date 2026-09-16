import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  submitEmployeeInquiry,
  fetchEmployeeInquiries,
  CreateInquiryPayload
} from './inquiries-api';
import * as authApi from '../auth/auth-api';

describe('Employee Portal Inquiries API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitEmployeeInquiry', () => {
    const validPayload: CreateInquiryPayload = {
      offerId: 'offer_123',
      idempotencyKey: 'idem_key_uuid',
      contractParty: 'CONSUMER',
      contactName: 'Jan Kowalski',
      contactEmail: 'jan@example.com',
      contactPhone: '+48 500 600 700',
      consentPrivacy: true,
      notes: 'Test inquiry notes'
    };

    it('fetches CSRF token and submits POST /employee/inquiries with same-origin credentials', async () => {
      vi.spyOn(authApi, 'fetchCsrfToken').mockResolvedValue('test_csrf_token_xyz');

      const mockResponse = {
        inquiry: {
          id: 'inq_1',
          status: 'NEW',
          referenceNumber: 'PP-12345678',
          createdAt: new Date().toISOString(),
          vehicle: {
            make: 'Toyota',
            model: 'Yaris',
            version: 'Comfort',
            productionYear: 2026,
            primaryImageUrl: 'https://img.test/yaris.jpg'
          },
          pricing: {
            listPricePln: 70000,
            employeePricePln: 65000,
            savingsPln: 5000,
            discountPct: 7.14
          }
        }
      };

      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockResponse
      });
      vi.stubGlobal('fetch', fakeFetch);

      const result = await submitEmployeeInquiry('/api', validPayload);

      expect(authApi.fetchCsrfToken).toHaveBeenCalledWith('/api');
      expect(result).toEqual(mockResponse);
      expect(fakeFetch).toHaveBeenCalledWith('/api/employee/inquiries', {
        method: 'POST',
        credentials: 'same-origin',
        signal: undefined,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': 'test_csrf_token_xyz'
        },
        body: JSON.stringify(validPayload)
      });
    });

    it('throws server error message when API responds with error status', async () => {
      vi.spyOn(authApi, 'fetchCsrfToken').mockResolvedValue('test_csrf');

      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Bad Request',
          message: 'Wymagana jest zgoda na przetwarzanie danych osobowych (RODO).'
        })
      });
      vi.stubGlobal('fetch', fakeFetch);

      await expect(submitEmployeeInquiry('/api/', validPayload)).rejects.toThrow(
        'Wymagana jest zgoda na przetwarzanie danych osobowych (RODO).'
      );
    });

    it('throws fallback status message when API error response contains no message property', async () => {
      vi.spyOn(authApi, 'fetchCsrfToken').mockResolvedValue('test_csrf');

      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Non-JSON response');
        }
      });
      vi.stubGlobal('fetch', fakeFetch);

      await expect(submitEmployeeInquiry('/api', validPayload)).rejects.toThrow('Błąd serwera (500)');
    });
  });

  describe('fetchEmployeeInquiries', () => {
    it('calls GET /employee/inquiries with query params and same-origin credentials', async () => {
      const mockResponse = {
        inquiries: [
          {
            id: 'inq_1',
            status: 'NEW',
            referenceNumber: 'PP-98765432',
            contractParty: 'CONSUMER' as const,
            createdAt: new Date().toISOString(),
            contactName: 'Jan Kowalski',
            contactEmail: 'jan@example.com',
            contactPhone: '500600700',
            nip: null,
            notes: null,
            vehicle: null,
            pricing: null,
            benefit: null
          }
        ],
        nextCursor: 'inq_2'
      };

      const fakeFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });
      vi.stubGlobal('fetch', fakeFetch);

      const result = await fetchEmployeeInquiries('/api', { limit: 10, cursor: 'inq_0' });

      expect(result).toEqual(mockResponse);
      expect(fakeFetch).toHaveBeenCalledWith('/api/employee/inquiries?limit=10&cursor=inq_0', {
        method: 'GET',
        credentials: 'same-origin',
        signal: undefined,
        headers: {
          'Accept': 'application/json'
        }
      });
    });

    it('throws error when fetching inquiries fails', async () => {
      const fakeFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Unauthorized',
          message: 'Brak aktywnej sesji pracownika.'
        })
      });
      vi.stubGlobal('fetch', fakeFetch);

      await expect(fetchEmployeeInquiries('/api')).rejects.toThrow('Brak aktywnej sesji pracownika.');
    });
  });
});
