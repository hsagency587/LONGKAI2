/* Longkai — coda.js: i lavori che hanno bisogno della rete (dettature, conferme, pagamenti).
   Stessa idea di Cantieri: senza rete restano in attesa e ripartono da soli; tre tentativi con attese
   crescenti; un errore di rete non consuma tentativi; un errore di validazione si ferma e lo dice.
   Ogni lavoro porta un lavoro_id: il server non scrive due volte. Gli esecutori si registrano per tipo. */

import { leggiLocale, salvaLocale } from './dati.js';
import { nuovoId } from './base.js';

const ATTESE = [5000, 30000, 120000];
const ESECUTORI = {};
let inCorso = false;
let ascoltatori = [];

export class ErroreRete extends Error { constructor(m) { super(m || 'Manca la rete'); this.name = 'ErroreRete'; } }
export class ErroreConfig extends Error { constructor(m) { super(m || 'Manca una configurazione'); this.name = 'ErroreConfig'; } }
export class ErroreValidazione extends Error { constructor(m) { super(m || 'Dati da correggere'); this.name = 'ErroreValidazione'; } }

export function registraEsecutore(tipo, fn) { ESECUTORI[tipo] = fn; }
export function suCambioCoda(fn) { ascoltatori.push(fn); return () => { ascoltatori = ascoltatori.filter((x) => x !== fn); }; }
function avvisaCambio() { for (const fn of ascoltatori) { try { fn(); } catch { /* niente */ } } }

export function lavori() { return leggiLocale().coda; }

export function accoda(lavoro) {
  const loc = leggiLocale();
  lavoro.id = lavoro.id || nuovoId();
  lavoro.lavoro_id = lavoro.lavoro_id || lavoro.id;
  lavoro.stato = 'in_attesa';
  lavoro.tentativi = 0;
  lavoro.prossimo = 0;
  lavoro.creato = new Date().toISOString();
  loc.coda.push(lavoro);
  salvaLocale(loc);
  avvisaCambio();
  elabora();
  return lavoro;
}

export function riprova(id) {
  const loc = leggiLocale();
  const l = loc.coda.find((x) => x.id === id);
  if (l) { l.stato = 'in_attesa'; l.tentativi = 0; l.prossimo = 0; l.errore = null; salvaLocale(loc); avvisaCambio(); elabora(); }
}

export function scarta(id) {
  const loc = leggiLocale();
  loc.coda = loc.coda.filter((x) => x.id !== id);
  salvaLocale(loc);
  avvisaCambio();
}

export async function elabora() {
  if (inCorso || !navigator.onLine) return;
  inCorso = true;
  try {
    for (;;) {
      const loc = leggiLocale();
      const adesso = Date.now();
      const l = loc.coda.find((x) => x.stato === 'in_attesa' && (x.prossimo || 0) <= adesso);
      if (!l) break;
      l.stato = 'in_corso'; salvaLocale(loc); avvisaCambio();
      try {
        const fn = ESECUTORI[l.tipo];
        if (!fn) throw new ErroreValidazione('Lavoro sconosciuto: ' + l.tipo);
        await fn(l);
        const loc2 = leggiLocale();
        loc2.coda = loc2.coda.filter((x) => x.id !== l.id);
        salvaLocale(loc2);
      } catch (e) {
        const loc2 = leggiLocale();
        const l2 = loc2.coda.find((x) => x.id === l.id);
        if (!l2) continue;
        l2.errore = e.message || String(e);
        if (e.name === 'ErroreRete' || e.name === 'ErroreConfig') {
          l2.stato = 'in_attesa'; l2.prossimo = Date.now() + (e.name === 'ErroreConfig' ? 60000 : 15000);
          salvaLocale(loc2); avvisaCambio();
          break; // senza rete o senza configurazione: inutile insistere adesso
        }
        if (e.name === 'ErroreValidazione') {
          l2.stato = 'fallito'; salvaLocale(loc2); avvisaCambio();
          continue;
        }
        l2.tentativi = (l2.tentativi || 0) + 1;
        if (l2.tentativi >= ATTESE.length) l2.stato = 'fallito';
        else { l2.stato = 'in_attesa'; l2.prossimo = Date.now() + ATTESE[l2.tentativi - 1]; }
        salvaLocale(loc2);
      }
      avvisaCambio();
    }
  } finally {
    inCorso = false;
  }
  const prossimi = leggiLocale().coda.filter((x) => x.stato === 'in_attesa').map((x) => x.prossimo || 0);
  if (prossimi.length) setTimeout(elabora, Math.max(500, Math.min(...prossimi) - Date.now()));
}

export function avviaCoda() {
  addEventListener('online', elabora);
  setInterval(elabora, 60000);
  elabora();
}
