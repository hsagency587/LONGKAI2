/* Lòngkai — service worker
   Tiene i file dell'app per aprirla senza rete. Il numero di versione lo scrive l'azione di rilascio
   al posto di 2026-10-22-9096736; in locale resta così e la cache si chiama "locale".
   Niente di Supabase va in cache: una risposta vecchia sarebbe un errore silenzioso. */
const VERSIONE = '2026-10-22-9096736';
const LOCALE = VERSIONE.startsWith('__');
const CACHE = 'longkai|' + (LOCALE ? 'locale' : VERSIONE) + '|' + self.registration.scope;

const FILE_BASE = [
  './', './index.html', './stile.css', './config.js', './manifest.webmanifest',
  './vendor/supabase.js',
  './font/atkinson-400.woff2', './font/atkinson-700.woff2', './font/cinzel.woff2', './font/cinzel-ext.woff2',
  './icone/logo.png', './icone/anello.png', './icone/icon-192.png', './icone/icon-512.png', './icone/favicon-32.png', './icone/apple-touch-icon.png',
  './js/app.js', './js/dati.js', './js/voce.js', './js/push.js', './comune/regole.js',
  './password.html', './js/password.js',
];

const NON_TOCCARE = ['supabase.co', 'supabase.in'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // cache: 'reload' salta la cache HTTP del browser: una versione nuova non deve incollarsi file vecchi
    caches.open(CACHE).then((cache) => Promise.all(FILE_BASE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => null)))),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE && k.startsWith('longkai|')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'AGGIORNA') self.skipWaiting();
});

/* Le notifiche push: poche, con un tag per tipo (una nuova sostituisce la precedente dello stesso tipo); il tocco apre la schermata giusta. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titolo || 'Lòngkai', {
    body: d.corpo || '', icon: './icone/icon-192.png', badge: './icone/icon-192.png', tag: d.tag || 'longkai', renotify: false, data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((finestre) => {
    for (const f of finestre) { if (f.url.startsWith(self.registration.scope)) { if (f.navigate) f.navigate(url); return f.focus(); } }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (NON_TOCCARE.some((d) => url.hostname.endsWith(d))) return;
  if (url.origin !== location.origin) return;
  // versione.json si legge sempre dalla rete: serve a sapere se c'è una versione nuova
  if (url.pathname.endsWith('/versione.json')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (LOCALE) {
    // in locale (sviluppo) prima la rete, così le modifiche si vedono subito; la cache serve solo senza rete
    e.respondWith(
      fetch(e.request).then((risposta) => {
        if (risposta.ok && e.request.mode !== 'navigate') { const copia = risposta.clone(); caches.open(CACHE).then((cache) => cache.put(e.request, copia)); }
        return risposta;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((c) => c || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((inCache) => {
      if (inCache) return inCache;
      return fetch(e.request).then((risposta) => {
        if (risposta.ok && e.request.mode !== 'navigate') {
          const copia = risposta.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copia));
        }
        return risposta;
      }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    }),
  );
});
