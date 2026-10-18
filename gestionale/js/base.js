/* Longkai — base.js: le cose che servono a tutti. h() per il testo, el() per costruire, formati, il registro dei passaggi. */

export const VERSIONE_APP = (globalThis.CONFIG && globalThis.CONFIG.versione) || '0.0.0';

/** Neutralizza il testo per l'HTML: ogni dato passa di qui, sempre. */
export function h(testo) {
  return String(testo ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Costruisce un elemento: el('div', { class: 'riga', 'data-az': 'x' }, [figli o testo]). Il testo va con textContent: mai HTML. */
export function el(tag, attributi = {}, figli = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attributi || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'testo') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of Array.isArray(figli) ? figli : [figli]) {
    if (f == null || f === false) continue;
    e.append(typeof f === 'string' ? document.createTextNode(f) : f);
  }
  return e;
}

/** Icone SVG in linea: venti, tratto 1,75. */
const ICONE = {
  oggi: '<path d="M8 2v3M16 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
  allievi: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  allenamenti: '<path d="M6 4v16M18 4v16M3 8h3M3 16h3M18 8h3M18 16h3M9 12h6"/>',
  quote: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 0 1-5 0M12 6v1.5M12 16.5V18"/>',
  altro: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  microfono: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  freccia: '<path d="M9 6l6 6-6 6"/>',
  indietro: '<path d="M15 6l-6 6 6 6"/>',
  piu: '<path d="M12 5v14M5 12h14"/>',
  meno: '<path d="M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  spunta: '<path d="M5 12l5 5L20 7"/>',
  cerca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  impostazioni: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  documento: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  avviso: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  rapporto: '<path d="M4 20h16M7 16V9M12 16V5M17 16v-4"/>',
  esci: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  rete: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M2 9a14 14 0 0 1 20 0"/>',
  aiuto: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  segnala: '<path d="M12 2a7 7 0 0 0-7 7v3l-2 4h18l-2-4V9a7 7 0 0 0-7-7zM9 20a3 3 0 0 0 6 0"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
export function icona(nome, classe = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (classe) svg.setAttribute('class', classe);
  svg.innerHTML = ICONE[nome] || ICONE.altro; // solo icone nostre, nessun dato
  return svg;
}

/** Centesimi → "60,00 €". */
export function euro(cent) {
  const n = (Number(cent) || 0) / 100;
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

/** Un id per i lavori (idempotenza). */
export function nuovoId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Gli ultimi dieci passaggi fatti nell'app: solo nomi di schermate e azioni, mai dati. Servono a Segnala un problema. */
const PASSAGGI = [];
export function registraPassaggio(cosa) {
  PASSAGGI.push({ t: new Date().toISOString().slice(11, 19), cosa: String(cosa).slice(0, 60) });
  if (PASSAGGI.length > 10) PASSAGGI.shift();
}
export function ultimiPassaggi() { return PASSAGGI.slice(); }

/** Il registro delle azioni dei tocchi (data-az): ogni vista aggiunge le sue. */
export const AZIONI = {};

/** Descrive il dispositivo senza dati personali. */
export function dispositivo() {
  const ua = navigator.userAgent || '';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : 'altro';
  return `${so} · ${screen.width}x${screen.height} · ${matchMedia('(display-mode: standalone)').matches ? 'installata' : 'browser'}`;
}
