import { Building2, User } from 'lucide-react';
import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CustomerTypeToggleProps {
  className?: string;
}

/**
 * Prywatnie / Na firmę toggle — mirrors the style used in ConditionPage nav tabs.
 * Uses bg-secondary rounded-lg container with bg-accent active state.
 */
export function CustomerTypeToggle({ className }: CustomerTypeToggleProps) {
  const { priceType, setPriceType } = usePriceSettings();
  const { t } = useTranslation();

  return (
    <div className={cn('flex bg-secondary rounded-lg p-0.5', className)}>
      <button
        type="button"
        onClick={() => setPriceType('gross')}
        className={cn(
          'flex items-center gap-2 px-4 min-h-touch rounded-md text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center',
          priceType === 'gross'
            ? 'bg-accent shadow-sm text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <User className="w-4 h-4" />
        {t('pricing.private', 'Prywatnie')}
      </button>
      <button
        type="button"
        onClick={() => setPriceType('net')}
        className={cn(
          'flex items-center gap-2 px-4 min-h-touch rounded-md text-sm font-semibold transition-all whitespace-nowrap flex-1 justify-center',
          priceType === 'net'
            ? 'bg-accent shadow-sm text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Building2 className="w-4 h-4" />
        {t('pricing.business', 'Na firmę')}
      </button>
    </div>
  );
}
