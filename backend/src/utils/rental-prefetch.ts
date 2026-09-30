// Constant inline body (identical on every page) so CSP can allow it by sha256 hash (see nginx.conf).
// Per-page parameters come from the preceding <script type="application/json" id="rental-prefetch-params">.
export const RENTAL_PREFETCH_JS = '(function(){var el=document.getElementById("rental-prefetch-params");if(!el)return;var c;try{c=JSON.parse(el.textContent)}catch(e){return}if(location.pathname!=="/wynajem-dlugoterminowy"||location.search)return;var type="b2b";try{if(localStorage.getItem("rentalClientType")==="consumer")type="b2c";}catch(e){}var u=c.url+"&offerType="+type;window.__RENTAL_PREFETCH__={url:u,p:fetch(u).then(function(r){return r.ok?r.json():null}).then(function(data){try{var first=data&&data.vehicles&&data.vehicles[0];if(location.pathname==="/wynajem-dlugoterminowy"&&!location.search&&first){var img=first.primaryImageUrl||(first.imageUrls&&first.imageUrls[0]);var l=document.createElement("link");l.rel="preload";l.as="image";l.setAttribute("fetchpriority","high");if(img&&img.indexOf("/uploads/")===0&&img.indexOf(".webp")===img.length-5){var b=img.slice(0,-5);l.href=b+"-lg.webp";l.setAttribute("imagesrcset",b+"-thumb.webp 600w, "+b+"-md.webp 900w, "+b+"-lg.webp 1400w");l.setAttribute("imagesizes","(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw");l.type="image/webp";}else{l.href=img||"/motolia-placeholder.webp";}document.head.appendChild(l);}}catch(e){}return data;}).catch(function(){return null})};})();';

// Read the user's segment in the browser: shared HTML must not bake in B2B/B2C.
// Query-string navigation stays on the ordinary client path (including cached HTML).
export function buildRentalPrefetchScript(defaultSort = 'minMonthlyRateNet_asc'): string {
    const [sortBy, sortOrder] = defaultSort.split('_');
    const params = new URLSearchParams({ page: '1', limit: '12', sortBy: sortBy || 'minMonthlyRateNet', sortOrder: sortOrder || 'asc' });
    const data = JSON.stringify({ url: `/api/rental/vehicles?${params}` }).replace(/</g, '\\u003c');
    return `<script type="application/json" id="rental-prefetch-params">${data}</script>\n<script>${RENTAL_PREFETCH_JS}</script>\n`;
}
