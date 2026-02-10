import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useSpecialOffer } from '@/contexts/SpecialOfferContext';

interface SpecialOfferTagProps {
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function SpecialOfferTag({ className, onClick }: SpecialOfferTagProps) {
    const { t } = useTranslation();
    const { hasSpecialOffer } = useSpecialOffer();

    if (!hasSpecialOffer) return null;

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
            window.location.reload();
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                "inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-orange-600",
                className
            )}
        >
            {t('listing.specialOffer')}
        </button>
    );
}
