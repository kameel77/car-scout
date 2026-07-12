import { normalizeBrand, normalizeModel } from './brand-normalization.service.js';
import { slugifyBrandName } from './brand-pages.service.js';

export interface PageMeta {
    title: string;
    description: string;
    canonical?: string; // absolute URL
    jsonLd?: object;
    noindex?: boolean;
    bodyHtml?: string;
    ogImage?: string;
    status: number;
}

export interface BrandCtx {
    brand: string;
    baseUrl: string;
    brandName: string;
    defaultTitle: string;
    defaultDescription: string;
    logoUrl: string;
    alternateNames?: string[];
    disambiguatingDescription?: string;
}

export type ListingVariant = 'oferta' | 'leasing' | 'kredyt';

const BRAND_DEFAULTS: Record<
    string,
    { name: string; title: string; description: string; alternateNames?: string[]; disambiguatingDescription?: string }
> = {
    carsalon: {
        name: 'CarSalon',
        title: 'CarSalon - auta nowe i używane z gwarancją',
        description: 'Setki ofert od sprawdzonych dealerów. Nowe i używane samochody z gwarancją.',
    },
    motolia: {
        name: 'Motolia',
        title: 'Motolia - leasing, kredyt i wynajem samochodów',
        description: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
        // Warianty zapisu marki, którymi ludzie realnie szukają (dane z Google Search Console)
        alternateNames: ['Motolia.pl', 'motolia.pl', 'Motoria', 'Motalia', 'Moto lia'],
        disambiguatingDescription:
            'Motolia (motolia.pl) to polski serwis motoryzacyjny: samochody nowe i używane z finansowaniem — leasing, kredyt i wynajem długoterminowy. Bywa zapisywana jako Motoria lub Motalia.',
    },
};

