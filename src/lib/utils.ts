import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a rental vehicle image URL.
 * Handles legacy data where only the filename was stored (without path prefix).
 *
 * Cases:
 * - Full URL (http/https) → returned as-is (external image)
 * - Path starting with /uploads/ → returned as-is (correct relative path)
 * - Bare filename (e.g. "1775884035510-abc.png") → reconstructed as /uploads/rental-images/{vehicleId}/{filename}
 */
export function normalizeRentalImageUrl(url: string | null | undefined, vehicleId?: string): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return url;
  // Bare filename — reconstruct full path
  if (vehicleId) return `/uploads/rental-images/${vehicleId}/${url}`;
  // No vehicleId, can't reconstruct — return null to show placeholder
  return null;
}
