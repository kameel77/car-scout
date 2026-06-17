import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { heroBannersApi } from '@/services/api';
import { OptimizedImage } from '@/components/OptimizedImage';
import {
    Carousel, CarouselContent, CarouselItem, type CarouselApi,
} from '@/components/ui/carousel';

const YELLOW = '#F5C518';
const YELLOW_DARK = '#D4A90A';
const BLACK = '#1A1A1A';

const ALIGN_CLASS: Record<string, string> = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
};

export function useHeroBanners() {
    return useQuery({
        queryKey: ['hero-banners', 'public'],
        queryFn: () => heroBannersApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });
}

export function HeroBannerCarousel() {
    const { data } = useHeroBanners();
    const banners = data?.banners ?? [];
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

    if (banners.length === 0) return null;

    return (
        <div className="relative">
            <Carousel setApi={setApi} opts={{ loop: true }} className="overflow-hidden rounded-3xl">
                <CarouselContent>
                    {banners.map((b) => (
                        <CarouselItem key={b.id} className="basis-full">
                            <div className="relative w-full h-[360px] md:h-[460px] lg:h-[520px] bg-slate-900">
                                {b.imageUrlDesktop && (
                                    <OptimizedImage
                                        src={b.imageUrlDesktop}
                                        alt={b.altText}
                                        width="1600"
                                        height="700"
                                        className={`absolute inset-0 w-full h-full object-cover ${b.imageUrlMobile ? 'hidden md:block' : ''}`}
                                    />
                                )}
                                {b.imageUrlMobile && (
                                    <OptimizedImage
                                        src={b.imageUrlMobile}
                                        alt={b.altText}
                                        width="800"
                                        height="800"
                                        className="absolute inset-0 w-full h-full object-cover md:hidden"
                                    />
                                )}

                                {b.buttonLabel && b.buttonUrl && (
                                    <>
                                        {/* Desktop: button along a vertical track inset 24px from top/bottom;
                                            translateY(-pct%) keeps it fully inside (0% = flush to top padding, 100% = bottom). */}
                                        <div className="hidden md:block absolute inset-x-0" style={{ top: '24px', bottom: '24px' }}>
                                            <div
                                                className={`absolute inset-x-0 px-10 lg:px-16 flex ${ALIGN_CLASS[b.buttonAlign] ?? 'justify-start'}`}
                                                style={{ top: `${b.buttonPositionYPct}%`, transform: `translateY(-${b.buttonPositionYPct}%)` }}
                                            >
                                                <Link
                                                    to={b.buttonUrl}
                                                    className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:-translate-y-0.5"
                                                    style={{ background: YELLOW, color: BLACK, boxShadow: `0 4px 24px ${YELLOW}60` }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = YELLOW_DARK)}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = YELLOW)}
                                                >
                                                    {b.buttonLabel}
                                                </Link>
                                            </div>
                                        </div>
                                        {/* Mobile: button anchored near bottom */}
                                        <div className="flex md:hidden absolute bottom-6 left-0 right-0 px-6 justify-center">
                                            <Link
                                                to={b.buttonUrl}
                                                className="inline-flex items-center justify-center px-7 py-3.5 rounded-2xl font-bold text-base"
                                                style={{ background: YELLOW, color: BLACK }}
                                            >
                                                {b.buttonLabel}
                                            </Link>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {banners.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            type="button"
                            aria-label={`Slajd ${i + 1}`}
                            onClick={() => api?.scrollTo(i)}
                            className="h-2 rounded-full transition-all"
                            style={{ width: selected === i ? 24 : 8, background: selected === i ? YELLOW : 'rgba(255,255,255,0.6)' }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
