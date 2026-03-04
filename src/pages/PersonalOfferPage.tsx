import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { usePersonalOffer } from '@/contexts/PersonalOfferContext';
import { useListingsByIds } from '@/hooks/useListingsByIds';
import { Gift, ArrowRight } from 'lucide-react';

export default function PersonalOfferPage() {
    const { t } = useTranslation();
    const { selectedIds, hasPersonalOffer } = usePersonalOffer();
    const { data, isLoading } = useListingsByIds(selectedIds);
    const listings = data?.listings || [];

    return (
        <div className="min-h-screen bg-background">
            <Header />

            <main className="container py-8">
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 p-8 md:p-12 mb-8 text-white">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_60%)]" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                                <Gift className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold">
                                    Oferta dla Ciebie
                                </h1>
                                <p className="text-white/80 text-sm md:text-base">
                                    Pojazdy wybrane specjalnie dla Ciebie
                                </p>
                            </div>
                        </div>
                        <p className="text-white/70 text-sm max-w-lg">
                            Poniżej znajdziesz pojazdy, które zostały dla Ciebie wyselekcjonowane.
                            Kliknij w wybrany pojazd, aby zobaczyć szczegóły i skonfigurować finansowanie.
                        </p>
                    </div>
                </div>

                {/* Content */}
                {!hasPersonalOffer && !isLoading ? (
                    <div className="py-16 text-center">
                        <Gift className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-lg font-medium text-foreground">
                            Brak dedykowanej oferty
                        </p>
                        <p className="text-muted-foreground mt-2 mb-6">
                            Nie masz jeszcze przypisanej spersonalizowanej oferty.
                            Skontaktuj się z nami, a przygotujemy propozycję dopasowaną do Twoich potrzeb.
                        </p>
                        <Link
                            to="/samochody"
                            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] transition-colors"
                        >
                            Przeglądaj wszystkie samochody
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <p className="text-sm text-muted-foreground">
                                Wybrano: <span className="font-semibold text-foreground">{listings.length}</span> {listings.length === 1 ? 'pojazd' : listings.length < 5 ? 'pojazdy' : 'pojazdów'}
                            </p>
                            <Link
                                to="/samochody"
                                className="text-sm text-[#F97316] hover:text-[#EA580C] font-medium flex items-center gap-1 transition-colors"
                            >
                                Zobacz wszystkie samochody
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {isLoading ? (
                                Array.from({ length: selectedIds.length || 3 }).map((_, i) => (
                                    <ListingCardSkeleton key={i} />
                                ))
                            ) : listings.length > 0 ? (
                                listings.map((listing, index) => (
                                    <ListingCard key={listing.listing_id} listing={listing} index={index} />
                                ))
                            ) : (
                                <div className="col-span-full py-16 text-center">
                                    <p className="text-lg font-medium text-foreground">Wybrane pojazdy nie są już dostępne</p>
                                    <p className="text-muted-foreground mt-1">
                                        Skontaktuj się z nami, a przygotujemy nową ofertę.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            <ScrollToTopButton />
            <Footer />
        </div>
    );
}
