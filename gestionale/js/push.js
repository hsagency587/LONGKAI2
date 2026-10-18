/* Longkai — push.js: le notifiche sul telefono. Poche e mirate (le manda l'orologio: una al mattino solo se c'è
   qualcosa di nuovo, una la sera solo se la lezione è ancora aperta, il giorno 1 il rapporto; mai fra le 22 e le 7).
   L'iscrizione è per telefono: si accende e si spegne da Impostazioni → Scadenze e avvisi. */
import { iscriviPush, togliPush } from './dati.js';

export function pushSupportato() {
  return 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;
}

/** Su iPhone le notifiche funzionano solo con l'app aggiunta alla schermata Home. */
export function iphoneNonInstallata() {
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installata = globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return iphone && !installata;
}

/** 'non_supportato' | 'negato' | 'attivo' | 'spento' */
export async function statoPush() {
  if (!pushSupportato()) return 'non_supportato';
  if (Notification.permission === 'denied') return 'negato';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'attivo' : 'spento';
  } catch { return 'spento'; }
}

function chiaveDaBase64(b64) {
  const riempita = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const s = atob(riempita.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Chiede il permesso (solo da un tocco dell'utente), iscrive il telefono e lo registra sul server. */
export async function attivaPush() {
  if (!pushSupportato()) {
    throw new Error(iphoneNonInstallata()
      ? 'Su iPhone prima aggiungi l\'app alla schermata Home (Condividi → Aggiungi alla schermata Home), poi attiva le notifiche da lì.'
      : 'Questo browser non ha le notifiche.');
  }
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') throw new Error('Notifiche non permesse. Si riattivano dalle impostazioni del telefono, alla voce di questo sito.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveDaBase64(globalThis.CONFIG?.vapidPublicKey || '') });
  await iscriviPush(sub);
  return sub;
}

/** Toglie l'iscrizione di questo telefono (il server non lo raggiunge più). */
export async function disattivaPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await togliPush(endpoint).catch(() => { /* già tolto dal server */ });
}

/** All'avvio: se il telefono è già iscritto, il server lo risa (dopo un cambio di account o un endpoint rinnovato). */
export async function sincronizzaPush() {
  if (!pushSupportato() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await iscriviPush(sub);
  } catch { /* senza rete o senza sessione: alla prossima */ }
}

/** Il numerino sull'icona dell'app (dove il telefono lo permette). */
export async function aggiornaBadge(n) {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (n > 0) await navigator.setAppBadge(n); else await navigator.clearAppBadge();
  } catch { /* niente */ }
}
