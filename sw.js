const CACHE='printhub-shell-v6-6';
const ASSETS=['./','./index.html','./styles.css','./config.js?v=0.8.6','./app.js?v=0.8.6','./production.js?v=0.8.6','./shared/passkiosk-receipt-pdf.js?v=0.8.6','./shared/receipt-font-metrics.js','./shared/printer-catalog.js?v=0.8.6','./manifest.webmanifest','./assets/printhub-icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
