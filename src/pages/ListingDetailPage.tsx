import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, Phone, MessageSquare, MapPin, Star, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { ImageGallery } from '@/components/ImageGallery';
import { SpecsGrid } from '@/components/SpecsGrid';
import { SpecificationsTable } from '@/components/SpecificationsTable';
import { EquipmentDisplay } from '@/components/EquipmentDisplay';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useListing } from '@/hooks/useListings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useListing(id);
  const { data: settings } = useAppSettings();
  const { priceType } = usePriceSettings();
  const listing = data?.listing;

  const displayPrice = React.useMemo(() => {
    if (!listing) return '';
    const currency = settings?.displayCurrency || 'PLN';
    let price = 0;

    if (currency === 'EUR' && listing.broker_price_eur) {
      price = listing.broker_price_eur;
    } else if (listing.broker_price_pln) {
      price = listing.broker_price_pln;
    }

    if (price > 0) {
      const finalPrice = priceType === 'net' ? Math.round(price / 1.23) : price;
      return `${finalPrice.toLocaleString('pl-PL')} ${currency}`;
    }

    return listing.price_display;
  }, [listing, settings, priceType]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 text-center">
          <p className="text-lg">{t('empty.noResults')}</p>
          <Button asChild className="mt-4">
            <Link to="/">{t('common.back')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const title = `${listing.make} ${listing.model} ${listing.version}`;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <Header />

      <main className="container py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">
            {t('nav.search')}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span>{listing.make}</span>
          <ChevronRight className="h-4 w-4" />
          <span>{listing.model}</span>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{listing.version}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Gallery */}
            <ImageGallery images={listing.image_urls} title={title} />

            {/* Title & Price - Mobile */}
            <div className="lg:hidden">
              <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="font-heading text-3xl font-bold text-accent">
                  {displayPrice}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {t('detail.lowestPrice')}
                </Badge>
              </div>
            </div>

            {/* Key Parameters */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.keyParameters')}</h2>
              <SpecsGrid
                year={listing.production_year}
                mileage={listing.mileage_km}
                fuelType={listing.fuel_type}
                transmission={listing.transmission}
                drive={listing.drive}
                power={listing.engine_power_hp}
                capacity={listing.engine_capacity_cm3}
                bodyType={listing.body_type}
              />
            </section>

            <Separator />

            {/* Specifications */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.specifications')}</h2>
              <SpecificationsTable specifications={listing.specifications} />
            </section>

            <Separator />

            {/* Equipment */}
            <section>
              <h2 className="font-heading text-xl font-semibold mb-4">{t('detail.equipment')}</h2>
              <EquipmentDisplay equipment={listing.equipment} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-6">
              {/* Price Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl shadow-card p-6 space-y-4"
              >
                <h1 className="font-heading text-xl font-bold text-foreground">{title}</h1>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-3xl font-bold text-accent">
                    {displayPrice}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {t('detail.lowestPrice')}
                </Badge>

                <div className="space-y-3 pt-2">
                  <Button asChild variant="hero" className="w-full" size="lg">
                    <Link to={`/listing/${listing.listing_id}/lead`}>
                      <MessageSquare className="h-5 w-5" />
                      {t('detail.askAbout')}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    size="lg"
                    onClick={() => window.open(`tel:${listing.contact_phone}`)}
                  >
                    <Phone className="h-5 w-5" />
                    {t('detail.call')}
                  </Button>
                </div>
              </motion.div>

              {/* Dealer Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card rounded-xl shadow-card p-6 space-y-4"
              >
                <h3 className="font-heading font-semibold">{t('detail.dealerInfo')}</h3>
                <div>
                  <p className="font-medium text-foreground">{listing.dealer_name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{listing.dealer_address_line1}, {listing.dealer_city}</span>
                  </div>
                </div>
                {listing.google_rating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-warning">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-medium">{listing.google_rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({listing.google_reviews_count} opinii)
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky CTA */}
      <div className="sticky-cta">
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => window.open(`tel:${listing.contact_phone}`)}
          >
            <Phone className="h-5 w-5" />
            {t('detail.call')}
          </Button>
          <Button asChild variant="hero" size="lg" className="flex-1">
            <Link to={`/listing/${listing.listing_id}/lead`}>
              {t('detail.sendInquiry')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
