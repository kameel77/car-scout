/**
 * Lightweight GTM dataLayer helpers for conversion-related UI events.
 *
 * `phone_click` is pushed on every click of a tel: link so that phone
 * conversions (the dominant channel in automotive) become measurable in
 * GA4/GTM. Configure a GTM trigger on event name "phone_click" and mark it
 * as a key event in GA4.
 */
export const trackPhoneClick = (clickLocation: string) => {
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: 'phone_click',
      click_location: clickLocation,
    });
  }
};
