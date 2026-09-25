import { cleanup, render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, describe, expect, it } from 'vitest';
import { MetaHead } from './MetaHead';
import type { SsrMeta } from '@/lib/ssrMeta';

const SSR_META: SsrMeta = {
    path: '/wynajem-dlugoterminowy/toyota-corolla-x1',
    title: 'Toyota Corolla 2025 — wynajem długoterminowy | Motolia',
    description: 'Toyota Corolla 2025 (suv, hybryda) w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.',
    canonical: 'https://motolia.pl/wynajem-dlugoterminowy/toyota-corolla-x1',
    ogImage: 'https://motolia.pl/uploads/rental/corolla.webp',
};

// jsdom ma `document`, więc react-helmet-async traktuje test jako "client" (canUseDOM=true) i
// commituje tagi do document.head — ale asynchronicznie, przez requestAnimationFrame (Helmet
// domyślnie defer=true), a nie wypełnia helmetContext.helmet (to działa tylko po stronie
// serwera). Stąd asercje czytają document.head/document.title przez waitFor zamiast kontekstu.
function renderMetaHead(props: Parameters<typeof MetaHead>[0]) {
    return render(
        <HelmetProvider>
            <MetaHead {...props} />
        </HelmetProvider>
    );
}

describe('MetaHead', () => {
    afterEach(() => {
        cleanup();
        delete window.__SSR_META__;
        history.replaceState({}, '', '/');
        document.title = '';
        document.head.querySelectorAll('[data-rh]').forEach((el) => el.remove());
    });

    it('uses the page props when there is no matching SSR meta (normal SPA navigation)', async () => {
        history.replaceState({}, '', '/wynajem-dlugoterminowy/inny-samochod');
        renderMetaHead({
            title: 'Client Title',
            description: 'Client description',
            canonical: '/wynajem-dlugoterminowy/inny-samochod',
        });

        await waitFor(() => expect(document.title).toBe('Client Title'));
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Client description');
    });

    it('prefers window.__SSR_META__ over props when it matches the current URL (initial load)', async () => {
        window.__SSR_META__ = SSR_META;
        history.replaceState({}, '', SSR_META.path);
        renderMetaHead({
            title: 'Client Title (wrong wording)',
            description: 'Client description (wrong wording, no rate)',
            canonical: SSR_META.path,
        });

        await waitFor(() => expect(document.title).toBe(SSR_META.title));
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(SSR_META.description);
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SSR_META.canonical);
        expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(SSR_META.ogImage);
        expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(SSR_META.title);
        expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(SSR_META.description);
    });

    it('falls back to props again after the SSR meta path no longer matches (SPA nav away)', async () => {
        window.__SSR_META__ = SSR_META;
        history.replaceState({}, '', '/wynajem-dlugoterminowy/other-slug');
        renderMetaHead({
            title: 'Client Title',
            description: 'Client description',
        });

        await waitFor(() => expect(document.title).toBe('Client Title'));
        expect(document.title).not.toBe(SSR_META.title);
    });
});
