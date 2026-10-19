// Si riparte da zero: togliamo il vecchio service worker e le sue cache dai telefoni che avevano l'app.
(async function () {
  try {
    if ('serviceWorker' in navigator) {
      const registrazioni = await navigator.serviceWorker.getRegistrations();
      for (const r of registrazioni) await r.unregister();
    }
    if ('caches' in window) {
      const nomi = await caches.keys();
      for (const n of nomi) await caches.delete(n);
    }
  } catch (_) { /* niente da fare */ }
})();
