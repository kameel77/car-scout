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
}

export function ImageSwiper({
    images,
    alt,
    aspectClassName = 'aspect-[16/10]',
    fallback,
    imgClassName,
}: ImageSwiperProps) {
    const [index, setIndex] = React.useState(0);
    const total = images.length;

    const goPrev = React.useCallback(() => {
        setIndex((i) => Math.max(0, i - 1));
    }, []);

    const goNext = React.useCallback(() => {
        setIndex((i) => Math.min(total - 1, i + 1));
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
            <OptimizedImage
                src={images[index]}
                alt={alt}
                draggable={false}
                className={cn('h-full w-full object-cover transition-transform duration-500', imgClassName)}
            />

            {showNav && (
                <>
                    <button
                        type="button"
                        aria-label="Poprzednie zdjęcie"
                        onClick={(e) => handleNavClick(e, 'prev')}
                        disabled={index === 0}
                        className={cn(
                            'absolute left-2 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center',
                            'h-8 w-8 rounded-full bg-background/80 text-foreground shadow-sm',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            'disabled:opacity-30 disabled:cursor-not-allowed hover:bg-background',
                        )}
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Następne zdjęcie"
                        onClick={(e) => handleNavClick(e, 'next')}
                        disabled={index === total - 1}
                        className={cn(
                            'absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center',
                            'h-8 w-8 rounded-full bg-background/80 text-foreground shadow-sm',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            'disabled:opacity-30 disabled:cursor-not-allowed hover:bg-background',
                        )}
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                            <button
                                type="button"
                                key={i}
                                aria-label={`Zdjęcie ${i + 1}`}
                                onClick={(e) => handleDotClick(e, i)}
                                className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/60',
                                )}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
