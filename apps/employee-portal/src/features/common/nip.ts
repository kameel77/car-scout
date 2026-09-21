/**
 * Sprawdza poprawność polskiego numeru NIP według wag:
 * 6, 5, 7, 2, 3, 4, 5, 6, 7 modulo 11.
 */
export function isValidNip(nip: string): boolean {
  if (!nip) return false;
  const digits = nip.replace(/[\s-]/g, '');
  if (!/^\d{10}$/.test(digits)) return false;
  if (/^(\d)\1{9}$/.test(digits)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const checksum = sum % 11;
  if (checksum === 10) return false;
  return checksum === parseInt(digits[9], 10);
}
