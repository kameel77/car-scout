import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Gauge, Fuel, Settings2, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Listing } from '@/data/mockData';
import { cn } from '@/lib/utils';

import { useAppSettings } from '@/hooks/useAppSettings';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { formatPrice } from '@/utils/formatters';

interface ListingCardProps {
  listing: Listing;
  index?: number;
}

export function ListingCard({ listing, index = 0 }: ListingCardProps) {
  const { t } = useTranslation();
  const { data: settings } = useAppSettings();
  const { priceType } = usePriceSettings();

  const priceInfo = React.useMemo(() => {
    const currency = settings?.displayCurrency || 'PLN';
    let basePrice = 0;

    if (currency === 'EUR' && listing.broker_price_eur) {
      basePrice = listing.broker_price_eur;
    } else if (listing.broker_price_pln) {
      basePrice = listing.broker_price_pln;
    }

    if (basePrice > 0) {
      const isNetPrimary = priceType === 'net';
      const primaryPrice = isNetPrimary ? Math.round(basePrice / 1.23) : basePrice;
      const secondaryPrice = isNetPrimary ? basePrice : Math.round(basePrice / 1.23);

      const primaryLabel = formatPrice(primaryPrice, currency);
      // Secondary price intentionally omitted on listing cards (kept in detail view)
      const secondaryLabel = null;

      return { primaryLabel, secondaryLabel };
    }

    return { primaryLabel: listing.price_display, secondaryLabel: null };
  }, [listing, settings, priceType]);

  const handleListingClick = () => {
    // Store current search parameters in sessionStorage for return navigation
    const currentSearchParams = new URLSearchParams(window.location.search);
    if (currentSearchParams.toString()) {
      sessionStorage.setItem('searchParams', currentSearchParams.toString());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="listing-card group"
    >
      <Link to={`/listing/${listing.listing_id}`} onClick={handleListingClick} className="block">
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={listing.primary_image_url}
            alt={`${listing.make} ${listing.model}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Price Badge */}
          <div className="absolute top-3 right-3 px-3 py-1.5 bg-card/95 backdrop-blur-sm rounded-lg shadow-md flex flex-col md:flex-row md:items-baseline md:gap-2 items-end md:items-baseline">
            <span className="font-heading text-lg font-bold text-foreground">
              {priceInfo.primaryLabel}
            </span>
            {priceInfo.secondaryLabel && (
              <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                {priceInfo.secondaryLabel}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {listing.make} {listing.model}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {listing.version}
            </p>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{listing.production_year}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              <span>{listing.mileage_km.toLocaleString('pl-PL')} {t('listing.km')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Fuel className="h-3.5 w-3.5" />
              <span className="capitalize">{listing.fuel_type}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="capitalize">{listing.transmission}</span>
            </div>
          </div>

          {/* Power & Location */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="h-3.5 w-3.5 text-accent" />
              <span className="font-medium">{listing.engine_power_hp} {t('listing.hp')}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{listing.dealer_city}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* CTA */}
      <div className="px-4 pb-4">
        <Button asChild variant="outline-primary" className="w-full group/btn">
          <Link to={`/listing/${listing.listing_id}`}>
            {t('listing.viewOffer')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card">
      <div className="aspect-[16/10] skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="h-5 w-3/4 skeleton-shimmer" />
          <div className="h-4 w-1/2 skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-4 skeleton-shimmer" />
          <div className="h-4 skeleton-shimmer" />
          <div className="h-4 skeleton-shimmer" />
          <div className="h-4 skeleton-shimmer" />
        </div>
        <div className="flex justify-between pt-2">
          <div className="h-4 w-16 skeleton-shimmer" />
          <div className="h-4 w-20 skeleton-shimmer" />
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="h-10 skeleton-shimmer rounded-lg" />
      </div>
    </div>
  );
}
