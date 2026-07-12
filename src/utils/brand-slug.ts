/**
 * Slugifier dla marek/modeli (strony /samochody/:marka[/:model]) — duplikat
 * backend/src/services/brand-pages.service.ts:slugifyBrandName (musi zostać z nim
 * zsynchronizowany, żeby slug wybrany w adminie zawsze pasował do kanonicznego sluga
 * wyliczanego na serwerze).
 *
 * Marki motoryzacyjne noszą diakrytyki spoza polskiego alfabetu (czeskie Škoda,
 * francuskie Citroën), więc oprócz mapy polskich znaków dokładamy ogólną dekompozycję
 * Unicode (NFD) jako fallback. Celowo nie reużywa sanitizeForSlug z url-utils.ts (slugi
 * ofert) — inny cel, nie dotykamy istniejących slugów ofert.
 */
const POLISH_CHARS: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
  'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
  'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
};

// Zakres Unicode combining diacritical marks (U+0300–U+036F) — to, co zostaje po
// normalize('NFD') rozbiciu znaku typu Š/ë na literę bazową + oddzielny znak akcentu.
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

export function slugifyBrandName(text: string): string {
  const polishMapped = text.split('').map((ch) => POLISH_CHARS[ch] || ch).join('');
  const asciiish = polishMapped.normalize('NFD').replace(COMBINING_MARKS_RE, '');
  return asciiish
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
