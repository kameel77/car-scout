import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { pl } from './translations/pl';

// Zastępuje i18next-browser-languagedetector: localStorage (ten sam klucz co dotąd) → navigator → 'pl'.
const LANGUAGE_STORAGE_KEY = 'i18nextLng';

export function detectLanguage(): string {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage niedostępny (np. Safari w trybie prywatnym)
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  } catch {
    // ignore
  }
  return 'pl';
}

i18n
  .use(initReactI18next)
  .init({
    lng: detectLanguage(),
    resources: {
      pl: { translation: pl },
    },
    fallbackLng: 'pl',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export async function loadLanguageResources(lng: string): Promise<void> {
  const code = lng.split('-')[0]?.toLowerCase();
  if (code === 'en' && !i18n.hasResourceBundle('en', 'translation')) {
    const { en } = await import('./translations/en');
    i18n.addResourceBundle('en', 'translation', en, true, true);
  } else if (code === 'de' && !i18n.hasResourceBundle('de', 'translation')) {
    const { de } = await import('./translations/de');
    i18n.addResourceBundle('de', 'translation', de, true, true);
  }
}

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // ignore
  }
  loadLanguageResources(lng);
});

// If initial detected language from localStorage/navigator is en or de, load it asynchronously
const initialLng = i18n.language?.split('-')[0]?.toLowerCase();
if (initialLng && initialLng !== 'pl') {
  loadLanguageResources(initialLng);
}

export default i18n;
