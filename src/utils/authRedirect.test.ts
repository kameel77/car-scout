import { describe, expect, it } from 'vitest';
import { getLoginRedirectPath, getPostLoginRedirectPath } from './authRedirect';

describe('admin login redirect helpers', () => {
  it('preserves the protected pipeline deep link as an internal redirect', () => {
    expect(
      getLoginRedirectPath({
        pathname: '/admin/pipeline',
        search: '?opp=opp_982',
        hash: '',
      })
    ).toBe('/admin/login?redirect=%2Fadmin%2Fpipeline%3Fopp%3Dopp_982');
  });

  it('returns only safe internal admin redirects after login', () => {
    expect(getPostLoginRedirectPath('?redirect=%2Fadmin%2Fpipeline%3Fopp%3Dopp_982')).toBe(
      '/admin/pipeline?opp=opp_982'
    );
    expect(getPostLoginRedirectPath('?redirect=https%3A%2F%2Fevil.example')).toBe('/admin/dashboard');
  });
});
