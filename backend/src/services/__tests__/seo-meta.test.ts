import { describe, it, expect } from 'vitest';
import {
    buildBrandMeta,
    buildListingMeta,
    buildModelMeta,
    buildRentalMeta,
    buildStaticMeta,
    defaultMeta,
    injectHead,
    resolveBrandCtx,
    BrandCtx,
} from '../seo-meta';
import { getFinancingArticle } from '../../content/financing-content';

const ctx: BrandCtx = {
    brand: 'motolia',
    baseUrl: 'https://dev.motolia.pl',
    brandName: 'Motolia',
    defaultTitle: 'Motolia - leasing, kredyt i wynajem samochodów',
    defaultDescription: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
    logoUrl: 'https://dev.motolia.pl/brands/motolia/logo.png',
};

const LISTING = {
    make: 'Ford',
    model: 'Puma',
    version: '1.0 EcoBoost',
    productionYear: 2024,
    pricePln: 99900,
    mileageKm: 10,
    condition: 'NEW',
    fuelType: 'benzyna',
    bodyType: 'suv',
    transmission: 'manualna',
    primaryImageUrl: '/uploads/listings/puma.webp',
    additionalInfoContent: '<p>Bogate <b>wyposażenie</b></p>',
    equipmentSafety: ['ABS', 'Czujniki parkowania <tył>'],
    equipmentAudioMultimedia: ['Apple CarPlay'],
    equipmentComfortExtras: [],
    equipmentOther: [],
};

const TEMPLATE = `<!doctype html><html><head><title>OLD</title><meta name="description" content="OLDD" /><meta property="og:title" content="OLD" /><meta property="og:description" content="OLDD" /><meta property="og:url" content="https://old.example" /><meta name="twitter:title" content="OLD" /><meta name="twitter:description" content="OLDD" /></head><body><div id="root"></div></body></html>`;

describe('resolveBrandCtx', () => {
    it('resolves motolia brand from env', () => {
        const prev = { BRAND: process.env.BRAND, FRONTEND_URL: process.env.FRONTEND_URL };
        process.env.BRAND = 'motolia';
        process.env.FRONTEND_URL = 'https://dev.motolia.pl/';
        const c = resolveBrandCtx();
        expect(c.brand).toBe('motolia');
        expect(c.brandName).toBe('Motolia');
        expect(c.baseUrl).toBe('https://dev.motolia.pl'); // trailing slash stripped
        if (prev.BRAND === undefined) delete process.env.BRAND; else process.env.BRAND = prev.BRAND;
        if (prev.FRONTEND_URL === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = prev.FRONTEND_URL;
    });

    it('defaults to carsalon', () => {
        const prev = process.env.BRAND;
        delete process.env.BRAND;
        expect(resolveBrandCtx().brandName).toBe('CarSalon');
        if (prev === undefined) delete process.env.BRAND; else process.env.BRAND = prev;
    });
});

describe('getFinancingArticle', () => {
    it('serves pillar articles for motolia only', () => {
        for (const path of ['/leasing', '/kredyt', '/wynajem-dlugoterminowy']) {
            expect(getFinancingArticle('motolia', path)?.h1).toBeTruthy();
            expect(getFinancingArticle('carsalon', path)).toBeUndefined();
        }
    });
});

describe('buildListingMeta', () => {
    it('oferta: self-canonical, Vehicle + BreadcrumbList JSON-LD, price in title', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.title).toContain('Ford Puma 1.0 EcoBoost 2024');
        expect(m.title).toContain('| Motolia');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect(m.status).toBe(200);
        const ld = m.jsonLd as any[];
        expect(ld[0]['@type']).toBe('Vehicle');
        expect(ld[0].offers.price).toBe(99900);
        expect(ld[0].itemCondition).toBe('https://schema.org/NewCondition');
        expect(ld[0].image).toBe('https://dev.motolia.pl/uploads/listings/puma.webp');
        expect(ld[1]['@type']).toBe('BreadcrumbList');
    });

    it('oferta: bodyHtml has h1, spec table, absolute image and stripped description', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.bodyHtml).toContain('<h1>Ford Puma 1.0 EcoBoost 2024</h1>');
        // Ukryty prerender celowo ładuje wariant -md (nie pełny 1920w) + lazy
        expect(m.bodyHtml).toContain('src="https://dev.motolia.pl/uploads/listings/puma-md.webp"');
        expect(m.bodyHtml).toContain('Bogate wyposażenie');
        expect(m.bodyHtml).not.toContain('<b>');
        expect(m.ogImage).toBe('https://dev.motolia.pl/uploads/listings/puma.webp');
    });

    it('oferta: preloadImages carries hero srcset variants for LCP preload', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.preloadImages).toHaveLength(1);
        const p = m.preloadImages![0];
        expect(p.href).toBe('https://dev.motolia.pl/uploads/listings/puma.webp');
        expect(p.imagesrcset).toContain('puma-thumb.webp 600w');
        expect(p.imagesrcset).toContain('puma-md.webp 1200w');
        expect((p as any).type).toBe('image/webp');
        expect(p.imagesizes).toContain('100vw');
    });

    it('leasing variant: canonical points to /oferta, variant in title, breadcrumb-only JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'leasing', ctx);
        expect(m.title).toContain('— leasing');
        expect(m.canonical).toBe('https://dev.motolia.pl/oferta/ford-puma-abc123');
        expect((m.jsonLd as any)['@type']).toBe('BreadcrumbList');
        expect(m.bodyHtml).toContain('<h2>Leasing tego pojazdu</h2>');
        expect(m.bodyHtml).toContain('<a href="/leasing">');
    });

    it('kredyt variant: financing section and escaped FAQ in bodyHtml, no FAQPage JSON-LD', () => {
        const faq = [
            { questionPl: 'Jaki wkład własny?', answerPl: '<p>Od <b>0%</b> wartości auta.</p>' },
        ];
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'kredyt', ctx, [], faq);
        expect(m.bodyHtml).toContain('<h2>Kredyt samochodowy na ten pojazd</h2>');
        expect(m.bodyHtml).toContain('<a href="/kredyt">');
        expect(m.bodyHtml).toContain('<h2>Najczęstsze pytania o kredyt</h2>');
        expect(m.bodyHtml).toContain('<h3>Jaki wkład własny?</h3>');
        expect(m.bodyHtml).toContain('Od 0% wartości auta.');
        expect(m.bodyHtml).not.toContain('<b>0%</b>');
        expect(JSON.stringify(m.jsonLd)).not.toContain('FAQPage');
    });

    it('oferta variant: no financing section, has purchase process and equipment', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        expect(m.bodyHtml).not.toContain('Kredyt samochodowy na ten pojazd');
        expect(m.bodyHtml).not.toContain('Leasing tego pojazdu');
        expect(m.bodyHtml).toContain('<h2>Jak kupić ten samochód?</h2>');
        expect(m.bodyHtml).toContain('<h2>Wyposażenie</h2>');
        expect(m.bodyHtml).toContain('<h3>Bezpieczeństwo</h3>');
        expect(m.bodyHtml).toContain('<li>Czujniki parkowania &lt;tył&gt;</li>');
        expect(m.bodyHtml).toContain('<li>Apple CarPlay</li>');
        expect(m.bodyHtml).not.toContain('<h3>Komfort i dodatki</h3>');
    });

    it('oferta variant: BreadcrumbList item 2 is Samochody / /samochody', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[1].itemListElement[1].name).toBe('Samochody');
        expect(ld[1].itemListElement[1].item).toBe('https://dev.motolia.pl/samochody');
        expect(m.bodyHtml).toContain('<li><a href="/samochody">Samochody</a></li>');
    });

    it('leasing variant: BreadcrumbList item 2 is Leasing samochodowy / /leasing', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'leasing', ctx);
        const ld = m.jsonLd as any;
        expect(ld.itemListElement[1].name).toBe('Leasing samochodowy');
        expect(ld.itemListElement[1].item).toBe('https://dev.motolia.pl/leasing');
        expect(m.bodyHtml).toContain('<li><a href="/leasing">Leasing samochodowy</a></li>');
    });

    it('kredyt variant: BreadcrumbList item 2 is Kredyt samochodowy / /kredyt', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'kredyt', ctx);
        const ld = m.jsonLd as any;
        expect(ld.itemListElement[1].name).toBe('Kredyt samochodowy');
        expect(ld.itemListElement[1].item).toBe('https://dev.motolia.pl/kredyt');
        expect(m.bodyHtml).toContain('<li><a href="/kredyt">Kredyt samochodowy</a></li>');
    });
});

