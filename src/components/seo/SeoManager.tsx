import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useBrand } from '@/contexts/BrandContext';
import { loadConsent, pushConsentDefault, fetchGeo } from '@/lib/consent';
import React from 'react';

export interface SeoConfig {
    gtmId?: string;
    clarityId?: string;
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
    const { config } = useBrand();
    const lang = i18n.language;
    const suffix = lang === 'pl' ? '' : lang === 'en' ? 'En' : 'De';

    const homeTitle = (seoConfig ? (seoConfig as any)[`homeTitle${suffix}`] : undefined) || seoConfig?.homeTitle;
    const homeDescription = (seoConfig ? (seoConfig as any)[`homeDescription${suffix}`] : undefined) || seoConfig?.homeDescription;

    const { data: settings } = useAppSettings();
    const siteName = React.useMemo(() => {
        if (!settings) return config.name;
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
        return pick?.trim() || config.name;
    }, [i18n.language, settings?.siteNameEn, settings?.siteNameDe, settings?.siteNamePl, settings, config.name]);

    // Clarity is loaded by the GTM tag "Clarity - Tag all pages", which is gated on
    // analytics_storage consent. It used to be initialised directly from here, which
    // bypassed the consent banner entirely — Clarity recorded sessions even after a
    // visitor rejected optional cookies. SPA navigations stay covered by
    // <ClarityPageTracker>, which calls clarity('upgrade') on every route change.
    // Do not re-add a direct init here.

    useEffect(() => {
        if (!seoConfig?.gtmId) return;
        const gtmId = seoConfig.gtmId;

        let cancelled = false;
        (async () => {
            const saved = loadConsent();
            let analytics = false;
            let marketing = false;
            if (saved) {
                analytics = saved.analytics;
                marketing = saved.marketing;
            } else {
                const geo = await fetchGeo();
                if (cancelled) return;
                if (!geo.isEEA) {
                    analytics = true;
                    marketing = true;
                }
            }
            pushConsentDefault(analytics, marketing);

            // Lazy Load GTM on user interaction to drastically improve PageSpeed
            const injectGTM = () => {
                if (cancelled || (window as any)._gtmLoaded) return;
                (window as any)._gtmLoaded = true;
                
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
            };

            // Tag Assistant preview opens the page with ?gtm_debug=... and expects the
            // container at page load — with lazy-load it times out ("Could not connect").
            // Inject immediately in debug sessions; normal visitors keep the lazy path.
            const isTagAssistantDebug = window.location.search.includes('gtm_debug')
                || document.referrer.includes('tagassistant.google.com');
            if (isTagAssistantDebug) {
                injectGTM();
                return;
            }

            // Inject GTM as soon as the main thread is idle (instead of waiting for
            // user interaction / 5s). The old lazy path made GA4 blind to sessions
            // that bounced within 5s without interacting — see docs/CRO_AUDIT_MOTOLIA_2026-07.md (P0.6).
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(injectGTM, { timeout: 2000 });
            } else {
                setTimeout(injectGTM, 200);
            }
        })();

        return () => { cancelled = true; };
    }, [seoConfig?.gtmId]);

    const finalOgTitle = seoConfig?.homeTitle || (settings as any)?.defaultOgTitle || homeTitle || siteName || config.name;
    const finalOgDescription = seoConfig?.homeDescription || (settings as any)?.defaultOgDescription || homeDescription || '';
    const finalOgImage = seoConfig?.homeOgImage || (settings as any)?.defaultOgImage || '';

    return (
        <Helmet>
            {/* Default/Global Meta Tags */}
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            {/* Fallback title if individual pages don't set it */}
            <title>{homeTitle || siteName}</title>
            <meta name="description" content={homeDescription || ''} />

            {/* OG Tags */}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={finalOgTitle} />
            <meta property="og:description" content={finalOgDescription} />
            {finalOgImage && <meta property="og:image" content={finalOgImage} />}

            {/* Twitter Tags */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={finalOgTitle} />
            <meta name="twitter:description" content={finalOgDescription} />
            {finalOgImage && <meta name="twitter:image" content={finalOgImage} />}
        </Helmet>
    );
}
