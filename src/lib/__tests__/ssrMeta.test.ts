import { describe, it, expect, afterEach } from 'vitest';
import { getSsrMeta, type SsrMeta } from '@/lib/ssrMeta';

const SAMPLE: SsrMeta = {
    path: '/wynajem-dlugoterminowy/toyota-corolla-x1',
    title: 'Toyota Corolla 2025 — wynajem długoterminowy | Motolia',
    description: 'Toyota Corolla 2025 (suv, hybryda) w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.',
    canonical: 'https://motolia.pl/wynajem-dlugoterminowy/toyota-corolla-x1',
    ogImage: 'https://motolia.pl/uploads/rental/corolla.webp',
};

describe('getSsrMeta', () => {
    afterEach(() => {
        delete window.__SSR_META__;
        history.replaceState({}, '', '/');
    });

    it('returns null when window.__SSR_META__ is not set', () => {
        history.replaceState({}, '', SAMPLE.path);
        expect(getSsrMeta()).toBeNull();
    });

    it('returns the SSR meta when location matches its path exactly', () => {
        window.__SSR_META__ = SAMPLE;
        history.replaceState({}, '', SAMPLE.path);
        expect(getSsrMeta()).toEqual(SAMPLE);
    });

    it('returns null once the SPA has navigated away, without deleting window.__SSR_META__', () => {
        window.__SSR_META__ = SAMPLE;
        history.replaceState({}, '', SAMPLE.path);
        expect(getSsrMeta()).toEqual(SAMPLE);

        // Nawigacja w SPA na inny URL — SSR meta zostaje w window (żeby StrictMode/podwójny
        // render był bezpieczny), ale przestaje pasować, więc kolejne wywołanie zwraca null.
        history.pushState({}, '', '/wynajem-dlugoterminowy/inny-samochod');
        expect(getSsrMeta()).toBeNull();
        expect(window.__SSR_META__).toEqual(SAMPLE);
    });

    // Ten sam SSR HTML jest cache'owany per path+page (backend cacheKey, render.ts), więc
    // window.__SSR_META__.path pomija każdy inny query param (utm/gclid/filtry) — inaczej meta
    // wygenerowana dla pierwszego odwiedzającego z ?utm_source=x nigdy nie pasowałaby kolejnym
    // gościom tego samego path+page, którym backend serwuje ten sam cache'owany HTML.
    it('matches "/nowe?utm_source=x&page=1" against SSR path "/nowe" — non-page params and page=1 are ignored', () => {
        window.__SSR_META__ = { ...SAMPLE, path: '/nowe' };
        history.replaceState({}, '', '/nowe?utm_source=x&page=1');
        expect(getSsrMeta()).not.toBeNull();
    });

    it('matches "/nowe?page=2&gclid=1" against SSR path "/nowe?page=2" — only ?page counts', () => {
        window.__SSR_META__ = { ...SAMPLE, path: '/nowe?page=2' };
        history.replaceState({}, '', '/nowe?page=2&gclid=1');
        expect(getSsrMeta()).not.toBeNull();
    });

    it('does not match "/nowe?page=3" against SSR path "/nowe?page=2" — a different page is different content', () => {
        window.__SSR_META__ = { ...SAMPLE, path: '/nowe?page=2' };
        history.replaceState({}, '', '/nowe?page=3');
        expect(getSsrMeta()).toBeNull();
    });
});