describe('buildListingMeta: itemCondition fallback dla fabrycznie nowych aut', () => {
    const currentYear = new Date().getFullYear();

    it('condition NEW → NewCondition', () => {
        const m = buildListingMeta({ ...LISTING, condition: 'NEW', mileageKm: 15000 }, 'x', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[0].itemCondition).toBe('https://schema.org/NewCondition');
        expect(ld[0].offers.itemCondition).toBe('https://schema.org/NewCondition');
    });

    it('condition USED z typowym przebiegiem i starszym rocznikiem → UsedCondition', () => {
        const m = buildListingMeta({ ...LISTING, condition: 'USED', mileageKm: 45000, productionYear: 2019 }, 'x', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[0].itemCondition).toBe('https://schema.org/UsedCondition');
    });

    it('brak condition (błędne dane z importu) + przebieg 8 km + rocznik bieżący → fallback do NewCondition', () => {
        const m = buildListingMeta({ ...LISTING, condition: '', mileageKm: 8, productionYear: currentYear }, 'x', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[0].itemCondition).toBe('https://schema.org/NewCondition');
    });

    it('mały przebieg, ale stary rocznik → fallback się nie uruchamia, zostaje UsedCondition', () => {
        const m = buildListingMeta({ ...LISTING, condition: 'USED', mileageKm: 8, productionYear: currentYear - 3 }, 'x', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[0].itemCondition).toBe('https://schema.org/UsedCondition');
    });

    it('świeży rocznik, ale przebieg powyżej progu → fallback się nie uruchamia, zostaje UsedCondition', () => {
        const m = buildListingMeta({ ...LISTING, condition: 'USED', mileageKm: 500, productionYear: currentYear }, 'x', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        expect(ld[0].itemCondition).toBe('https://schema.org/UsedCondition');
    });
});

describe('buildListingMeta breadcrumb: brand/model levels', () => {
    it('inserts brand and brand+model levels between category and offer name, links to new URLs', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const ld = m.jsonLd as any[];
        const breadcrumb = ld[1];
        expect(breadcrumb['@type']).toBe('BreadcrumbList');
        expect(breadcrumb.itemListElement).toHaveLength(5);
        expect(breadcrumb.itemListElement[2]).toEqual({
            '@type': 'ListItem', position: 3, name: 'Ford', item: 'https://dev.motolia.pl/samochody/ford',
        });
        expect(breadcrumb.itemListElement[3]).toEqual({
            '@type': 'ListItem', position: 4, name: 'Ford Puma', item: 'https://dev.motolia.pl/samochody/ford/puma',
        });
        expect(breadcrumb.itemListElement[4].position).toBe(5);
        expect(m.bodyHtml).toContain('<li><a href="/samochody/ford">Ford</a></li>');
        expect(m.bodyHtml).toContain('<li><a href="/samochody/ford/puma">Ford Puma</a></li>');
    });

    it('uses canonical brand name (normalizeBrand) for the breadcrumb, not the raw make field', () => {
        const m = buildListingMeta({ ...LISTING, make: 'skoda', model: 'Octavia' }, 'skoda-octavia-abc', 'oferta', ctx);
        expect(m.bodyHtml).toContain('<li><a href="/samochody/skoda">Škoda</a></li>');
    });
});

