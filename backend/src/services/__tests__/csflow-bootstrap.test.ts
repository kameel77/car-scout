import { describe, it, expect } from 'vitest';
import { parseCsflowCarId } from '../csflow-bootstrap.js';

describe('parseCsflowCarId', () => {
    it('parsuje legacy format csflow-{carId}', () => {
        expect(parseCsflowCarId('csflow-35203')).toBe(35203);
    });

    it('zwraca null dla nowego formatu csflow-{slug}-{carId}', () => {
        expect(parseCsflowCarId('csflow-carsed-35203')).toBeNull();
    });

    it('zwraca null dla null, pustego stringa i innych źródeł', () => {
        expect(parseCsflowCarId(null)).toBeNull();
        expect(parseCsflowCarId('')).toBeNull();
        expect(parseCsflowCarId('otomoto-123')).toBeNull();
        expect(parseCsflowCarId('csflow-')).toBeNull();
    });
});
