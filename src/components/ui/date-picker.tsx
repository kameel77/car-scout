import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export interface DatePickerProps {
    value?: string | null;
    onChange: (date: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
    fromYear?: number;
    toYear?: number;
}

export function DatePicker({
    value,
    onChange,
    placeholder = 'Wybierz datę',
    disabled = false,
    className,
    id,
    fromYear = 1990,
    toYear = new Date().getFullYear() + 2,
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    const selectedDate = React.useMemo(() => {
        if (!value || typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = parse(trimmed, 'yyyy-MM-dd', new Date());
        return isValid(parsed) ? parsed : undefined;
    }, [value]);

    const handleSelect = (date: Date | undefined) => {
        if (date) {
            onChange(format(date, 'yyyy-MM-dd'));
        } else {
            onChange('');
        }
        setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className={cn('relative flex items-center', className)}>
                <PopoverTrigger asChild disabled={disabled}>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            'w-full justify-start text-left font-normal h-10 px-3 bg-white border-input',
                            !value && 'text-muted-foreground',
                            disabled && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                            {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : placeholder}
                        </span>
                    </Button>
                </PopoverTrigger>
                {Boolean(value) && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                        title="Wyczyść datę"
                        aria-label="Wyczyść datę"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            <PopoverContent className="w-auto p-0 bg-white shadow-xl border border-gray-200 z-50" align="start">
                <Calendar
                    mode="single"
                    captionLayout="dropdown-buttons"
                    fromYear={fromYear}
                    toYear={toYear}
                    defaultMonth={selectedDate || new Date()}
                    selected={selectedDate}
                    onSelect={handleSelect}
                    initialFocus
                    locale={pl}
                />
            </PopoverContent>
        </Popover>
    );
}
