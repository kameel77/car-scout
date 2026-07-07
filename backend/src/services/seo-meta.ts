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
}

export type ListingVariant = 'oferta' | 'leasing' | 'kredyt';

const BRAND_DEFAULTS: Record<string, { name: string; title: string; description: string }> = {
    carsalon: {
        name: 'CarSalon',
        title: 'CarSalon - auta nowe i używane z gwarancją',
        description: 'Setki ofert od sprawdzonych dealerów. Nowe i używane samochody z gwarancją.',
    },
    motolia: {
        name: 'Motolia',
        title: 'Motolia - leasing, kredyt i wynajem samochodów',
        description: 'Szeroki wybór aut. Proste finansowanie. Leasing, kredyt i wynajem długoterminowy.',
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

    const bodyHtml = `
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Strona główna</a></li>
    <li><a href="/samochody">Samochody</a></li>
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
            { '@type': 'ListItem', position: 2, name: 'Samochody', item: `${ctx.baseUrl}/samochody` },
            { '@type': 'ListItem', position: 3, name: name, item: canonical }
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

export function buildRentalMeta(
    r: RentalMetaInput,
    slug: string,
    ctx: BrandCtx,
    faq: FaqItem[] = [],
    monthlyRateFrom: number | null = null
): PageMeta {
    const name = [r.make, r.model, r.version, r.productionYear ? String(r.productionYear) : null]
        .filter(Boolean)
        .join(' ');
    const canonical = `${ctx.baseUrl}/wynajem-dlugoterminowy/${slug}`;
    const safeName = escapeHtml(name);
    const imageUrl = r.primaryImageUrl ? absoluteUrl(r.primaryImageUrl, ctx.baseUrl) : null;
    const rateFrom = monthlyRateFrom ? Math.round(monthlyRateFrom).toLocaleString('pl-PL') : null;
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
  <p>${safeName} w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.</p>
  ${rateFrom ? `<p>Rata najmu od ${rateFrom} zł brutto miesięcznie.</p>` : ''}
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
    <h2>Wynajem długoterminowy tego pojazdu</h2>
    <p>${safeName} dostępny w najmie długoterminowym przez ${escapeHtml(ctx.brandName)} — jedna stała rata obejmująca finansowanie auta, bez wkładu własnego i bez zobowiązań na koniec umowy.</p>
    <ol>
      <li>Wybierz okres najmu i roczny limit kilometrów przy ofercie.</li>
      <li>Zostaw kontakt — doradca przygotuje ofertę najmu dopasowaną do Twoich potrzeb.</li>
      <li>Podpisz umowę i odbierz samochód.</li>
    </ol>
  </section>
  ${faqSectionHtml(faq, 'Najczęstsze pytania o wynajem długoterminowy')}
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
        offers: {
            '@type': 'Offer',
            // Najem, nie sprzedaż — GoodRelations LeaseOut
            businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
            availability: 'https://schema.org/InStock',
            url: canonical,
            seller: { '@type': 'Organization', name: ctx.brandName, url: `${ctx.baseUrl}/` },
            ...(monthlyRateFrom
                ? {
                      priceSpecification: {
                          '@type': 'UnitPriceSpecification',
                          minPrice: Math.round(monthlyRateFrom),
                          priceCurrency: 'PLN',
                          valueAddedTaxIncluded: true,
                          unitText: 'miesiąc',
                          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
                      },
                  }
                : {}),
        },
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
        title: `${name} — najem długoterminowy | ${ctx.brandName}`,
        description: `${name} w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.`,
        canonical,
        ogImage: imageUrl || undefined,
        bodyHtml,
        jsonLd,
        status: 200,
    };
}

interface StaticRoute {
    title: (brand: string) => string;
    description: string;
    canonicalPath?: string; // default: own path
}

const STATIC_ROUTES: Record<string, StaticRoute> = {
    '/samochody': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
    },
    '/search': {
        title: b => `Samochody dostępne od ręki — nowe i używane | ${b}`,
        description:
            'Przeglądaj samochody dostępne od ręki u dealerów. Nowe i używane auta z dopasowanym finansowaniem: leasing, kredyt lub najem.',
        canonicalPath: '/samochody',
    },
    '/nowe': {
        title: b => `Nowe samochody z rabatem dostępne u dealerów | ${b}`,
        description:
            'Nowe samochody z rabatem, dostępne od ręki u dealerów. Sprawdź dostępność i dopasowane finansowanie.',
    },
    '/uzywane': {
        title: b => `Samochody używane od dealera z gwarancją | ${b}`,
        description:
            'Samochody używane od dealerów — sprawdzone auta z finansowaniem: leasing, kredyt lub najem.',
    },
    '/leasing': {
        title: b => `Leasing samochodu — auta dostępne od ręki | ${b}`,
        description:
            'Samochody dostępne od ręki w leasingu. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/kredyt': {
        title: b => `Kredyt samochodowy — auta dostępne od ręki | ${b}`,
        description:
            'Samochody dostępne od ręki na kredyt. Złóż wniosek o finansowanie i odbierz auto bez czekania.',
    },
    '/wynajem-dlugoterminowy': {
        title: b => `Wynajem długoterminowy samochodu — auto w abonamencie | ${b}`,
        description:
            'Wynajem długoterminowy samochodu — auto w abonamencie ze stałą ratą, bez wkładu własnego. Sprawdź dostępne modele.',
    },
    '/dla-ciebie': {
        title: b => `Oferta dopasowana do Ciebie | ${b}`,
        description:
            'Samochód z dopasowanym finansowaniem — leasing, kredyt lub najem. Zostaw kontakt, dobierzemy ofertę.',
    },
    '/dla-firm': {
        title: b => `Samochody i finansowanie dla firm | ${b}`,
        description:
            'Auta dla firm — leasing, kredyt lub najem długoterminowy. Złóż wniosek o finansowanie.',
    },
    '/faq': {
        title: b => `Najczęstsze pytania | ${b}`,
        description:
            'Odpowiedzi na najczęstsze pytania o zakup samochodu, finansowanie i proces zamówienia.',
    },
    '/kontakt': {
        title: b => `Kontakt | ${b}`,
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

export function buildStaticMeta(
    path: string,
    ctx: BrandCtx,
    listings: RelatedListing[] = [],
    faq: any[] = [],
    listingsBasePath: string = '/oferta',
    article?: FinancingArticle
): PageMeta | null {
    if (path === '/') {
        const bodyHtml = `
<h1>${ctx.defaultTitle}</h1>
<p>${ctx.defaultDescription}</p>
${listings.length > 0 ? `
<section>
  <h2>Najnowsze oferty</h2>
  <ul>
    ${listings.map(l => listingLinkHtml(l, listingsBasePath)).join('\n')}
  </ul>
  <p><a href="/samochody">Zobacz wszystkie samochody</a></p>
</section>` : ''}`.trim();

        return {
            title: ctx.defaultTitle,
            description: ctx.defaultDescription,
            canonical: `${ctx.baseUrl}/`,
            bodyHtml,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: ctx.brandName,
                url: `${ctx.baseUrl}/`,
                logo: ctx.logoUrl,
            },
            status: 200,
        };
    }
    const route = STATIC_ROUTES[path];
    if (!route) return null;

    const title = route.title(ctx.brandName);
    const bodyHtml = `
<h1>${article ? escapeHtml(article.h1) : title}</h1>
<p>${route.description}</p>
${listings.length > 0 ? `
<section>
  <h2>Oferty</h2>
  <ul>
    ${listings.map(l => listingLinkHtml(l, listingsBasePath)).join('\n')}
  </ul>
</section>` : ''}
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
        canonical: `${ctx.baseUrl}${route.canonicalPath ?? path}`,
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
        html = html.replace(
            /<div id="root"><\/div>/,
            () => `<div id="root">${meta.bodyHtml}</div>`
        );
    }

    return html;
}
