/* Longkai — comune/fonetica.js
   Come l'app riconosce le parole del Sifu: "bon sao" → Bong Sao, "fac sao" → Fak Sao.
   Logica pura, usata dall'app (revisione, ricerca) e dal server (validazione).
   Nessuna dipendenza. Provata in test/fonetica_test.js. */

/** Normalizza una parola o una frase per il confronto fonetico. */
export function normalizza(testo) {
  let t = String(testo || '').toLowerCase();
  // accenti via
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  // solo lettere e numeri, niente spazi, trattini, apostrofi
  t = t.replace(/[^a-z0-9]+/g, ' ').trim();
  // parola per parola
  t = t.split(' ').map(normalizzaParola).join('');
  return t;
}

function normalizzaParola(p) {
  if (!p) return '';
  let w = p;
  // grafie equivalenti del cantonese romanizzato
  w = w.replace(/sau$|sou$|sao$/, 'sao');          // sau / sou / sao → sao
  // c/ch/ci/q → k: "chum" = "cium" = "kum"; "fac" = "fak"
  w = w.replace(/ch/g, 'k').replace(/ci(?=[aou])/g, 'k').replace(/c/g, 'k').replace(/kk/g, 'k').replace(/qu/g, 'k').replace(/q/g, 'k');
  w = w.replace(/ph/g, 'f');
  w = w.replace(/y/g, 'i').replace(/j/g, 'g');     // "biu jee" / "biu gi"
  w = w.replace(/w/g, 'u');                        // "wu sao" / "u sao"
  w = w.replace(/h(?=[^aeiou]|$)/g, '');           // h muta davanti a consonante o in fine
  w = w.replace(/([aeiou])\1+/g, '$1');            // doppie vocali: fook → fok, taan → tan
  w = w.replace(/([^aeiou])\1+/g, '$1');           // doppie consonanti
  w = w.replace(/ng$/, 'n');                       // g finale: bong → bon
  w = w.replace(/(ao|au)$/, 'ao');
  return w;
}

/** Distanza di Levenshtein fra due stringhe (numero di lettere da cambiare). */
export function distanza(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + costo);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Tolleranza: quante lettere possono differire, in base alla lunghezza. */
function tolleranza(lunghezza) {
  if (lunghezza <= 4) return 1;
  if (lunghezza <= 8) return 2;
  return 3;
}

/**
 * Cerca la voce più vicina a `sentito` fra le `voci`.
 * Ogni voce: { id, nome, sinonimi: [], pronunce: [] } (sinonimi e pronunce facoltativi).
 * Risponde { voce, punteggio, forma } oppure null se nessuna è abbastanza vicina.
 * punteggio: 0 = identico dopo la normalizzazione; più alto = più lontano.
 */
export function trovaMigliore(sentito, voci) {
  const s = normalizza(sentito);
  if (!s) return null;
  let migliore = null;
  for (const voce of voci || []) {
    const forme = [voce.nome, ...(voce.sinonimi || []), ...(voce.pronunce || [])].filter(Boolean);
    for (const forma of forme) {
      const f = normalizza(forma);
      if (!f) continue;
      let d;
      if (f === s) d = 0;
      else if (f.startsWith(s) || s.startsWith(f)) d = Math.min(1, Math.abs(f.length - s.length)); // "tan" per "tansao"
      else d = distanza(s, f);
      if (d > tolleranza(Math.max(s.length, f.length))) continue;
      if (!migliore || d < migliore.punteggio || (d === migliore.punteggio && f.length > normalizza(migliore.forma).length)) {
        migliore = { voce, punteggio: d, forma };
      }
    }
  }
  return migliore;
}

/**
 * Tutte le voci abbastanza vicine, dalla più vicina. Serve per "quale?" quando ce n'è più d'una.
 * Risponde [{ voce, punteggio, forma }].
 */
export function trovaCandidati(sentito, voci, massimo = 3) {
  const s = normalizza(sentito);
  if (!s) return [];
  const trovati = new Map();
  for (const voce of voci || []) {
    const forme = [voce.nome, ...(voce.sinonimi || []), ...(voce.pronunce || [])].filter(Boolean);
    for (const forma of forme) {
      const f = normalizza(forma);
      if (!f) continue;
      const d = f === s ? 0 : distanza(s, f);
      if (d > tolleranza(Math.max(s.length, f.length))) continue;
      const prima = trovati.get(voce);
      if (!prima || d < prima.punteggio) trovati.set(voce, { voce, punteggio: d, forma });
    }
  }
  return Array.from(trovati.values()).sort((a, b) => a.punteggio - b.punteggio).slice(0, massimo);
}

/**
 * Abbina un nome di persona sentito a un elenco di allievi { id, nome, cognome, soprannomi: [] }.
 * Confronta con "nome", "cognome", "nome cognome", "cognome nome" e i soprannomi.
 * Risponde { allievo, punteggio } oppure { ambiguo: [allievi] } oppure null.
 */
export function abbinaPersona(sentito, allievi) {
  const voci = (allievi || []).map((a) => ({
    id: a.id,
    nome: `${a.nome || ''} ${a.cognome || ''}`.trim(),
    sinonimi: [a.nome, a.cognome, `${a.cognome || ''} ${a.nome || ''}`.trim(), ...(a.soprannomi || [])].filter(Boolean),
    allievo: a,
  }));
  const candidati = trovaCandidati(sentito, voci, 5);
  if (!candidati.length) return null;
  const migliori = candidati.filter((c) => c.punteggio === candidati[0].punteggio);
  if (migliori.length > 1) return { ambiguo: migliori.map((c) => c.voce.allievo) };
  return { allievo: migliori[0].voce.allievo, punteggio: migliori[0].punteggio };
}
