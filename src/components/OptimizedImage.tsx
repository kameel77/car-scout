import React, { useState } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string | null;
    alt?: string;
    fallbackSrc?: string;
    forceThumbnail?: boolean;
    /** Obraz nad foldem (LCP): eager + fetchpriority=high zamiast lazy */
    priority?: boolean;
}

// Pipeline (image-optimizer.ts) zachowuje proporcje oryginału; zdjęcia aut to
// w praktyce 16:9 — te wymiary służą przeglądarce tylko jako intrinsic ratio
// (rozmiar na stronie i tak wyznacza kontener z aspect-ratio + object-cover).
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 675;
const THUMB_W = 600;
const THUMB_H = 338;

type Mode = 'srcset' | 'plain' | 'fallback';

export function OptimizedImage({
    src,
    alt = '',
    fallbackSrc = '/motolia-placeholder.webp',
    forceThumbnail = false,
    priority = false,
    className,
    sizes,
    ...props
}: OptimizedImageProps) {
    // Degradacja per-src: srcset (pełen zestaw wariantów) → plain (sam duży plik,
    // gdy wariant -md/-thumb nie istnieje na dysku) → fallback (placeholder).
    // Klucz po src, żeby błąd jednego zdjęcia nie psuł kolejnych w swiperze.
    const [failed, setFailed] = useState<{ src: string; mode: Mode } | null>(null);
    const mode: Mode = failed && failed.src === src ? failed.mode : 'srcset';
    const degradeTo = (m: Mode) => setFailed({ src: src ?? '', mode: m });

    const loadingAttrs = priority
        ? { loading: 'eager' as const, decoding: 'async' as const, ...({ fetchpriority: 'high' } as object) }
        : { loading: 'lazy' as const, decoding: 'async' as const };

    if (!src || mode === 'fallback') {
        return (
            <img
                src={fallbackSrc}
                alt={alt}
                className={className}
                width={DEFAULT_WIDTH}
                height={DEFAULT_HEIGHT}
                {...loadingAttrs}
                {...props}
            />
        );
    }

    const isLocalUpload = src.startsWith('/uploads/');
    const isWebp = src.endsWith('.webp');

    if (isLocalUpload && isWebp && mode === 'srcset') {
        const base = src.slice(0, -'.webp'.length);
        const thumbSrc = `${base}-thumb.webp`;
        const mediumSrc = `${base}-md.webp`;

        if (forceThumbnail) {
            return (
                <img
                    src={thumbSrc}
                    alt={alt}
                    className={className}
                    width={THUMB_W}
                    height={THUMB_H}
                    onError={() => degradeTo('plain')}
                    {...loadingAttrs}
                    {...props}
                />
            );
        }

        return (
            <img
                src={src}
                srcSet={`${thumbSrc} ${THUMB_W}w, ${mediumSrc} 1200w, ${src} 1920w`}
                sizes={sizes ?? '100vw'}
                alt={alt}
                className={className}
                width={DEFAULT_WIDTH}
                height={DEFAULT_HEIGHT}
                onError={() => degradeTo('plain')}
                {...loadingAttrs}
                {...props}
            />
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            width={DEFAULT_WIDTH}
            height={DEFAULT_HEIGHT}
            onError={() => degradeTo('fallback')}
            {...loadingAttrs}
            {...props}
        />
    );
}
