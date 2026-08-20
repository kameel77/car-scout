import { describe, it, expect } from 'vitest';
import { formatPhoneForTelLink, formatNumber, formatPrice } from '../formatters';

describe('formatNumber', () => {
    it('formats numbers with non-breaking spaces for thousands', () => {
        expect(formatNumber(1000)).toBe('1\u00A0000');
        expect(formatNumber(2739)).toBe('2\u00A0739');
        expect(formatNumber(158900)).toBe('158\u00A0900');
    });

    it('handles numeric strings with spaces or commas', () => {
        expect(formatNumber('158 900')).toBe('158\u00A0900');
        expect(formatNumber('1234,5')).toBe('1\u00A0235');
    });

    it('returns original string if not a number', () => {
        expect(formatNumber('abc')).toBe('abc');
    });
});

describe('formatPrice', () => {
    it('formats price with non-breaking space between amount and currency', () => {
        expect(formatPrice(2739, 'zł')).toBe('2\u00A0739\u00A0zł');
        expect(formatPrice(158900, 'PLN')).toBe('158\u00A0900\u00A0PLN');
    });
});

describe('formatPhoneForTelLink', () => {
    it('returns empty string if phone is not provided', () => {
        expect(formatPhoneForTelLink()).toBe('');
        expect(formatPhoneForTelLink(undefined)).toBe('');
    });

    it('formats normal Polish mobile number with spaces', () => {
        expect(formatPhoneForTelLink('445 445 485')).toBe('+48445445485');
    });

    it('formats normal Polish mobile number with dashes', () => {
        expect(formatPhoneForTelLink('445-445-485')).toBe('+48445445485');
    });

    it('formats Polish mobile number already containing country code with plus', () => {
        expect(formatPhoneForTelLink('+48 445 445 485')).toBe('+48445445485');
        expect(formatPhoneForTelLink('+48445445485')).toBe('+48445445485');
    });

    it('formats Polish mobile number containing country code without plus', () => {
        expect(formatPhoneForTelLink('48 445 445 485')).toBe('+48445445485');
        expect(formatPhoneForTelLink('48445445485')).toBe('+48445445485');
    });

    it('formats Polish mobile number containing double zero international prefix', () => {
        expect(formatPhoneForTelLink('0048 445 445 485')).toBe('+48445445485');
    });

    it('retains international prefix for foreign numbers starting with +', () => {
        expect(formatPhoneForTelLink('+49 123 456 789')).toBe('+49123456789');
    });

    it('retains international prefix for foreign numbers starting with 00', () => {
        expect(formatPhoneForTelLink('0049 123 456 789')).toBe('+49123456789');
    });

    it('formats Polish landline number correctly', () => {
        expect(formatPhoneForTelLink('22 112 09 50')).toBe('+48221120950');
        expect(formatPhoneForTelLink('+48 22 112 09 50')).toBe('+48221120950');
    });
});
