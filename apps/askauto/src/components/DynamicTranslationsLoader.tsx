import React from 'react';
import { useQuery } from '@tanstack/react-query';
import i18n from '@/i18n';
import { translations as staticTranslations } from '@/i18n/translations';
import { translationsApi } from '@/services/api';
import { getFeatureKey, getTechnicalTranslationKey } from '@/utils/i18n-utils';
import type { TranslationEntry } from '@/types/translations';

const SUPPORTED_LANGS = ['pl', 'en', 'de'] as const;

function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function setNestedValue(target: any, path: string, value: string) {
  const parts = path.split('.');
  let current = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

function buildMergedBundle(language: string, entries: TranslationEntry[]) {
  const base = cloneDeep((staticTranslations as any)[language]?.translation || {});

  entries.forEach((entry) => {
    const key =
      entry.category === 'feature'
        ? `features.${getFeatureKey(entry.sourceValue)}`
        : getTechnicalTranslationKey(entry.category, entry.sourceValue);

    if (!key) return;

    const valueForLang =
      language === 'pl'
        ? entry.pl || entry.sourceValue
        : language === 'en'
          ? entry.en
          : entry.de;

    if (valueForLang) {
      setNestedValue(base, key, valueForLang);
    }
  });

  return base;
}

export function DynamicTranslationsLoader() {
  const { data } = useQuery({
    queryKey: ['dynamic-translations'],
    queryFn: async () => translationsApi.list(),
    staleTime: 1000 * 60 * 5,
  });

  React.useEffect(() => {
    if (!data?.translations) return;

    const entries = data.translations as TranslationEntry[];

    SUPPORTED_LANGS.forEach((lang) => {
      const mergedBundle = buildMergedBundle(lang, entries);
      i18n.addResourceBundle(lang, 'translation', mergedBundle, true, true);
    });
  }, [data?.translations]);

  return null;
}
