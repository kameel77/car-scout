import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RentalApiError, rentalPublicApi } from '../rental-api';

describe('rentalPublicApi.getVehicle and RentalApiError', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('creates RentalApiError with status and message', () => {
        const err = new RentalApiError('Vehicle not found', 404);
        expect(err.name).toBe('RentalApiError');
        expect(err.message).toBe('Vehicle not found');
        expect(err.status).toBe(404);
    });

    it('throws RentalApiError with status 404 when response is 404', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        }));

        await expect(rentalPublicApi.getVehicle('non-existent-slug')).rejects.toMatchObject({
            name: 'RentalApiError',
            status: 404,
            message: 'Vehicle not found',
        });
    });

    it('throws RentalApiError with status 500 when response is 500', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
        }));

        await expect(rentalPublicApi.getVehicle('some-slug')).rejects.toMatchObject({
            name: 'RentalApiError',
            status: 500,
            message: 'Failed to fetch vehicle (500)',
        });
    });
});
