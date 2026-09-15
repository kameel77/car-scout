// Read the user's segment in the browser: shared HTML must not bake in B2B/B2C.
// Query-string navigation stays on the ordinary client path (including cached HTML).
export function buildRentalPrefetchScript(defaultSort = 'minMonthlyRateNet_asc'): string {
    const [sortBy, sortOrder] = defaultSort.split('_');
    const params = new URLSearchParams({ page: '1', limit: '12', sortBy: sortBy || 'minMonthlyRateNet', sortOrder: sortOrder || 'asc' });
    const baseUrl = JSON.stringify(`/api/rental/vehicles?${params}`).replace(/</g, '\\u003c');
    // Only the no-image candidate is unambiguous here. Real image hints need the
    // same URL normalization and responsive variants as OptimizedImage first.
    return `<script>(function(){if(location.pathname!=="/wynajem-dlugoterminowy"||location.search)return;var type="b2b";try{if(localStorage.getItem("rentalClientType")==="consumer")type="b2c";}catch(e){}var u=${baseUrl}+"&offerType="+type;window.__RENTAL_PREFETCH__={url:u,p:fetch(u).then(function(r){return r.ok?r.json():null}).then(function(data){try{var first=data&&data.vehicles&&data.vehicles[0];if(location.pathname==="/wynajem-dlugoterminowy"&&!location.search&&first&&!first.primaryImageUrl&&(!first.imageUrls||first.imageUrls.length===0)){var l=document.createElement("link");l.rel="preload";l.as="image";l.href="/motolia-placeholder.webp";l.setAttribute("fetchpriority","high");document.head.appendChild(l);}}catch(e){}return data;}).catch(function(){return null})};})();</script>\n`;
}
