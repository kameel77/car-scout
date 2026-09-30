import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n, { detectLanguage } from './index';

describe('language detection', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('prefers the i18nextLng value from localStorage', () => {
    localStorage.setItem('i18nextLng', 'de');
    expect(detectLanguage()).toBe('de');
  });

  it('falls back to navigator.language when nothing is stored', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US');
    expect(detectLanguage()).toBe('en-US');
  });

  it('falls back to pl when localStorage throws and navigator has no language', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('');
    expect(detectLanguage()).toBe('pl');
  });

  it('persists the language under i18nextLng on languageChanged', async () => {
    await i18n.changeLanguage('pl');
    expect(localStorage.getItem('i18nextLng')).toBe('pl');
  });

  it('does not throw when localStorage.setItem fails', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    await expect(i18n.changeLanguage('pl')).resolves.toBeDefined();
  });
});
