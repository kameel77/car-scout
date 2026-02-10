
import { Helmet } from 'react-helmet-async';

interface MetaHeadProps {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: string;
    schema?: object; // JSON-LD
}

export function MetaHead({
    title,
    description,
    image,
    url,
    type = 'website',
    schema
}: MetaHeadProps) {
    const siteUrl = window.location.origin;
    const fullUrl = url ? (url.startsWith('http') ? url : `${siteUrl}${url}`) : window.location.href;
    const fullImage = image ? (image.startsWith('http') ? image : `${siteUrl}${image}`) : undefined;

    return (
        <Helmet>
            {title && <title>{title}</title>}
            {description && <meta name="description" content={description} />}

            {/* OG Tags */}
            {title && <meta property="og:title" content={title} />}
            {description && <meta property="og:description" content={description} />}
            {fullImage && <meta property="og:image" content={fullImage} />}
            <meta property="og:url" content={fullUrl} />
            <meta property="og:type" content={type} />

            {/* Twitter Cards */}
            <meta name="twitter:card" content="summary_large_image" />
            {title && <meta name="twitter:title" content={title} />}
            {description && <meta name="twitter:description" content={description} />}
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
