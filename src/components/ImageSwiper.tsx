import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipe } from '@/hooks/useSwipe';
import { OptimizedImage } from '@/components/OptimizedImage';

interface ImageSwiperProps {
    images: string[];
    alt: string;
    aspectClassName?: string;
    fallback?: React.ReactNode;
    imgClassName?: string;
    ctaSlide?: React.ReactNode;
    /** Karta nad foldem (LCP): eager + fetchpriority=high */
    priority?: boolean;
    sizes?: string;
}

// Domyślne sizes pod grid kart ofert (1 kol. mobile, 2 sm, 3 lg, 3-4 xl)
const CARD_SIZES = '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw';

export function ImageSwiper({
    images,
    alt,
    aspectClassName = 'aspect-[16/10]',
    fallback,
    imgClassName,
    ctaSlide,
    priority = false,
    sizes = CARD_SIZES,
}: ImageSwiperProps) {
    const [index, setIndex] = React.useState(0);
    const total = images.length + (ctaSlide ? 1 : 0);

    const goPrev = React.useCallback(() => {
        setIndex((i) => (i === 0 ? total - 1 : i - 1));
    }, [total]);

    const goNext = React.useCallback(() => {
        setIndex((i) => (i === total - 1 ? 0 : i + 1));
    }, [total]);

    const swipe = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goPrev });

    const handleNavClick = (e: React.MouseEvent, dir: 'prev' | 'next') => {
        e.preventDefault();
        e.stopPropagation();
        if (dir === 'prev') goPrev();
        else goNext();
    };

    const handleDotClick = (e: React.MouseEvent, i: number) => {
        e.preventDefault();
        e.stopPropagation();
        setIndex(i);
    };

    if (total === 0) {
        return (
            <div className={cn('relative overflow-hidden bg-muted', aspectClassName)}>
                {fallback}
            </div>
        );
    }

    const showNav = total > 1;

    return (
        <div
            className={cn('relative overflow-hidden bg-muted touch-pan-y select-none', aspectClassName)}
            {...swipe}
        >
            {ctaSlide && index === images.length ? (
                <div className="h-full w-full">{ctaSlide}</div>
            ) : (
                <OptimizedImage
                    src={images[index]}
                    alt={alt}
                    draggable={false}
                    priority={priority && index === 0}
                    sizes={sizes}
                    ladder="card"
                    className={cn('h-full w-full object-cover transition-transform duration-500', imgClassName)}
                />
            )}

            {showNav && (
                <>
                    <button
                        type="button"
                        aria-label="Poprzednie zdjęcie"
                        onClick={(e) => handleNavClick(e, 'prev')}
                        className={cn(
                            'absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center',
                            'h-10 w-10 rounded-full bg-background/80 text-foreground shadow-sm',
                            'opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity',
                        )}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Następne zdjęcie"
                        onClick={(e) => handleNavClick(e, 'next')}
                        className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center',
                            'h-10 w-10 rounded-full bg-background/80 text-foreground shadow-sm',
                            'opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity',
                        )}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full font-medium tabular-nums">
                        {index + 1} / {total}
                    </div>
                </>
            )}
        </div>
    );
}
