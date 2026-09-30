import { describe, expect, it } from 'vitest';
import { PILLAR_BENEFITS, PILLAR_CALC_MIN_H, PILLAR_TYPES } from './components/pillar/pillarContent';
import { splitLeadParagraph } from './components/financing/splitLeadParagraph';
import {
  PILLAR_BENEFITS as BACKEND_BENEFITS,
  PILLAR_CALC_MIN_H as BACKEND_MIN_H,
  pillarLead,
  pillarShellHtml,
} from '../backend/src/services/pillar-shell';
import { getFinancingArticle } from '../backend/src/content/financing-content';

describe('pillar SSR shell stays in sync with FinancingPillarPage', () => {
  it('benefits and calculator min-heights are equal in frontend and backend', () => {
    expect(BACKEND_BENEFITS).toEqual(PILLAR_BENEFITS);
    expect(BACKEND_MIN_H).toEqual(PILLAR_CALC_MIN_H);
  });

  it('lead extraction matches splitLeadParagraph for the real articles', () => {
    for (const type of PILLAR_TYPES) {
      const article = getFinancingArticle('motolia', `/${type}`)!;
      expect(pillarLead(article.html)).toBe(splitLeadParagraph(article.html).lead);
    }
  });

  it('renders H1, lead, benefits and a sized calculator placeholder, escaping text', () => {
    const html = pillarShellHtml('kredyt', { h1: 'A <b>&</b> "B"', html: '<p>Lead <i>x</i> & y</p><p>reszta</p>' });
    expect(html).toContain('<h1 class="text-3xl font-bold text-foreground leading-tight">A &lt;b&gt;&amp;&lt;/b&gt; &quot;B&quot;</h1>');
    expect(html).toContain('>Lead &lt;i&gt;x&lt;/i&gt; &amp; y</p>');
    expect(html).not.toContain('reszta');
    for (const b of PILLAR_BENEFITS.kredyt) expect(html).toContain(`<span>${b}</span>`);
    expect(html).toContain(PILLAR_CALC_MIN_H.kredyt);
  });

  it('returns nothing when the brand has no article', () => {
    expect(pillarShellHtml('leasing', null)).toBe('');
  });
});
