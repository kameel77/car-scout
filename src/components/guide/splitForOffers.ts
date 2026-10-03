/**
 * Miejsce na wtrącenie sprzedażowe (rząd ofert) w treści poradnika: granica sekcji H2
 * najbliższa ~40% długości tekstu, ale nie wcześniej niż po pierwszej sekcji i nie w FAQ.
 * Zwraca [przed, po]; gdy nie ma sensownej granicy, oferty idą przed FAQ albo na koniec.
 */
const FAQ_OPEN = '<section class="guide-faq">';

export function splitForOffers(html: string): [string, string] {
  const faqAt = html.indexOf(FAQ_OPEN);
  const end = faqAt >= 0 ? faqAt : html.length;
  const target = end * 0.4;

  const candidates: number[] = [];
  const re = /<h2[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index < end) candidates.push(m.index);
  }
  // Pierwszy H2 bywa zaraz po wstępie: oferty dopiero po co najmniej jednej pełnej sekcji.
  const eligible = candidates.slice(1);
  if (eligible.length === 0) return [html.slice(0, end), html.slice(end)];

  const at = eligible.reduce((best, i) => (Math.abs(i - target) < Math.abs(best - target) ? i : best));
  return [html.slice(0, at), html.slice(at)];
}