export function resolveBrandCtx(): BrandCtx {
    const brand = process.env.BRAND === 'motolia' ? 'motolia' : 'carsalon';
    const d = BRAND_DEFAULTS[brand];
    const baseUrl = (process.env.FRONTEND_URL || 'https://carsalon.pl').replace(/\/$/, '');
    return {
        brand,
        baseUrl,
        brandName: d.name,
        defaultTitle: d.title,
        defaultDescription: d.description,
        logoUrl: `${baseUrl}/brands/${brand}/logo.png`,
        alternateNames: d.alternateNames,
        disambiguatingDescription: d.disambiguatingDescription,
    };
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Rich-text z importów/od dealerów może zawierać HTML — do bodyHtml trafia sam tekst
function htmlToText(s: string): string {
    return escapeHtml(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

// og:image, JSON-LD image i image-sitemap wymagają absolutnych URL-i
function absoluteUrl(url: string, baseUrl: string): string {
    return url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export interface ListingMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    pricePln: number;
    mileageKm: number;
    condition: string;
    fuelType: string | null;
    bodyType: string | null;
    transmission: string | null;
    primaryImageUrl: string | null;
    additionalInfoContent: string | null;
    equipmentSafety?: string[];
    equipmentAudioMultimedia?: string[];
    equipmentComfortExtras?: string[];
    equipmentOther?: string[];
}

interface EquipmentGroups {
    equipmentSafety?: string[];
    equipmentAudioMultimedia?: string[];
    equipmentComfortExtras?: string[];
    equipmentOther?: string[];
}

// Unikalna per pojazd treść — kluczowa przeciw thin content
function equipmentSectionHtml(e: EquipmentGroups): string {
    const groups = [
        { label: 'Bezpieczeństwo', items: e.equipmentSafety },
        { label: 'Audio i multimedia', items: e.equipmentAudioMultimedia },
        { label: 'Komfort i dodatki', items: e.equipmentComfortExtras },
        { label: 'Pozostałe', items: e.equipmentOther },
    ].filter(g => g.items && g.items.length > 0);
    if (!groups.length) return '';
    return `
  <section>
    <h2>Wyposażenie</h2>
    ${groups.map(g => `<h3>${g.label}</h3>\n<ul>\n${g.items!.map(i => `<li>${escapeHtml(i)}</li>`).join('\n')}\n</ul>`).join('\n')}
  </section>`;
}

// Do JSON-LD (JSON.stringify sam escapuje) — zdjęcie tagów, mini-markdownu CMS i nadmiaru białych znaków
function stripTags(s: string): string {
    return s
        .replace(/<[^>]*>/g, ' ')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

export interface RelatedListing {
    id: string;
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    pricePln: number | null;
    slug: string;
}

export interface FaqItem {
    questionPl: string;
    answerPl: string;
}

// Widoczne FAQ (bez FAQPage JSON-LD — strona kanonikalizuje do /oferta, schema byłaby ignorowana)
// Odpowiedzi FAQ z CMS używają mini-markdownu (**pogrubienie**, [tekst](adres))
function miniMarkdownToHtml(s: string): string {
    return htmlToText(s)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) =>
            /^(https?:\/\/|\/)/.test(href) ? `<a href="${href}">${text}</a>` : text);
}

function faqSectionHtml(faq: FaqItem[], heading: string): string {
    if (!faq.length) return '';
    return `
  <section>
    <h2>${escapeHtml(heading)}</h2>
    ${faq.map(f => `<h3>${escapeHtml(f.questionPl)}</h3>\n<p>${miniMarkdownToHtml(f.answerPl)}</p>`).join('\n')}
  </section>`;
}

export function buildListingMeta(
    l: ListingMetaInput,
    slug: string,
    variant: ListingVariant,
    ctx: BrandCtx,
    related: RelatedListing[] = [],
    faq: FaqItem[] = []
): PageMeta {
    const name = [l.make, l.model, l.version, String(l.productionYear)].filter(Boolean).join(' ');
    const price = l.pricePln.toLocaleString('pl-PL');
    const variantLabel = variant === 'leasing' ? ' — leasing' : variant === 'kredyt' ? ' — kredyt' : '';
    const canonical = `${ctx.baseUrl}/oferta/${slug}`;
    const breadcrumbLevel2: { name: string; path: string } =
        variant === 'leasing'
            ? { name: 'Leasing samochodowy', path: '/leasing' }
            : variant === 'kredyt'
            ? { name: 'Kredyt samochodowy', path: '/kredyt' }
            : { name: 'Samochody', path: '/samochody' };
    const detale = [
        `cena ${price} zł`,
        `przebieg ${l.mileageKm.toLocaleString('pl-PL')} km`,
        l.fuelType,
        l.bodyType,
    ]
        .filter(Boolean)
        .join(', ');

    const safeName = escapeHtml(name);
    const imageUrl = l.primaryImageUrl ? absoluteUrl(l.primaryImageUrl, ctx.baseUrl) : null;

    // Poziomy marki i marka/model w breadcrumbie linkują do nowych stron katalogowych
    // (/samochody/:marka, /samochody/:marka/:model) — kanoniczna nazwa/slug, nie surowe dane.
    const brandName = normalizeBrand(l.make);
    const modelName = normalizeModel(l.model);
    const brandSlug = slugifyBrandName(brandName);
    const modelSlug = slugifyBrandName(modelName);
    const safeBrand = escapeHtml(brandName);
    const safeBrandModel = escapeHtml(`${brandName} ${modelName}`);

    const bodyHtml = `
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Strona główna</a></li>
    <li><a href="${breadcrumbLevel2.path}">${breadcrumbLevel2.name}</a></li>
    <li><a href="/samochody/${brandSlug}">${safeBrand}</a></li>
    <li><a href="/samochody/${brandSlug}/${modelSlug}">${safeBrandModel}</a></li>
    <li>${safeName}</li>
  </ol>
</nav>
<article>
  <h1>${safeName}${variantLabel}</h1>
  ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${safeName}" style="max-width:100%;height:auto;"/>` : ''}
  <table>
    <tbody>
      <tr><td>Marka</td><td>${escapeHtml(l.make)}</td></tr>
      <tr><td>Model</td><td>${escapeHtml(l.model)}</td></tr>
      ${l.version ? `<tr><td>Wersja</td><td>${escapeHtml(l.version)}</td></tr>` : ''}
      <tr><td>Rocznik</td><td>${l.productionYear}</td></tr>
      <tr><td>Przebieg</td><td>${l.mileageKm.toLocaleString('pl-PL')} km</td></tr>
      <tr><td>Cena</td><td>${price} zł</td></tr>
      ${l.fuelType ? `<tr><td>Paliwo</td><td>${escapeHtml(l.fuelType)}</td></tr>` : ''}
      ${l.bodyType ? `<tr><td>Nadwozie</td><td>${escapeHtml(l.bodyType)}</td></tr>` : ''}
      ${l.transmission ? `<tr><td>Skrzynia</td><td>${escapeHtml(l.transmission)}</td></tr>` : ''}
    </tbody>
  </table>
  ${l.additionalInfoContent ? `<div class="description">${htmlToText(l.additionalInfoContent)}</div>` : ''}
  ${equipmentSectionHtml(l)}
  ${variant === 'oferta' ? `
  <section>
    <h2>Jak kupić ten samochód?</h2>
    <ol>
      <li>Sprawdź szczegóły oferty i wybierz formę finansowania — gotówka, <a href="/kredyt">kredyt samochodowy</a>, <a href="/leasing">leasing samochodu</a> lub <a href="/wynajem-dlugoterminowy">wynajem długoterminowy</a>.</li>
      <li>Zostaw kontakt przez formularz — doradca ${escapeHtml(ctx.brandName)} potwierdzi dostępność auta u dealera.</li>
      <li>Podpisz umowę i odbierz samochód u dealera.</li>
    </ol>
  </section>` : ''}
  ${variant === 'kredyt' ? `
  <section>
    <h2>Kredyt samochodowy na ten pojazd</h2>
    <p>${safeName} w cenie ${price} zł możesz sfinansować kredytem samochodowym przez ${escapeHtml(ctx.brandName)} — wniosek online, decyzja bez wizyty w banku, auto dostępne od ręki u dealera.</p>
    <ol>
      <li>Wybierz okres finansowania i wysokość wpłaty własnej w kalkulatorze przy ofercie.</li>
      <li>Zostaw kontakt — doradca przygotuje ofertę kredytową dopasowaną do Twoich potrzeb.</li>
      <li>Podpisz umowę i odbierz samochód u dealera.</li>
    </ol>
    <p>Zobacz, jak działa <a href="/kredyt">kredyt samochodowy</a> — warunki, RRSO i wniosek o finansowanie.</p>
  </section>` : ''}
  ${variant === 'leasing' ? `
  <section>
    <h2>Leasing tego pojazdu</h2>
    <p>${safeName} w cenie ${price} zł dostępny w leasingu przez ${escapeHtml(ctx.brandName)} — minimum formalności, decyzja online, auto od ręki u dealera. Oferta dla firm i przedsiębiorców.</p>
    <ol>
      <li>Wybierz okres leasingu, wpłatę wstępną i wykup w kalkulatorze przy ofercie.</li>
      <li>Zostaw kontakt — doradca przygotuje ofertę leasingową dopasowaną do Twojej firmy.</li>
      <li>Podpisz umowę i odbierz samochód u dealera.</li>
    </ol>
    <p>Zobacz, jak działa <a href="/leasing">leasing samochodu</a> — operacyjny i konsumencki, rata i wniosek.</p>
  </section>` : ''}
  ${faqSectionHtml(faq, variant === 'kredyt' ? 'Najczęstsze pytania o kredyt' : variant === 'leasing' ? 'Najczęstsze pytania o leasing' : 'Najczęstsze pytania')}
  ${related.length > 0 ? `
  <section>
    <h2>Podobne oferty</h2>
    <ul>
      ${related.map(r => listingLinkHtml(r, '/oferta')).join('\n')}
    </ul>
  </section>` : ''}
</article>`.trim();

    const schemaCondition =
        l.condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition';

    const jsonLd: any[] = [];
    if (variant === 'oferta') {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'Vehicle',
            name,
            brand: { '@type': 'Brand', name: l.make },
            model: l.model,
            vehicleModelDate: String(l.productionYear),
            mileageFromOdometer: {
                '@type': 'QuantitativeValue',
                value: l.mileageKm,
                unitCode: 'KMT',
            },
            ...(imageUrl ? { image: imageUrl } : {}),
            ...(l.transmission ? { vehicleTransmission: l.transmission } : {}),
            ...(l.fuelType ? { fuelType: l.fuelType } : {}),
            ...(l.bodyType ? { bodyType: l.bodyType } : {}),
            itemCondition: schemaCondition,
            offers: {
                '@type': 'Offer',
                price: l.pricePln,
                priceCurrency: 'PLN',
                availability: 'https://schema.org/InStock',
                url: canonical,
                itemCondition: schemaCondition,
            },
            url: canonical
        });
    }

    jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Strona główna', item: ctx.baseUrl },
            { '@type': 'ListItem', position: 2, name: breadcrumbLevel2.name, item: `${ctx.baseUrl}${breadcrumbLevel2.path}` },
            { '@type': 'ListItem', position: 3, name: brandName, item: `${ctx.baseUrl}/samochody/${brandSlug}` },
            { '@type': 'ListItem', position: 4, name: `${brandName} ${modelName}`, item: `${ctx.baseUrl}/samochody/${brandSlug}/${modelSlug}` },
            { '@type': 'ListItem', position: 5, name: name, item: canonical }
        ]
    });

    return {
        title: `${name}${variantLabel} — ${price} zł | ${ctx.brandName}`,
        description: `${name}: ${detale}. Samochód dostępny od ręki u dealera — sprawdź finansowanie: leasing, kredyt lub najem.`,
        canonical,
        ogImage: imageUrl || undefined,
        bodyHtml,
        jsonLd: jsonLd.length === 1 ? jsonLd[0] : jsonLd,
        status: 200,
    };
}

export interface RentalMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    sellingPrice?: number | null;
    primaryImageUrl?: string | null;
    bodyType?: string | null;
    fuelType?: string | null;
    transmission?: string | null;
    enginePowerHp?: number | null;
    doors?: number | null;
    seats?: number | null;
    color?: string | null;
    mileageKm?: number | null;
    condition?: string;
    equipmentSafety?: string[];
    equipmentAudioMultimedia?: string[];
    equipmentComfortExtras?: string[];
    equipmentOther?: string[];
}

export interface RelatedRentalVehicle {
    slug: string;
    make: string;
    model: string;
    productionYear: number | null;
    monthlyRateFrom: number | null;
}

function rentalLinkHtml(r: RelatedRentalVehicle): string {
    const year = r.productionYear ? ` (${r.productionYear})` : '';
    const rate = r.monthlyRateFrom
        ? ` — rata od ${Math.round(r.monthlyRateFrom).toLocaleString('pl-PL')} zł/mies.`
        : '';
    return `<li><a href="/wynajem-dlugoterminowy/${r.slug}">${escapeHtml(`${r.make} ${r.model}`)}${year}${rate}</a></li>`;
}

// Pierwsza litera na mały druk, ale skróty typu "SUV" zostają w całości wielkie
function lowerFirstWord(s: string): string {
    if (!s) return s;
    if (s === s.toUpperCase()) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
}

type FuelCanon = 'benzyna' | 'diesel' | 'hybryda' | 'plugin' | 'elektryczny' | 'lpg';

function canonicalizeFuel(fuelType: string): FuelCanon | null {
    const s = fuelType.toLowerCase();
    if (s.includes('plug')) return 'plugin';
    if (s.includes('elektr')) return 'elektryczny';
    if (s.includes('hybryd') || s.includes('hybrid')) return 'hybryda';
    if (s.includes('diesel')) return 'diesel';
    if (s.includes('benzyn')) return 'benzyna';
    if (s.includes('lpg')) return 'lpg';
    return null;
}

type BodyCanon = 'suv' | 'kombi' | 'sedan' | 'kompakt' | 'miejskie' | 'furgon' | 'inne';

function canonicalizeBodyType(bodyType: string): BodyCanon {
    const s = bodyType.toLowerCase();
    if (s.includes('suv')) return 'suv';
    if (s.includes('kombi')) return 'kombi';
    if (s.includes('sedan') || s.includes('limuzyn')) return 'sedan';
    if (s.includes('hatchback') || s.includes('kompakt')) return 'kompakt';
    if (s.includes('miejsk') || s.includes('mini')) return 'miejskie';
    if (s.includes('van') || s.includes('dostawcz') || s.includes('furgon') || s.includes('pickup') || s.includes('ciężarow')) return 'furgon';
    return 'inne';
}

// Fraza rzeczownikowa do akapitu otwierającego, np. "silnikiem benzynowym"; nieznane
// paliwo dostaje bezpieczny fallback zbudowany z realnej wartości pola, bez zmyślania kategorii
const OPENING_ENGINE_PHRASE: Record<FuelCanon, string> = {
    benzyna: 'silnikiem benzynowym',
    diesel: 'silnikiem diesla',
    hybryda: 'napędem hybrydowym',
    plugin: 'napędem plug-in hybrydowym',
    elektryczny: 'napędem elektrycznym',
    lpg: 'silnikiem benzynowym zasilanym LPG',
};

function openingEngineClause(fuelType: string | null | undefined, enginePowerHp: number | null | undefined): string | null {
    const canon = fuelType ? canonicalizeFuel(fuelType) : null;
    const base = fuelType
        ? canon
            ? OPENING_ENGINE_PHRASE[canon]
            : `napędem ${escapeHtml(lowerFirstWord(fuelType))}`
        : enginePowerHp
        ? 'mocą'
        : null;
    if (!base) return null;
    return enginePowerHp ? `${base} ${enginePowerHp} KM` : base;
}

function openingTransmissionClause(transmission: string | null | undefined): string | null {
    if (!transmission) return null;
    const s = transmission.toLowerCase();
    if (s.includes('automat')) return 'automatyczną skrzynią';
    if (s.includes('manual')) return 'manualną skrzynią';
    return `skrzynią ${escapeHtml(lowerFirstWord(transmission))}`;
}

// Akapit otwierający zbudowany z realnych pól (bez zmyślonych faktów) — dominuje nad
// szablonem, przeciw sklejaniu stron przez Google w duplikaty (patrz kontekst w CLAUDE.md)
function rentalOpeningParagraph(r: RentalMetaInput, safeName: string, rateFrom: string | null): string {
    const engineClause = openingEngineClause(r.fuelType, r.enginePowerHp);
    const transmissionClause = openingTransmissionClause(r.transmission);
    const engineTransClause = [engineClause, transmissionClause].filter(Boolean).join(' i ');
    const bodyLabel = r.bodyType ? escapeHtml(lowerFirstWord(r.bodyType)) : null;
    const rateClause = rateFrom ? ` od ${rateFrom} zł brutto miesięcznie` : '';

    if (bodyLabel) {
        return `${safeName} to ${bodyLabel}${engineTransClause ? ` z ${engineTransClause}` : ''}, dostępne w wynajmie długoterminowym${rateClause}.`;
    }
    if (engineTransClause) {
        return `${safeName} z ${engineTransClause} dostępne jest w wynajmie długoterminowym${rateClause}.`;
    }
    return `${safeName} dostępne jest w wynajmie długoterminowym${rateClause}.`;
}

// Akapit segmentowy wg nadwozia — raz zdefiniowana mapa, marka+model wplecione w zdanie
const SEGMENT_TEXT: Record<BodyCanon, (n: string) => string> = {
    suv: n => `${n} jako SUV zapewnia wysoką pozycję za kierownicą i dobrą widoczność w mieście, a przy tym mieści bagaż na dłuższą trasę. To uniwersalny wybór do wynajmu długoterminowego — sprawdzi się zarówno w codziennych dojazdach, jak i w podróżach rodzinnych.`,
    kombi: n => `${n} w nadwoziu kombi to typowy wybór dla rodzin i kierowców pokonujących długie trasy — duży bagażnik ułatwia przewóz sprzętu i bagażu na wyjazdy. W wynajmie długoterminowym to auto, które sprawdzi się zarówno w mieście, jak i w trasie.`,
    sedan: n => `${n} w nadwoziu sedan/limuzyna to elegancki wybór do reprezentacyjnych wyjazdów służbowych i częstych tras międzymiastowych. W wynajmie długoterminowym sprawdzi się jako auto firmowe.`,
    kompakt: n => `${n} jako kompakt to zwrotne auto do jazdy miejskiej i podmiejskiej, łatwe w parkowaniu i codziennej eksploatacji. W wynajmie długoterminowym to popularny wybór na pierwsze firmowe lub prywatne auto.`,
    miejskie: n => `${n} to niewielkie auto miejskie — zwrotne i łatwe w parkowaniu w codziennej eksploatacji. W wynajmie długoterminowym sprawdzi się jako drugie auto do miasta lub dojazdów do pracy.`,
    furgon: n => `${n} w wersji dostawczej to auto do pracy — przewóz towaru, narzędzi lub sprzętu na co dzień. W wynajmie długoterminowym to popularny wybór dla firm potrzebujących przewidywalnego kosztu floty.`,
    inne: n => `${n} to samochód, który można dopasować do różnych zastosowań — od codziennych dojazdów po dłuższe trasy. W wynajmie długoterminowym to elastyczna alternatywa dla zakupu na własność.`,
};

// Akapit wg paliwa — tylko rozpoznane kategorie, bez podawania liczb (spalanie/zasięg)
const FUEL_TEXT: Record<FuelCanon, (n: string) => string> = {
    benzyna: n => `Silnik benzynowy w ${n} sprawdza się przede wszystkim w jeździe miejskiej i mieszanej — bez ograniczeń związanych z zasięgiem czy dostępnością stacji.`,
    diesel: n => `Diesel w ${n} to typowy wybór do jazdy trasowej i przy większych rocznych przebiegach, popularny w wynajmie długoterminowym dla firm jeżdżących międzymiastowo.`,
    hybryda: n => `Napęd hybrydowy w ${n} obniża spalanie w jeździe miejskiej względem porównywalnej wersji benzynowej, bez konieczności ładowania z gniazdka.`,
    plugin: n => `Napęd plug-in hybrydowy w ${n} pozwala pokonywać krótsze trasy miejskie na prądzie, a w dłuższych trasach wspiera się silnikiem spalinowym.`,
    elektryczny: n => `${n} jako auto elektryczne wymaga dostępu do ładowania, ale w zamian oferuje ciszę pracy silnika i niższe koszty eksploatacji w mieście.`,
    lpg: n => `Instalacja LPG w ${n} obniża koszt paliwa przy większych przebiegach, przy zachowaniu zasięgu zbliżonego do wersji benzynowej.`,
};

// 3 warianty tej samej treści (ten sam sens, inna składnia) — dobór deterministyczny wg slugu,
// żeby setki stron najmu nie dzieliły identycznego bloku h2+akapit+ol
const RENTAL_INTRO_VARIANTS: Array<(safeName: string, brandName: string) => string> = [
    (safeName, brandName) => `
    <h2>Wynajem długoterminowy tego pojazdu</h2>
    <p>${safeName} dostępny w najmie długoterminowym przez ${brandName} — jedna stała rata obejmująca finansowanie auta, bez wkładu własnego i bez zobowiązań na koniec umowy.</p>
    <ol>
      <li>Wybierz okres najmu i roczny limit kilometrów przy ofercie.</li>
      <li>Zostaw kontakt — doradca przygotuje ofertę najmu dopasowaną do Twoich potrzeb.</li>
      <li>Podpisz umowę i odbierz samochód.</li>
    </ol>`,
    (safeName, brandName) => `
    <h2>Jak wynająć ${safeName} długoterminowo?</h2>
    <p>Wynajem długoterminowy przez ${brandName} to jedna stała rata bez wkładu własnego — ${safeName} odbierasz bez zobowiązań na koniec umowy.</p>
    <ol>
      <li>Zostaw kontakt przez formularz, a doradca sprawdzi dostępność auta.</li>
      <li>Ustal okres najmu, roczny limit kilometrów i wysokość raty.</li>
      <li>Podpisz umowę najmu i odbierz samochód.</li>
    </ol>`,
    (safeName, brandName) => `
    <h2>Najem długoterminowy — jak to działa</h2>
    <p>Bez wkładu własnego, bez zobowiązań po zakończeniu umowy — tak wygląda wynajem długoterminowy ${safeName} przez ${brandName}, rozliczany jedną stałą ratą miesięczną.</p>
    <ol>
      <li>Dobierz okres umowy i limit kilometrów do swoich potrzeb.</li>
      <li>Skontaktuj się z doradcą, który przygotuje indywidualną ofertę.</li>
      <li>Podpisz umowę i odbierz ${safeName} u dealera.</li>
    </ol>`,
];

function pickVariant(slug: string, count: number): number {
    let sum = 0;
    for (let i = 0; i < slug.length; i++) sum += slug.charCodeAt(i);
    return sum % count;
}

// FAQ per pojazd z realnych pól — bez zmyślonych liczb (spalanie/osiągi/ceny poza monthlyRateFrom)
function buildGeneratedRentalFaq(r: RentalMetaInput, name: string, rateFrom: string | null, ctx: BrandCtx): FaqItem[] {
    const items: FaqItem[] = [];
    if (rateFrom) {
        items.push({
            questionPl: `Ile kosztuje wynajem długoterminowy ${name}?`,
            answerPl: `Rata wynajmu długoterminowego dla ${name} zaczyna się od ${rateFrom} zł brutto miesięcznie. Dokładną wysokość raty, dopasowaną do okresu umowy i rocznego limitu kilometrów, przygotuje doradca po kontakcie.`,
        });
    }
    items.push({
        questionPl: `Czy ${name} jest dostępny od ręki?`,
        answerPl: `${name} można wynająć u dealera ${ctx.brandName} — zostaw kontakt przez formularz, a doradca potwierdzi dostępność i umówi odbiór.`,
    });
    const specParts: string[] = [];
    if (r.transmission) specParts.push(`skrzynia biegów: ${r.transmission}`);
    if (r.fuelType) specParts.push(`paliwo: ${r.fuelType}`);
    if (specParts.length > 0) {
        items.push({
            questionPl: `Jaka skrzynia biegów i jakie paliwo ma ${name}?`,
            answerPl: `${specParts.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('. ')}.`,
        });
    }
    return items;
}

export function buildRentalMeta(
    r: RentalMetaInput,
    slug: string,
    ctx: BrandCtx,
    faq: FaqItem[] = [],
    monthlyRateFrom: number | null = null,
    related: RelatedRentalVehicle[] = []
): PageMeta {
    const name = [r.make, r.model, r.version, r.productionYear ? String(r.productionYear) : null]
        .filter(Boolean)
        .join(' ');
    const canonical = `${ctx.baseUrl}/wynajem-dlugoterminowy/${slug}`;
    const safeName = escapeHtml(name);
    const imageUrl = r.primaryImageUrl ? absoluteUrl(r.primaryImageUrl, ctx.baseUrl) : null;
    const rateFrom = monthlyRateFrom ? Math.round(monthlyRateFrom).toLocaleString('pl-PL') : null;
    const safeMakeModel = escapeHtml(`${r.make} ${r.model}`);
    const bodyCanon = r.bodyType ? canonicalizeBodyType(r.bodyType) : null;
    const fuelCanon = r.fuelType ? canonicalizeFuel(r.fuelType) : null;
    const introVariant = RENTAL_INTRO_VARIANTS[pickVariant(slug, RENTAL_INTRO_VARIANTS.length)];
    const generatedFaq = buildGeneratedRentalFaq(r, name, rateFrom, ctx);
    const combinedFaq = [...generatedFaq, ...faq];
    const bodyHtml = `
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Strona główna</a></li>
    <li><a href="/wynajem-dlugoterminowy">Wynajem długoterminowy</a></li>
    <li>${safeName}</li>
  </ol>
</nav>
<article>
  <h1>${safeName} — wynajem długoterminowy</h1>
  ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${safeName}" style="max-width:100%;height:auto;"/>` : ''}
  <p>${rentalOpeningParagraph(r, safeName, rateFrom)}</p>
  ${rateFrom ? `<p>Rata najmu od ${rateFrom} zł brutto miesięcznie.</p>` : ''}
  ${bodyCanon ? `<p>${SEGMENT_TEXT[bodyCanon](safeMakeModel)}</p>` : ''}
  ${fuelCanon ? `<p>${FUEL_TEXT[fuelCanon](safeMakeModel)}</p>` : ''}
  <table>
    <tbody>
      <tr><td>Marka</td><td>${escapeHtml(r.make)}</td></tr>
      <tr><td>Model</td><td>${escapeHtml(r.model)}</td></tr>
      ${r.version ? `<tr><td>Wersja</td><td>${escapeHtml(r.version)}</td></tr>` : ''}
      ${r.productionYear ? `<tr><td>Rocznik</td><td>${r.productionYear}</td></tr>` : ''}
      ${r.fuelType ? `<tr><td>Paliwo</td><td>${escapeHtml(r.fuelType)}</td></tr>` : ''}
      ${r.bodyType ? `<tr><td>Nadwozie</td><td>${escapeHtml(r.bodyType)}</td></tr>` : ''}
      ${r.transmission ? `<tr><td>Skrzynia</td><td>${escapeHtml(r.transmission)}</td></tr>` : ''}
      ${r.enginePowerHp ? `<tr><td>Moc</td><td>${r.enginePowerHp} KM</td></tr>` : ''}
      ${r.color ? `<tr><td>Kolor</td><td>${escapeHtml(r.color)}</td></tr>` : ''}
    </tbody>
  </table>
  ${equipmentSectionHtml(r)}
  <section>
    ${introVariant(safeName, escapeHtml(ctx.brandName))}
    <p>Zobacz, jak działa <a href="/wynajem-dlugoterminowy">wynajem długoterminowy samochodu</a> — co obejmuje rata, okresy i limity kilometrów.</p>
  </section>
  ${faqSectionHtml(combinedFaq, 'Najczęstsze pytania o wynajem długoterminowy')}
  ${related.length > 0 ? `
  <section>
    <h2>Zobacz też inne auta w wynajmie</h2>
    <ul>
      ${related.map(rentalLinkHtml).join('\n')}
    </ul>
  </section>` : ''}
</article>`.trim();

    const jsonLd: any[] = [];
    jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'Vehicle',
        name,
        brand: { '@type': 'Brand', name: r.make },
        model: r.model,
        ...(r.productionYear ? { vehicleModelDate: String(r.productionYear) } : {}),
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(r.bodyType ? { bodyType: r.bodyType } : {}),
        ...(r.fuelType ? { fuelType: r.fuelType } : {}),
        ...(r.transmission ? { vehicleTransmission: r.transmission } : {}),
        ...(r.color ? { color: r.color } : {}),
        ...(r.doors ? { numberOfDoors: r.doors } : {}),
        ...(r.seats ? { seatingCapacity: r.seats } : {}),
        ...(r.enginePowerHp
            ? {
                  vehicleEngine: {
                      '@type': 'EngineSpecification',
                      enginePower: { '@type': 'QuantitativeValue', value: r.enginePowerHp, unitCode: 'BHP' },
                  },
              }
            : {}),
        ...(typeof r.mileageKm === 'number'
            ? { mileageFromOdometer: { '@type': 'QuantitativeValue', value: r.mileageKm, unitCode: 'KMT' } }
            : {}),
        ...(r.condition
            ? {
                  itemCondition:
                      r.condition === 'NEW'
                          ? 'https://schema.org/NewCondition'
                          : 'https://schema.org/UsedCondition',
              }
            : {}),
        ...(monthlyRateFrom
            ? {
                  offers: {
                      '@type': 'Offer',
                      // Najem, nie sprzedaż — GoodRelations LeaseOut
                      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
                      availability: 'https://schema.org/InStock',
                      url: canonical,
                      seller: { '@type': 'Organization', name: ctx.brandName, url: `${ctx.baseUrl}/` },
                      priceSpecification: {
                          '@type': 'UnitPriceSpecification',
                          price: Math.round(monthlyRateFrom),
                          minPrice: Math.round(monthlyRateFrom),
                          priceCurrency: 'PLN',
                          valueAddedTaxIncluded: true,
                          unitText: 'miesiąc',
                          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
                      },
                  },
              }
            : {}),
        url: canonical,
    });

    jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Strona główna', item: ctx.baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Wynajem długoterminowy', item: `${ctx.baseUrl}/wynajem-dlugoterminowy` },
            { '@type': 'ListItem', position: 3, name, item: canonical },
        ],
    });

    // Strony najmu są self-canonical — FAQPage jest tu zasadne (inaczej niż na wariantach ofert)
    // combinedFaq: wygenerowane pytania (dane pojazdu) + FAQ z CMS — ta sama lista co w widocznym HTML
    if (combinedFaq.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: combinedFaq.map(f => ({
                '@type': 'Question',
                name: stripTags(f.questionPl),
                acceptedAnswer: { '@type': 'Answer', text: stripTags(f.answerPl) },
            })),
        });
    }

    const metaDetails = [r.bodyType, r.fuelType, rateFrom ? `rata od ${rateFrom} zł/mies.` : null]
        .filter(Boolean)
        .join(', ');

    return {
        title: `${name} — wynajem długoterminowy | ${ctx.brandName}`,
        description: `${name}${metaDetails ? ` (${metaDetails})` : ''} w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.`,
        canonical,
        ogImage: imageUrl || undefined,
        bodyHtml,
        jsonLd,
        status: 200,
    };
}

interface StaticRoute {
    title: (brand: string) => string;
    h1: string; // bez sufiksu marki — inaczej niż title, żeby h1 nie dublował brandu z <title>
    description: string;
    canonicalPath?: string; // default: own path
}

const STATIC_ROUTES: Record<string, StaticRoute> = {
    '/samochody': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        h1: 'Samochody dostępne od ręki — nowe i używane',
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
    },
    '/search': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        h1: 'Samochody dostępne od ręki — nowe i używane',
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
        canonicalPath: '/samochody',
    },
    '/nowe': {
        title: b => `Nowe samochody z rabatem dostępne u dealerów | ${b}`,
        h1: 'Nowe samochody z rabatem dostępne u dealerów',
        description:
            'Nowe samochody z rabatem, dostępne od ręki u dealerów. Sprawdź dostępność i dopasowane finansowanie.',
    },
    '/uzywane': {
        title: b => `Samochody używane od dealera z gwarancją | ${b}`,
        h1: 'Samochody używane od dealera z gwarancją',
        description:
            'Samochody używane od dealerów — sprawdzone auta z finansowaniem: leasing, kredyt lub najem.',
    },
    '/leasing': {
        title: b => `Leasing samochodu — auta dostępne od ręki | ${b}`,
        h1: 'Leasing samochodu — auta dostępne od ręki',
        description:
            'Samochody dostępne od ręki w leasingu. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/kredyt': {
        title: b => `Kredyt samochodowy — auta dostępne od ręki | ${b}`,
        h1: 'Kredyt samochodowy — auta dostępne od ręki',
        description:
            'Samochody dostępne od ręki na kredyt. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/wynajem-dlugoterminowy': {
        title: b => `Wynajem długoterminowy samochodu — auto w abonamencie | ${b}`,
        h1: 'Wynajem długoterminowy samochodu — auto w abonamencie',
        description:
            'Wynajem długoterminowy samochodu — auto w abonamencie ze stałą ratą, bez wkładu własnego. Sprawdź dostępne modele.',
    },
    '/dla-ciebie': {
        title: b => `Oferta dopasowana do Ciebie | ${b}`,
        h1: 'Oferta dopasowana do Ciebie',
        description:
            'Samochód z dopasowanym finansowaniem — leasing, kredyt lub najem. Zostaw kontakt, dobierzemy ofertę.',
    },
    '/dla-firm': {
        title: b => `Samochody i finansowanie dla firm | ${b}`,
        h1: 'Samochody i finansowanie dla firm',
        description:
            'Auta dla firm — leasing, kredyt lub najem długoterminowy. Złóż wniosek o finansowanie.',
    },
    '/faq': {
        title: b => `Najczęstsze pytania | ${b}`,
        h1: 'Najczęstsze pytania',
        description:
            'Odpowiedzi na najczęstsze pytania o zakup samochodu, finansowanie i proces zamówienia.',
    },
    '/kontakt': {
        title: b => `Kontakt | ${b}`,
        h1: 'Kontakt',
        description: 'Skontaktuj się z nami — pomożemy dobrać samochód i finansowanie.',
    },
};

// Pozwala renderowi odrzucić nieznane ścieżki (404) bez odpytywania bazy
export function hasStaticRoute(path: string): boolean {
    return path === '/' || path in STATIC_ROUTES;
}

function listingLinkHtml(l: RelatedListing, basePath: string): string {
    const year = l.productionYear ? ` (${l.productionYear})` : '';
    const price = l.pricePln ? ` — ${l.pricePln.toLocaleString('pl-PL')} zł` : '';
    return `<li><a href="${basePath}/${l.slug}">${escapeHtml(`${l.make} ${l.model}`)}${year}${price}</a></li>`;
}

export interface FinancingArticle {
    h1: string;
    html: string;
}

export interface StaticPagination {
    page: number; // 1-based
    totalPages: number;
}

// Crawlowalna nawigacja paginacji dla stron katalogowych (SSR-lite).
// Prawdziwe hrefy — crawlery bez JS odkrywają oferty ze stron 2+.
function paginationNavHtml(basePath: string, { page, totalPages }: StaticPagination): string {
    if (totalPages <= 1) return '';
    const href = (p: number) => (p > 1 ? `${basePath}?page=${p}` : basePath);
    const windowPages = new Set<number>([1, totalPages]);
    for (let p = page - 1; p <= page + 1; p++) {
        if (p >= 1 && p <= totalPages) windowPages.add(p);
    }
    const items = [...windowPages].sort((a, b) => a - b)
        .map(p => (p === page
            ? `<li><span aria-current="page">${p}</span></li>`
            : `<li><a href="${href(p)}">${p}</a></li>`))
        .join('\n    ');
    return `
<nav aria-label="Paginacja">
  <ul>
    ${page > 1 ? `<li><a href="${href(page - 1)}" rel="prev">Poprzednia strona</a></li>` : ''}
    ${items}
    ${page < totalPages ? `<li><a href="${href(page + 1)}" rel="next">Następna strona</a></li>` : ''}
  </ul>
</nav>`;
}

// Deklinacja liczebnika przy słowie "oferta" (1 oferta / 2-4 oferty / 5+ ofert; 12-14 to wyjątek → "ofert")
function pluralOfert(n: number): string {
    if (n === 1) return 'oferta';
    const lastDigit = n % 10;
    const lastTwo = n % 100;
    if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'oferty';
    return 'ofert';
}

function offersCountLabel(n: number): string {
    return `${n} ${pluralOfert(n)}`;
}

export interface BrandLinkEntry {
    name: string; // marka lub model — nazwa do wyświetlenia
    slug: string;
    count: number;
}

// Linkowanie wewnętrzne: "Popularne marki" na /samochody, "Modele marki" i "Inne marki"
// na stronach marek/modeli — ten sam znacznik, różny basePath/nagłówek.
function brandLinksSectionHtml(heading: string, basePath: string, entries: BrandLinkEntry[], max: number = 20): string {
    if (!entries.length) return '';
    return `
  <section>
    <h2>${escapeHtml(heading)}</h2>
    <ul>
      ${entries.slice(0, max).map(e => `<li><a href="${basePath}/${e.slug}">${escapeHtml(e.name)}</a> (${e.count})</li>`).join('\n')}
    </ul>
  </section>`;
}

// FAQ dynamiczne (2–3 pozycje) dla stron marek/modeli — z żywych danych: przedział cen
// aktywnych ofert, dostępne modele/liczba ofert, formy finansowania. Znika przy 0 ofert
// (zakaz zmyślonych danych — CLAUDE.md/spec). `models` obecne tylko na stronie marki.
function buildGeneratedBrandFaq(
    name: string,
    count: number,
    priceRange: { min: number | null; max: number | null },
    models: BrandLinkEntry[] | undefined,
    ctx: BrandCtx
): FaqItem[] {
    if (count === 0) return [];
    const items: FaqItem[] = [];
    if (priceRange.min != null && priceRange.max != null) {
        const priceText = priceRange.min === priceRange.max
            ? `${priceRange.min.toLocaleString('pl-PL')} zł`
            : `od ${priceRange.min.toLocaleString('pl-PL')} do ${priceRange.max.toLocaleString('pl-PL')} zł`;
        items.push({
            questionPl: `Ile kosztują samochody ${name}?`,
            answerPl: `Aktualne ceny ${name} w ofercie ${ctx.brandName} mieszczą się w przedziale ${priceText}, w zależności od modelu, rocznika i wersji.`,
        });
    }
    if (models && models.length > 0) {
        const modelNames = models.slice(0, 8).map(m => m.name).join(', ');
        items.push({
            questionPl: `Jakie modele ${name} są dostępne?`,
            answerPl: `W ofercie ${ctx.brandName} dostępne są obecnie modele: ${modelNames} — łącznie ${offersCountLabel(count)}.`,
        });
    } else {
        items.push({
            questionPl: `Ile ofert ${name} jest obecnie dostępnych?`,
            answerPl: `Obecnie w ofercie ${ctx.brandName} dostępnych jest ${offersCountLabel(count)} ${name}.`,
        });
    }
    items.push({
        questionPl: `Jak sfinansować zakup ${name}?`,
        answerPl: `${name} możesz sfinansować kredytem samochodowym, leasingiem lub wynajmem długoterminowym — wybierz formę finansowania przy wybranej ofercie, a doradca ${ctx.brandName} pomoże dobrać warunki.`,
    });
    return items;
}

export interface BrandPricingRange {
    min: number | null;
    max: number | null;
}

// Treść CMS (F2, SeoContentPage) dla strony marki/modelu — meta nadpisuje domyślne,
// html wstawiany pod listingiem, faq doklejane PO dynamicznym FAQ (spec §2/§3).
export interface CmsPageContent {
    html: string;
    faq: FaqItem[];
    metaTitle: string | null;
    metaDescription: string | null;
}

// Strona marki (/samochody/:marka) — zawsze self-canonical i indeksowalna (polityka progowa w spec).
export function buildBrandMeta(
    make: string,
    brandSlug: string,
    count: number,
    priceRange: BrandPricingRange,
    models: BrandLinkEntry[],
    otherBrands: BrandLinkEntry[],
    listings: RelatedListing[],
    ctx: BrandCtx,
    pagination?: StaticPagination,
    cms?: CmsPageContent
): PageMeta {
    const safeName = escapeHtml(make);
    const isPaged = !!pagination && pagination.page > 1;
    const canonicalBase = `/samochody/${brandSlug}`;
    const countLabel = offersCountLabel(count);
    const baseTitle = cms?.metaTitle || `${make} (${countLabel}) — nowe i używane | ${ctx.brandName}`;
    const title = isPaged ? `${baseTitle} — strona ${pagination!.page}` : baseTitle;
    const description = cms?.metaDescription || `Samochody ${make} dostępne od ręki — ${countLabel}. Sprawdź aktualne ceny i dopasuj finansowanie: leasing, kredyt lub wynajem długoterminowy.`;
    const baseH1 = `Samochody ${safeName} dostępne od ręki — nowe i używane`;
    const h1 = isPaged ? `${baseH1} — strona ${pagination!.page}` : baseH1;

    const faq = [...buildGeneratedBrandFaq(make, count, priceRange, models, ctx), ...(cms?.faq ?? [])];

    const bodyHtml = `
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Strona główna</a></li>
    <li><a href="/samochody">Samochody</a></li>
    <li>${safeName}</li>
  </ol>
</nav>
<article>
  <h1>${h1}</h1>
  ${listings.length > 0 ? `
  <section>
    <h2>Oferty</h2>
    <ul>
      ${listings.map(l => listingLinkHtml(l, '/oferta')).join('\n')}
    </ul>
  </section>` : `<p>Aktualnie brak ofert ${safeName} — zostaw kontakt, powiadomimy o nowej ofercie.</p>`}
  ${pagination ? paginationNavHtml(canonicalBase, pagination) : ''}
  ${cms?.html ? `<div class="cms-content">${cms.html}</div>` : ''}
  ${brandLinksSectionHtml(`Modele ${make}`, canonicalBase, models)}
  ${brandLinksSectionHtml('Popularne marki', '/samochody', otherBrands)}
  ${faqSectionHtml(faq, 'Najczęstsze pytania')}
</article>`.trim();

    const jsonLd: any[] = [];
    if (listings.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: listings.map((l, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${ctx.baseUrl}/oferta/${l.slug}`,
            })),
        });
    }
    jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Strona główna', item: ctx.baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Samochody', item: `${ctx.baseUrl}/samochody` },
            { '@type': 'ListItem', position: 3, name: make, item: `${ctx.baseUrl}${canonicalBase}` },
        ],
    });
    if (faq.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(f => ({
                '@type': 'Question',
                name: stripTags(f.questionPl),
                acceptedAnswer: { '@type': 'Answer', text: stripTags(f.answerPl) },
            })),
        });
    }

    return {
        title,
        description,
        canonical: `${ctx.baseUrl}${canonicalBase}${isPaged ? `?page=${pagination!.page}` : ''}`,
        bodyHtml,
        jsonLd,
        status: 200,
    };
}

