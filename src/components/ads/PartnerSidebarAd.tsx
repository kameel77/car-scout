import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PartnerSidebarAdProps {
    title?: string;
    description?: string;
    imageUrl?: string;
    ctaText?: string;
    url: string;
    features?: string[];
    brandName?: string;
    hideUiElements?: boolean;
    overlayOpacity?: number;
    className?: string;
}

export function PartnerSidebarAd({
    title,
    description,
    imageUrl,
    ctaText,
    url,
    features,
    brandName,
    hideUiElements = false,
    overlayOpacity = 0.9,
    className
}: PartnerSidebarAdProps) {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "bg-card rounded-xl shadow-card overflow-hidden border border-border/50 relative",
                className
            )}
        >
            <div
                className="absolute inset-0 bg-accent pointer-events-none transition-opacity duration-300"
                style={{ opacity: overlayOpacity }}
            />
            {!hideUiElements && (
                <div className="relative p-1 border-b border-border/50 flex justify-between items-center bg-muted/30 px-3">
                    <div className="flex items-center gap-1.5">
                        <Info className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('ads.partner')}</span>
                    </div>
                    {brandName && <span className="text-[10px] font-medium text-muted-foreground">{brandName}</span>}
                </div>
            )}

            {imageUrl && (
                <div className="aspect-[16/9] overflow-hidden relative pointer-events-none">
                    <img
                        src={imageUrl}
                        alt={title || t('ads.advertisement')}
                        className={cn(
                            "w-full h-full object-cover transition-all duration-300",
                            overlayOpacity >= 0.1 ? "mix-blend-multiply" : ""
                        )}
                        style={{ opacity: 1 - (overlayOpacity * 0.4) }}
                    />
                </div>
            )}

            {!hideUiElements && (
                <div className="p-5 space-y-4 text-left">
                    <div className="space-y-2">
                        {title && (
                            <h3 className="font-heading text-xl font-bold text-foreground leading-tight">
                                {title}
                            </h3>
                        )}
                        {description && (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>

                    {features && features.length > 0 && (
                        <ul className="space-y-2">
                            {features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                                    <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {ctaText && (
                        <Button asChild variant="hero" className="w-full group/btn" size="lg">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                {ctaText}
                                <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                            </a>
                        </Button>
                    )}
                </div>
            )}

            {hideUiElements && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-10" aria-label={title || t('ads.partnerOffer')}>
                    <span className="sr-only">{title || t('ads.partnerOffer')}</span>
                </a>
            )}
        </motion.div>
    );
}
