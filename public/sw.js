self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Bloom Service Worker activated');
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through
  event.respondWith(fetch(event.request));
});
