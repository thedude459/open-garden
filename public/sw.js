const CACHE_NAME = "plant-catalog-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request.url.includes("/api/plants/")) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      if (request.url.includes("/search")) {
        return new Response(
          JSON.stringify({ offline: true, cached_ids_only: true }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Offline" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
