/* Longkai — comune/scadenze.js
   Soglie, giorni mancanti, chiavi di deduplica degli avvisi, stato di una scadenza.
   Provato in test/scadenze_test.js. */

import { giorniFra } from './date.js';

export const SOGLIE_PREDEFINITE = [30, 15, 7];

/** Giorni che mancano (negativi se è passata). */
export function giorniMancanti(scadenza, oggi) {
  return giorniFra(oggi, scadenza);
}

/** 'in_regola' | 'in_scadenza' | 'scaduta', con la soglia più larga come confine. */
export function statoScadenza(scadenza, oggi, soglie = SOGLIE_PREDEFINITE) {
  const g = giorniMancanti(scadenza, oggi);
  if (g < 0) return 'scaduta';
  if (g <= Math.max(...soglie)) return 'in_scadenza';
  return 'in_regola';
}

/**
 * Quale soglia scatta oggi per una scadenza, considerando quelle già mandate.
 * Risponde la soglia (numero) o 'scaduto' o null se niente da mandare.
 * giaMandate: oggetto { "30": "2026-10-01", "scaduto": "..." }.
 */
export function sogliaDaMandare(scadenza, oggi, soglie = SOGLIE_PREDEFINITE, giaMandate = {}) {
  const g = giorniMancanti(scadenza, oggi);
  if (g < 0) return giaMandate.scaduto ? null : 'scaduto';
  const ordinate = [...soglie].sort((a, b) => a - b); // dalla più stretta
  for (const s of ordinate) {
    // conta solo la soglia più stretta raggiunta: se è già stata mandata, le più larghe non si mandano più
    if (g <= s) return giaMandate[String(s)] ? null : s;
  }
  return null;
}

/** Chiave unica di un avviso: una sola riga per scadenza, soglia, canale e destinatario. */
export function chiaveDedup(scadenzaId, soglia, canale, destinatario) {
  return `${scadenzaId}|${soglia}|${canale}|${destinatario}`;
}

/** Lo stato peggiore fra più scadenze di un allievo: scaduta > in_scadenza > in_regola > nessuna. */
export function statoPeggiore(stati) {
  const ordine = ['scaduta', 'in_scadenza', 'in_regola'];
  for (const s of ordine) if ((stati || []).includes(s)) return s;
  return 'nessuna';
}
