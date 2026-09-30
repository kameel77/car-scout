import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { heroBannersApi } from '@/services/api';
import { readSsrJson } from '@/lib/ssrData';
import { HeroBannerSlide, YELLOW } from '@/components/HeroBannerSlide';

export function useHeroBanners() {
    const ssrHeroBanners = readSsrJson<any>('hero-banners');
    const initialHeroBanners = ssrHeroBanners ? { banners: ssrHeroBanners } : undefined;
    return useQuery({
        queryKey: ['hero-banners', 'public'],
        queryFn: () => heroBannersApi.listPublic(),
        staleTime: 5 * 60 * 1000,
        initialData: initialHeroBanners,
    });
}

const loadCarousel = () => import('./HeroBannerEmbla');

// Pierwszy render to statyczny pierwszy baner (ten sam markup co slajd 0 w karuzeli —
// to element LCP strony głównej). Karuzela (embla) ładuje się po zdarzeniu load + idle, tylko gdy banerów > 1.
export function HeroBannerCarousel() {
    const { data } = useHeroBanners();
    const banners = data?.banners ?? [];
    const hasMany = banners.length > 1;
    const [Embla, setEmbla] = React.useState<React.ComponentType<{ banners: typeof banners; startIndex?: number }> | null>(null);

    const [startIndex, setStartIndex] = React.useState(0);

    const startLoading = React.useCallback(() => {
        loadCarousel().then((m) => setEmbla(() => m.default)).catch(() => { /* zostaje statyczny baner */ });
    }, []);

    React.useEffect(() => {
        if (!hasMany) return;
        let idleId: number | undefined;
        let timerId: number | undefined;
        const schedule = () => {
            if (typeof window.requestIdleCallback === 'function') {
                idleId = window.requestIdleCallback(startLoading);
            } else {
                timerId = window.setTimeout(startLoading, 1500);
            }
        };
        // Start dopiero po zdarzeniu load, żeby chunk karuzeli nie konkurował z obrazem LCP.
        if (document.readyState === 'complete') {
            schedule();
        } else {
            window.addEventListener('load', schedule, { once: true });
        }
        return () => {
            window.removeEventListener('load', schedule);
            if (idleId !== undefined) window.cancelIdleCallback(idleId);
            if (timerId !== undefined) window.clearTimeout(timerId);
        };
    }, [hasMany, startLoading]);

    if (banners.length === 0) return null;

    if (Embla && hasMany) return <Embla banners={banners} startIndex={startIndex} />;

    return (
        <div className="relative">
            <div className="relative overflow-hidden rounded-3xl [contain:layout_paint]" role="region" aria-roledescription="carousel">
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
                            onClick={() => { setStartIndex(i); startLoading(); }}
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
