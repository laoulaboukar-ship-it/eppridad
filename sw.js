// EPPRIDAD Service Worker v5 — Full Offline + IA ready
const CACHE = 'eppridad-v5';
const CACHE_IMG = 'eppridad-img-v5';

const CORE = [
  '/index.html', '/ecole.html', '/filieres.html', '/services.html',
  '/admission.html', '/galerie.html', '/contact.html', '/infos.html',
  '/espace-etudiant.html', '/fiche-inscription.html', '/marketplace.html', '/formations-en-ligne.html',
  '/css/style.css', '/css/index.css', '/css/index_0.css',
  '/css/espace-etudiant.css', '/css/infos.css', '/css/contact.css',
  '/css/ecole.css', '/css/filieres.css', '/css/galerie.css',
  '/css/services.css', '/css/fiche-inscription.css',
  '/js/main.js', '/js/forms.js', '/js/supabase.js',
  '/js/espace-etudiant.js', '/js/infos.js', '/js/index.js',
  '/js/chatbot.js', '/js/devis-ia.js',
  '/manifest.json', '/favicon.ico', '/favicon.svg',
  '/favicon-96x96.png', '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png', '/web-app-manifest-512x512.png'
];

const IMGS = [
  '/images/logo.png','/images/campus_gate.jpg','/images/campus_building.jpg',
  '/images/campus_ground.jpg','/images/campus1.jpg','/images/students1.jpg',
  '/images/agri1.jpg','/images/elevage1.jpg','/images/bureau.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then(c => c.addAll(CORE).catch(()=>{})),
      caches.open(CACHE_IMG).then(c => c.addAll(IMGS).catch(()=>{}))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_IMG).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// APIs externes à ne jamais intercepter
const BYPASS = [/api\.anthropic\.com/,/supabase\.co/,/workers\.dev/,/fonts\.google/,/fonts\.gstatic/];

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (BYPASS.some(p => p.test(e.request.url))) return;
  if (url.origin !== location.origin) return;
  if (e.request.destination === 'image') {
    e.respondWith(cacheFirst(e.request, CACHE_IMG)); return;
  }
  if (e.request.destination === 'document') {
    e.respondWith(networkFirst(e.request, CACHE)); return;
  }
  e.respondWith(staleWhileRevalidate(e.request, CACHE));
});

async function cacheFirst(req, name) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try { const res = await fetch(req); if(res.ok)(await caches.open(name)).put(req,res.clone()); return res; }
  catch { return new Response('',{status:408}); }
}
async function networkFirst(req, name) {
  try { const res = await fetch(req); if(res.ok)(await caches.open(name)).put(req,res.clone()); return res; }
  catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match('/index.html');
    return fallback || new Response(
      `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>EPPRIDAD — Hors-ligne</title>
      <style>body{font-family:sans-serif;background:#0a150a;color:#fff;text-align:center;padding:40px}h1{color:#d4af37}a{color:#d4af37}</style></head>
      <body><div style="font-size:48px">🌿</div><h1>EPPRIDAD — Hors-ligne</h1>
      <p>Reconnectez-vous pour accéder à toutes les fonctionnalités.</p><a href="/">Accueil</a></body></html>`,
      {status:200,headers:{'Content-Type':'text/html;charset=utf-8'}}
    );
  }
}
async function staleWhileRevalidate(req, name) {
  const cached = await caches.match(req);
  const fresh = fetch(req).then(res=>{ if(res.ok)caches.open(name).then(c=>c.put(req,res.clone())); return res; }).catch(()=>null);
  return cached || fresh;
}
self.addEventListener('message', e => { if(e.data?.type==='SKIP_WAITING') self.skipWaiting(); });
