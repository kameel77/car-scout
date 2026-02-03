import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PartnerBannerAdProps {
    title?: string;
    subtitle?: string;
    ctaText?: string;
    url: string;
    imageUrl?: string;
    mobileImageUrl?: string;
    hideUiElements?: boolean;
    overlayOpacity?: number;
    className?: string;
}
export function PartnerBannerAd({
    title,
    subtitle,
    ctaText,
    url,
    imageUrl,
    mobileImageUrl,
    hideUiElements = false,
    overlayOpacity = 0.9,
    className
}: PartnerBannerAdProps) {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
                "relative w-full rounded-xl overflow-hidden group border border-accent/20",
                "aspect-[3/1] md:aspect-[5/1] lg:aspect-[7/1] min-h-[140px] md:min-h-[160px]",
                className
            )}
        >
            {/* Background Image/Overlay */}
            <div
                className="absolute inset-0 bg-accent pointer-events-none transition-opacity duration-300"
                style={{ opacity: overlayOpacity }}
            />

            {imageUrl && (
                <div className="absolute inset-0 pointer-events-none">
                    {/* Desktop/Tablet Image */}
                    <img
                        src={imageUrl}
                        alt=""
                        className={cn(
                            "w-full h-full object-cover transition-all duration-300",
                            mobileImageUrl ? "hidden md:block" : "block",
                            overlayOpacity >= 0.1 ? "mix-blend-overlay" : ""
                        )}
                        style={{ opacity: 1 - (overlayOpacity * 0.6) }}
                    />
                    {/* Mobile Image */}
                    {mobileImageUrl && (
                        <img
                            src={mobileImageUrl}
                            alt=""
                            className={cn(
                                "w-full h-full object-cover transition-all duration-300 md:hidden",
                                overlayOpacity >= 0.1 ? "mix-blend-overlay" : ""
                            )}
                            style={{ opacity: 1 - (overlayOpacity * 0.6) }}
                        />
                    )}
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-accent via-accent/80 to-transparent transition-opacity duration-300"
                        style={{ opacity: overlayOpacity }}
                    />
                </div>
            )}

            {!hideUiElements && (
                <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1 max-w-2xl text-left">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[9px] font-bold uppercase tracking-widest text-white border border-white/20 flex items-center gap-1">
                                <Info className="h-2.5 w-2.5" />
                                {t('ads.partnerOffer')}
                            </span>
                        </div>
                        {title && (
                            <h3 className="font-heading text-xl md:text-2xl font-bold text-white leading-tight">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-white/80 text-sm md:text-base font-medium">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    {ctaText && (
                        <div className="shrink-0">
                            <Button asChild size="lg" className="bg-white text-accent hover:bg-white/90 shadow-lg group/btn font-bold">
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    {ctaText}
                                    <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                                </a>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Click Link for Full-Graphic Ads */}
            {hideUiElements && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={title || t('ads.partnerOffer')}>
                    <span className="sr-only">{title || t('ads.partnerOffer')}</span>
                </a>
            )}
        </motion.div>
    );
}
