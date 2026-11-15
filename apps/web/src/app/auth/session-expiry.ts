/**
 * Whether a 401 from this request means the session has ended. Signing in or
 * up with a wrong password also answers 401, and signing out needs no rescue,
 * so those are left to their own pages.
 */
export function endsSession(url: string): boolean {
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
  if (!path.startsWith('/api/')) return false;
  return !/^\/api\/auth\/(login|register|logout)$/.test(path);
}

/**
 * Where to go after signing in again: the page the session ended on, if it is
 * a page of this app. Anything else (another site, the login page itself)
 * goes to Today.
 */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return '/today';
  }
  return url.split('?')[0] === '/login' ? '/today' : url;
}
