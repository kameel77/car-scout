
import { Helmet } from 'react-helmet-async';
import { getSsrMeta } from '@/lib/ssrMeta';

interface MetaHeadProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    canonical?: string;
    type?: string;
    schema?: object; // JSON-LD
}

export function MetaHead({
    title,
    description,
    image,
    url,
    canonical,
    type = 'website',
    schema
}: MetaHeadProps) {
    // Na pierwszym renderze URL-a, który faktycznie przyszedł z SSR, wartości serwera wygrywają
    // z propsami — react-helmet-async z data-rh (seo-meta.ts injectHead) podmienia SSR-owe tagi
    // head na te z tego Helmeta, więc bez tego strony bez własnego opisu/canonical (albo z
    // opisem, który tu potrafi wyjść pusty/inny niż SSR) traciłyby poprawną, wygenerowaną przez
    // backend treść. Po nawigacji w SPA getSsrMeta() przestaje pasować i wygrywają propsy jak dotąd.
    const ssrMeta = getSsrMeta();
    const effectiveTitle = ssrMeta?.title ?? title;
    const effectiveDescription = ssrMeta?.description ?? description;
    const effectiveCanonical = ssrMeta?.canonical ?? canonical;
    const effectiveImage = ssrMeta?.ogImage ?? image;

    const siteUrl = window.location.origin;
    const fullUrl = url ? (url.startsWith('http') ? url : `${siteUrl}${url}`) : window.location.href;
    const fullImage = effectiveImage ? (effectiveImage.startsWith('http') ? effectiveImage : `${siteUrl}${effectiveImage}`) : undefined;
    const canonicalUrl = effectiveCanonical ? (effectiveCanonical.startsWith('http') ? effectiveCanonical : `${siteUrl}${effectiveCanonical}`) : undefined;

    return (
        <Helmet>
            {effectiveTitle && <title>{effectiveTitle}</title>}
            {effectiveDescription && <meta name="description" content={effectiveDescription} />}

            {/* Canonical URL */}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* OG Tags */}
            {effectiveTitle && <meta property="og:title" content={effectiveTitle} />}
            {effectiveDescription && <meta property="og:description" content={effectiveDescription} />}
            {fullImage && <meta property="og:image" content={fullImage} />}
            <meta property="og:url" content={canonicalUrl || fullUrl} />
            <meta property="og:type" content={type} />

            {/* Twitter Cards */}
            <meta name="twitter:card" content="summary_large_image" />
            {effectiveTitle && <meta name="twitter:title" content={effectiveTitle} />}
            {effectiveDescription && <meta name="twitter:description" content={effectiveDescription} />}
            {fullImage && <meta name="twitter:image" content={fullImage} />}

            {/* Structured Data (JSON-LD) */}
            {schema && (
                <script type="application/ld+json">
                    {JSON.stringify(schema)}
                </script>
            )}
        </Helmet>
    );
}
