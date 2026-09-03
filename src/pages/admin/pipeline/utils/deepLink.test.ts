import { describe, expect, it } from 'vitest';
import { getDeepLinkedOpportunityId, getUrlWithoutOpportunityId } from './deepLink';

describe('getDeepLinkedOpportunityId', () => {
  it('returns an opportunity ID from the opp query parameter', () => {
    expect(getDeepLinkedOpportunityId('?opp=opp_982')).toBe('opp_982');
  });

  it('returns null when the opp query parameter is missing or blank', () => {
    expect(getDeepLinkedOpportunityId('?view=queue')).toBeNull();
    expect(getDeepLinkedOpportunityId('?opp=%20%20')).toBeNull();
  });

  it('removes only the opp parameter when a detail modal is closed', () => {
    expect(getUrlWithoutOpportunityId('/admin/pipeline', '?view=queue&opp=opp_982', '#details')).toBe(
      '/admin/pipeline?view=queue#details'
    );
  });
});
