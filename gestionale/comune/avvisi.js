/* Longkai — comune/avvisi.js
   Quali avvisi creare oggi, senza doppioni, e il testo del riassunto unico per la notifica.
   Logica pura, usata dall'orologio (server) e dall'app. Provata in test/avvisi_test.js. */

import { sogliaDaMandare, chiaveDedup } from './scadenze.js';

export const TIPI = { certificato: 'certificato medico', tesseramento: 'tesseramento', quota: 'quota', da_richiamare: 'da richiamare', cassetta: 'cassetta', pacchetto: 'pacchetto', serale: 'serale', rapporto: 'rapporto' };

function nome(a) { return `${a?.nome || ''} ${a?.cognome || ''}`.trim() || 'un allievo'; }
function dataIt(d) { return String(d || '').split('-').reverse().join('/'); }
function euro(cent) { return `${((Number(cent) || 0) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }

/**
 * Gli avvisi di oggi. Ogni avviso ha una chiave unica: chi la ha già vista (giaMandate) non la rivede.
 * scadenze: [{ id, tipo, data, avvisi_mandati, allievo: { nome, cognome } }]
 * quote: [{ id (addebito), scadenza, residuo_cent, allievo: {...} }]
 * daRichiamare: [{ allievo_id, allievo, lezioni_mancate_di_fila }]
 * cassetta: numero di file da smistare; pacchetti: [{ id (abbonamento), lezioni_rimanenti, allievo }]
 * Risponde { avvisi: [{ chiave, tipo, soglia, testo, allievo_id, scadenza_id, addebito_id }], segnaScadenze: [{ id, soglia }] }.
 */
export function avvisiDaCreare({ oggi, soglie = [30, 15, 7], scadenze = [], quote = [], daRichiamare = [], cassetta = 0, pacchetti = [], giaMandate = new Set(), destinatario = 'sifu' } = {}) {
  const avvisi = [];
  const segnaScadenze = [];
  const settimana = oggi.slice(0, 4) + '-' + settimanaDellAnno(oggi);
  const aggiungi = (a) => { if (giaMandate.has(a.chiave)) return; avvisi.push(a); };
  for (const s of scadenze) {
    const soglia = sogliaDaMandare(s.data, oggi, soglie, s.avvisi_mandati || {});
    if (soglia === null) continue;
    const quando = soglia === 'scaduto' ? `è scaduto il ${dataIt(s.data)}` : soglia === 0 ? 'scade oggi' : `scade fra ${soglia} giorni (${dataIt(s.data)})`;
    aggiungi({ chiave: chiaveDedup(s.id, soglia, 'app', destinatario), tipo: s.tipo, soglia: String(soglia), testo: `Il ${TIPI[s.tipo] || s.tipo} di ${nome(s.allievo)} ${quando}.`, allievo_id: s.allievo_id || s.allievo?.id || null, scadenza_id: s.id, addebito_id: null });
    segnaScadenze.push({ id: s.id, soglia: String(soglia) });
  }
  for (const q of quote) {
    const soglia = sogliaDaMandare(q.scadenza, oggi, soglie, q.avvisi_mandati || {});
    if (soglia === null) continue;
    const quando = soglia === 'scaduto' ? `scaduta il ${dataIt(q.scadenza)}` : soglia === 0 ? 'in scadenza oggi' : `in scadenza fra ${soglia} giorni`;
    aggiungi({ chiave: chiaveDedup('addebito:' + q.id, soglia, 'app', destinatario), tipo: 'quota', soglia: String(soglia), testo: `${nome(q.allievo)}: quota di ${euro(q.residuo_cent)} ${quando}.`, allievo_id: q.allievo_id || q.allievo?.id || null, scadenza_id: null, addebito_id: q.id });
  }
  for (const r of daRichiamare) {
    aggiungi({ chiave: chiaveDedup('richiamo:' + r.allievo_id, settimana, 'app', destinatario), tipo: 'da_richiamare', soglia: null, testo: `${nome(r.allievo)} manca da ${r.lezioni_mancate_di_fila || 3} lezioni: da richiamare.`, allievo_id: r.allievo_id, scadenza_id: null, addebito_id: null });
  }
  if (cassetta > 0) aggiungi({ chiave: chiaveDedup('cassetta', oggi, 'app', destinatario), tipo: 'cassetta', soglia: null, testo: cassetta === 1 ? 'Un file in cassetta da smistare.' : `${cassetta} file in cassetta da smistare.`, allievo_id: null, scadenza_id: null, addebito_id: null });
  for (const p of pacchetti) {
    aggiungi({ chiave: chiaveDedup('pacchetto:' + p.id, String(p.lezioni_rimanenti), 'app', destinatario), tipo: 'pacchetto', soglia: String(p.lezioni_rimanenti), testo: `${nome(p.allievo)}: ${p.lezioni_rimanenti === 0 ? 'pacchetto finito' : 'ultima lezione del pacchetto'}.`, allievo_id: p.allievo_id || p.allievo?.id || null, scadenza_id: null, addebito_id: null });
  }
  return { avvisi, segnaScadenze };
}

/** Il riassunto per l'unica notifica del mattino: "1 certificato in scadenza · 2 quote · 1 da richiamare". Null se non c'è niente. */
export function testoRiassunto(avvisi) {
  if (!avvisi?.length) return null;
  const conta = {};
  for (const a of avvisi) conta[a.tipo] = (conta[a.tipo] || 0) + 1;
  const pezzi = [];
  const scad = (conta.certificato || 0) + (conta.tesseramento || 0);
  if (scad) pezzi.push(scad === 1 ? '1 documento in scadenza' : `${scad} documenti in scadenza`);
  if (conta.quota) pezzi.push(conta.quota === 1 ? '1 quota da incassare' : `${conta.quota} quote da incassare`);
  if (conta.da_richiamare) pezzi.push(conta.da_richiamare === 1 ? '1 allievo da richiamare' : `${conta.da_richiamare} allievi da richiamare`);
  if (conta.cassetta) pezzi.push('file in cassetta');
  if (conta.pacchetto) pezzi.push(conta.pacchetto === 1 ? '1 pacchetto quasi finito' : `${conta.pacchetto} pacchetti quasi finiti`);
  return pezzi.join(' · ');
}

/** Ore di silenzio: niente notifiche fra le 22 e le 7. */
export function oraDiSilenzio(ora, { dalle = 22, alle = 7 } = {}) {
  return ora >= dalle || ora < alle;
}

/** Numero della settimana ISO di una data "AAAA-MM-GG". */
export function settimanaDellAnno(data) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  const giorno = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - giorno);
  const inizio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return String(Math.ceil(((d - inizio) / 86400000 + 1) / 7)).padStart(2, '0');
}
