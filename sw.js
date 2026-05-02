// ════════════════════════════════════════════════════════════
//  EPPRIDAD Service Worker — PWA Cache & Offline
//  Version 28 — www.eppridad.com
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'eppridad-v28';
const STATIC_CACHE = 'eppridad-static-v28';
const DYNAMIC_CACHE = 'eppridad-dynamic-v28';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/espace-etudiant.html',
  '/cours-etudiant.html',
  '/formations-en-ligne.html',
  '/inscription.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/css/style.css',
  '/css/espace-etudiant.css',
  '/js/supabase.js',
  '/js/espace-etudiant.js',
  '/js/forms.js',
  '/js/main.js',
];

// ── Installation ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS.filter(url => !url.includes('undefined'))))
      .then(() => self.skipWaiting())
      .catch(err => console.log('[SW] Install warning:', err))
  );
});

// ── Activation — nettoyage des anciens caches ──────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch — stratégie Network First avec fallback cache ────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les APIs externes
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.href.includes('fonts.googleapis') && !url.href.includes('fonts.gstatic')) return;

  // Supabase et EmailJS — toujours réseau (pas de cache)
  if (url.href.includes('supabase.co') || url.href.includes('emailjs.com') || url.href.includes('googleapis.com/emailjs')) {
    return;
  }

  event.respondWith(
    // Network First : essayer le réseau en premier
    fetch(request)
      .then(response => {
        // Mettre en cache les ressources statiques valides
        if (response && response.status === 200 && response.type !== 'opaque') {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Réseau indisponible → chercher dans le cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Page offline si rien en cache
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('/espace-etudiant.html');
          }
          return new Response('Hors ligne — EPPRIDAD', { status: 503 });
        });
      })
  );
});

// ── Message handler ───────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
