/**
 * Zwraca poprawną polską formę gramatyczną liczebnika dla liczby n.
 * forms: [forma_dla_1, forma_dla_2_4, forma_dla_reszty]
 * 
 * Przykłady:
 * - pluralPl(1, ['wariant', 'warianty', 'wariantów']) => 'wariant'
 * - pluralPl(2, ['wariant', 'warianty', 'wariantów']) => 'warianty'
 * - pluralPl(5, ['wariant', 'warianty', 'wariantów']) => 'wariantów'
 * - pluralPl(12, ['wariant', 'warianty', 'wariantów']) => 'wariantów'
 * - pluralPl(22, ['wariant', 'warianty', 'wariantów']) => 'warianty'
 */
export function pluralPl(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.floor(n));
  if (abs === 1) {
    return forms[0];
  }
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 12 && mod100 <= 14) {
    return forms[2];
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1];
  }
  return forms[2];
}

/**
 * Formatuje liczbę z jej odmianą, np. formatCountPl(3, ['oferta', 'oferty', 'ofert']) => '3 oferty'
 */
export function formatCountPl(n: number, forms: [string, string, string]): string {
  return `${n} ${pluralPl(n, forms)}`;
}