// Strona modelu (/samochody/:marka/:model) — self-canonical + indeksowalna tylko przy
// count >= 2 (polityka progowa w spec); poniżej progu: 200 + noindex, treść zostaje.
export function buildModelMeta(
    make: string,
    model: string,
    brandSlug: string,
    modelSlug: string,
    count: number,
    priceRange: BrandPricingRange,
    siblingModels: BrandLinkEntry[],
    listings: RelatedListing[],
    ctx: BrandCtx,
    pagination?: StaticPagination,
    cms?: CmsPageContent
): PageMeta {
    const name = `${make} ${model}`;
    const safeName = escapeHtml(name);
    const safeBrand = escapeHtml(make);
    const isPaged = !!pagination && pagination.page > 1;
    const canonicalBase = `/samochody/${brandSlug}/${modelSlug}`;
    const countLabel = offersCountLabel(count);
    const baseTitle = cms?.metaTitle || `${name} (${countLabel}) — dostępne od ręki | ${ctx.brandName}`;
    const title = isPaged ? `${baseTitle} — strona ${pagination!.page}` : baseTitle;
    const description = cms?.metaDescription || `${name} dostępne od ręki — ${countLabel}. Sprawdź aktualne ceny i dopasuj finansowanie: leasing, kredyt lub wynajem długoterminowy.`;
    const baseH1 = `${safeName} — dostępne od ręki`;
    const h1 = isPaged ? `${baseH1} — strona ${pagination!.page}` : baseH1;

    const faq = [...buildGeneratedBrandFaq(name, count, priceRange, undefined, ctx), ...(cms?.faq ?? [])];

    const bodyHtml = `
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Strona główna</a></li>
    <li><a href="/samochody">Samochody</a></li>
    <li><a href="/samochody/${brandSlug}">${safeBrand}</a></li>
    <li>${safeName}</li>
  </ol>
</nav>
<article>
  <h1>${h1}</h1>
  ${listings.length > 0 ? `
  <section>
    <h2>Oferty</h2>
    <ul>
      ${listings.map(l => listingLinkHtml(l, '/oferta')).join('\n')}
    </ul>
  </section>` : `<p>Aktualnie brak ofert ${safeName} — zostaw kontakt, powiadomimy o nowej ofercie.</p>`}
  ${pagination ? paginationNavHtml(canonicalBase, pagination) : ''}
  ${cms?.html ? `<div class="cms-content">${cms.html}</div>` : ''}
  ${brandLinksSectionHtml(`Inne modele ${make}`, `/samochody/${brandSlug}`, siblingModels)}
  ${faqSectionHtml(faq, 'Najczęstsze pytania')}
</article>`.trim();

    const jsonLd: any[] = [];
    if (listings.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: listings.map((l, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${ctx.baseUrl}/oferta/${l.slug}`,
            })),
        });
    }
    jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Strona główna', item: ctx.baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Samochody', item: `${ctx.baseUrl}/samochody` },
            { '@type': 'ListItem', position: 3, name: make, item: `${ctx.baseUrl}/samochody/${brandSlug}` },
            { '@type': 'ListItem', position: 4, name, item: `${ctx.baseUrl}${canonicalBase}` },
        ],
    });
    if (faq.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(f => ({
                '@type': 'Question',
                name: stripTags(f.questionPl),
                acceptedAnswer: { '@type': 'Answer', text: stripTags(f.answerPl) },
            })),
        });
    }

    return {
        title,
        description,
        canonical: `${ctx.baseUrl}${canonicalBase}${isPaged ? `?page=${pagination!.page}` : ''}`,
        // Model z opublikowaną treścią CMS jest indeksowalny nawet poniżej progu 2 ofert (spec §1/F2).
        noindex: cms ? false : count < 2,
        bodyHtml,
        jsonLd,
        status: 200,
    };
}

export interface OrgSettings {
    legalCompanyName?: string | null;
    legalAddress?: string | null;
    legalVatId?: string | null;
    legalContactEmail?: string | null;
    legalContactPhone?: string | null;
}

export function buildStaticMeta(
    path: string,
    ctx: BrandCtx,
    listings: RelatedListing[] = [],
    faq: any[] = [],
    listingsBasePath: string = '/oferta',
    article?: FinancingArticle,
    pagination?: StaticPagination,
    orgSettings?: OrgSettings,
    popularBrands: BrandLinkEntry[] = []
): PageMeta | null {
    if (path === '/') {
        // h1 jest na stronie już w statycznym home-shell (index.html) — tu tylko wzmocniony akapit,
        // żeby prerender dla botów nie dublował <h1>
        const bodyHtml = `
<p><strong>${ctx.defaultTitle}</strong></p>
<p>${ctx.defaultDescription}</p>
${listings.length > 0 ? `
<section>
  <h2>Najnowsze oferty</h2>
  <ul>
    ${listings.map(l => listingLinkHtml(l, listingsBasePath)).join('\n')}
  </ul>
  <p><a href="/samochody">Zobacz wszystkie samochody</a></p>
</section>` : ''}`.trim();

        const jsonLd: Record<string, unknown> = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: ctx.brandName,
            url: `${ctx.baseUrl}/`,
            logo: ctx.logoUrl,
            description: ctx.defaultDescription,
        };
        if (orgSettings?.legalCompanyName) jsonLd.legalName = orgSettings.legalCompanyName;
        if (orgSettings?.legalVatId) jsonLd.vatID = orgSettings.legalVatId;
        if (orgSettings?.legalAddress) jsonLd.address = orgSettings.legalAddress;
        const contactPoint: Record<string, unknown> = {};
        if (orgSettings?.legalContactPhone) contactPoint.telephone = orgSettings.legalContactPhone;
        if (orgSettings?.legalContactEmail) contactPoint.email = orgSettings.legalContactEmail;
        if (Object.keys(contactPoint).length > 0) {
            jsonLd.contactPoint = {
                '@type': 'ContactPoint',
                ...contactPoint,
                contactType: 'customer service',
                areaServed: 'PL',
                availableLanguage: ['pl'],
            };
        }
        if (ctx.alternateNames && ctx.alternateNames.length > 0) jsonLd.alternateName = ctx.alternateNames;
        if (ctx.disambiguatingDescription) jsonLd.disambiguatingDescription = ctx.disambiguatingDescription;
        // TODO: sameAs — brak zweryfikowanych profili społecznościowych w danych

        return {
            title: ctx.defaultTitle,
            description: ctx.defaultDescription,
            canonical: `${ctx.baseUrl}/`,
            bodyHtml,
            jsonLd,
            status: 200,
        };
    }
    const route = STATIC_ROUTES[path];
    if (!route) return null;

    const isPaged = !!pagination && pagination.page > 1;
    const canonicalBase = route.canonicalPath ?? path;
    const title = isPaged
        ? `${route.title(ctx.brandName)} — strona ${pagination.page}`
        : route.title(ctx.brandName);
    // h1 bez sufiksu marki z <title> — "— strona N" może zostać, odróżnia strony paginacji
    const h1 = article
        ? escapeHtml(article.h1)
        : isPaged
        ? `${route.h1} — strona ${pagination.page}`
        : route.h1;
    // Strony finansowania pokazują skróconą listę (pełny katalog jest na /samochody)
    const browseAllLink = path === '/leasing' || path === '/kredyt';
    const bodyHtml = `
<h1>${h1}</h1>
<p>${route.description}</p>
${listings.length > 0 ? `
<section>
  <h2>Oferty</h2>
  <ul>
    ${listings.map(l => listingLinkHtml(l, listingsBasePath)).join('\n')}
  </ul>${browseAllLink ? `
  <p><a href="/samochody">Zobacz wszystkie samochody</a></p>` : ''}
</section>` : ''}
${pagination ? paginationNavHtml(canonicalBase, pagination) : ''}
${path === '/samochody' ? brandLinksSectionHtml('Popularne marki', '/samochody', popularBrands) : ''}
${article ? `
<article>
${article.html}
</article>` : ''}
${faqSectionHtml(faq, 'Najczęstsze pytania')}`.trim();

    const jsonLd: any[] = [];
    if (listings.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: listings.map((l, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${ctx.baseUrl}${listingsBasePath}/${l.slug}`
            }))
        });
    }

    if (faq.length > 0) {
        jsonLd.push({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map(f => ({
                '@type': 'Question',
                name: stripTags(f.questionPl),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: stripTags(f.answerPl)
                }
            }))
        });
    }

    return {
        title,
        description: route.description,
        canonical: `${ctx.baseUrl}${canonicalBase}${isPaged ? `?page=${pagination.page}` : ''}`,
        bodyHtml,
        jsonLd: jsonLd.length === 1 ? jsonLd[0] : jsonLd.length > 1 ? jsonLd : undefined,
        status: 200,
    };
}

