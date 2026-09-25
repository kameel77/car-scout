import { describe, it, expect } from 'vitest';
import { isLeasingEligibleByAge, LEASING_MAX_VEHICLE_AGE_YEARS } from './financingEligibility';

describe('isLeasingEligibleByAge', () => {
  const now = new Date('2026-09-25T12:00:00Z');

  it('allows vehicles up to the max age', () => {
    expect(LEASING_MAX_VEHICLE_AGE_YEARS).toBe(5);
    expect(isLeasingEligibleByAge(2026, now)).toBe(true);
    expect(isLeasingEligibleByAge(2021, now)).toBe(true);
  });

  it('rejects vehicles older than the max age', () => {
    expect(isLeasingEligibleByAge(2020, now)).toBe(false);
    expect(isLeasingEligibleByAge(2012, now)).toBe(false);
  });

  it('treats a missing production year as eligible', () => {
    expect(isLeasingEligibleByAge(null, now)).toBe(true);
    expect(isLeasingEligibleByAge(undefined, now)).toBe(true);
  });
});
