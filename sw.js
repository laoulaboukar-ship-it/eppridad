// EPPRIDAD Service Worker v1.0
const CACHE_STATIC = 'eppridad-static-v3';
const CACHE_IMG    = 'eppridad-images-v3';

const CORE = [
  '/index.html', '/ecole.html', '/filieres.html', '/services.html',
  '/admission.html', '/galerie.html', '/contact.html', '/infos.html',
  '/espace-etudiant.html', '/fiche-inscription.html',
  '/css/style.css', '/js/main.js', '/js/forms.js',
  '/manifest.json', '/favicon.ico', '/favicon.svg',
  '/favicon-96x96.png', '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png', '/web-app-manifest-512x512.png'
];

const IMGS = [
  '/images/logo.png','/images/campus_building.jpg','/images/campus_gate.jpg',
  '/images/campus1.jpg','/images/campus_ground.jpg','/images/campus_office.jpg',
  '/images/agri1.jpg','/images/agri2.jpg','/images/agri3.jpg',
  '/images/elevage1.jpg','/images/elevage2.jpg','/images/bureau.jpg',
  '/images/formation1.jpg','/images/formation2.jpg','/images/formation3.jpg',
  '/images/sport_club.jpg','/images/students1.jpg','/images/students2.jpg',
  '/images/promotion.jpg','/images/terrain1.jpg',
  '/images/filiere_agriculture.jpg','/images/filiere_agroalimentaire.jpg',
  '/images/filiere_elevage.jpg','/images/filiere_environnement.jpg',
  '/images/filiere_genie.jpg','/images/filiere_socioeconomie.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then(c => c.addAll(CORE)),
      caches.open(CACHE_IMG).then(c => c.addAll(IMGS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_IMG).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.destination === 'image') {
    e.respondWith(cacheFirst(request, CACHE_IMG)); return;
  }
  if (request.destination === 'document') {
    e.respondWith(networkFirst(request, CACHE_STATIC)); return;
  }
  e.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
});

async function cacheFirst(req, name) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch { return new Response('', { status: 408 }); }
}

async function networkFirst(req, name) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || caches.match('/index.html');
  }
}

async function staleWhileRevalidate(req, name) {
  const cached = await caches.match(req);
  const fresh = fetch(req).then(res => {
    if (res.ok) caches.open(name).then(c => c.put(req, res.clone()));
    return res;
  }).catch(() => null);
  return cached || fresh;
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