describe('buildRentalMeta', () => {
    it('self-canonical under /wynajem-dlugoterminowy', () => {
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Corolla', version: null, productionYear: 2024 },
            'toyota-corolla-x1',
            ctx
        );
        expect(m.title).toContain('— wynajem długoterminowy');
        expect(m.canonical).toBe('https://dev.motolia.pl/wynajem-dlugoterminowy/toyota-corolla-x1');
    });

    it('rental section and FAQ in bodyHtml', () => {
        const faq = [{ questionPl: 'Jaki limit kilometrów?', answerPl: 'Od <b>10 000</b> km rocznie.' }];
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Corolla', version: null, productionYear: 2024 },
            'toyota-corolla-x1',
            ctx,
            faq
        );
        // Boilerplate sekcji rotuje deterministycznie wg slugu (suma kodów znaków % 3) — dla
        // 'toyota-corolla-x1' wypada wariant 2 ("Najem długoterminowy — jak to działa")
        expect(m.bodyHtml).toContain('<h2>Najem długoterminowy — jak to działa</h2>');
        expect(m.bodyHtml).toContain('<a href="/wynajem-dlugoterminowy">wynajem długoterminowy samochodu</a>');
        expect(m.bodyHtml).toContain('<h2>Najczęstsze pytania o wynajem długoterminowy</h2>');
        expect(m.bodyHtml).toContain('<h3>Jaki limit kilometrów?</h3>');
        expect(m.bodyHtml).toContain('Od 10 000 km rocznie.');
        expect(m.bodyHtml).not.toContain('<b>10 000</b>');
        // FAQ wygenerowane z danych pojazdu (brak rocznika/paliwa tutaj poza rokiem) — pytanie o dostępność zawsze obecne
        expect(m.bodyHtml).toContain('<h3>Czy Toyota Corolla 2024 jest dostępny od ręki?</h3>');
    });

    it('full Vehicle + LeaseOut offer + BreadcrumbList + FAQPage JSON-LD, rate in body', () => {
        const faq = [{ questionPl: 'Co zawiera rata?', answerPl: 'Finansowanie i **ubezpieczenie**.' }];
        const m = buildRentalMeta(
            {
                make: 'Toyota',
                model: 'Corolla',
                version: 'Comfort',
                productionYear: 2026,
                primaryImageUrl: '/uploads/rental/corolla.webp',
                bodyType: 'sedan',
                fuelType: 'hybryda',
                transmission: 'automatyczna',
                enginePowerHp: 140,
                doors: 4,
                seats: 5,
                color: 'czarny',
                mileageKm: 0,
                condition: 'NEW',
                equipmentSafety: ['ABS'],
            },
            'toyota-corolla-x1',
            ctx,
            faq,
            1899.5
        );
        const ld = m.jsonLd as any[];
        expect(ld[0]['@type']).toBe('Vehicle');
        expect(ld[0].image).toBe('https://dev.motolia.pl/uploads/rental/corolla.webp');
        expect(ld[0].itemCondition).toBe('https://schema.org/NewCondition');
        expect(ld[0].vehicleTransmission).toBe('automatyczna');
        expect(ld[0].offers.businessFunction).toBe('http://purl.org/goodrelations/v1#LeaseOut');
        expect(ld[0].offers.priceSpecification.price).toBe(1900);
        expect(ld[0].offers.priceSpecification.minPrice).toBe(1900);
        expect(ld[0].offers.seller.name).toBe('Motolia');
        expect(ld[1]['@type']).toBe('BreadcrumbList');
        expect(ld[2]['@type']).toBe('FAQPage');
        // Wygenerowane pytania (z danych pojazdu) idą przed FAQ z CMS — ta sama kolejność co w widocznym HTML
        expect(ld[2].mainEntity.at(-1).acceptedAnswer.text).toBe('Finansowanie i ubezpieczenie.');
        expect(ld[2].mainEntity[0].name).toContain('Ile kosztuje wynajem długoterminowy');
        expect(ld[2].mainEntity[0].acceptedAnswer.text).toContain('1900 zł brutto miesięcznie');
        expect(m.bodyHtml).toContain(`Rata najmu od ${(1900).toLocaleString('pl-PL')} zł brutto miesięcznie.`);
        expect(m.bodyHtml).toContain('<h2>Wyposażenie</h2>');
        expect(m.bodyHtml).toContain('<tr><td>Moc</td><td>140 KM</td></tr>');
        expect(m.ogImage).toBe('https://dev.motolia.pl/uploads/rental/corolla.webp');
    });

    it('omits offers entirely when monthlyRateFrom is not set', () => {
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Corolla', version: null, productionYear: 2024 },
            'toyota-corolla-x1',
            ctx
        );
        const ld = m.jsonLd as any[];
        expect(ld[0]['@type']).toBe('Vehicle');
        expect(ld[0].offers).toBeUndefined();
    });

    it('two vehicles with different bodyType/fuelType produce substantially different bodyHtml (anti thin-content)', () => {
        const kombi = buildRentalMeta(
            {
                make: 'Skoda',
                model: 'Fabia',
                version: '1.0 TSI DSG Drive',
                productionYear: 2026,
                bodyType: 'Kombi',
                fuelType: 'Benzyna',
                transmission: 'Automatyczna',
                enginePowerHp: 110,
            },
            'skoda-fabia-k1',
            ctx,
            [],
            1261
        );
        const suv = buildRentalMeta(
            {
                make: 'Kia',
                model: 'EV6',
                version: null,
                productionYear: 2026,
                bodyType: 'SUV',
                fuelType: 'Elektryczny',
                transmission: 'Automatyczna',
                enginePowerHp: 229,
            },
            'kia-ev6-k2',
            ctx,
            [],
            2400
        );

        // Akapit otwierający zbudowany z konkretnych pól, nie z ogólnika
        expect(kombi.bodyHtml).toContain(
            `Skoda Fabia 1.0 TSI DSG Drive 2026 to kombi z silnikiem benzynowym 110 KM i automatyczną skrzynią, dostępne w wynajmie długoterminowym od ${(1261).toLocaleString('pl-PL')} zł brutto miesięcznie.`
        );
        expect(suv.bodyHtml).toContain(
            `Kia EV6 2026 to SUV z napędem elektrycznym 229 KM i automatyczną skrzynią, dostępne w wynajmie długoterminowym od ${(2400).toLocaleString('pl-PL')} zł brutto miesięcznie.`
        );

        // Akapit segmentowy wg nadwozia różni się między SUV a kombi
        expect(kombi.bodyHtml).toContain('w nadwoziu kombi to typowy wybór dla rodzin');
        expect(suv.bodyHtml).toContain('jako SUV zapewnia wysoką pozycję za kierownicą');
        expect(kombi.bodyHtml).not.toContain('jako SUV zapewnia wysoką pozycję za kierownicą');

        // Akapit wg paliwa różni się między benzyną a elektrykiem, bez podawania liczb spalania/zasięgu
        expect(kombi.bodyHtml).toContain('Silnik benzynowy w Skoda Fabia sprawdza się');
        expect(suv.bodyHtml).toContain('jako auto elektryczne wymaga dostępu do ładowania');
        expect(kombi.bodyHtml).not.toMatch(/\d+\s*km zasięgu|\d+\s*l\/100/);
        expect(suv.bodyHtml).not.toMatch(/\d+\s*km zasięgu|\d+\s*l\/100/);

        expect(kombi.bodyHtml).not.toBe(suv.bodyHtml);
    });

    it('FAQ with monthlyRateFrom appears in visible HTML and matches FAQPage JSON-LD exactly', () => {
        const m = buildRentalMeta(
            { make: 'Toyota', model: 'Yaris', version: null, productionYear: 2025, transmission: 'Manualna', fuelType: 'Benzyna' },
            'toyota-yaris-r1',
            ctx,
            [],
            999
        );
        expect(m.bodyHtml).toContain('<h3>Ile kosztuje wynajem długoterminowy Toyota Yaris 2025?</h3>');
        expect(m.bodyHtml).toContain('999 zł brutto miesięcznie');
        expect(m.bodyHtml).toContain('<h3>Czy Toyota Yaris 2025 jest dostępny od ręki?</h3>');
        expect(m.bodyHtml).toContain('<h3>Jaka skrzynia biegów i jakie paliwo ma Toyota Yaris 2025?</h3>');

        const ld = m.jsonLd as any[];
        const faqPage = ld.find(e => e['@type'] === 'FAQPage');
        expect(faqPage.mainEntity).toHaveLength(3);
        expect(faqPage.mainEntity.map((e: any) => e.name)).toEqual([
            'Ile kosztuje wynajem długoterminowy Toyota Yaris 2025?',
            'Czy Toyota Yaris 2025 jest dostępny od ręki?',
            'Jaka skrzynia biegów i jakie paliwo ma Toyota Yaris 2025?',
        ]);
    });

    it('renders related rental vehicles as links with rate', () => {
        const related = [
            { slug: 'skoda-octavia-r2', make: 'Skoda', model: 'Octavia', productionYear: 2025, monthlyRateFrom: 1500.4 },
            { slug: 'skoda-superb-r3', make: 'Skoda', model: 'Superb', productionYear: null, monthlyRateFrom: null },
        ];
        const m = buildRentalMeta(
            { make: 'Skoda', model: 'Fabia', version: null, productionYear: 2026 },
            'skoda-fabia-k1',
            ctx,
            [],
            null,
            related
        );
        expect(m.bodyHtml).toContain('<h2>Zobacz też inne auta w wynajmie</h2>');
        expect(m.bodyHtml).toContain(`<a href="/wynajem-dlugoterminowy/skoda-octavia-r2">Skoda Octavia (2025) — rata od ${(1500).toLocaleString('pl-PL')} zł/mies.</a>`);
        expect(m.bodyHtml).toContain('<a href="/wynajem-dlugoterminowy/skoda-superb-r3">Skoda Superb</a>');
    });

    it('no related section when related list is empty', () => {
        const m = buildRentalMeta(
            { make: 'Skoda', model: 'Fabia', version: null, productionYear: 2026 },
            'skoda-fabia-k1',
            ctx
        );
        expect(m.bodyHtml).not.toContain('Zobacz też inne auta w wynajmie');
    });

    it('missing fields (nulls) render gracefully — no crash, no empty sentences, no empty table rows', () => {
        const m = buildRentalMeta(
            {
                make: 'BMW',
                model: 'X1',
                version: null,
                productionYear: null,
                bodyType: null,
                fuelType: null,
                transmission: null,
                enginePowerHp: null,
                color: null,
            },
            'bmw-x1-min',
            ctx
        );
        expect(m.bodyHtml).toContain('BMW X1 dostępne jest w wynajmie długoterminowym.');
        expect(m.bodyHtml).not.toContain('<p></p>');
        expect(m.bodyHtml).not.toContain('undefined');
        expect(m.bodyHtml).not.toContain('null');
        // Sekcja segmentowa/paliwowa pominięta całkowicie, bez zmyślonych kategorii
        expect(m.bodyHtml).not.toContain('W wynajmie długoterminowym to');
        expect(m.bodyHtml).toContain('<h3>Czy BMW X1 jest dostępny od ręki?</h3>');
    });

    it('meta description is enriched with bodyType/fuelType/rate when available', () => {
        const m = buildRentalMeta(
            { make: 'Skoda', model: 'Fabia', version: null, productionYear: 2026, bodyType: 'Kombi', fuelType: 'Benzyna' },
            'skoda-fabia-k1',
            ctx,
            [],
            1261
        );
        expect(m.description).toContain(`Kombi, Benzyna, rata od ${(1261).toLocaleString('pl-PL')} zł/mies.`);
    });
});

