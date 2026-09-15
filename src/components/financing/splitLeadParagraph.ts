/**
 * Separates the first paragraph used as the page lead from the remainder rendered
 * in the below-the-fold pillar article.
 */
export function splitLeadParagraph(html: string): { lead: string | null; rest: string } {
  const match = html.match(/<p[^>]*>[\s\S]*?<\/p>/i);
  if (!match || match.index == null) return { lead: null, rest: html };
  const lead = match[0].replace(/<\/?p[^>]*>/gi, '').trim();
  const rest = html.slice(0, match.index) + html.slice(match.index + match[0].length);
  return { lead, rest };
}
