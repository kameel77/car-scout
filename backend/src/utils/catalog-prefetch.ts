// Constant inline body (identical on every page) so CSP can allow it by sha256 hash (see nginx.conf).
// Per-page parameters come from the preceding <script type="application/json" id="catalog-prefetch-params">.
export const CATALOG_PREFETCH_JS = '(function(){var el=document.getElementById("catalog-prefetch-params");if(!el)return;var c;try{c=JSON.parse(el.textContent)}catch(e){return}if(location.pathname.replace(/\\/+$/,"")!==c.route||location.search)return;var u=c.url;window.__CATALOG_PREFETCH__={url:u,p:fetch(u).then(function(r){return r.ok?r.json():null}).catch(function(){return null})};})();';

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
    const data = JSON.stringify({ route: path, url: `/api/listings?${params}` }).replace(/</g, '\\u003c');
    return `<script type="application/json" id="catalog-prefetch-params">${data}</script>\n<script>${CATALOG_PREFETCH_JS}</script>\n`;
}
