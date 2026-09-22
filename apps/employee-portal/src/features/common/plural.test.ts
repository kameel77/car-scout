import { describe, it, expect } from 'vitest';
import { pluralPl, formatCountPl } from './plural';

describe('Polish Plural Forms Helper (plural.ts)', () => {
  const offerForms: [string, string, string] = ['oferta', 'oferty', 'ofert'];
  const variantForms: [string, string, string] = ['wariant', 'warianty', 'wariantów'];
  const inquiryForms: [string, string, string] = ['zapytanie', 'zapytania', 'zapytań'];

  it('handles singular form (n = 1)', () => {
    expect(pluralPl(1, offerForms)).toBe('oferta');
    expect(pluralPl(1, variantForms)).toBe('wariant');
    expect(pluralPl(1, inquiryForms)).toBe('zapytanie');
  });

  it('handles few form (n = 2, 3, 4)', () => {
    expect(pluralPl(2, offerForms)).toBe('oferty');
    expect(pluralPl(3, variantForms)).toBe('warianty');
    expect(pluralPl(4, inquiryForms)).toBe('zapytania');
  });

  it('handles many form (n = 0, 5..10)', () => {
    expect(pluralPl(0, offerForms)).toBe('ofert');
    expect(pluralPl(5, variantForms)).toBe('wariantów');
    expect(pluralPl(10, inquiryForms)).toBe('zapytań');
  });

  it('handles teen exceptions (n = 11, 12, 13, 14)', () => {
    expect(pluralPl(11, variantForms)).toBe('wariantów');
    expect(pluralPl(12, variantForms)).toBe('wariantów');
    expect(pluralPl(13, variantForms)).toBe('wariantów');
    expect(pluralPl(14, variantForms)).toBe('wariantów');
  });

  it('handles higher numbers and teen exception in higher hundreds (n = 21, 22, 25, 112, 124)', () => {
    expect(pluralPl(21, offerForms)).toBe('ofert');
    expect(pluralPl(22, offerForms)).toBe('oferty');
    expect(pluralPl(25, variantForms)).toBe('wariantów');
    expect(pluralPl(112, variantForms)).toBe('wariantów');
    expect(pluralPl(124, variantForms)).toBe('warianty');
  });

  it('formats count with plural form string', () => {
    expect(formatCountPl(1, offerForms)).toBe('1 oferta');
    expect(formatCountPl(3, offerForms)).toBe('3 oferty');
    expect(formatCountPl(12, offerForms)).toBe('12 ofert');
  });
});
