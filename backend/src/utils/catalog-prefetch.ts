// Runs in the browser so a cached HTML response cannot prefetch unfiltered data
// on a filtered URL. This is a public fetch, never an authenticated response.
export function buildCatalogPrefetchScript(path: string, perPage: number, sortBy: string, currency: string): string {
    if (!['/nowe', '/uzywane', '/samochody'].includes(path)) return '';
    const params = new URLSearchParams();
    if (path !== '/samochody') params.set('status', path === '/nowe' ? 'NEW' : 'USED');
    params.set('rateType', 'credit');
    params.set('rateBasis', 'gross');
    params.set('sortBy', sortBy);
    params.set('currency', currency);
    params.set('page', '1');
    params.set('perPage', String(perPage));
    const url = JSON.stringify(`/api/listings?${params}`).replace(/</g, '\\u003c');
    const route = JSON.stringify(path);
    return `<script>(function(){if(location.pathname.replace(/\\/+$/,"")!==${route}||location.search)return;var u=${url};window.__CATALOG_PREFETCH__={url:u,p:fetch(u).then(function(r){return r.ok?r.json():null}).catch(function(){return null})};})();</script>\n`;
}
