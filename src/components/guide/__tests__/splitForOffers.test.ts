import { describe, expect, it } from 'vitest';
import { splitForOffers } from '../splitForOffers';

const sec = (n: number, len = 200) => `<h2 id="s${n}">S${n}</h2><p>${'x'.repeat(len)}</p>`;

describe('splitForOffers', () => {
  it('splits at an H2 boundary near 40% of the text, never before the second section', () => {
    const html = [1, 2, 3, 4, 5].map((n) => sec(n)).join('');
    const [before, after] = splitForOffers(html);
    expect(before + after).toBe(html);
    expect(after.startsWith('<h2 id="s3">')).toBe(true);
  });

  it('never splits inside the FAQ section', () => {
    const html = sec(1) + sec(2, 20) + '<section class="guide-faq"><h2 id="faq">FAQ</h2><h3>Q</h3><p>A</p></section>';
    const [before, after] = splitForOffers(html);
    expect(after.startsWith('<h2 id="s2">')).toBe(true);
    expect(before).not.toContain('guide-faq');
  });

  it('falls back to "before FAQ" (or the end) when there is only one section', () => {
    const faq = '<section class="guide-faq"><h2>FAQ</h2></section>';
    expect(splitForOffers(sec(1) + faq)).toEqual([sec(1), faq]);
    expect(splitForOffers(sec(1))).toEqual([sec(1), '']);
  });
});
