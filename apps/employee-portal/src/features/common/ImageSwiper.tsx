import React, { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Car } from 'lucide-react';
import { useSwipe } from './useSwipe';

export interface ImageSwiperProps {
  images: string[];
  alt: string;
  aspectClassName?: string;
  fallback?: React.ReactNode;
  imgClassName?: string;
}

export const ImageSwiper: React.FC<ImageSwiperProps> = ({
  images,
  alt,
  aspectClassName = 'aspect-[16/10]',
  fallback,
  imgClassName = 'w-full h-full object-cover',
}) => {
  const [index, setIndex] = useState(0);
  const total = images.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i === 0 ? total - 1 : i - 1));
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((i) => (i === total - 1 ? 0 : i + 1));
  }, [total]);

  const swipe = useSwipe({ onSwipeLeft: goNext, onSwipeRight: goPrev });

  const handleNavClick = (e: React.MouseEvent, dir: 'prev' | 'next') => {
    e.preventDefault();
    e.stopPropagation();
    if (dir === 'prev') goPrev();
    else goNext();
  };

  if (total === 0) {
    return (
      <div className={`relative overflow-hidden bg-gray-100 flex items-center justify-center ${aspectClassName}`}>
        {fallback || (
          <div className="flex flex-col items-center justify-center text-gray-300 gap-1">
            <Car className="h-10 w-10 text-gray-300" />
            <span className="text-xs text-gray-400">Brak zdjęcia</span>
          </div>
        )}
      </div>
    );
  }

  const showNav = total > 1;

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 select-none touch-pan-y group ${aspectClassName}`}
      {...swipe}
    >
      <img
        src={images[index]}
        alt={`${alt} - zdjęcie ${index + 1}`}
        className={`${imgClassName} transition-opacity duration-200`}
        loading="lazy"
        draggable={false}
      />

      {showNav && (
        <>
          <button
            type="button"
            aria-label="Poprzednie zdjęcie"
            onClick={(e) => handleNavClick(e, 'prev')}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-sm opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Następne zdjęcie"
            onClick={(e) => handleNavClick(e, 'next')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-sm opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full font-medium tabular-nums pointer-events-none z-10">
            {index + 1} / {total}
          </div>
        </>
      )}
    </div>
  );
};
