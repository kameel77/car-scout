import { describe, expect, it } from 'vitest';
import { normalizePhone } from './customer.service.js';

describe('normalizePhone', () => {
  it.each([
    ['123123123', '+48123123123'],
    ['48123123123', '+48123123123'],
    ['+48 123 123 123', '+48123123123'],
    ['0048123123123', '+48123123123'],
  ])('normalizes %s to one canonical Polish number', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});
