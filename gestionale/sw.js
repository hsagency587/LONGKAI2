// Service worker "interruttore": sostituisce quello vecchio, svuota le cache e si toglie di mezzo.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(nomi.map((n) => caches.delete(n)));
    await self.registration.unregister();
    const finestre = await self.clients.matchAll({ type: 'window' });
    for (const f of finestre) f.navigate(f.url);
  })());
});
