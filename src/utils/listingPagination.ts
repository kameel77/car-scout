// wally.com.pl-style page list: only concrete clickable numbers, no ellipsis.
export const buildPages = (current: number, total: number): number[] => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const mid = Math.round((3 + total) / 2);
  const isCurrentInDefaultSet = current <= 3 || current >= total || current === mid;
  const pages = new Set<number>([1, 2, 3, isCurrentInDefaultSet ? mid : current, total]);
  return [...pages].sort((a, b) => a - b);
};
