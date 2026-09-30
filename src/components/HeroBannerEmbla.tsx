import React from 'react';
import type { PublicHeroBanner } from '@/services/api';
import {
    Carousel, CarouselContent, CarouselItem, type CarouselApi,
} from '@/components/ui/carousel';
import { HeroBannerSlide, YELLOW } from '@/components/HeroBannerSlide';

// Ładowany leniwie z HeroBannerCarousel (gdy banerów > 1), żeby embla-carousel
// nie trafiała do głównego chunka.
export default function HeroBannerEmbla({ banners }: { banners: PublicHeroBanner[] }) {
    const [api, setApi] = React.useState<CarouselApi>();
    const [selected, setSelected] = React.useState(0);

    React.useEffect(() => {
        if (!api) return;
        const onSelect = () => setSelected(api.selectedScrollSnap());
        api.on('select', onSelect);
        onSelect();
        return () => { api.off('select', onSelect); };
    }, [api]);

    React.useEffect(() => {
        if (!api || banners.length <= 1) return;
        const id = setInterval(() => api.scrollNext(), 6000);
        return () => clearInterval(id);
    }, [api, banners.length]);

    return (
        <div className="relative">
            <Carousel setApi={setApi} opts={{ loop: true }} className="overflow-hidden rounded-3xl">
                <CarouselContent>
                    {banners.map((b, idx) => (
                        <CarouselItem key={b.id} className="basis-full">
                            <HeroBannerSlide banner={b} priority={idx === 0} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {banners.length > 1 && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex z-10">
                    {/* Brandbook rozdz. 03: kropka pozostaje mała, ale pole dotyku ma 44 x 44 px.
                        Powiększamy obszar klikalny przyciskiem, nie samą grafiką. */}
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            type="button"
                            aria-label={`Slajd ${i + 1}`}
                            aria-current={selected === i}
                            onClick={() => api?.scrollTo(i)}
                            className="flex min-h-touch min-w-touch items-center justify-center"
                        >
                            <span
                                className="block h-2.5 rounded-full transition-all"
                                style={{ width: selected === i ? 26 : 10, background: selected === i ? YELLOW : 'rgba(255,255,255,0.75)' }}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
