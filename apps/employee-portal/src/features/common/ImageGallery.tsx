import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, Car } from 'lucide-react';
import { useSwipe } from './useSwipe';

export interface ImageGalleryProps {
  images: string[];
  title: string;
  aspectClassName?: string;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  title,
  aspectClassName = 'aspect-[16/10]',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [thumbsOverflow, setThumbsOverflow] = useState(false);

  const total = images.length;

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  }, [total]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  }, [total]);

  const mainSwipe = useSwipe({ onSwipeLeft: goToNext, onSwipeRight: goToPrevious });
  const lightboxSwipe = useSwipe({ onSwipeLeft: goToNext, onSwipeRight: goToPrevious });

  const scrollThumbs = (dir: 'prev' | 'next') => {
    const el = thumbsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'next' ? 240 : -240, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;
    const update = () => setThumbsOverflow(el.scrollWidth > el.clientWidth + 4);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [images]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxOpen) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNext();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setLightboxOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, goToNext, goToPrevious]);

  // Prevent background scrolling when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  if (total === 0) {
    return (
      <div className={`relative w-full ${aspectClassName} max-h-[460px] bg-paper rounded-xl flex flex-col items-center justify-center text-muted gap-2 border border-line`}>
        <Car className="h-16 w-16 text-muted" />
        <span className="text-sm">Brak zdjęć dla tego pojazdu</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Image Container */}
      <div
        className={`relative w-full ${aspectClassName} max-h-[460px] bg-paper rounded-xl overflow-hidden cursor-pointer group select-none touch-pan-y shadow-xs`}
        onClick={() => setLightboxOpen(true)}
        {...mainSwipe}
      >
        <img
          src={images[selectedIndex]}
          alt={`${title} - zdjęcie ${selectedIndex + 1}`}
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-200"
          draggable={false}
        />

        {/* Hover zoom badge */}
        <div className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <ZoomIn className="h-4 w-4" />
        </div>

        {/* Photo Counter */}
        {total > 1 && (
          <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 text-white text-xs font-medium rounded-full tabular-nums pointer-events-none z-10">
            {selectedIndex + 1} / {total}
          </div>
        )}

        {/* Left / Right Arrows on Main Image */}
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Poprzednie zdjęcie"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Następne zdjęcie"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails Row */}
      {total > 1 && (
        <div className="relative">
          <div
            ref={thumbsRef}
            className="flex gap-2 overflow-x-auto pb-2 scroll-smooth scrollbar-thin"
          >
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-label={`Miniatura ${idx + 1}`}
                className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedIndex === idx
                    ? 'border-emerald-600 ring-2 ring-emerald-100 opacity-100'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img
                  src={img}
                  alt={`${title} miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>

          {thumbsOverflow && (
            <>
              <button
                type="button"
                aria-label="Przewiń miniatury w lewo"
                onClick={() => scrollThumbs('prev')}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white z-10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Przewiń miniatury w prawo"
                onClick={() => scrollThumbs('next')}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-md hover:bg-white z-10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galeria zdjęć - ${title}`}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none touch-pan-y backdrop-blur-xs p-4"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            aria-label="Zamknij podgląd"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image Container with swipe */}
          <div
            className="relative w-full h-[88vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            {...lightboxSwipe}
          >
            <img
              src={images[selectedIndex]}
              alt={`${title} - pełne zdjęcie ${selectedIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200"
            />

            {/* Lightbox Navigation Chevrons */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Poprzednie zdjęcie w galerii"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer z-20"
                >
                  <ChevronLeft className="h-8 w-8" />
                </button>
                <button
                  type="button"
                  aria-label="Następne zdjęcie w galerii"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer z-20"
                >
                  <ChevronRight className="h-8 w-8" />
                </button>
              </>
            )}

            {/* Bottom photo counter in lightbox */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 border border-white/10 rounded-full text-white text-sm font-medium tabular-nums pointer-events-none">
              {selectedIndex + 1} / {total}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
