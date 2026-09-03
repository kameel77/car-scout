export function getLoginRedirectPath(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  const redirect = `${location.pathname}${location.search}${location.hash}`;
  return `/admin/login?redirect=${encodeURIComponent(redirect)}`;
}

export function getPostLoginRedirectPath(search: string): string {
  const redirect = new URLSearchParams(search).get('redirect');

  if (redirect?.startsWith('/admin/') && !redirect.startsWith('//')) {
    return redirect;
  }

  return '/admin/dashboard';
}
