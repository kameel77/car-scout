/**
 * Reguły kwalifikowalności finansowania per pojazd (decyzja biznesowa 2026-09-25):
 * - leasing: pojazd nie starszy niż 5 lat (liczone od rocznika),
 * - kredyt: bez limitu wieku.
 * Ta sama stała jest w backend/src/services/financing-calc.service.ts.
 */
export const LEASING_MAX_VEHICLE_AGE_YEARS = 5;

export function isLeasingEligibleByAge(productionYear?: number | null, now: Date = new Date()): boolean {
  if (!productionYear) return true;
  return now.getFullYear() - productionYear <= LEASING_MAX_VEHICLE_AGE_YEARS;
}
