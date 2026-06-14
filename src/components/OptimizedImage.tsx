import React, { useState } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string | null;
    alt?: string;
    fallbackSrc?: string;
    forceThumbnail?: boolean;
}

export function OptimizedImage({
    src,
    alt = '',
    fallbackSrc = '/motolia-placeholder.png',
    forceThumbnail = false,
    className,
    ...props
}: OptimizedImageProps) {
    const [error, setError] = useState(false);

    if (!src) {
        return <img src={fallbackSrc} alt={alt} className={className} {...props} />;
    }

    if (error) {
        return <img src={fallbackSrc} alt={alt} className={className} {...props} />;
    }

    const isLocalUpload = src.startsWith('/uploads/');
    const isWebp = src.endsWith('.webp');

    if (isLocalUpload && isWebp) {
        const thumbSrc = src.replace('.webp', '-thumb.webp');
        
        if (forceThumbnail) {
            return (
                <img 
                    src={thumbSrc} 
                    alt={alt} 
                    className={className} 
                    onError={() => setError(true)}
                    {...props} 
                />
            );
        }

        return (
            <picture>
                <source media="(max-width: 768px)" srcSet={thumbSrc} />
                <img 
                    src={src} 
                    alt={alt} 
                    className={className} 
                    onError={() => setError(true)}
                    {...props} 
                />
            </picture>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt} 
            className={className} 
            onError={() => setError(true)}
            {...props} 
        />
    );
}
