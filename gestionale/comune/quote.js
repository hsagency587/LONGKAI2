/* Longkai — comune/quote.js
   Logica pura delle quote: residuo di un addebito, gruppo di scadenza, totali, la frase del saldo.
   Provata in test/quote_test.js. */

import { primoDelMese, aggiungiMesi } from './date.js';

export const MOTIVI = { abbonamento: 'Abbonamento', extra: 'Lezione in più', privata: 'Privata', tessera: 'Tessera', altro: 'Altro' };
export const METODI = { contanti: 'Contanti', bonifico: 'Bonifico', altro: 'Altro' };

export function residuo(d) {
  return Math.max(0, (Number(d?.importo_cent) || 0) - (Number(d?.sconto_cent) || 0) - (Number(d?.pagato_cent) || 0));
}

/** 'scaduto' | 'questo_mese' | 'prossimo' | 'oltre' | 'senza_data' rispetto a oggi. */
export function gruppoScadenza(scadenza, oggi) {
  if (!scadenza) return 'senza_data';
  if (scadenza < oggi) return 'scaduto';
  const questo = primoDelMese(oggi);
  const prossimo = aggiungiMesi(questo, 1);
  const dopo = aggiungiMesi(questo, 2);
  if (scadenza < prossimo) return 'questo_mese';
  if (scadenza < dopo) return 'prossimo';
  return 'oltre';
}

export const GRUPPI_SCADENZA = [['scaduto', 'Scaduti'], ['questo_mese', 'Questo mese'], ['prossimo', 'Il mese prossimo'], ['oltre', 'Più avanti'], ['senza_data', 'Senza scadenza']];

/** Totali di un elenco di pagamenti: per metodo, per tipo, e il netto (pagamenti meno rimborsi). */
export function totali(pagamenti) {
  const perMetodo = {};
  let incassi = 0; let rimborsi = 0;
  for (const p of pagamenti || []) {
    if (p.annullato_il) continue;
    const segno = p.tipo === 'rimborso' ? -1 : 1;
    perMetodo[p.metodo] = (perMetodo[p.metodo] || 0) + segno * (Number(p.importo_cent) || 0);
    if (segno > 0) incassi += Number(p.importo_cent) || 0; else rimborsi += Number(p.importo_cent) || 0;
  }
  return { perMetodo, incassi, rimborsi, netto: incassi - rimborsi };
}

/** La frase del saldo di un allievo: "Da pagare …", "In regola fino al …", "Credito …". */
export function fraseSaldo(s, formattaEuro, formattaData) {
  const d = s || {};
  if (d.da_pagare_cent > 0) return { testo: `Da pagare: ${formattaEuro(d.da_pagare_cent)}`, tono: 'errore' };
  if (d.credito_cent > 0 && !(d.in_arrivo_cent > 0)) return { testo: `Credito: ${formattaEuro(d.credito_cent)}`, tono: 'ok' };
  if (d.coperto_fino_al) return { testo: `In regola fino al ${formattaData(d.coperto_fino_al)}`, tono: 'ok' };
  if (d.in_arrivo_cent > 0) return { testo: `In regola · in arrivo ${formattaEuro(d.in_arrivo_cent)}`, tono: 'ok' };
  return { testo: 'Nessuna quota aperta', tono: 'neutro' };
}

/** Da "60", "60,50", "60.5" a centesimi; null se non è un numero. */
export function centesimiDa(testo) {
  const t = String(testo ?? '').trim().replace(/€/g, '').replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
