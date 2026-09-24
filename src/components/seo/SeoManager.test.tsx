import { cleanup, render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SsrMeta } from '@/lib/ssrMeta';

const useQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({ useQuery }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSettings: () => ({ data: undefined }) }));
vi.mock('@/contexts/BrandContext', () => ({ useBrand: () => ({ config: { name: 'Motolia' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'pl' } }) }));
vi.mock('@/services/api', () => ({ seoApi: { getConfig: vi.fn() } }));

// Import po mockach (SeoManager importuje moduły powyżej na starcie pliku).
const { SeoManager } = await import('./SeoManager');

const HOME_SEO_CONFIG = {
    homeTitle: 'Motolia — leasing, kredyt i wynajem samochodów',
    homeDescription: 'Opis strony głównej — domyślny fallback.',
};

const SSR_META: SsrMeta = {
    path: '/dla-firm',
    title: 'Leasing i najem samochodów dla firm od 1 auta | Motolia',
    description: 'Auta dla Twojej firmy — leasing i najem, wsparcie od pierwszego samochodu.',
    canonical: 'https://motolia.pl/dla-firm',
};

describe('SeoManager', () => {
    beforeEach(() => {
        useQuery.mockReturnValue({ data: HOME_SEO_CONFIG });
    });

    afterEach(() => {
        cleanup();
        delete window.__SSR_META__;
        history.replaceState({}, '', '/');
        document.title = '';
        document.head.querySelectorAll('[data-rh]').forEach((el) => el.remove());
        vi.clearAllMocks();
    });

    it('falls back to the home SEO config when there is no matching SSR meta', async () => {
        history.replaceState({}, '', '/dla-firm');
        render(
            <HelmetProvider>
                <SeoManager />
            </HelmetProvider>
        );

        await waitFor(() => expect(document.title).toBe(HOME_SEO_CONFIG.homeTitle));
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(HOME_SEO_CONFIG.homeDescription);
        // Bez SSR meta nie ma czego wstawić jako canonical — SeoManager go dotąd nie renderował.
        expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    });

    // Regresja: /dla-firm (MotoliaB2BPage) używa MetaHead tylko dla schema, nie dla
    // title/description — bez tego SeoManager pokazywałby opis strony głównej zamiast
    // poprawnego, wyrenderowanego przez SSR opisu dla /dla-firm.
    it('prefers window.__SSR_META__ over the home SEO config when it matches the current URL', async () => {
        window.__SSR_META__ = SSR_META;
        history.replaceState({}, '', SSR_META.path);
        render(
            <HelmetProvider>
                <SeoManager />
            </HelmetProvider>
        );

        await waitFor(() => expect(document.title).toBe(SSR_META.title));
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(SSR_META.description);
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(SSR_META.canonical);
        expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe(SSR_META.title);
        expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe(SSR_META.description);
    });
});
