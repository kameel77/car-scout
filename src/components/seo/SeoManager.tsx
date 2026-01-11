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
            // Determine API URL: prefer VITE_API_URL, fallback to direct localhost:3000 for dev to bypass potential proxy issues
            const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000';
            const endpoint = `${apiUrl}/api/seo`;

            console.log(`[useSeoConfig] Fetching SEO config from: ${endpoint}`);

            try {
                const res = await fetch(endpoint);
                console.log(`[useSeoConfig] Response status: ${res.status}`);

                if (!res.ok) {
                    const text = await res.text();
                    console.error('[useSeoConfig] Error response:', text);
                    throw new Error(`Failed to fetch SEO config: ${res.status}`);
                }

                const data = await res.json();
                console.log('[useSeoConfig] Data received:', data);
                return data;
            } catch (error) {
                console.error('[useSeoConfig] Fetch error:', error);
                throw error;
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false // Reduce spam
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
