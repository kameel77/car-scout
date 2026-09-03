export function getDeepLinkedOpportunityId(search: string): string | null {
  const opportunityId = new URLSearchParams(search).get('opp')?.trim();
  return opportunityId || null;
}

export function getUrlWithoutOpportunityId(pathname: string, search: string, hash: string): string {
  const searchParams = new URLSearchParams(search);
  searchParams.delete('opp');
  const remainingSearch = searchParams.toString();

  return `${pathname}${remainingSearch ? `?${remainingSearch}` : ''}${hash}`;
}
