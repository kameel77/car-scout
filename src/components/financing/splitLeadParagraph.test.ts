import { describe, expect, it } from 'vitest';
import { splitLeadParagraph } from './splitLeadParagraph';

describe('splitLeadParagraph', () => {
  it('moves only the first paragraph into the page lead', () => {
    expect(splitLeadParagraph('<h2>Temat</h2><p class="lead">Pierwszy akapit</p><p>Drugi akapit</p>')).toEqual({
      lead: 'Pierwszy akapit',
      rest: '<h2>Temat</h2><p>Drugi akapit</p>',
    });
  });

  it('leaves HTML without a paragraph unchanged', () => {
    expect(splitLeadParagraph('<h2>Temat</h2>')).toEqual({ lead: null, rest: '<h2>Temat</h2>' });
  });
});
