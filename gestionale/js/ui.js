/* Longkai — ui.js: il router, la barra in alto, la navigazione, i fogli, i toast, le strisce. */

import { el, icona, registraPassaggio, AZIONI } from './base.js';
import { soloLettura, leggiLocale, salvaLocale } from './dati.js';

const VOCI = [
  { rotta: 'oggi', nome: 'Oggi', icona: 'oggi' },
  { rotta: 'allievi', nome: 'Allievi', icona: 'allievi' },
  { rotta: 'allenamenti', nome: 'Allenamenti', icona: 'allenamenti' },
  { rotta: 'quote', nome: 'Quote', icona: 'quote' },
  { rotta: 'altro', nome: 'Altro', icona: 'altro' },
];

const VISTE = {};
export function registraVista(rotta, fn) { VISTE[rotta] = fn; }

/* ---------- router: #/oggi, #/allievi/<id> ---------- */
export function leggiRotta() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [rotta, ...resto] = hash.split('/');
  return { rotta: rotta || 'oggi', parametri: resto.filter(Boolean), hash };
}
export function vai(rotta) { location.hash = '#/' + rotta.replace(/^\/+/, ''); }

let generazione = 0;

/** Disegna la vista della rotta corrente. Ogni vista riceve un contenitore suo: se nel frattempo
    si è cambiata schermata, il contenitore vecchio è già fuori dalla pagina e la vista lenta scrive nel vuoto. */
export async function disegna() {
  const { rotta, parametri } = leggiRotta();
  const base = rotta.split('?')[0];
  const vista = VISTE[base] || VISTE['non-trovata'];
  registraPassaggio('vista:' + base);
  const mia = ++generazione;
  const main = document.getElementById('contenuto');
  const box = el('div', { class: 'vista' });
  main.replaceChildren(box);
  document.getElementById('fogli').replaceChildren(); // un foglio aperto non sopravvive al cambio di schermata
  azioneFissa(null); // la bolla dell'azione è della schermata: la rimette chi la vuole
  disegnaNav(base);
  try {
    await vista(box, parametri);
  } catch (e) {
    if (mia !== generazione) return;
    box.replaceChildren(statoErrore(e, () => disegna()));
    console.error('vista', base, e?.codice || e?.name || 'errore');
  }
  if (mia !== generazione) return;
  main.focus({ preventScroll: true });
  const loc = leggiLocale(); loc.ultimaVista = base; salvaLocale(loc);
}

/* ---------- barra in alto ---------- */
export function testata(titolo, { indietro = null, azione = null } = {}) {
  const barra = document.getElementById('barra-alto');
  barra.replaceChildren();
  if (indietro) {
    barra.append(el('button', { class: 'tasto icona', 'aria-label': 'Indietro', onclick: () => (typeof indietro === 'string' ? vai(indietro) : history.back()) }, icona('indietro')));
  } else {
    barra.append(el('img', { class: 'logo', src: 'icone/logo-oro.png', alt: '' }));
  }
  barra.append(el('h1', { testo: titolo }));
  if (azione) barra.append(azione);
  // la rotellina: nelle schermate principali (senza Indietro) porta alle impostazioni
  if (!indietro) barra.append(el('a', { class: 'tasto icona rotellina', href: '#/impostazioni', 'aria-label': 'Impostazioni', title: 'Impostazioni' }, icona('impostazioni')));
}

/* ---------- navigazione ---------- */
function disegnaNav(attiva) {
  const nav = document.getElementById('nav');
  nav.replaceChildren();
  nav.append(el('div', { class: 'marchio' }, [el('img', { src: 'icone/logo-oro.png', alt: '' }), 'Longkai']));
  for (const v of VOCI) {
    const corrente = v.rotta === attiva || (attiva !== 'oggi' && VOCI.every((x) => x.rotta !== attiva) && v.rotta === 'altro');
    const a = el('a', { href: '#/' + v.rotta, class: corrente ? 'attiva' : '', 'aria-current': corrente ? 'page' : null }, [icona(v.icona), el('span', { testo: v.nome })]);
    nav.append(a);
  }
}
export function mostraNav(si) { document.getElementById('nav').classList.toggle('nascosto', !si); document.getElementById('app').classList.toggle('senza-nav', !si); }