describe('buildStaticMeta', () => {
    it('known route gets unique title and self-canonical', () => {
        const m = buildStaticMeta('/uzywane', ctx)!;
        expect(m.title).toContain('używane');
        expect(m.canonical).toBe('https://dev.motolia.pl/uzywane');
    });

    it('/search canonicalizes to /samochody', () => {
        expect(buildStaticMeta('/search', ctx)!.canonical).toBe('https://dev.motolia.pl/samochody');
    });

    it('catalog preloads only the first card and matches WebP responsive variants', () => {
        const listings = [
            {
                id: 'first', make: 'Ford', model: 'Puma', version: 'ST-Line',
                productionYear: 2025, pricePln: 120000, slug: 'ford-puma-first',
                primaryImageUrl: '/uploads/listings/first.webp',
            },
            {
                id: 'second', make: 'Skoda', model: 'Kamiq', version: 'Style',
                productionYear: 2025, pricePln: 125000, slug: 'skoda-kamiq-second',
                primaryImageUrl: '/uploads/listings/second.webp',
            },
        ];
        const m = buildStaticMeta('/nowe', ctx, listings)!;
        expect(m.preloadImages).toHaveLength(1);
        expect(m.preloadImages![0]).toMatchObject({
            href: 'https://dev.motolia.pl/uploads/listings/first.webp',
            type: 'image/webp',
        });
        expect(m.preloadImages![0].imagesrcset).toContain('first-thumb.webp 600w');
        expect(m.preloadImages![0].imagesrcset).not.toContain('second');
    });

    it('without article: route.description stays the intro <p> right after <h1> (unchanged behavior)', () => {
        const m = buildStaticMeta('/uzywane', ctx)!;
        expect(m.bodyHtml).toContain(
            '<h1>Samochody używane od dealera z gwarancją</h1>\n<p>Samochody używane od dealerów — sprawdzone auta z finansowaniem: leasing, kredyt lub najem.</p>'
        );
        expect(m.description).toBe('Samochody używane od dealerów — sprawdzone auta z finansowaniem: leasing, kredyt lub najem.');
    });

    it('home uses brand defaults and Organization JSON-LD', () => {
        const m = buildStaticMeta('/', ctx)!;
        expect(m.title).toBe(ctx.defaultTitle);
        const org = Array.isArray(m.jsonLd) ? m.jsonLd.find((x: any) => x['@type'] === 'Organization') : m.jsonLd;
        expect(org?.['@type']).toBe('Organization');
    });

    it('home bodyHtml has no h1 (avoids duplicate with home-shell h1) and shows title as strong text', () => {
        const m = buildStaticMeta('/', ctx)!;
        expect(m.bodyHtml).not.toContain('<h1>');
        expect(m.bodyHtml).toContain(`<p><strong>${ctx.defaultTitle}</strong></p>`);
    });

    it('category h1 excludes the "| Brand" suffix present in <title>', () => {
        const m = buildStaticMeta('/samochody', ctx)!;
        expect(m.title).toContain('| Motolia');
        expect(m.bodyHtml).toContain('<h1>Samochody dostępne od ręki — nowe i używane</h1>');
        expect(m.bodyHtml).not.toContain('| Motolia</h1>');
    });

    it('paginated category h1 keeps "— strona N" but still excludes the brand suffix', () => {
        const m = buildStaticMeta('/samochody', ctx, [], [], '/oferta', undefined, { page: 3, totalPages: 58 })!;
        expect(m.bodyHtml).toContain('<h1>Samochody dostępne od ręki — nowe i używane — strona 3</h1>');
        expect(m.bodyHtml).not.toContain('| Motolia</h1>');
    });

    it('Organization JSON-LD includes description, alternateName and disambiguatingDescription from brand ctx', () => {
        const m = buildStaticMeta('/', ctx)!;
        const org = (Array.isArray(m.jsonLd) ? m.jsonLd.find((x: any) => x['@type'] === 'Organization') : m.jsonLd) as any;
        expect(org.description).toBe(ctx.defaultDescription);
        expect(org.alternateName).toBeUndefined();
        expect(org.disambiguatingDescription).toBeUndefined();
        expect(org.legalName).toBeUndefined();
        expect(org.contactPoint).toBeUndefined();

        const prevBrand = process.env.BRAND;
        process.env.BRAND = 'motolia';
        const motoliaCtx = resolveBrandCtx();
        if (prevBrand === undefined) delete process.env.BRAND; else process.env.BRAND = prevBrand;

        const mMotolia = buildStaticMeta('/', motoliaCtx)!;
        const orgMotolia = (Array.isArray(mMotolia.jsonLd) ? mMotolia.jsonLd.find((x: any) => x['@type'] === 'Organization') : mMotolia.jsonLd) as any;
        expect(orgMotolia.alternateName).toEqual(['Motolia.pl', 'motolia.pl', 'Motoria', 'Motalia', 'Moto lia']);
        expect(orgMotolia.disambiguatingDescription).toContain('Motolia');
    });

    it('Organization JSON-LD includes legal fields and contactPoint when settings are complete', () => {
        const m = buildStaticMeta('/', ctx, [], [], '/oferta', undefined, undefined, {
            legalCompanyName: 'Motolia Sp. z o.o.',
            legalAddress: 'ul. Testowa 1, 00-001 Warszawa',
            legalVatId: 'PL1234567890',
            legalContactEmail: 'kontakt@motolia.pl',
            legalContactPhone: '+48123456789',
        })!;
        const org = (Array.isArray(m.jsonLd) ? m.jsonLd.find((x: any) => x['@type'] === 'Organization') : m.jsonLd) as any;
        expect(org.legalName).toBe('Motolia Sp. z o.o.');
        expect(org.address).toBe('ul. Testowa 1, 00-001 Warszawa');
        expect(org.vatID).toBe('PL1234567890');
        expect(org.contactPoint).toEqual({
            '@type': 'ContactPoint',
            telephone: '+48123456789',
            email: 'kontakt@motolia.pl',
            contactType: 'customer service',
            areaServed: 'PL',
            availableLanguage: ['pl'],
        });
    });

    it('Organization JSON-LD omits legal fields and contactPoint when settings are empty/absent', () => {
        const m = buildStaticMeta('/', ctx, [], [], '/oferta', undefined, undefined, {})!;
        const org = (Array.isArray(m.jsonLd) ? m.jsonLd.find((x: any) => x['@type'] === 'Organization') : m.jsonLd) as any;
        expect(org.legalName).toBeUndefined();
        expect(org.address).toBeUndefined();
        expect(org.vatID).toBeUndefined();
        expect(org.contactPoint).toBeUndefined();

        const mNoArg = buildStaticMeta('/', ctx)!;
        const orgNoArg = (Array.isArray(mNoArg.jsonLd) ? mNoArg.jsonLd.find((x: any) => x['@type'] === 'Organization') : mNoArg.jsonLd) as any;
        expect(orgNoArg.contactPoint).toBeUndefined();
    });

    it('Organization JSON-LD contactPoint appears even with only one of phone/email set', () => {
        const m = buildStaticMeta('/', ctx, [], [], '/oferta', undefined, undefined, {
            legalContactEmail: 'kontakt@motolia.pl',
        })!;
        const org = (Array.isArray(m.jsonLd) ? m.jsonLd.find((x: any) => x['@type'] === 'Organization') : m.jsonLd) as any;
        expect(org.contactPoint).toEqual({
            '@type': 'ContactPoint',
            email: 'kontakt@motolia.pl',
            contactType: 'customer service',
            areaServed: 'PL',
            availableLanguage: ['pl'],
        });
    });

    it('unknown route returns null', () => {
        expect(buildStaticMeta('/nie-ma-takiej-strony', ctx)).toBeNull();
    });

    it('financing category renders pillar article and visible FAQ with FAQPage JSON-LD', () => {
        const article = { h1: 'Leasing samochodu osobowego — operacyjny i konsumencki', html: '<p>Treść filaru z <a href="/kredyt">linkiem</a>.</p>' };
        const faq = [{ questionPl: 'Czy leasing wymaga BIK?', answerPl: 'Tak, **weryfikacja** obejmuje BIK.' }];
        const m = buildStaticMeta('/leasing', ctx, [], faq, '/oferta', article)!;
        expect(m.bodyHtml).toContain('<h1>Leasing samochodu osobowego — operacyjny i konsumencki</h1>');
        expect(m.bodyHtml).toContain('<article>');
        expect(m.bodyHtml).toContain('href="/kredyt"');
        expect(m.bodyHtml).toContain('<h3>Czy leasing wymaga BIK?</h3>');
        expect(m.bodyHtml).not.toContain('**');
        expect(JSON.stringify(m.jsonLd)).toContain('FAQPage');
    });

    it('financing category with article: first <p> of article.html becomes centerpiece right after <h1>, before "Oferty", and is not duplicated inside <article>', () => {
        const article = {
            h1: 'Leasing samochodu osobowego — operacyjny i konsumencki',
            html: '<p>Leasing to forma finansowania <a href="/kredyt">pojazdu</a>.</p>\n\n<h2>Ile kosztuje leasing?</h2>\n\n<p>Druga sekcja artykułu.</p>',
        };
        const listings = [
            { id: 'l1', make: 'Kia', model: 'Ceed', version: null, productionYear: 2025, pricePln: 90000, slug: 'kia-ceed-l1' },
        ];
        const m = buildStaticMeta('/leasing', ctx, listings, [], '/oferta', article)!;

        const h1Idx = m.bodyHtml!.indexOf('<h1>');
        const introIdx = m.bodyHtml!.indexOf('<p>Leasing to forma finansowania');
        const offersIdx = m.bodyHtml!.indexOf('<h2>Oferty</h2>');
        const articleIdx = m.bodyHtml!.indexOf('<article>');

        // Definicja pojawia się dokładnie raz — zaraz po <h1>, przed sekcją "Oferty"
        expect(h1Idx).toBeGreaterThanOrEqual(0);
        expect(introIdx).toBeGreaterThan(h1Idx);
        expect(introIdx).toBeLessThan(offersIdx);
        expect(offersIdx).toBeLessThan(articleIdx);
        expect(m.bodyHtml!.match(/Leasing to forma finansowania/g)).toHaveLength(1);

        // Reszta artykułu (druga sekcja) nadal renderuje się w <article>, bez pierwszego akapitu
        expect(m.bodyHtml).toContain('<h2>Ile kosztuje leasing?</h2>');
        expect(m.bodyHtml).toContain('<p>Druga sekcja artykułu.</p>');

        // route.description zostaje meta description, mimo że w bodyHtml go nie ma
        expect(m.description).toBe('Samochody dostępne od ręki w leasingu. Złóż wniosek o finansowanie i odbierz auto bez czekania.');
    });

    it('rental category links to rental pages via listingsBasePath', () => {
        const rentals = [
            { id: 'r1', make: 'Kia', model: 'Sportage', version: null, productionYear: 2026, pricePln: null, slug: 'kia-sportage-r1' },
        ];
        const m = buildStaticMeta('/wynajem-dlugoterminowy', ctx, rentals, [], '/wynajem-dlugoterminowy')!;
        expect(m.bodyHtml).toContain('href="/wynajem-dlugoterminowy/kia-sportage-r1"');
        expect(m.bodyHtml).toContain('Kia Sportage (2026)');
        expect(m.bodyHtml).not.toContain('/oferta/');
        expect(m.bodyHtml).not.toContain('zł');
        expect(JSON.stringify(m.jsonLd)).toContain('https://dev.motolia.pl/wynajem-dlugoterminowy/kia-sportage-r1');
    });

    it('paginated category page: title suffix, self-canonical with ?page, prev/next links', () => {
        const m = buildStaticMeta('/samochody', ctx, [], [], '/oferta', undefined, { page: 3, totalPages: 58 })!;
        expect(m.title).toContain('— strona 3');
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody?page=3');
        expect(m.bodyHtml).toContain('href="/samochody?page=2"');
        expect(m.bodyHtml).toContain('href="/samochody?page=4"');
        expect(m.bodyHtml).toContain('href="/samochody?page=58"');
        expect(m.bodyHtml).toContain('aria-current="page"');
    });

    it('page 1 with pagination: clean canonical, no title suffix, link to page 2', () => {
        const m = buildStaticMeta('/samochody', ctx, [], [], '/oferta', undefined, { page: 1, totalPages: 58 })!;
        expect(m.title).not.toContain('strona');
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody');
        expect(m.bodyHtml).toContain('href="/samochody?page=2"');
        expect(m.bodyHtml).not.toContain('rel="prev"');
    });

    it('single page: no pagination nav', () => {
        const m = buildStaticMeta('/samochody', ctx, [], [], '/oferta', undefined, { page: 1, totalPages: 1 })!;
        expect(m.bodyHtml).not.toContain('Paginacja');
    });

    it('paginated /search links point at canonical /samochody base', () => {
        const m = buildStaticMeta('/search', ctx, [], [], '/oferta', undefined, { page: 2, totalPages: 5 })!;
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody?page=2');
        expect(m.bodyHtml).toContain('href="/samochody?page=3"');
    });

    it('financing pages link to full catalog instead of paginating', () => {
        const listings = [
            { id: 'l1', make: 'Kia', model: 'Ceed', version: null, productionYear: 2025, pricePln: 90000, slug: 'kia-ceed-l1' },
        ];
        const m = buildStaticMeta('/leasing', ctx, listings)!;
        expect(m.bodyHtml).toContain('href="/samochody">Zobacz wszystkie samochody');
        expect(m.bodyHtml).not.toContain('Paginacja');
        const cars = buildStaticMeta('/samochody', ctx, listings)!;
        expect(cars.bodyHtml).not.toContain('Zobacz wszystkie samochody');
    });
});

