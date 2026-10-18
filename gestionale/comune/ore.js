/* Longkai — comune/ore.js
   Le durate sono minuti interi. Qui si convertono, si arrotondano e si sommano.
   Provato in test/ore_test.js. */

export const PASSO_MINUTI = 30;
export const MINUTI_MINIMI = 30;
export const MINUTI_MASSIMI = 6 * 60;

/** Da "1 h 30", "1,5", "90 min", "un'ora e mezza" a minuti. Risponde null se non capisce. */
export function minutiDa(testo) {
  if (typeof testo === 'number') return arrotonda(testo);
  let t = String(testo || '').toLowerCase().trim();
  if (!t) return null;
  t = t.replace(/un'ora|un ora|unora/g, '1 ora').replace(/mezz'ora|mezzora|mezza ora/g, '30 minuti').replace(/e mezza|e mezzo/g, '30 minuti');
  t = t.replace(',', '.');
  let minuti = 0;
  let trovato = false;
  const ore = t.match(/(\d+(?:\.\d+)?)\s*(?:h|ore|ora)(?![a-z])/);
  if (ore) { minuti += Math.round(parseFloat(ore[1]) * 60); trovato = true; }
  const min = t.match(/(\d+)\s*(?:min|minuti|minuto)(?![a-z])/);
  if (min) { minuti += parseInt(min[1], 10); trovato = true; }
  else if (ore) {
    // "1 h 30": il numero dopo le ore sono minuti
    const dopo = t.slice(ore.index + ore[0].length).match(/^\s*(?:e\s*)?(\d{1,2})\b/);
    if (dopo) minuti += parseInt(dopo[1], 10);
  }
  if (!trovato) {
    const solo = t.match(/^(\d+(?:\.\d+)?)$/);
    if (solo) { const n = parseFloat(solo[1]); minuti = n <= 8 ? Math.round(n * 60) : Math.round(n); trovato = true; }
  }
  if (!trovato) return null;
  return arrotonda(minuti);
}

/** Arrotonda al passo di mezz'ora e tiene dentro i limiti. */
export function arrotonda(minuti) {
  if (minuti == null || isNaN(minuti)) return null;
  let m = Math.round(minuti / PASSO_MINUTI) * PASSO_MINUTI;
  if (m < MINUTI_MINIMI) m = MINUTI_MINIMI;
  if (m > MINUTI_MASSIMI) m = MINUTI_MASSIMI;
  return m;
}

/** Da minuti a "1 h", "1 h 30", "45 min". */
export function formattaMinuti(minuti) {
  const m = Number(minuti) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} h ${r}`;
  if (h) return `${h} h`;
  return `${r} min`;
}

/** Somma i minuti di un elenco di presenze [{ minuti }]. */
export function sommaMinuti(presenze) {
  return (presenze || []).reduce((tot, p) => tot + (Number(p.minuti) || 0), 0);
}

/**
 * Decide le presenze di una sessione dalle parole del Sifu, già riordinate.
 * attesi: [id]; detti: { tutti, mancanti: [id], presenti: [{ id, minuti }], extra: [{ id, minuti }] }
 * durataCorso: minuti. Risponde [{ allievo_id, minuti, tipo }].
 */
export function presenzeDa(attesi, detti, durataCorso, iscrittiAlCorso) {
  const iscritti = new Set(iscrittiAlCorso || attesi || []);
  const mappa = new Map();
  const d = detti || {};
  if (d.tutti) for (const id of attesi || []) mappa.set(id, { allievo_id: id, minuti: durataCorso, tipo: 'normale' });
  for (const p of d.presenti || []) mappa.set(p.id, { allievo_id: p.id, minuti: p.minuti ?? durataCorso, tipo: iscritti.has(p.id) ? 'normale' : 'extra' });
  for (const p of d.extra || []) mappa.set(p.id, { allievo_id: p.id, minuti: p.minuti ?? durataCorso, tipo: iscritti.has(p.id) ? 'normale' : 'extra' });
  for (const id of d.mancanti || []) mappa.delete(id);
  return Array.from(mappa.values()).map((p) => ({ ...p, minuti: arrotonda(p.minuti) }));
}
