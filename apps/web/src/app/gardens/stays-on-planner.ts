/** Same garden's overview or bed view. Anywhere else drops the in-memory plan. */
export function staysOnPlanner(gardenId: string, nextUrl: string): boolean {
  const path = nextUrl.split(/[?#]/)[0] ?? '';
  return path === `/gardens/${gardenId}/layout` || path.startsWith(`/gardens/${gardenId}/layout/`);
}