describe('buildBrandMeta', () => {
    const models = [
        { name: 'Octavia', slug: 'octavia', count: 5 },
        { name: 'Fabia', slug: 'fabia', count: 2 },
    ];
    const otherBrands = [{ name: 'BMW', slug: 'bmw', count: 10 }];
    const listings = [
        { id: 'l1', make: 'Škoda', model: 'Octavia', version: null, productionYear: 2023, pricePln: 89900, bodyType: 'kombi', fuelType: 'diesel', slug: 'skoda-octavia-l1' },
    ];

    it('is always self-canonical (never noindex, count-independent)', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody/skoda');
        expect(m.noindex).toBeUndefined();
        expect(m.status).toBe(200);
    });

    it('title/description/h1 include the real offer count', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        expect(m.title).toContain('Škoda (7 ofert)');
        expect(m.title).toContain('| Motolia');
        expect(m.description).toContain('7 ofert');
        expect(m.bodyHtml).toContain('<h1>Samochody Škoda dostępne od ręki — nowe i używane</h1>');
    });

    it('links to model pages and to other brands (linkowanie wewnętrzne)', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        expect(m.bodyHtml).toContain('<a href="/samochody/skoda/octavia">Octavia</a>');
        expect(m.bodyHtml).toContain('<a href="/samochody/skoda/fabia">Fabia</a>');
        expect(m.bodyHtml).toContain('<a href="/samochody/bmw">BMW</a>');
    });

    it('breadcrumb: Home > Samochody > Marka', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        const breadcrumb = (m.jsonLd as any[]).find(e => e['@type'] === 'BreadcrumbList');
        expect(breadcrumb.itemListElement).toEqual([
            { '@type': 'ListItem', position: 1, name: 'Strona główna', item: 'https://dev.motolia.pl' },
            { '@type': 'ListItem', position: 2, name: 'Samochody', item: 'https://dev.motolia.pl/samochody' },
            { '@type': 'ListItem', position: 3, name: 'Škoda', item: 'https://dev.motolia.pl/samochody/skoda' },
        ]);
    });

    it('dynamic FAQ (2-3 items, real data) with FAQPage JSON-LD matching visible HTML', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        expect(m.bodyHtml).toContain('od 59 900 do 189 900 zł');
        expect(m.bodyHtml).toContain('Jakie modele Škoda są dostępne?');
        const faqPage = (m.jsonLd as any[]).find(e => e['@type'] === 'FAQPage');
        expect(faqPage.mainEntity.length).toBeGreaterThanOrEqual(2);
        expect(faqPage.mainEntity.length).toBeLessThanOrEqual(3);
    });

    it('at 0 offers: dynamic FAQ disappears entirely, no fabricated numbers', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 0, { min: null, max: null }, [], otherBrands, [], ctx);
        expect(m.bodyHtml).not.toContain('Najczęstsze pytania');
        expect(JSON.stringify(m.jsonLd)).not.toContain('FAQPage');
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody/skoda'); // still self-canonical
        expect(m.bodyHtml).toContain('Aktualnie brak ofert Škoda — zostaw kontakt, powiadomimy o nowej ofercie.');
        // "podobne auta" — linki do innych marek zostają mimo braku ofert (waitlist, F3)
        expect(m.bodyHtml).toContain('<a href="/samochody/bmw">BMW</a>');
    });

    it('paginated: title/h1 suffix and canonical carry ?page=N', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 40, { min: 50000, max: 100000 }, models, otherBrands, listings, ctx, { page: 2, totalPages: 3 });
        expect(m.title).toContain('— strona 2');
        expect(m.bodyHtml).toContain('<h1>Samochody Škoda dostępne od ręki — nowe i używane — strona 2</h1>');
        expect(m.canonical).toBe('https://dev.motolia.pl/samochody/skoda?page=2');
        expect(m.bodyHtml).toContain('<a href="/samochody/skoda">1</a>');
        expect(m.bodyHtml).toContain('href="/samochody/skoda?page=3"');
    });
});

