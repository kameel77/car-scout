/**
 * Lightweight GTM dataLayer helpers for conversion & remarketing UI events.
 * Follows GA4 E-Commerce guidelines (clearing previous ecommerce object before pushes).
 */

export interface DynamicRemarketingItem {
  id: string;
  name: string;
  make?: string;
  model?: string;
  price?: number;
  monthlyRate?: number;
  financingType?: string;
  category?: string;
}

export interface LeadSubmitPayload {
  formId: string;
  leadType: string;
  brand?: string;
  model?: string;
  listingId?: string;
  financingType?: string;
  phone?: string;
}

const getWindowDataLayer = (): any[] | null => {
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    return (window as any).dataLayer;
  }
  return null;
};

export const trackPhoneClick = (clickLocation: string, landingPageSlug?: string, trafficSource?: string) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'phone_click',
      click_location: clickLocation,
      landing_page_slug: landingPageSlug || '',
      traffic_source: trafficSource || '',
    });
  }
};

/** Pierwsza interakcja z formularzem leada — etap lejka między view_item a generate_lead. */
export const trackLeadFormStart = (formId: string, hasFinancingContext: boolean) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'lead_form_start',
      form_id: formId,
      has_financing_context: hasFinancingContext,
    });
  }
};

export const trackLpView = (landingPageSlug: string, trafficSource?: string) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'lp_view',
      landing_page_slug: landingPageSlug,
      traffic_source: trafficSource || '',
    });
  }
};

const mapItemToGa4 = (item: DynamicRemarketingItem, index?: number) => {
  const data: any = {
    item_id: item.id,
    item_name: item.name,
    item_brand: item.make || '',
    item_category: item.financingType || item.category || 'auto',
    price: item.price || 0,
  };
  if (item.monthlyRate && item.monthlyRate > 0) {
    data.monthly_installment = item.monthlyRate;
  }
  if (typeof index === 'number') {
    data.index = index;
  }
  return data;
};

export const trackViewItem = (item: DynamicRemarketingItem) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({ ecommerce: null });
    dl.push({
      event: 'view_item',
      ecommerce: {
        currency: 'PLN',
        value: item.price || item.monthlyRate || 0,
        items: [mapItemToGa4(item)],
      },
      dynx_itemid: item.id,
      dynx_totalvalue: item.price || item.monthlyRate || 0,
      dynx_pagetype: 'offerdetail',
    });
  }
};

export const trackViewArchivedItem = (item: DynamicRemarketingItem) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({ ecommerce: null });
    dl.push({
      event: 'view_archived_item',
      ecommerce: {
        currency: 'PLN',
        value: item.price || item.monthlyRate || 0,
        items: [mapItemToGa4(item)],
      },
      dynx_itemid: item.id,
      dynx_totalvalue: item.price || item.monthlyRate || 0,
      dynx_pagetype: 'archived_offer',
    });
  }
};

export const trackViewItemList = (items: DynamicRemarketingItem[], listName = 'Search Results') => {
  const dl = getWindowDataLayer();
  if (dl && items.length > 0) {
    dl.push({ ecommerce: null });
    dl.push({
      event: 'view_item_list',
      ecommerce: {
        item_list_name: listName,
        items: items.slice(0, 10).map((item, index) => mapItemToGa4(item, index + 1)),
      },
      dynx_pagetype: 'searchresults',
    });
  }
};

export const trackSelectItem = (item: DynamicRemarketingItem, listName = 'Search Results') => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({ ecommerce: null });
    dl.push({
      event: 'select_item',
      ecommerce: {
        item_list_name: listName,
        items: [mapItemToGa4(item)],
      },
    });
  }
};

export interface RentalBudgetFilterPayload {
  priceFrom: number | null;
  priceTo: number | null;
  priceBasis: 'net' | 'gross';
  resultsCount: number;
}

export const trackRentalClientTypeChange = (clientType: 'business' | 'consumer', priceBasis: 'net' | 'gross') => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'rental_client_type_change',
      client_type: clientType,
      price_basis: priceBasis,
    });
  }
};

export const trackRentalBudgetFilter = (payload: RentalBudgetFilterPayload) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'rental_budget_filter',
      price_from: payload.priceFrom,
      price_to: payload.priceTo,
      price_basis: payload.priceBasis,
      results_count: payload.resultsCount,
    });
  }
};

export const trackLeadSubmit = (payload: LeadSubmitPayload) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'generate_lead',
      lead_type: payload.leadType,
      form_id: payload.formId,
      brand: payload.brand || '',
      model: payload.model || '',
      listing_id: payload.listingId || '',
      financing_type: payload.financingType || 'general',
      lead_details: {
        phone: payload.phone || '',
      },
    });
  }
};

/**
 * Query params worth keeping in `page_location`. Everything else is filter and
 * sorting state that the pages append to the URL after mount — keeping it only
 * fragments the GA4 page reports into variants like /leasing?status=new.
 */
const PRESERVED_QUERY_PARAMS = new Set([
  'gclid', 'gbraid', 'wbraid', 'dclid', 'gad_source', 'gclsrc',
  'fbclid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'epik', 'srsltid',
]);

export const cleanPageLocation = (href: string): string => {
  try {
    const url = new URL(href);
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      const name = key.toLowerCase();
      if (name.startsWith('utm_') || PRESERVED_QUERY_PARAMS.has(name)) {
        kept.append(key, value);
      }
    });
    url.search = kept.toString();
    url.hash = '';
    return url.toString();
  } catch {
    return href;
  }
};

export const trackPageView = (pageLocation: string, pageReferrer: string) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'spa_page_view',
      page_location: pageLocation,
      page_title: document.title,
      page_referrer: pageReferrer,
    });
  }
};
