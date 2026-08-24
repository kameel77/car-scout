import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { cleanPageLocation, trackPageView } from '@/lib/analytics';

/**
 * Sends a GA4 page_view on SPA navigation through the `spa_page_view` dataLayer event.
 * Must be rendered inside <BrowserRouter>.
 *
 * GA4 enhanced measurement ("page changes based on browser history events") fires its
 * own page_view the instant the URL changes — before react-helmet-async swaps <title>,
 * so every SPA hit carried the PREVIOUS page's title, and before the pages append their
 * filter state, so hits landed on URLs like /leasing?status=new. This tracker waits for
 * the title to settle and reports the cleaned location instead.
 *
 * The enhanced-measurement history trigger MUST be off in the GA4 stream, otherwise it
 * and the GTM tag on `spa_page_view` both count the same navigation.
 */

// <Helmet> applies the new title a frame after the route renders, but pages whose title
// depends on a fetch (offer detail) update it later. Send once the title has held still.
const TITLE_SETTLE_MS = 300;
// Cap for a title that never settles, so the page_view is never dropped entirely.
const TITLE_SETTLE_MAX_MS = 2500;

export function PageViewTracker() {
    const location = useLocation();
    const isInitialRender = useRef(true);
    const referrer = useRef('');

    useEffect(() => {
        // The Google tag sends the initial page_view itself, and by the time the lazily
        // injected GTM runs, <title> is already correct — sending here would double it.
        if (isInitialRender.current) {
            isInitialRender.current = false;
            referrer.current = cleanPageLocation(window.location.href);
            return;
        }

        const titleEl = document.querySelector('title');
        let settleTimer = 0;
        let deadlineTimer = 0;
        let observer: MutationObserver | undefined;

        const send = () => {
            window.clearTimeout(settleTimer);
            window.clearTimeout(deadlineTimer);
            observer?.disconnect();
            const pageLocation = cleanPageLocation(window.location.href);
            trackPageView(pageLocation, referrer.current);
            referrer.current = pageLocation;
        };

        settleTimer = window.setTimeout(send, TITLE_SETTLE_MS);
        deadlineTimer = window.setTimeout(send, TITLE_SETTLE_MAX_MS);

        if (titleEl) {
            observer = new MutationObserver(() => {
                window.clearTimeout(settleTimer);
                settleTimer = window.setTimeout(send, TITLE_SETTLE_MS);
            });
            observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }

        return () => {
            window.clearTimeout(settleTimer);
            window.clearTimeout(deadlineTimer);
            observer?.disconnect();
        };
        // Filter params land in location.search after mount; reacting to them would send
        // a second page_view for the same navigation — and they are stripped anyway.
    }, [location.pathname]);

    return null;
}