describe('buildBrandMeta with CMS content', () => {
    const models = [{ name: 'Octavia', slug: 'octavia', count: 5 }];
    const otherBrands = [{ name: 'BMW', slug: 'bmw', count: 10 }];
    const listings = [
        { id: 'l1', make: 'Škoda', model: 'Octavia', version: null, productionYear: 2023, pricePln: 89900, bodyType: 'kombi', fuelType: 'diesel', slug: 'skoda-octavia-l1' },
    ];
    const cms = {
        html: '<p>Treść redakcyjna o Škodzie.</p>',
        faq: [{ questionPl: 'Czy Škoda jest niezawodna?', answerPl: 'Tak, zwykle tak.' }],
        metaTitle: 'Škoda — CMS title',
        metaDescription: 'Škoda — CMS description',
    };

    it('CMS metaTitle/metaDescription override the generated defaults', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx, undefined, cms);
        expect(m.title).toBe('Škoda — CMS title');
        expect(m.description).toBe('Škoda — CMS description');
    });

    it('CMS html is inserted into bodyHtml, and CMS FAQ is appended after generated FAQ (visible + FAQPage)', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx, undefined, cms);
        expect(m.bodyHtml).toContain('<div class="cms-content"><p>Treść redakcyjna o Škodzie.</p></div>');
        expect(m.bodyHtml).toContain('<h3>Czy Škoda jest niezawodna?</h3>');
        const faqPage = (m.jsonLd as any[]).find(e => e['@type'] === 'FAQPage');
        expect(faqPage.mainEntity.at(-1).name).toBe('Czy Škoda jest niezawodna?');
        // generowane FAQ idzie przed CMS FAQ — ta sama kolejność co w widocznym HTML
        expect(faqPage.mainEntity.length).toBeGreaterThan(1);
    });

    it('paginated title suffix is appended after the CMS override', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 40, { min: 50000, max: 100000 }, models, otherBrands, listings, ctx, { page: 2, totalPages: 3 }, cms);
        expect(m.title).toBe('Škoda — CMS title — strona 2');
    });

    it('without CMS content, behaves exactly as before (no cms-content div, no override)', () => {
        const m = buildBrandMeta('Škoda', 'skoda', 7, { min: 59900, max: 189900 }, models, otherBrands, listings, ctx);
        expect(m.bodyHtml).not.toContain('cms-content');
        expect(m.title).toContain('Škoda (7 ofert)');
    });
});

