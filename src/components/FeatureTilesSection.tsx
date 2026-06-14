import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Car } from 'lucide-react';
import { featureTilesApi } from '@/services/api';
import { OptimizedImage } from '@/components/OptimizedImage';

interface FeatureTilesSectionProps {
    heading?: string;
    className?: string;
}

const PLN_FMT = new Intl.NumberFormat('pl-PL');

function pluralPl(n: number): string {
    // pluralization for "oferta" — Polish: 1 oferta / 2-4 oferty / 5+ ofert (+ exceptions 12-14)
    if (n === 1) return 'oferta';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'oferty';
    return 'ofert';
}

function ensureRelativeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const u = new URL(url);
            return u.pathname + u.search + u.hash;
        } catch {
            return url;
        }
    }
    return url;
}

export function FeatureTilesSection({ heading, className }: FeatureTilesSectionProps) {
    const { data } = useQuery({
        queryKey: ['feature-tiles', 'public'],
        queryFn: () => featureTilesApi.listPublic(),
        staleTime: 5 * 60 * 1000,
    });
    const tiles = data?.tiles || [];
    if (tiles.length === 0) return null;

    return (
        <section className={className ?? 'py-12 bg-background'}>
            <div className="container">
                {heading && <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{heading}</h2>}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {tiles.map((tile) => {
                        const href = ensureRelativeUrl(tile.targetUrl);
                        return (
                            <Link
                                key={tile.id}
                                to={href}
                                className="group relative aspect-[4/5] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow bg-slate-900"
                            >
                                {tile.imageUrl ? (
                                    <OptimizedImage
                                        src={tile.imageUrl}
                                        alt={tile.title}
                                        width="400"
                                        height="500"
                                        loading="lazy"
                                        forceThumbnail={true}
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                        <Car className="w-16 h-16" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
                                <div className="relative h-full flex flex-col justify-between p-4">
                                    <div className="text-white text-base sm:text-lg font-bold text-center leading-tight drop-shadow">
                                        {tile.title}
                                    </div>
                                    {typeof tile.vehicleCount === 'number' && (
                                        <div className="bg-white rounded-full px-4 py-2 flex items-center justify-between gap-2 shadow-sm">
                                            <span className="text-sm font-semibold text-foreground">
                                                {PLN_FMT.format(tile.vehicleCount)} {pluralPl(tile.vehicleCount)}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-foreground" />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