/* ---------- la bolla dell'azione principale della schermata (+ Allievo, + Pagamento…), sopra il microfono ---------- */
export function azioneFissa(opzioni) {
  document.getElementById('bolla-azione')?.remove();
  if (!opzioni || soloLettura()) return;
  const { testo, href = null, onclick = null } = opzioni;
  const b = el(href ? 'a' : 'button', { id: 'bolla-azione', class: 'bolla-azione', href, onclick, type: href ? null : 'button', 'data-scrittura': '' }, [icona('piu'), el('span', { testo })]);
  document.body.append(b);
}

/* ---------- la bolla per dettare (solo il Sifu) ---------- */
export function mostraBolla(si, azione) {
  let b = document.getElementById('bolla');
  if (!si) { b?.remove(); return; }
  if (!b) { b = el('button', { id: 'bolla', class: 'bolla', 'aria-label': 'Detta', title: 'Detta' }, icona('microfono')); document.body.append(b); }
  b.onclick = azione;
}

/* ---------- strisce in cima ---------- */
export function striscia(id, testo, { tipo = '', tasto = null } = {}) {
  const box = document.getElementById('strisce');
  togliStriscia(id);
  const s = el('div', { class: 'striscia-avviso ' + tipo, 'data-striscia': id }, [el('span', { testo })]);
  if (tasto) s.append(tasto);
  box.append(s);
}
export function togliStriscia(id) {
  document.querySelectorAll(`[data-striscia="${id}"]`).forEach((x) => x.remove());
}