describe('buildModelMeta', () => {
    const listings = [
        { id: 'l1', make: 'Škoda', model: 'Octavia', version: null, productionYear: 2023, pricePln: 89900, bodyType: 'kombi', fuelType: 'diesel', slug: 'skoda-octavia-l1' },
        { id: 'l2', make: 'Škoda', model: 'Octavia', version: 'RS', productionYear: 2024, pricePln: 129900, bodyType: 'kombi', fuelType: 'diesel', slug: 'skoda-octavia-rs-l2' },
    ];

    it('indexing threshold: noindex below 2 active offers, self-canonical either way', () => {
        const one = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 1, { min: 89900, max: 89900 }, [], listings.slice(0, 1), ctx);
        expect(one.noindex).toBe(true);
        expect(one.status).toBe(200);
        expect(one.canonical).toBe('https://dev.motolia.pl/samochody/skoda/octavia');

        const zero = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 0, { min: null, max: null }, [], [], ctx);
        expect(zero.noindex).toBe(true);
        expect(zero.status).toBe(200);
    });

    it('indexing threshold: indexable at >=2 active offers', () => {
        const m = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 2, { min: 89900, max: 129900 }, [], listings, ctx);
        expect(m.noindex).toBe(false);
    });

    it('title/h1/breadcrumb reflect marka+model', () => {
        const m = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 2, { min: 89900, max: 129900 }, [], listings, ctx);
        expect(m.title).toContain('Škoda Octavia (2 oferty)');
        expect(m.bodyHtml).toContain('<h1>Škoda Octavia — dostępne od ręki</h1>');
        expect(m.bodyHtml).toContain('<li><a href="/samochody/skoda">Škoda</a></li>');
        const breadcrumb = (m.jsonLd as any[]).find(e => e['@type'] === 'BreadcrumbList');
        expect(breadcrumb.itemListElement).toHaveLength(4);
        expect(breadcrumb.itemListElement[3]).toEqual({
            '@type': 'ListItem', position: 4, name: 'Škoda Octavia', item: 'https://dev.motolia.pl/samochody/skoda/octavia',
        });
    });

    it('at 0 offers: dynamic FAQ disappears, page still renders with sibling model links', () => {
        const siblings = [{ name: 'Fabia', slug: 'fabia', count: 3 }];
        const m = buildModelMeta('Škoda', 'Superb', 'skoda', 'superb', 0, { min: null, max: null }, siblings, [], ctx);
        expect(JSON.stringify(m.jsonLd)).not.toContain('FAQPage');
        expect(m.noindex).toBe(true);
        expect(m.status).toBe(200);
        expect(m.bodyHtml).toContain('Aktualnie brak ofert Škoda Superb — zostaw kontakt, powiadomimy o nowej ofercie.');
        expect(m.bodyHtml).toContain('<a href="/samochody/skoda/fabia">Fabia</a>');
    });

    describe('with CMS content', () => {
        const cms = {
            html: '<p>Treść redakcyjna o Octavii.</p>',
            faq: [{ questionPl: 'Czy Octavia RS jest szybka?', answerPl: 'Tak, bardzo.' }],
            metaTitle: 'Octavia — CMS title',
            metaDescription: 'Octavia — CMS description',
        };

        it('indexable (noindex: false) at 0 offers when CMS content is published — persistence override', () => {
            const zero = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 0, { min: null, max: null }, [], [], ctx, undefined, cms);
            expect(zero.noindex).toBe(false);
            expect(zero.status).toBe(200);
        });

        it('indexable (noindex: false) at 1 offer when CMS content is published — below the normal >=2 threshold', () => {
            const one = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 1, { min: 89900, max: 89900 }, [], listings.slice(0, 1), ctx, undefined, cms);
            expect(one.noindex).toBe(false);
        });

        it('CMS metaTitle/metaDescription override the generated defaults', () => {
            const m = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 2, { min: 89900, max: 129900 }, [], listings, ctx, undefined, cms);
            expect(m.title).toBe('Octavia — CMS title');
            expect(m.description).toBe('Octavia — CMS description');
        });

        it('CMS html is inserted into bodyHtml, and CMS FAQ is appended after generated FAQ', () => {
            const m = buildModelMeta('Škoda', 'Octavia', 'skoda', 'octavia', 2, { min: 89900, max: 129900 }, [], listings, ctx, undefined, cms);
            expect(m.bodyHtml).toContain('<div class="cms-content"><p>Treść redakcyjna o Octavii.</p></div>');
            expect(m.bodyHtml).toContain('<h3>Czy Octavia RS jest szybka?</h3>');
            const faqPage = (m.jsonLd as any[]).find(e => e['@type'] === 'FAQPage');
            expect(faqPage.mainEntity.at(-1).name).toBe('Czy Octavia RS jest szybka?');
        });
    });
});

