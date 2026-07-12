import { describe, it, expect } from 'vitest';
import { slugifyBrandName } from '@/utils/brand-slug';

describe('slugifyBrandName', () => {
  // Regresja: SearchPage rozwiązywał slug marki z /samochody/:marka przez sanitizeForSlug
  // (tylko polskie diakrytyki) — "Škoda" nie mapowało się na slug "skoda" wygenerowany przez
  // backend (slugifyBrandName z ogólną dekompozycją Unicode NFD), więc strona marki wpadała
  // w CMS-fallback/404 mimo działającego SSR.
  it('resolves Škoda to the skoda slug used by the backend', () => {
    expect(slugifyBrandName('Škoda')).toBe('skoda');
  });

  it('handles other non-Polish diacritics (Citroën)', () => {
    expect(slugifyBrandName('Citroën')).toBe('citroen');
  });

  it('still transliterates Polish diacritics', () => {
    expect(slugifyBrandName('Łódź')).toBe('lodz');
  });
});
