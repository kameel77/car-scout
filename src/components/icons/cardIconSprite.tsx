import { forwardRef, type SVGProps } from 'react';

/**
 * Shared SVG sprite for the icons rendered ~30x per catalog page by ListingCard.
 * One <symbol> per icon, referenced through <use> — keeps per-card DOM small.
 * Path data copied from lucide-react (calendar, gauge, fuel, map-pin, arrow-right, info),
 * GearboxIcon and the inline "power" bolt that used to live in ListingCard.
 */
export type CardIconName = 'calendar' | 'gauge' | 'fuel' | 'map-pin' | 'arrow-right' | 'info' | 'gearbox' | 'power';

export const CARD_ICON_SPRITE_ID = 'lc-sprite';
export const cardIconSymbolId = (name: CardIconName) => `lc-${name}`;

const LUCIDE = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const SPRITE_HTML = `<svg id="${CARD_ICON_SPRITE_ID}" width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="lc-calendar" ${LUCIDE}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></symbol>
<symbol id="lc-gauge" ${LUCIDE}><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></symbol>
<symbol id="lc-fuel" ${LUCIDE}><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></symbol>
<symbol id="lc-map-pin" ${LUCIDE}><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></symbol>
<symbol id="lc-arrow-right" ${LUCIDE}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
<symbol id="lc-info" ${LUCIDE}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></symbol>
<symbol id="lc-gearbox" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M40 12v12H8m16-12v24M8 12v24"/><path d="M44 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0M28 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0M12 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0m16 32a4 4 0 1 1-8 0a4 4 0 0 1 8 0m-16 0a4 4 0 1 1-8 0a4 4 0 0 1 8 0m28 4a4 4 0 1 0 0-8a4 4 0 0 0 0 8"/></symbol>
<symbol id="lc-power" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>
</svg>`;

/** Idempotently mounts the sprite into document.body (no-op on the server). */
export function ensureCardIconSprite() {
  if (typeof document === 'undefined' || document.getElementById(CARD_ICON_SPRITE_ID)) return;
  document.body.insertAdjacentHTML('beforeend', SPRITE_HTML);
}

type CardIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & { name: CardIconName };

// forwardRef + prop spread so it can be a Radix `asChild` trigger.
export const CardIcon = forwardRef<SVGSVGElement, CardIconProps>(({ name, ...props }, ref) => (
  <svg ref={ref} aria-hidden="true" {...props}>
    <use href={`#${cardIconSymbolId(name)}`} />
  </svg>
));
CardIcon.displayName = 'CardIcon';
