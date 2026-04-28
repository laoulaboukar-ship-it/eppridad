// EPPRIDAD — Service Worker V28
const CACHE = 'eppridad-v28';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.hostname.includes('supabase.co') || u.hostname.includes('emailjs.com') || u.hostname.includes('wa.me')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
