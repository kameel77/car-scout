import { describe, it, expect } from 'vitest';
import { formatPhoneForTelLink } from '../formatters';

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
