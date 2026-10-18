/* Longkai — comune/allievi.js
   Logica pura sugli allievi: nome, minorenni, validazione della scheda, filtri dell'elenco, scadenza proposta.
   Provata in test/allievi_test.js. */

import { giorniFra, aggiungiMesi, formattaData } from './date.js';

export const FILTRI = [
  ['tutti', 'Tutti'], ['mortara', 'Mortara'], ['vigevano', 'Vigevano'], ['in_regola', 'In regola'], ['in_scadenza', 'In scadenza'],
  ['scaduti', 'Scaduti'], ['da_pagare', 'Da pagare'], ['da_richiamare', 'Da richiamare'], ['da_completare', 'Da completare'], ['usciti', 'Usciti'],
];

export function nomeCompleto(a) {
  return `${a?.nome || ''} ${a?.cognome || ''}`.trim();
}
export function cognomeNome(a) {
  return `${a?.cognome || ''} ${a?.nome || ''}`.trim();
}

/** Anni compiuti alla data (null se la nascita manca). */
export function eta(nascita, oggi) {
  if (!nascita) return null;
  const [a, m, g] = String(nascita).split('-').map(Number);
  const [a2, m2, g2] = String(oggi).split('-').map(Number);
  let anni = a2 - a;
  if (m2 < m || (m2 === m && g2 < g)) anni -= 1;
  return anni;
}
export function eMinorenne(nascita, oggi) {
  const e = eta(nascita, oggi);
  return e !== null && e < 18;
}

/**
 * Controlla una scheda prima di salvarla. Risponde { errori: { campo: messaggio }, daCompletare }.
 * Il nome è l'unica cosa obbligatoria: il resto manca → la scheda resta "da completare" (nessun promemoria finché è così).
 */
export function validaAllievo(dati, { oggi, tutoreObbligatorio = true } = {}) {
  const errori = {};
  const d = dati || {};
  if (!String(d.nome || '').trim()) errori.nome = 'Il nome serve.';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email).trim())) errori.email = 'Questa email non sembra giusta.';
  if (d.nascita && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.nascita))) errori.nascita = 'La data va scritta per intero.';
  if (d.nascita && oggi && giorniFra(d.nascita, oggi) < 0) errori.nascita = 'Una data di nascita nel futuro?';
  if (d.tutore_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.tutore_email).trim())) errori.tutore_email = 'Questa email non sembra giusta.';
  const minorenne = oggi ? eMinorenne(d.nascita, oggi) : false;
  const mancaTutore = minorenne && tutoreObbligatorio && !String(d.tutore_nome || '').trim();
  const daCompletare = !String(d.cognome || '').trim() || !d.nascita || mancaTutore || Boolean(d.da_completare);
  return { errori, daCompletare, minorenne, mancaTutore };
}

/** Applica un filtro dell'elenco (chip) e la ricerca (già normalizzata da chi chiama). */
export function filtraAllievi(elenco, filtro = 'tutti', normalizzaFn = (x) => String(x || '').toLowerCase(), query = '') {
  const q = normalizzaFn(query);
  let righe = (elenco || []).filter((a) => {
    const uscito = a.stato === 'uscito';
    switch (filtro) {
      case 'usciti': return uscito;
      case 'mortara': return !uscito && /mortara/i.test(a.citta_corsi || a.citta || '');
      case 'vigevano': return !uscito && /vigevano/i.test(a.citta_corsi || a.citta || '');
      case 'in_regola': return !uscito && !(a.da_pagare_cent > 0) && (a.stato_scadenze == null || a.stato_scadenze === 'in_regola');
      case 'in_scadenza': return !uscito && a.stato_scadenze === 'in_scadenza';
      case 'scaduti': return !uscito && a.stato_scadenze === 'scaduta';
      case 'da_pagare': return !uscito && a.da_pagare_cent > 0;
      case 'da_richiamare': return !uscito && Boolean(a.da_richiamare);
      case 'da_completare': return !uscito && Boolean(a.da_completare);
      default: return !uscito;
    }
  });
  if (q) {
    righe = righe.filter((a) => {
      const testi = [nomeCompleto(a), cognomeNome(a), ...(a.soprannomi || [])].map(normalizzaFn);
      return testi.some((t) => t.includes(q));
    });
  }
  return righe.sort((x, y) => cognomeNome(x).localeCompare(cognomeNome(y), 'it'));
}

/** La scadenza proposta per un documento: data + i mesi delle impostazioni (12 per certificato e tesseramento). */
export function scadenzaProposta(tipo, data, impostazioni = {}) {
  const mesi = tipo === 'certificato' ? (impostazioni.certificato_mesi ?? 12) : tipo === 'tesseramento' ? (impostazioni.tesseramento_mesi ?? 12) : null;
  if (!mesi || !data) return null;
  return aggiungiMesi(data, mesi);
}

/** La seconda riga dell'elenco: corsi · stato · cosa manca. */
export function secondaRiga(a) {
  const pezzi = [];
  if (a.corsi) pezzi.push(a.corsi);
  else if (a.citta) pezzi.push(a.citta);
  if (a.stato === 'sospeso') pezzi.push('sospeso');
  if (a.stato === 'uscito') pezzi.push('uscito' + (a.uscito_il ? ' il ' + formattaData(a.uscito_il, 'numerico') : ''));
  if (a.da_completare) pezzi.push('scheda da completare');
  if (a.da_pagare_cent > 0) pezzi.push('da pagare');
  if (a.stato_scadenze === 'scaduta') pezzi.push('scaduto');
  else if (a.stato_scadenze === 'in_scadenza') pezzi.push('in scadenza');
  if (a.da_richiamare) pezzi.push('da richiamare');
  return pezzi.join(' · ');
}

/** Il pallino dell'elenco: rosso se scaduto o da pagare, ambra se in scadenza, verde se a posto, neutro se fuori. */
export function pallinoAllievo(a) {
  if (a.stato === 'uscito') return 'neutro';
  if (a.stato_scadenze === 'scaduta' || a.da_pagare_cent > 0) return 'errore';
  if (a.stato_scadenze === 'in_scadenza' || a.da_richiamare || a.da_completare) return 'attenzione';
  if (a.stato === 'sospeso') return 'info';
  return 'ok';
}
