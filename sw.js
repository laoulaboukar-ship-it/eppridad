/* Kassan'Mou SW v59 */
var CACHE = 'km-v59';
var PRECACHE = ['/kassanmou/', '/kassanmou/index.html', '/kassanmou/manifest.json'];
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(PRECACHE).catch(function(){return;});}));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
    .then(function(){return self.clients.matchAll({type:'window'});})
    .then(function(clients){clients.forEach(function(cl){cl.navigate(cl.url);});})
  );
});
self.addEventListener('fetch', function(e) {
  if(e.request.method!=='GET') return;
  var u=new URL(e.request.url);
  if(u.hostname.includes('supabase.co')||u.hostname.includes('emailjs.com')||
     u.hostname.includes('jsdelivr.net')||u.hostname.includes('fonts.g')||
     u.hostname.includes('wa.me')) return;
  e.respondWith(fetch(e.request).then(function(r){
    if(r&&r.status===200){caches.open(CACHE).then(function(ca){ca.put(e.request,r.clone());});}
    return r;
  }).catch(function(){return caches.match(e.request).then(function(cached){return cached||caches.match('/kassanmou/');});}));
});
console.log('[KM-SW] v59 actif');