export function defaultMeta(ctx: BrandCtx, opts: { noindex?: boolean; status?: number } = {}): PageMeta {
    return {
        title: ctx.defaultTitle,
        description: ctx.defaultDescription,
        noindex: opts.noindex,
        status: opts.status ?? 200,
    };
}

function escapeAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function injectHead(template: string, meta: PageMeta): string {
    const title = escapeAttr(meta.title);
    const description = escapeAttr(meta.description);
    let html = template
        .replace(/<title>.*?<\/title>/, () => `<title>${title}</title>`)
        .replace(/(<meta name="description" content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`)
        .replace(/(<meta property="og:title"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${title}${p2}`)
        .replace(/(<meta property="og:description"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`)
        .replace(/(<meta name="twitter:title"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${title}${p2}`)
        .replace(/(<meta name="twitter:description"[^>]*content=").*?(")/, (_m, p1, p2) => `${p1}${description}${p2}`);

    if (meta.canonical) {
        const canonical = escapeAttr(meta.canonical);
        html = html.replace(
            /(<meta property="og:url"[^>]*content=").*?(")/,
            (_m, p1, p2) => `${p1}${canonical}${p2}`
        );
    }

    if (meta.ogImage) {
        const ogImage = escapeAttr(meta.ogImage);
        html = html.replace(
            /(<meta property="og:image"[^>]*content=").*?(")/,
            (_m, p1, p2) => `${p1}${ogImage}${p2}`
        ).replace(
            /(<meta name="twitter:image"[^>]*content=").*?(")/,
            (_m, p1, p2) => `${p1}${ogImage}${p2}`
        );
    }

    const extra: string[] = [];
    if (meta.canonical) extra.push(`<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
    if (meta.noindex) extra.push(`<meta name="robots" content="noindex" />`);
    if (meta.jsonLd) {
        // < prevents </script> breakout from data-derived strings
        const json = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c');
        extra.push(`<script type="application/ld+json">${json}</script>`);
    }
    if (extra.length) {
        html = html.replace('</head>', () => `${extra.join('\n')}\n</head>`);
    }

    if (meta.bodyHtml) {
        // display:none — fallback jest dla botów czytających surowy HTML; bez tego użytkownik
        // widzi błysk niestylowanego tekstu zanim React zamontuje SPA i wyczyści #root.
        // Wstawiamy zaraz za otwarciem #root (a nie podmieniamy pustego roota), bo na
        // stronie głównej root zawiera widoczny statyczny shell hero (vite.config).
        html = html.replace(
            '<div id="root">',
            () => `<div id="root"><div class="seo-prerender" style="display:none">${meta.bodyHtml}</div>`
        );
    }

    return html;
}
