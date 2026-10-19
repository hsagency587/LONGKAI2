/* Longkai — comune/blocchi.js
   I blocchi di una lezione: chi (il gruppo o degli allievi), cosa, quando (da–a in minuti, facoltativo), i passi.
   Logica pura: pulisce, ordina, riassume, prepara le corsie della linea del tempo. Provata in test/blocchi_test.js. */

function minuti(v) { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; }

/** Un blocco nella forma giusta (gli id li dà chi lo crea; qui uno casuale se manca). */
export function nuovoBlocco(parte = {}) {
  const chi = Array.isArray(parte.chi) && parte.chi.length ? [...parte.chi] : 'gruppo';
  return { id: parte.id || Math.random().toString(36).slice(2, 10), chi, cosa: String(parte.cosa || ''), argomenti: [...(parte.argomenti || [])], da: minuti(parte.da), a: minuti(parte.a), passi: (parte.passi || []).map((p) => String(p).trim()).filter(Boolean), fatto: parte.fatto === true ? true : parte.fatto === false ? false : null };
}

/** Pulisce una lista letta dal database: forma attesa, numeri sensati, la fine dopo l'inizio, dentro la durata. */
export function normalizzaBlocchi(lista, durata = null) {
  return (Array.isArray(lista) ? lista : []).map((b) => nuovoBlocco(b)).map((b) => {
    if (b.da !== null && b.a !== null && b.a < b.da) [b.da, b.a] = [b.a, b.da];
    if (durata) { if (b.da !== null && b.da > durata) b.da = durata; if (b.a !== null && b.a > durata) b.a = durata; }
    return b;
  });
}

/** In ordine: prima quelli con un orario (per inizio, poi per fine), poi gli altri nell'ordine dato. */
export function ordinaBlocchi(blocchi) {
  const con = blocchi.filter((b) => b.da !== null || b.a !== null).sort((x, y) => (x.da ?? 0) - (y.da ?? 0) || (x.a ?? 1e9) - (y.a ?? 1e9));
  return [...con, ...blocchi.filter((b) => b.da === null && b.a === null)];
}

export function eGruppo(b) { return b.chi === 'gruppo' || !Array.isArray(b.chi) || !b.chi.length; }

/** "0–10′" · "dai 40′" · "fino ai 20′" · "". */
export function orarioBlocco(b) {
  if (b.da === null && b.a === null) return '';
  if (b.a === null) return `dai ${b.da}′`;
  if (b.da === null) return `fino ai ${b.a}′`;
  return `${b.da}–${b.a}′`;
}

/** Il testo di un blocco: cosa, o gli argomenti, o i passi. */
export function testoBlocco(b, nomeArgomento = (id) => id) {
  const cosa = (b.cosa || '').trim();
  const arg = (b.argomenti || []).map(nomeArgomento).filter(Boolean).join(', ');
  const passi = (b.passi || []).join(' → ');
  return cosa || arg || passi || '…';
}

/** Una riga sola per gli elenchi: "0–10′ riscaldamento · 10–60′ combinazione · Allievo Uno 40–60′ Siu Nim Tao". */
export function riassuntoBlocchi(blocchi, { nomeArgomento = (id) => id, nomeAllievo = (id) => id, massimo = 4 } = {}) {
  const ord = ordinaBlocchi(normalizzaBlocchi(blocchi));
  const pezzi = ord.map((b) => [eGruppo(b) ? '' : b.chi.map(nomeAllievo).filter(Boolean).join(', '), orarioBlocco(b), testoBlocco(b, nomeArgomento)].filter(Boolean).join(' '));
  return pezzi.slice(0, massimo).join(' · ') + (pezzi.length > massimo ? ` · +${pezzi.length - massimo}` : '');
}

/** Le corsie della linea del tempo: il gruppo, poi una per ogni insieme di allievi; i blocchi senza orario a parte.
    Ogni blocco con orario ha `sinistra` e `larghezza` in percentuale della durata. */
export function corsie(blocchi, durata) {
  const ord = ordinaBlocchi(normalizzaBlocchi(blocchi, durata > 0 ? durata : null));
  const d = durata > 0 ? durata : Math.max(60, ...ord.map((b) => b.a || 0));
  const conOrario = ord.filter((b) => b.da !== null || b.a !== null).map((b) => {
    const da = b.da ?? 0; const a = b.a ?? d;
    return { ...b, sinistra: Math.round((da / d) * 1000) / 10, larghezza: Math.max(3, Math.round(((a - da) / d) * 1000) / 10) };
  });
  const righe = [];
  const gruppo = conOrario.filter(eGruppo);
  if (gruppo.length) righe.push({ chiave: 'gruppo', chi: 'gruppo', blocchi: gruppo });
  for (const b of conOrario.filter((x) => !eGruppo(x))) {
    const chiave = [...b.chi].sort().join(',');
    let r = righe.find((x) => x.chiave === chiave);
    if (!r) { r = { chiave, chi: b.chi, blocchi: [] }; righe.push(r); }
    r.blocchi.push(b);
  }
  return { durata: d, righe, senzaOrario: ord.filter((b) => b.da === null && b.a === null) };
}

/** Gli argomenti di tutti i blocchi, senza doppioni, in ordine: il "previsto" di prima. */
export function argomentiDeiBlocchi(blocchi) {
  const out = [];
  for (const b of ordinaBlocchi(normalizzaBlocchi(blocchi))) for (const id of b.argomenti || []) if (!out.includes(id)) out.push(id);
  return out;
}
