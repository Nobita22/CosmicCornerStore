/* ============================================================
   CosmicCorner - minimal service worker
   ------------------------------------------------------------
   This worker exists so /sw.js requests resolve (no more 404s)
   and so the shop behaves like a normal page.

   IMPORTANT: it intentionally has NO fetch handler and caches
   NOTHING. The shop data (products.json) and images (media/) must
   always come fresh from the server after every admin save, so
   nothing here may be cached - network behaviour stays default.
   ============================================================ */

self.addEventListener('install', () => {
  // Activate immediately after install; never wait for old workers.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of open pages right away.
  event.waitUntil(self.clients.claim());
});

// No fetch event listener - every request goes straight to the
// network, exactly as if no service worker were installed. This is
// deliberate so admin edits always show up instantly on refresh.