import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';

export interface SeoConfig {
    gtmId?: string;
    homeTitle?: string;
    homeDescription?: string;
    homeOgImage?: string;
    listingTitle?: string;
    listingDescription?: string;
}

export function useSeoConfig() {
    return useQuery<SeoConfig>({
        queryKey: ['seo-config'],
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/seo`);
            if (!res.ok) throw new Error('Failed to fetch SEO config');
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function SeoManager() {
    const { data: seoConfig } = useSeoConfig();

    useEffect(() => {
        if (seoConfig?.gtmId) {
            const gtmId = seoConfig.gtmId;
            // Google Tag Manager
            (function (w: any, d: any, s: any, l: any, i: any) {
                w[l] = w[l] || []; w[l].push({
                    'gtm.start':
                        new Date().getTime(), event: 'gtm.js'
                }); var f = d.getElementsByTagName(s)[0],
                    j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : ''; j.async = true; j.src =
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
            <title>{seoConfig?.homeTitle || 'Car Scout'}</title>
        </Helmet>
    );
}
