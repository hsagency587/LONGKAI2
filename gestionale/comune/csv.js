/* Longkai — comune/csv.js
   Lettura e scrittura di un CSV semplice (virgola o punto e virgola, virgolette), per importare ed esportare gli allievi.
   Provato in test/csv_test.js. */

/** Divide un testo CSV in righe di celle. Capisce da solo se il separatore è "," o ";". */
export function analizzaCsv(testo) {
  const t = String(testo || '').replace(/^﻿/, '');
  if (!t.trim()) return [];
  const primaRiga = t.split(/\r?\n/)[0];
  const sep = (primaRiga.match(/;/g) || []).length > (primaRiga.match(/,/g) || []).length ? ';' : ',';
  const righe = [];
  let riga = [];
  let cella = '';
  let dentro = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentro) {
      if (c === '"') {
        if (t[i + 1] === '"') { cella += '"'; i++; } else dentro = false;
      } else cella += c;
    } else if (c === '"') dentro = true;
    else if (c === sep) { riga.push(cella); cella = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      riga.push(cella); righe.push(riga); riga = []; cella = '';
    } else cella += c;
  }
  if (cella.length || riga.length) { riga.push(cella); righe.push(riga); }
  return righe.filter((r) => r.some((x) => String(x).trim() !== ''));
}

const INTESTAZIONI = {
  nome: ['nome', 'name', 'first name'], cognome: ['cognome', 'surname', 'last name'], nascita: ['nascita', 'data di nascita', 'nato il', 'data nascita', 'birth'],
  email: ['email', 'e-mail', 'mail'], telefono: ['telefono', 'cellulare', 'cell', 'tel', 'phone'], citta: ['città', 'citta', 'sede', 'city'],
  corso: ['corso', 'corsi'], note: ['note', 'nota'], soprannomi: ['soprannomi', 'soprannome', 'detto'],
  tutore_nome: ['tutore', 'genitore', 'tutore nome'], tutore_telefono: ['telefono tutore', 'tutore telefono', 'tel tutore'], tutore_email: ['email tutore', 'tutore email'],
};

function normalizzaIntestazione(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "12/03/1990", "1990-03-12", "12.3.90" → "1990-03-12"; altrimenti null. */
export function dataIso(testo) {
  const s = String(testo || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    let a = m[3];
    if (a.length === 2) a = (Number(a) > 30 ? '19' : '20') + a;
    return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Dalle righe CSV agli allievi: la prima riga sono le intestazioni (nome, cognome, nascita, email, telefono, città, corso, note…).
 * Risponde { allievi: [...], scartate: n, colonne: [...] }.
 */
export function allieviDaCsv(righe) {
  if (!righe || righe.length < 2) return { allievi: [], scartate: 0, colonne: [] };
  const teste = righe[0].map(normalizzaIntestazione);
  const indice = {};
  for (const [campo, nomi] of Object.entries(INTESTAZIONI)) {
    const i = teste.findIndex((h) => nomi.some((n) => normalizzaIntestazione(n) === h));
    if (i >= 0) indice[campo] = i;
  }
  if (indice.nome == null) return { allievi: [], scartate: righe.length - 1, colonne: Object.keys(indice) };
  const allievi = [];
  let scartate = 0;
  for (const r of righe.slice(1)) {
    const v = (campo) => (indice[campo] == null ? '' : String(r[indice[campo]] ?? '').trim());
    let nome = v('nome');
    let cognome = v('cognome');
    if (!nome) { scartate++; continue; }
    // "Cognome Nome" in una colonna sola: si spezza all'ultimo spazio
    if (!cognome && indice.cognome == null && nome.includes(' ')) { const p = nome.split(/\s+/); cognome = p.pop(); nome = p.join(' '); }
    const a = { nome, cognome, nascita: dataIso(v('nascita')), email: v('email') || null, telefono: v('telefono') || null, citta: v('citta') || null, corso: v('corso') || null, note: v('note') || null,
      soprannomi: v('soprannomi') ? v('soprannomi').split(/[;,]/).map((x) => x.trim()).filter(Boolean) : [],
      tutore_nome: v('tutore_nome') || null, tutore_telefono: v('tutore_telefono') || null, tutore_email: v('tutore_email') || null };
    allievi.push(a);
  }
  return { allievi, scartate, colonne: Object.keys(indice) };
}

/** Esporta gli allievi in CSV (separatore ";", virgolette dove servono), con il BOM per Excel. */
export function csvDaAllievi(allievi) {
  const colonne = ['nome', 'cognome', 'nascita', 'email', 'telefono', 'citta', 'corsi', 'stato', 'soprannomi', 'note'];
  const cella = (x) => { const s = Array.isArray(x) ? x.join(', ') : String(x ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const righe = [colonne.join(';')];
  for (const a of allievi || []) righe.push(colonne.map((c) => cella(a[c])).join(';'));
  return '﻿' + righe.join('\r\n');
}
