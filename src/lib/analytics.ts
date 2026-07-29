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

export const trackPhoneClick = (clickLocation: string) => {
  const dl = getWindowDataLayer();
  if (dl) {
    dl.push({
      event: 'phone_click',
      click_location: clickLocation,
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