/* ---------- toast con Annulla ---------- */
let toastTimer = null;
export function toast(testo, { tipo = '', annulla = null, durata = 5000 } = {}) {
  const t = document.getElementById('toast');
  t.className = 'toast ' + tipo;
  // gli errori si annunciano subito ai lettori di schermo, il resto con calma
  t.setAttribute('role', tipo === 'errore' ? 'alert' : 'status');
  t.setAttribute('aria-live', tipo === 'errore' ? 'assertive' : 'polite');
  t.replaceChildren(el('span', { testo }));
  t.classList.toggle('passivo', !annulla); // senza tasto non deve coprire quello che c'è sotto (i tasti di un foglio)
  if (annulla) t.append(el('button', { class: 'tasto', testo: 'Annulla', onclick: () => { annulla(); nascondiToast(); } }));
  requestAnimationFrame(() => t.classList.add('visibile'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(nascondiToast, durata);
}
function nascondiToast() { document.getElementById('toast').classList.remove('visibile'); }
export const avvisa = (testo) => toast(testo, { tipo: 'errore', durata: 6000 });

/* ---------- foglio dal basso e domanda ---------- */
export function apriFoglio(titolo, contenuto, { suChiusura = null } = {}) {
  const sfondo = el('div', { class: 'foglio-sfondo', role: 'dialog', 'aria-modal': 'true', 'aria-label': titolo });
  const foglio = el('div', { class: 'foglio' }, [el('h2', { testo: titolo })]);
  foglio.append(contenuto);
  sfondo.append(foglio);
  const daDoveVenivo = document.activeElement;
  let chiuso = false;
  sfondo.addEventListener('click', (e) => { if (e.target === sfondo) chiudi(); });
  const suTasto = (e) => {
    if (e.key === 'Escape') { chiudi(); return; }
    // il fuoco resta dentro al foglio finché è aperto
    if (e.key === 'Tab') {
      const f = [...foglio.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', suTasto);
  function chiudi() {
    if (chiuso) return;
    chiuso = true;
    sfondo.remove(); document.removeEventListener('keydown', suTasto);
    if (daDoveVenivo && daDoveVenivo.isConnected) daDoveVenivo.focus?.();
    if (suChiusura) suChiusura();
  }
  document.getElementById('fogli').append(sfondo);
  // il fuoco va sul primo comando del foglio
  (foglio.querySelector('input, textarea, select') || foglio.querySelector('button'))?.focus();
  return chiudi;
}
export function chiedi(titolo, testo, opzioni) {
  return new Promise((risolvi) => {
    const box = el('div', {}, [el('p', { testo })]);
    const tasti = el('div', { class: 'tasti' });
    for (const o of opzioni) tasti.append(el('button', { class: 'tasto ' + (o.classe || 'bordo'), testo: o.testo, onclick: () => { risolvi(o.valore); chiudi(); } }));
    box.append(tasti);
    // chiuso con Esc o toccando fuori = nessuna scelta (false), così chi aspetta non resta appeso
    const chiudi = apriFoglio(titolo, box, { suChiusura: () => risolvi(false) });
  });
}

/* ---------- stati ---------- */
export function statoVuoto(testo, azione) {
  const v = el('div', { class: 'vuoto' }, [el('p', { testo })]);
  if (azione) v.append(azione);
  return v;
}
export function statoErrore(e, riprova) {
  const box = el('div', { class: 'stato-errore' }, [el('p', { testo: 'Qualcosa è andato storto.' }), el('p', { class: 'piccolo attenuato', testo: e?.message || String(e) })]);
  if (riprova) box.append(el('button', { class: 'tasto bordo', testo: 'Riprova', onclick: riprova }));
  return box;
}
export function scheletri(n = 3) {
  const box = el('div');
  for (let i = 0; i < n; i++) box.append(el('div', { class: 'scheletro' }));
  return box;
}

/* ---------- sezione a striscia e riga ---------- */
export function sezione(titolo, figli = [], azione = null) {
  const t = el('div', { class: 'sezione-titolo' }, [el('span', { testo: titolo })]);
  if (azione) t.append(azione);
  return el('section', { class: 'sezione' }, [t, ...(Array.isArray(figli) ? figli : [figli])]);
}
export function riga({ principale, secondaria, destra, pallino, href, onclick, scrittura = false }) {
  const cliccabile = Boolean(href || onclick);
  const tag = href ? 'a' : cliccabile ? 'button' : 'div';
  const r = el(tag, { class: 'riga' + (pallino ? '' : ' senza-icona') + (cliccabile ? '' : ' statica'), href, onclick, 'data-scrittura': scrittura || null, type: tag === 'button' ? 'button' : null });
  if (pallino) r.append(el('span', { class: 'pallino ' + pallino }));
  const testo = el('div', {}, [el('div', { class: 'principale', testo: principale })]);
  if (secondaria) testo.append(el('div', { class: 'secondaria', testo: secondaria }));
  r.append(testo);
  const d = el('div', { class: 'destra' });
  if (destra) d.append(el('span', { testo: destra }));
  if (cliccabile) d.append(icona('freccia', 'freccia'));
  r.append(d);
  return r;
}

/* ---------- i tocchi: data-az → AZIONI ---------- */
export function avviaTocchi() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-az]');
    if (!t) return;
    const fn = AZIONI[t.dataset.az];
    if (fn) { e.preventDefault(); registraPassaggio('az:' + t.dataset.az); fn(t, e); }
  });
}

/* ---------- sola lettura ---------- */
export function applicaSolaLettura(forzaNo = false) {
  const si = !forzaNo && soloLettura();
  document.body.classList.toggle('sola-lettura', si);
  if (si) striscia('sola-lettura', 'Sola lettura: vedi quello che vede il Sifu, senza poter modificare.', { tipo: 'blu' });
  else togliStriscia('sola-lettura');
}

/* ---------- tema e testo ---------- */
let ascoltaSistema = false;
export function applicaAspetto({ tema, testo } = {}) {
  if (!ascoltaSistema) {
    // "Come il telefono": se il telefono cambia tema mentre l'app è aperta, l'app lo segue
    ascoltaSistema = true;
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (leggiLocale().tema === 'sistema') applicaAspetto(); });
  }
  const loc = leggiLocale();
  const t = tema || loc.tema || 'scuro';
  const effettivo = t === 'sistema' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'chiaro' : 'scuro') : t;
  document.documentElement.dataset.tema = effettivo;
  document.documentElement.dataset.testo = testo || loc.testo || 'normale';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effettivo === 'chiaro' ? '#f6f3ef' : '#1a1613');
  if (tema || testo) { loc.tema = t; loc.testo = testo || loc.testo; salvaLocale(loc); }
}
