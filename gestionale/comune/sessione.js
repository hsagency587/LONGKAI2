/* Longkai — comune/sessione.js
   Logica pura della sessione: i dati da mandare a conferma_sessione dallo stato del modulo, le forme "attive",
   il previsto proposto dal mese, i conti della giornata. Provata in test/sessione_test.js. */

import { giorniFra } from './date.js';

/** Dallo stato del modulo "A mano" ai dati che conferma_sessione si aspetta. Solo quello che c'è davvero. */
export function datiPerConferma(stato) {
  const s = stato || {};
  const dati = {
    presenze: (s.presenti || []).filter((p) => p.presente !== false).map((p) => ({ allievo_id: p.allievo_id, minuti: p.minuti, tipo: p.tipo || 'normale', origine: 'mano' })),
  };
  if ((s.gruppo?.argomenti || []).length || (s.gruppo?.nota || '').trim()) dati.gruppo = { argomenti: s.gruppo.argomenti || [], nota: (s.gruppo.nota || '').trim() || null };
  const singoli = (s.singoli || []).filter((x) => (x.argomenti || []).length || (x.nota || '').trim() || (x.osservazione || '').trim())
    .map((x) => ({ allievo_id: x.allievo_id, argomenti: x.argomenti || [], nota: (x.nota || '').trim() || null, osservazione: (x.osservazione || '').trim() || null }));
  if (singoli.length) dati.singoli = singoli;
  const forme = (s.forme || []).filter((f) => f.allievo_id && f.forma_id).map((f) => ({ allievo_id: f.allievo_id, forma_id: f.forma_id, stato: f.stato || 'in_apprendimento', sezione: Number(f.sezione) || 0 }));
  if (forme.length) dati.forme = forme;
  const pagamenti = (s.pagamenti || []).filter((p) => p.allievo_id && p.importo_cent > 0).map((p) => ({ allievo_id: p.allievo_id, importo_cent: Math.round(p.importo_cent), metodo: p.metodo || 'contanti', nota: (p.nota || '').trim() || null }));
  if (pagamenti.length) dati.pagamenti = pagamenti;
  if (s.prossima_volta && ((s.prossima_volta.argomenti || []).length || (s.prossima_volta.nota || '').trim())) dati.prossima_volta = { argomenti: s.prossima_volta.argomenti || [], nota: (s.prossima_volta.nota || '').trim() || null };
  if ((s.nota || '').trim()) dati.nota = s.nota.trim();
  return dati;
}

/** Le forme su cui un allievo sta lavorando adesso: in apprendimento o in rifinitura, o toccate negli ultimi N giorni. */
export function formeAttive(forme, oggi, giorni = 60) {
  return (forme || []).filter((f) => f.stato === 'in_apprendimento' || f.stato === 'in_rifinitura' || (f.ultima_volta && giorniFra(f.ultima_volta, oggi) <= giorni));
}

/** Le tacche di una forma: quante sezioni ha e quante sono fatte. */
export function tacche(forma) {
  const n = Array.isArray(forma?.sezioni) ? forma.sezioni.length : 0;
  const fatte = forma?.stato === 'completa' || forma?.stato === 'in_rifinitura' ? n : Math.min(Number(forma?.sezione) || 0, n);
  return { totale: n, fatte, corrente: forma?.stato === 'in_apprendimento' && fatte < n ? fatte + 1 : null };
}

export const STATI_FORMA = { non_iniziata: 'Non iniziata', in_apprendimento: 'In apprendimento', completa: 'Completa', in_rifinitura: 'In rifinitura' };
export function etichettaForma(forma) {
  const t = tacche(forma);
  if (forma.stato === 'in_apprendimento') return t.totale ? `In apprendimento: sezione ${Math.min(t.fatte + 1, t.totale)} di ${t.totale}` : 'In apprendimento';
  return STATI_FORMA[forma.stato] || forma.stato;
}

/** Il previsto di una sessione quando non c'è un programma suo: gli argomenti del mese non ancora fatti, in ordine. */
export function previstoDalMese(programmaMese, massimo = 4) {
  return (programmaMese?.argomenti || []).filter((a) => !a.fatto_il).sort((a, b) => (a.ordine || 0) - (b.ordine || 0)).slice(0, massimo).map((a) => a.argomento_id);
}

/** La copertura di un'area: quanti argomenti dell'area sono stati fatti almeno una volta. */
export function copertura(argomentiArea, progressi) {
  const fatti = new Set((progressi || []).map((p) => p.argomento_id));
  const totale = (argomentiArea || []).length;
  const n = (argomentiArea || []).filter((a) => fatti.has(a.id)).length;
  return { totale, fatti: n, quota: totale ? n / totale : 0 };
}

/** I conti della giornata: cosa resta da confermare e se si può chiudere. */
export function statoGiornata(sessioni) {
  const s = sessioni || [];
  const daFare = s.filter((x) => x.stato === 'prevista');
  const fatte = s.filter((x) => x.stato === 'fatta');
  const saltate = s.filter((x) => x.stato === 'saltata');
  return { daFare: daFare.length, fatte: fatte.length, saltate: saltate.length, chiudibile: s.length > 0 && daFare.length === 0 };
}

/** Minuti di presenza: tra 30 e 360, a passi di 30. */
export function minutiValidi(m, durata) {
  const n = Number(m);
  if (!n || n < 30) return Math.max(30, Math.min(360, Math.round((durata || 60) / 30) * 30));
  return Math.max(30, Math.min(360, Math.round(n / 30) * 30));
}
