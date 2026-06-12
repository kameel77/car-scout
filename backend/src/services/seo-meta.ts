export interface PageMeta {
    title: string;
    description: string;
    canonical?: string; // absolute URL
    jsonLd?: object;
    noindex?: boolean;
    status: number;
}

export interface BrandCtx {
    baseUrl: string;
    brandName: string;
    defaultTitle: string;
    defaultDescription: string;
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
    return {
        baseUrl: (process.env.FRONTEND_URL || 'https://carsalon.pl').replace(/\/$/, ''),
        brandName: d.name,
        defaultTitle: d.title,
        defaultDescription: d.description,
    };
}

export interface ListingMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number;
    pricePln: number;
    mileageKm: number;
    fuelType: string | null;
    bodyType: string | null;
}

export function buildListingMeta(
    l: ListingMetaInput,
    slug: string,
    variant: ListingVariant,
    ctx: BrandCtx
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

    return {
        title: `${name}${variantLabel} — ${price} zł | ${ctx.brandName}`,
        description: `${name}: ${detale}. Samochód dostępny od ręki u dealera — sprawdź finansowanie: leasing, kredyt lub najem.`,
        canonical,
        jsonLd:
            variant === 'oferta'
                ? {
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
                      ...(l.fuelType ? { fuelType: l.fuelType } : {}),
                      ...(l.bodyType ? { bodyType: l.bodyType } : {}),
                      offers: {
                          '@type': 'Offer',
                          price: l.pricePln,
                          priceCurrency: 'PLN',
                          availability: 'https://schema.org/InStock',
                          url: canonical,
                      },
                  }
                : undefined,
        status: 200,
    };
}

export interface RentalMetaInput {
    make: string;
    model: string;
    version: string | null;
    productionYear: number | null;
    sellingPrice?: number | null;
}

export function buildRentalMeta(r: RentalMetaInput, slug: string, ctx: BrandCtx): PageMeta {
    const name = [r.make, r.model, r.version, r.productionYear ? String(r.productionYear) : null]
        .filter(Boolean)
        .join(' ');
    const canonical = `${ctx.baseUrl}/wynajem-dlugoterminowy/${slug}`;
    return {
        title: `${name} — najem długoterminowy | ${ctx.brandName}`,
        description: `${name} w najmie długoterminowym — stała rata miesięczna, bez wkładu własnego. Sprawdź dostępność u dealera.`,
        canonical,
        jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Vehicle',
            name,
            brand: { '@type': 'Brand', name: r.make },
            model: r.model,
            ...(r.sellingPrice
                ? {
                      offers: {
                          '@type': 'Offer',
                          price: r.sellingPrice,
                          priceCurrency: 'PLN',
                          availability: 'https://schema.org/InStock',
                          url: canonical,
                      },
                  }
                : {}),
        },
        status: 200,
    };
}

interface StaticRoute {
    title: (brand: string) => string;
    description: string;
    canonicalPath?: string; // default: own path
    organization?: boolean;
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
        title: b => `Najem długoterminowy samochodów | ${b}`,
        description:
            'Auta w najmie długoterminowym — stała rata, bez wkładu własnego. Sprawdź dostępne samochody.',
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

export function buildStaticMeta(path: string, ctx: BrandCtx): PageMeta | null {
    if (path === '/') {
        return {
            title: ctx.defaultTitle,
            description: ctx.defaultDescription,
            canonical: `${ctx.baseUrl}/`,
            jsonLd: {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: ctx.brandName,
                url: `${ctx.baseUrl}/`,
            },
            status: 200,
        };
    }
    const route = STATIC_ROUTES[path];
    if (!route) return null;
    return {
        title: route.title(ctx.brandName),
        description: route.description,
        canonical: `${ctx.baseUrl}${route.canonicalPath ?? path}`,
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
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/(<meta name="description" content=").*?(")/, `$1${description}$2`)
        .replace(/(<meta property="og:title"[^>]*content=").*?(")/, `$1${title}$2`)
        .replace(/(<meta property="og:description"[^>]*content=").*?(")/, `$1${description}$2`)
        .replace(/(<meta name="twitter:title"[^>]*content=").*?(")/, `$1${title}$2`)
        .replace(/(<meta name="twitter:description"[^>]*content=").*?(")/, `$1${description}$2`);

    if (meta.canonical) {
        html = html.replace(
            /(<meta property="og:url"[^>]*content=").*?(")/,
            `$1${escapeAttr(meta.canonical)}$2`
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
        html = html.replace('</head>', `${extra.join('\n')}\n</head>`);
    }
    return html;
}
