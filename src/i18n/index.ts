import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { pl } from './translations/pl';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: { translation: pl },
    },
    fallbackLng: 'pl',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
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
  loadLanguageResources(lng);
});

// If initial detected language from localStorage/navigator is en or de, load it asynchronously
const initialLng = i18n.language?.split('-')[0]?.toLowerCase();
if (initialLng && initialLng !== 'pl') {
  loadLanguageResources(initialLng);
}

export default i18n;
