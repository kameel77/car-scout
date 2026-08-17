import { describe, it, expect } from 'vitest';
import {
    extractRequestHost,
    getCanonicalProductionHosts,
    isProductionHost,
} from '../environment.js';

describe('environment service — non-production de-indexing detection', () => {
    describe('extractRequestHost', () => {
        it('extracts Host header', () => {
            expect(extractRequestHost({ headers: { host: 'motolia.pl' } })).toBe('motolia.pl');
        });

        it('strips port from Host header', () => {
            expect(extractRequestHost({ headers: { host: 'motolia.pl:443' } })).toBe('motolia.pl');
            expect(extractRequestHost({ headers: { host: 'dev.motolia.pl:3000' } })).toBe('dev.motolia.pl');
        });

        it('ignores X-Forwarded-Host and reads Host directly to prevent header poisoning', () => {
            expect(
                extractRequestHost({
                    headers: {
                        host: 'motolia.pl',
                        'x-forwarded-host': 'dev.motolia.pl',
                    },
                })
            ).toBe('motolia.pl');
        });

        it('returns empty string on missing or invalid host', () => {
            expect(extractRequestHost({ headers: {} })).toBe('');
            expect(extractRequestHost({ headers: { host: undefined } })).toBe('');
            expect(extractRequestHost({ headers: { host: '' } })).toBe('');
        });
    });

    describe('getCanonicalProductionHosts', () => {
        it('includes apex and www for motolia brand', () => {
            const hosts = getCanonicalProductionHosts('https://motolia.pl', 'motolia');
            expect(hosts).toContain('motolia.pl');
            expect(hosts).toContain('www.motolia.pl');
            expect(hosts.size).toBe(2);
        });

        it('includes apex and www for carsalon brand', () => {
            const hosts = getCanonicalProductionHosts('https://carsalon.pl', 'carsalon');
            expect(hosts).toContain('carsalon.pl');
            expect(hosts).toContain('www.carsalon.pl');
            expect(hosts.size).toBe(2);
        });

        it('does not treat dev/staging FRONTEND_URL as production host', () => {
            const hosts = getCanonicalProductionHosts('https://dev.motolia.pl', 'motolia');
            expect(hosts.has('dev.motolia.pl')).toBe(false);
            expect(hosts.has('motolia.pl')).toBe(true);
            expect(hosts.has('www.motolia.pl')).toBe(true);
        });

        it('derives canonical host from clean production FRONTEND_URL if brand is custom', () => {
            const hosts = getCanonicalProductionHosts('https://example.pl', 'custom-brand');
            expect(hosts.has('example.pl')).toBe(true);
            expect(hosts.has('www.example.pl')).toBe(true);
        });
    });

    describe('isProductionHost', () => {
        const frontendUrl = 'https://motolia.pl';
        const brand = 'motolia';

        it('accepts canonical production apex host', () => {
            expect(isProductionHost({ headers: { host: 'motolia.pl' } }, frontendUrl, brand)).toBe(true);
            expect(isProductionHost('motolia.pl', frontendUrl, brand)).toBe(true);
        });

        it('accepts canonical production www variant', () => {
            expect(isProductionHost({ headers: { host: 'www.motolia.pl' } }, frontendUrl, brand)).toBe(true);
            expect(isProductionHost('www.motolia.pl', frontendUrl, brand)).toBe(true);
        });

        it('accepts canonical production host with port', () => {
            expect(isProductionHost({ headers: { host: 'motolia.pl:443' } }, frontendUrl, brand)).toBe(true);
            expect(isProductionHost({ headers: { host: 'www.motolia.pl:443' } }, frontendUrl, brand)).toBe(true);
        });

        it('rejects dev subdomain', () => {
            expect(isProductionHost({ headers: { host: 'dev.motolia.pl' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost('dev.motolia.pl', frontendUrl, brand)).toBe(false);
        });

        it('rejects staging subdomain', () => {
            expect(isProductionHost({ headers: { host: 'staging.motolia.pl' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost('staging.motolia.pl', frontendUrl, brand)).toBe(false);
        });

        it('does not allow spoofing non-production via X-Forwarded-Host when Host is canonical production', () => {
            expect(
                isProductionHost(
                    {
                        headers: {
                            host: 'motolia.pl',
                            'x-forwarded-host': 'dev.motolia.pl',
                        },
                    },
                    frontendUrl,
                    brand
                )
            ).toBe(true);
        });

        it('rejects unknown preview and coolify subdomains', () => {
            expect(isProductionHost({ headers: { host: 'pr-42.motolia.pl' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost({ headers: { host: 'motolia-dev.37.27.193.161.sslip.io' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost('coolify.motolia.pl', frontendUrl, brand)).toBe(false);
        });

        it('rejects raw IP addresses', () => {
            expect(isProductionHost({ headers: { host: '89.167.100.82' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost({ headers: { host: '204.168.226.1' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost({ headers: { host: '127.0.0.1:3000' } }, frontendUrl, brand)).toBe(false);
        });

        it('rejects missing or blank Host', () => {
            expect(isProductionHost({ headers: {} }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost({ headers: { host: '' } }, frontendUrl, brand)).toBe(false);
            expect(isProductionHost('', frontendUrl, brand)).toBe(false);
        });

        it('fails closed when FRONTEND_URL is non-prod and brand is unset', () => {
            expect(isProductionHost({ headers: { host: 'dev.motolia.pl' } }, 'https://dev.motolia.pl', '')).toBe(false);
        });
    });
});
