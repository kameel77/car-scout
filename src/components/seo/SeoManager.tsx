import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppSettings } from '@/hooks/useAppSettings';
import React from 'react';

export interface SeoConfig {
    gtmId?: string;
    homeTitle?: string;
    homeTitleEn?: string;
    homeTitleDe?: string;
    homeDescription?: string;
    homeDescriptionEn?: string;
    homeDescriptionDe?: string;
    homeOgImage?: string;
    listingTitle?: string;
    listingTitleEn?: string;
    listingTitleDe?: string;
    listingDescription?: string;
    listingDescriptionEn?: string;
    listingDescriptionDe?: string;
}
import { seoApi } from '@/services/api';

export function useSeoConfig() {
    return useQuery<SeoConfig>({
        queryKey: ['seo-config'],
        queryFn: async () => {
            return seoApi.getConfig();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false // Reduce spam
    });
}

export function SeoManager() {
    const { data: seoConfig } = useSeoConfig();
    const { i18n } = useTranslation();
    const lang = i18n.language;
    const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

    const homeTitle = (seoConfig ? (seoConfig as any)[`homeTitle${suffix}`] : undefined) || seoConfig?.homeTitle;
    const homeDescription = (seoConfig ? (seoConfig as any)[`homeDescription${suffix}`] : undefined) || seoConfig?.homeDescription;

    const { data: settings } = useAppSettings();
    const siteName = React.useMemo(() => {
        const langCode = i18n.language.slice(0, 2).toLowerCase();
        const candidates = [
            langCode === 'en' ? settings?.siteNameEn : null,
            langCode === 'de' ? settings?.siteNameDe : null,
            langCode === 'pl' ? settings?.siteNamePl : null,
            settings?.siteNameEn,
            settings?.siteNameDe,
            settings?.siteNamePl
        ];
        const pick = candidates.find((s) => typeof s === 'string' && s.trim().length > 0);
        return pick?.trim() || 'Car Scout';
    }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl]);

    useEffect(() => {
        if (seoConfig?.gtmId) {
            const gtmId = seoConfig.gtmId;
            // Google Tag Manager
            (function (w: any, d: any, s: any, l: any, i: any) {
                w[l] = w[l] || []; w[l].push({
                    'gtm.start':
                        new Date().getTime(), event: 'gtm.js'
                });
                const f = d.getElementsByTagName(s)[0];
                const j = d.createElement(s);
                const dl = l != 'dataLayer' ? '&l=' + l : '';
                j.async = true;
                j.src =
                    'https://www.googletagmanager.com/gtm.js?id=' + i + dl; f.parentNode.insertBefore(j, f);
            })(window, document, 'script', 'dataLayer', gtmId);
        }
    }, [seoConfig?.gtmId]);

    return (
        <Helmet>
            {/* Default/Global Meta Tags */}
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            {/* Fallback title if individual pages don't set it */}
            <title>{homeTitle || siteName}</title>
            <meta name="description" content={homeDescription || ''} />
        </Helmet>
    );
}
