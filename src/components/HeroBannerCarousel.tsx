import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { heroBannersApi } from '@/services/api';
import { HeroBannerSlide, YELLOW } from '@/components/HeroBannerSlide';

export function useHeroBanners() {
    const initialHeroBanners = typeof window !== 'undefined' && (window as any).__HERO_BANNERS__
        ? { banners: (window as any).__HERO_BANNERS__ }
        : undefined;
    return useQuery({
        queryKey: ['hero-banners', 'public'],
        queryFn: () => heroBannersApi.listPublic(),
        staleTime: 5 * 60 * 1000,
        initialData: initialHeroBanners,
    });
}

const loadCarousel = () => import('./HeroBannerEmbla');

// Pierwszy render to statyczny pierwszy baner (ten sam markup co slajd 0 w karuzeli —
// to element LCP strony głównej). Karuzela (embla) ładuje się po idle, tylko gdy banerów > 1.
export function HeroBannerCarousel() {
    const { data } = useHeroBanners();
    const banners = data?.banners ?? [];
    const hasMany = banners.length > 1;
    const [Embla, setEmbla] = React.useState<React.ComponentType<{ banners: typeof banners }> | null>(null);

    const startLoading = React.useCallback(() => {
        loadCarousel().then((m) => setEmbla(() => m.default)).catch(() => { /* zostaje statyczny baner */ });
    }, []);

    React.useEffect(() => {
        if (!hasMany) return;
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(startLoading);
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(startLoading, 1500);
        return () => window.clearTimeout(id);
    }, [hasMany, startLoading]);

    if (banners.length === 0) return null;

    if (Embla && hasMany) return <Embla banners={banners} />;

    return (
        <div className="relative">
            <div className="relative overflow-hidden rounded-3xl" role="region" aria-roledescription="carousel">
                <div className="overflow-hidden">
                    <div className="flex -ml-4">
                        <div role="group" aria-roledescription="slide" className="min-w-0 shrink-0 grow-0 pl-4 basis-full">
                            <HeroBannerSlide banner={banners[0]} priority />
                        </div>
                    </div>
                </div>
            </div>

            {hasMany && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex z-10">
                    {banners.map((b, i) => (
                        <button
                            key={b.id}
                            type="button"
                            aria-label={`Slajd ${i + 1}`}
                            aria-current={i === 0}
                            onClick={startLoading}
                            className="flex min-h-touch min-w-touch items-center justify-center"
                        >
                            <span
                                className="block h-2.5 rounded-full transition-all"
                                style={{ width: i === 0 ? 26 : 10, background: i === 0 ? YELLOW : 'rgba(255,255,255,0.75)' }}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
