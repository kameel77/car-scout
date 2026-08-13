import { describe, it, expect, beforeEach } from 'vitest';
import { pushConsentDefault, pushConsentUpdate, commitConsent } from '@/lib/consent';

/**
 * Regression guard for a bug that silently disabled Consent Mode in production.
 *
 * The dataLayer used to receive plain arrays (`['consent', 'default', {...}]`).
 * Google ignores that shape: it only processes `arguments` objects, the ones
 * produced by `function gtag(){ dataLayer.push(arguments); }`. The banner looked
 * like it worked, but every tag ran as if consent had been granted.
 *
 * `Object.prototype.toString` is the only reliable way to tell the two apart —
 * an `arguments` object is array-like, so length/indexing checks would pass for
 * a plain array too.
 */
const tag = (value: unknown) => Object.prototype.toString.call(value);

describe('consent mode dataLayer commands', () => {
    beforeEach(() => {
        window.dataLayer = [];
    });

    it('pushes the consent default as an arguments object, not an array', () => {
        pushConsentDefault(false, false);

        const command = window.dataLayer![0];
        expect(tag(command)).toBe('[object Arguments]');
        expect(Array.isArray(command)).toBe(false);
    });

    it('pushes the consent update as an arguments object, not an array', () => {
        pushConsentUpdate(true, true);

        const command = window.dataLayer![0];
        expect(tag(command)).toBe('[object Arguments]');
        expect(Array.isArray(command)).toBe(false);
    });

    it('maps analytics and marketing choices onto the four v2 signals', () => {
        pushConsentUpdate(true, false);

        const [command, action, payload] = Array.from(
            window.dataLayer![0] as IArguments,
        ) as [string, string, Record<string, string>];

        expect(command).toBe('consent');
        expect(action).toBe('update');
        expect(payload).toEqual({
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            security_storage: 'granted',
        });
    });

    it('denies every optional signal when the visitor rejects', () => {
        pushConsentUpdate(false, false);

        const payload = Array.from(window.dataLayer![0] as IArguments)[2] as Record<string, string>;

        expect(payload.analytics_storage).toBe('denied');
        expect(payload.ad_storage).toBe('denied');
        expect(payload.ad_user_data).toBe('denied');
        expect(payload.ad_personalization).toBe('denied');
    });

    it('sets url_passthrough and ads_data_redaction alongside the default', () => {
        pushConsentDefault(false, false);

        const commands = window.dataLayer!.map((c) => Array.from(c as IArguments));

        expect(commands).toContainEqual(['set', 'url_passthrough', true]);
        expect(commands).toContainEqual(['set', 'ads_data_redaction', true]);
    });
});

describe('commitConsent', () => {
    beforeEach(() => {
        window.dataLayer = [];
    });

    it('pushes consent_updated as a plain object after the consent update command', () => {
        commitConsent({ analytics: true, marketing: false }, { persistRemote: false });

        const [command, eventPush] = window.dataLayer!;
        expect(tag(command)).toBe('[object Arguments]');
        expect(eventPush).toEqual({ event: 'consent_updated' });
    });

    it('pushes consent_updated as a plain object, not an arguments object or array', () => {
        commitConsent({ analytics: true, marketing: false }, { persistRemote: false });

        const eventPush = window.dataLayer![1];
        expect(tag(eventPush)).toBe('[object Object]');
        expect(Array.isArray(eventPush)).toBe(false);
    });
});
