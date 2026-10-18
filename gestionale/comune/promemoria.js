/* Longkai — comune/promemoria.js
   I promemoria agli allievi mandati con un tocco su WhatsApp: il testo dal modello con {nome} {tipo} {data} {importo}, il link.
   Logica pura. Provata in test/promemoria_test.js. */

export const TESTI_PREDEFINITI = {
  certificato: 'Ciao {nome}, il tuo certificato medico scade il {data}. Porta quello nuovo in palestra. Longkai',
  tesseramento: 'Ciao {nome}, il tuo tesseramento scade il {data}. Rinnoviamolo in palestra. Longkai',
  quota: 'Ciao {nome}, la quota di {importo} per {tipo} è in scadenza il {data}. Longkai',
};

function dataIt(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d).split('-').reverse().join('/') : String(d || ''); }

/** Riempie il modello: {nome} {tipo} {data} {importo}. */
export function messaggioPromemoria(modello, { nome = '', tipo = '', data = '', importo = '' } = {}) {
  return String(modello || '').replace(/\{nome\}/g, nome).replace(/\{tipo\}/g, tipo).replace(/\{data\}/g, dataIt(data)).replace(/\{importo\}/g, importo).replace(/\s{2,}/g, ' ').trim();
}

/** Un numero italiano in formato internazionale senza segni: "333 123 4567" → "393331234567"; null se non è un numero. */
export function numeroWhatsApp(telefono) {
  let t = String(telefono || '').replace(/[^\d+]/g, '');
  if (!t) return null;
  if (t.startsWith('00')) t = '+' + t.slice(2);
  if (t.startsWith('+')) t = t.slice(1);
  else if (t.startsWith('3') && t.length === 10) t = '39' + t;   // cellulare italiano senza prefisso
  else if (t.startsWith('0')) return null;                       // fisso: niente WhatsApp
  return /^\d{10,15}$/.test(t) ? t : null;
}

/** Il link che apre WhatsApp con il messaggio già scritto. Null se il numero non va bene. */
export function linkWhatsApp(telefono, testo) {
  const n = numeroWhatsApp(telefono);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(testo)}`;
}

/** Il link per chiamare. */
export function linkChiama(telefono) {
  const t = String(telefono || '').replace(/[^\d+]/g, '');
  return t ? `tel:${t}` : null;
}
