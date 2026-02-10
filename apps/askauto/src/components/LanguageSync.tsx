import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSettings } from '@/hooks/useAppSettings';

const PRIORITY = ['pl', 'de', 'en'];

export function LanguageSync() {
    const { i18n } = useTranslation();
    const { data: settings, isLoading } = useAppSettings();

    React.useEffect(() => {
        // Only proceed once settings are loaded
        if (isLoading || !settings?.enabledLanguages) return;

        const enabled = settings.enabledLanguages;

        // i18next-browser-languagedetector already populated i18n.language from localStorage/navigator
        // We just need to ensure the choice is valid (enabled)
        const current = i18n.language?.split('-')[0]; // Handle cases like 'pl-PL' -> 'pl'

        if (current && enabled.includes(current)) {
            // Current language is valid and enabled, nothing to do
            return;
        }

        // Current is disabled or missing. Pick the best default based on PRIORITY.
        const bestDefault = PRIORITY.find(p => enabled.includes(p)) || enabled[0];

        if (bestDefault && bestDefault !== current) {
            console.log(`[LanguageSync] Switching from ${current} to ${bestDefault} (enabled: ${enabled})`);
            i18n.changeLanguage(bestDefault);
        }
    }, [settings?.enabledLanguages, isLoading, i18n]);

    return null;
}
