import { describe, it, expect } from 'vitest';
import { isValidNip } from './nip';

describe('isValidNip', () => {
  it('validates correct NIP numbers with and without dashes', () => {
    // Known valid NIPs
    expect(isValidNip('1234563218')).toBe(true);
    expect(isValidNip('123-456-32-18')).toBe(true);
    expect(isValidNip('5252344078')).toBe(true); // Example valid NIP
  });

  it('rejects invalid NIP numbers with incorrect checksum', () => {
    expect(isValidNip('1234563219')).toBe(false);
    expect(isValidNip('0000000000')).toBe(false);
    expect(isValidNip('1111111111')).toBe(false);
  });

  it('rejects malformed or empty NIP strings', () => {
    expect(isValidNip('')).toBe(false);
    expect(isValidNip('123')).toBe(false);
    expect(isValidNip('12345678901')).toBe(false);
    expect(isValidNip('abcdefghij')).toBe(false);
  });
});
