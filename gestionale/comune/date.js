/* Longkai — comune/date.js
   Tutto in Europe/Rome. Le date sono stringhe "AAAA-MM-GG"; gli istanti sono Date.
   Provato in test/date_test.js. */

export const FUSO = 'Europe/Rome';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Le parti di un istante viste da Roma: { anno, mese, giorno, ora, minuto, giornoSettimana (1 = lunedì … 7 = domenica) }. */
export function partiRoma(istante = new Date()) {
  const f = new Intl.DateTimeFormat('it-IT', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  const p = {};
  for (const x of f.formatToParts(istante)) p[x.type] = x.value;
  const brevi = { 'dom': 7, 'lun': 1, 'mar': 2, 'mer': 3, 'gio': 4, 'ven': 5, 'sab': 6 };
  return {
    anno: +p.year, mese: +p.month, giorno: +p.day, ora: +p.hour % 24, minuto: +p.minute,
    giornoSettimana: brevi[String(p.weekday || '').toLowerCase().slice(0, 3)] || 0,
  };
}

/** "AAAA-MM-GG" di oggi a Roma. */
export function oggiRoma(istante = new Date()) {
  const p = partiRoma(istante);
  return `${p.anno}-${String(p.mese).padStart(2, '0')}-${String(p.giorno).padStart(2, '0')}`;
}

/** Giorno della settimana (1 = lunedì … 7 = domenica) di una data "AAAA-MM-GG". */
export function giornoSettimana(data) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g, 12));
  const js = d.getUTCDay(); // 0 = domenica
  return js === 0 ? 7 : js;
}

/** Somma giorni a una data "AAAA-MM-GG". */
export function aggiungiGiorni(data, giorni) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g + giorni, 12));
  return d.toISOString().slice(0, 10);
}

/** Somma mesi a una data (per le scadenze: certificato a 12 mesi). Il 31 diventa l'ultimo del mese. */
export function aggiungiMesi(data, mesi) {
  const [a, m, g] = String(data).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mesi, 1, 12));
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).getUTCDate();
  d.setUTCDate(Math.min(g, ultimo));
  return d.toISOString().slice(0, 10);
}

/** Giorni fra due date (b - a). */
export function giorniFra(a, b) {
  const [a1, m1, g1] = String(a).split('-').map(Number);
  const [a2, m2, g2] = String(b).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, g2) - Date.UTC(a1, m1 - 1, g1)) / 86400000);
}

/** Il primo giorno del mese di una data. */
export function primoDelMese(data) {
  return String(data).slice(0, 7) + '-01';
}

/** "Sabato 18 ottobre" / "sab 18 ott" / "18/10/2026". */
export function formattaData(data, stile = 'esteso') {
  const [a, m, g] = String(data).split('-').map(Number);
  const gs = giornoSettimana(data);
  if (stile === 'breve') return `${GIORNI_BREVI[gs % 7]} ${g} ${MESI[m - 1].slice(0, 3)}`;
  if (stile === 'numerico') return `${String(g).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  const nome = GIORNI[gs % 7];
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${g} ${MESI[m - 1]}`;
}

/** "Ottobre 2026". */
export function formattaMese(data) {
  const [a, m] = String(data).split('-').map(Number);
  const n = MESI[m - 1];
  return `${n[0].toUpperCase()}${n.slice(1)} ${a}`;
}

/** "fra 6 giorni", "oggi", "ieri", "3 giorni fa". */
export function relativa(data, oggi = oggiRoma()) {
  const d = giorniFra(oggi, data);
  if (d === 0) return 'oggi';
  if (d === 1) return 'domani';
  if (d === -1) return 'ieri';
  if (d > 1) return `fra ${d} giorni`;
  return `${-d} giorni fa`;
}

/** "19:00" da "19:00:00" o da minuti dalla mezzanotte. */
export function formattaOra(ora) {
  if (typeof ora === 'number') return `${String(Math.floor(ora / 60)).padStart(2, '0')}:${String(ora % 60).padStart(2, '0')}`;
  return String(ora || '').slice(0, 5);
}
