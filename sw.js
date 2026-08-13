const CACHE_NAME = "localkart-v2";
const STATIC_ASSETS = ["/", "/app.js", "/styles.css", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) return; // API calls always go to network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});