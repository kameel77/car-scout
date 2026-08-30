import React, { useState } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string | null;
    alt?: string;
    fallbackSrc?: string;
    forceThumbnail?: boolean;
    /** Obraz nad foldem (LCP): eager + fetchpriority=high zamiast lazy */
    priority?: boolean;
    /** Wariant mobile (<768px). Gdy podany, renderujemy <picture> zamiast dwóch <img>. */
    mobileSrc?: string | null;
    /** Czy pokazywać szary placeholder motolii gdy brak src lub błąd ładowania */
    allowPlaceholder?: boolean;
}

// Pipeline (image-optimizer.ts) zachowuje proporcje oryginału; zdjęcia aut to
// w praktyce 16:9 — te wymiary służą przeglądarce tylko jako intrinsic ratio
// (rozmiar na stronie i tak wyznacza kontener z aspect-ratio + object-cover).
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 675;
const THUMB_W = 600;
const THUMB_H = 338;

function localVariants(src: string): string | null {
    if (!src.startsWith('/uploads/') || !src.endsWith('.webp')) return null;
    const base = src.slice(0, -'.webp'.length);
    return `${base}-thumb.webp ${THUMB_W}w, ${base}-md.webp 900w, ${base}.webp 1920w`;
}

type Mode = 'srcset' | 'plain' | 'fallback';

export function OptimizedImage({
    src,
    mobileSrc,
    alt = '',
    fallbackSrc = '/motolia-placeholder.webp',
    forceThumbnail = false,
    priority = false,
    allowPlaceholder = true,
    className,
    sizes,
    ...props
}: OptimizedImageProps) {
    // Degradacja per-src: srcset (pełen zestaw wariantów) → plain (sam duży plik,
    // gdy wariant -md/-thumb nie istnieje na dysku) → fallback (placeholder).
    // Klucz po src, żeby błąd jednego zdjęcia nie psuł kolejnych w swiperze.
    // Znany edge case: jeśli wariant obrazka zwróci 404, onError degraduje do trybu plain
    // i gubi <picture> (mobile pobiera wtedy plik desktopowy podany w src).
    // Warunek wyzwalający wywróciłby też SSR, więc to zachowanie zamierzone/akceptowalne.
    const [failed, setFailed] = useState<{ src: string; mode: Mode } | null>(null);
    const mode: Mode = failed && failed.src === src ? failed.mode : 'srcset';
    const degradeTo = (m: Mode) => setFailed({ src: src ?? '', mode: m });

    const loadingAttrs = priority
        ? { loading: 'eager' as const, decoding: 'async' as const, ...({ fetchpriority: 'high' } as object) }
        : { loading: 'lazy' as const, decoding: 'async' as const };

    if (!src || mode === 'fallback') {
        if (!allowPlaceholder) return null;
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

        const img = (
            <img
                src={src}
                srcSet={localVariants(src) ?? undefined}
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

        const webpSource = localVariants(src);

        if (mobileSrc) {
            const mobileWebp = localVariants(mobileSrc);
            return (
                <picture>
                    {mobileWebp && <source media="(max-width: 767px)" type="image/webp" srcSet={mobileWebp} sizes={sizes ?? '100vw'} />}
                    {webpSource && <source type="image/webp" srcSet={webpSource} sizes={sizes ?? '100vw'} />}
                    {img}
                </picture>
            );
        }

        if (webpSource) {
            return (
                <picture>
                    {webpSource && <source type="image/webp" srcSet={webpSource} sizes={sizes ?? '100vw'} />}
                    {img}
                </picture>
            );
        }

        return img;
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
