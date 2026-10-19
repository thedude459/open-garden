/** True when the embed URL answers. Iframe load also fires for an aborted document, which the parent page cannot read. */
export function embedMapReachable(url: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  return fetchFn(url, { mode: 'no-cors', cache: 'no-store' }).then(
    () => true,
    () => false,
  );
}

export function embedMapUrl(latitude: number, longitude: number): string {
  const pad = 0.005;
  const west = longitude - pad;
  const south = latitude - pad;
  const east = longitude + pad;
  const north = latitude + pad;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=mapnik&marker=${latitude},${longitude}`;
}
