import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DatePicker } from '../ui/date-picker';
import { format, parse } from 'date-fns';

describe('DatePicker Component & Date formatting', () => {
    afterEach(() => {
        cleanup();
    });

    it('formats local Date to YYYY-MM-DD without UTC timezone shift (e.g. Europe/Warsaw)', () => {
        // Date created at local midnight 2026-08-27 00:00:00
        const localDate = new Date(2026, 7, 27, 0, 0, 0); // Month is 0-indexed (7 = August)
        const formatted = format(localDate, 'yyyy-MM-dd');
        expect(formatted).toBe('2026-08-27');

        // Regression guard: check that parse -> format roundtrip is exact
        const parsed = parse('2026-08-27', 'yyyy-MM-dd', new Date());
        expect(format(parsed, 'yyyy-MM-dd')).toBe('2026-08-27');
    });

    it('renders placeholder when no value is provided', () => {
        render(<DatePicker value="" onChange={() => {}} placeholder="Wybierz datę dostępności" />);
        expect(screen.getByText('Wybierz datę dostępności')).toBeInTheDocument();
    });

    it('renders the formatted date string when value is provided', () => {
        render(<DatePicker value="2026-09-15" onChange={() => {}} />);
        expect(screen.getByText('2026-09-15')).toBeInTheDocument();
    });

    it('invokes onChange with empty string when clear button is clicked', () => {
        const handleChange = vi.fn();
        render(<DatePicker value="2026-09-15" onChange={handleChange} />);
        
        const clearButton = screen.getByRole('button', { name: /wyczyść datę/i });
        fireEvent.click(clearButton);
        
        expect(handleChange).toHaveBeenCalledWith('');
    });
});
