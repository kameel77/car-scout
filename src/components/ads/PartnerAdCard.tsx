import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PartnerAdCardProps {
    title?: string;
    description?: string;
    imageUrl?: string;
    ctaText?: string;
    url: string;
    brandName?: string;
    overlayOpacity?: number;
    index?: number;
    className?: string;
}

export function PartnerAdCard({
    title,
    description,
    imageUrl,
    ctaText,
    url,
    brandName,
    overlayOpacity = 0.9,
    index = 0,
    className
}: PartnerAdCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn("listing-card group flex flex-col h-full", className)}
        >
            <a href={url} target="_blank" rel="noopener noreferrer" className="block flex-1">
                {/* Image */}
                <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                        src={imageUrl}
                        alt={title || "Reklama"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                    <div
                        className="absolute inset-0 bg-accent transition-opacity duration-300"
                        style={{ opacity: overlayOpacity }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Ad Badge */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-background/90 backdrop-blur-sm rounded text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Reklama
                    </div>

                    {brandName && (
                        <div className="absolute bottom-3 left-3 px-3 py-1 bg-accent/90 backdrop-blur-sm rounded-lg shadow-md">
                            <span className="font-heading text-xs font-bold text-white uppercase tracking-wider">
                                {brandName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3 flex-1">
                    {title && (
                        <div>
                            <h3 className="font-heading text-lg font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors min-h-[3.5rem]">
                                {title}
                            </h3>
                        </div>
                    )}

                    {description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                            {description}
                        </p>
                    )}
                </div>
            </a>

            {/* CTA */}
            {ctaText && (
                <div className="px-4 pb-4 mt-auto">
                    <Button asChild variant="hero" className="w-full group/btn">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            {ctaText}
                            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                        </a>
                    </Button>
                </div>
            )}
        </motion.div>
    );
}

export function PartnerAdCardSkeleton() {
    return (
        <div className="listing-card">
            <div className="aspect-[16/10] skeleton-shimmer" />
            <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 skeleton-shimmer" />
                <div className="space-y-2">
                    <div className="h-4 skeleton-shimmer" />
                    <div className="h-4 skeleton-shimmer" />
                    <div className="h-4 w-4/5 skeleton-shimmer" />
                </div>
            </div>
            <div className="px-4 pb-4">
                <div className="h-10 skeleton-shimmer rounded-lg" />
            </div>
        </div>
    );
}