describe('defaultMeta', () => {
    it('carries noindex and status', () => {
        const m = defaultMeta(ctx, { noindex: true, status: 404 });
        expect(m.noindex).toBe(true);
        expect(m.status).toBe(404);
        expect(m.title).toBe(ctx.defaultTitle);
    });
});

describe('injectHead', () => {
    it('replaces title/description/og/twitter and appends canonical + JSON-LD', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('<title>OLD</title>');
        expect(html).toContain('Ford Puma');
        expect(html).toContain('<link rel="canonical" href="https://dev.motolia.pl/oferta/ford-puma-abc123" />');
        expect(html).toContain('application/ld+json');
        expect(html).toContain('og:url" content="https://dev.motolia.pl/oferta/ford-puma-abc123"');
        expect(html).not.toContain('noindex');
    });

    it('wraps bodyHtml in a hidden prerender container inside #root', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('<div id="root"><div class="seo-prerender" style="display:none">');
        expect(html).toContain('<h1>Ford Puma');
    });

    it('adds robots noindex when meta.noindex', () => {
        const html = injectHead(TEMPLATE, defaultMeta(ctx, { noindex: true, status: 404 }));
        expect(html).toContain('<meta name="robots" content="noindex" />');
    });

    it('emits fetchpriority=high image preload with imagesrcset', () => {
        const m = buildListingMeta(LISTING, 'ford-puma-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('<link rel="preload" as="image" fetchpriority="high"');
        expect(html).toContain('imagesrcset=');
        expect(html).toContain('puma-thumb.webp 600w');
    });

    it('escapes </script> in JSON-LD', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).not.toContain('</script><b>');
    });

    it('does not interpret $-patterns in vehicle data', () => {
        const m = buildListingMeta({ ...LISTING, version: 'GT $& $1 $$' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('GT $&amp; $1 $$');
        expect(html).not.toContain('OLDD');
    });

    it('keeps escaped JSON-LD when data contains </script>', () => {
        const m = buildListingMeta({ ...LISTING, version: '</script><b>' }, 's-abc123', 'oferta', ctx);
        const html = injectHead(TEMPLATE, m);
        expect(html).toContain('\\u003c/script>');
    });
});
