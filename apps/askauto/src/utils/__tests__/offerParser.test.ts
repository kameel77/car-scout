import { describe, it, expect } from 'vitest';
import { parseOfferParam } from '../offerParser';

describe('offerParser', () => {
    describe('parseOfferParam', () => {
        it('should parse CRM tracking offer with UUID and discount', () => {
            // Base64URL encoded: uuid=abc-123&offerDiscount=5000
            const encoded = 'dXVpZD1hYmMtMTIzJm9mZmVyRGlzY291bnQ9NTAwMA';
            const result = parseOfferParam(encoded);

            expect(result).toEqual({
                type: 'crm_tracking',
                uuid: 'abc-123',
                discount: 5000
            });
        });

        it('should parse special offer with discount only', () => {
            // Base64URL encoded: offerDiscount=3000
            const encoded = 'b2ZmZXJEaXNjb3VudD0zMDAw';
            const result = parseOfferParam(encoded);

            expect(result).toEqual({
                type: 'special_offer',
                discount: 3000
            });
        });

        it('should return invalid for null or empty input', () => {
            expect(parseOfferParam(null)).toEqual({ type: 'invalid' });
            expect(parseOfferParam('')).toEqual({ type: 'invalid' });
            expect(parseOfferParam(undefined)).toEqual({ type: 'invalid' });
        });

        it('should return invalid for malformed base64', () => {
            const result = parseOfferParam('not-valid-base64!!!');
            expect(result).toEqual({ type: 'invalid' });
        });

        it('should return invalid for offer with UUID but no discount', () => {
            // Base64URL encoded: uuid=abc-123
            const encoded = 'dXVpZD1hYmMtMTIz';
            const result = parseOfferParam(encoded);

            expect(result).toEqual({ type: 'invalid' });
        });

        it('should handle negative discount as invalid', () => {
            // Base64URL encoded: offerDiscount=-1000
            const encoded = 'b2ZmZXJEaXNjb3VudD0tMTAwMA';
            const result = parseOfferParam(encoded);

            expect(result).toEqual({ type: 'invalid' });
        });

        it('should round decimal discount values', () => {
            // Base64URL encoded: offerDiscount=1500.75
            const encoded = 'b2ZmZXJEaXNjb3VudD0xNTAwLjc1';
            const result = parseOfferParam(encoded);

            expect(result).toEqual({
                type: 'special_offer',
                discount: 1501
            });
        });

        it('should handle base64url encoding with - and _', () => {
            // Construct payload that produces + and / in Base64
            // We inject binary data \xff (11111111) and \xfe which trigger high bits
            const payload = 'uuid=abc-123&offerDiscount=5000&padding=\xff\xff';

            // Generate Base64 and convert to Base64URL
            let base64 = '';
            if (typeof Buffer !== 'undefined') {
                base64 = Buffer.from(payload).toString('base64');
            } else {
                // Fallback for environment without Buffer (though Vitest has it)
                // Just use a known valid string if Buffer is missing, 
                // but we can assume Node env for this test file execution.
                base64 = 'dXVpZD1hYmMtMTIzJm9mZmVyRGlzY291bnQ9NTAwMCZwYWRkaW5nDv//';
            }

            const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

            const result = parseOfferParam(base64Url);

            // Should parse correctly and ignore the binary padding param or handle it reasonably
            // The key assertion is that it didn't return 'invalid' due to decoding error
            expect(result.type).toBe('crm_tracking');
        });
    });
});
