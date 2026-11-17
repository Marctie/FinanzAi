/* Service worker di FinanzAI (solo versione web / PWA).
 * - Pagine: prima la rete, se offline la copia in cache (così gli aggiornamenti arrivano subito).
 * - File statici con hash nel nome (js/css/font/icone): prima la cache.
 * - Le chiamate a Supabase non vengono mai messe in cache.
 * Le notifiche push verranno aggiunte qui nella Fase 5.
 */
const CACHE = 'finanzai-v1';
const SCOPE = self.registration.scope;               // es. https://marctie.github.io/FinanzAi/

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll([SCOPE, SCOPE + 'index.html', SCOPE + 'manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !url.href.startsWith(SCOPE)) return;   // Supabase e altri domini: rete diretta

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(SCOPE + 'index.html', copy));
      return res;
    }).catch(() => caches.match(SCOPE + 'index.html')));
    return;
  }

  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
