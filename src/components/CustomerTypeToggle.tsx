import { usePriceSettings } from '@/contexts/PriceSettingsContext';
import { cn } from '@/lib/utils';

interface CustomerTypeToggleProps {
  className?: string;
}

export function CustomerTypeToggle({ className }: CustomerTypeToggleProps) {
  const { customerType, setCustomerType } = usePriceSettings();

  return (
    <div className={cn('bg-secondary rounded-full p-1 flex gap-0.5', className)}>
      <button
        type="button"
        onClick={() => setCustomerType('private')}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
          customerType === 'private'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        👤 Prywatnie
      </button>
      <button
        type="button"
        onClick={() => setCustomerType('business')}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
          customerType === 'business'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        🏢 Firma
      </button>
    </div>
  );
}
