/* Service worker di FinanzAI (solo versione web / PWA).
 * - Pagine: prima la rete, se offline la copia in cache (così gli aggiornamenti arrivano subito).
 * - File statici con hash nel nome (js/css/font/icone): prima la cache.
 * - Le chiamate a Supabase non vengono mai messe in cache.
 * - Notifiche push (Web Push / VAPID) inviate dalle Edge Functions: su iPhone solo con l'app nella schermata Home.
 */
const CACHE = 'finanzai-v2';
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

// ── Notifiche push ───────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'FinanzAI';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    tag: data.tag || undefined,
    icon: SCOPE + 'assets/icons/icon-192.png',
    badge: SCOPE + 'assets/icons/icon-192.png',
    data: { url: SCOPE + (data.route ? data.route.replace(/^\//, '') : '') },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(SCOPE)) { await c.focus(); if ('navigate' in c) await c.navigate(url).catch(() => undefined); return; }
    }
    await self.clients.openWindow(url);
  })());
});
