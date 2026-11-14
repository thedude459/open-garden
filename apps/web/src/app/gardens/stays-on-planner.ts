/**
 * Same garden's overview, bed view, or transplants. Transplants are part of the
 * planner (ADR 0010): create/delete waiting rows there, then place them in Bed View.
 */
export function staysOnPlanner(gardenId: string, nextUrl: string): boolean {
  const path = nextUrl.split(/[?#]/)[0] ?? '';
  return (
    path === `/gardens/${gardenId}/layout` ||
    path.startsWith(`/gardens/${gardenId}/layout/`) ||
    path === `/gardens/${gardenId}/transplants`
  );
}
