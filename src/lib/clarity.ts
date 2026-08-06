/**
 * Microsoft Clarity is loaded exclusively through the GTM tag
 * "Clarity - Tag all pages", which requires analytics_storage consent.
 *
 * A direct loader used to live here and ran unconditionally on every page,
 * bypassing the consent banner. It was removed on 2026-08-06 — a visitor who
 * rejected optional cookies was still being recorded.
 *
 * This module now only declares the global typing used by <ClarityPageTracker>.
 * If Clarity ever needs to be initialised from application code again, gate it
 * on `loadConsent()?.analytics` first.
 */

declare global {
    interface Window {
        clarity?: (...args: unknown[]) => void;
    }
}

export {};
