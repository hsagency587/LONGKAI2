/* Longkai — viste/blocchi.js: la lezione a blocchi. La linea del tempo (Oggi, Programma), il foglio «Programma la lezione»,
   il foglio di un blocco (chi, cosa, dal minuto al minuto, argomenti, passi). */
import { el } from '../base.js';
import { salvaProgramma, allieviAttivi, attesiSessione, argomentiAttivi } from '../dati.js';
import { riga, statoVuoto, toast, avvisa, apriFoglio } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { normalizzaBlocchi, ordinaBlocchi, nuovoBlocco, corsie, orarioBlocco, testoBlocco, eGruppo, argomentiDeiBlocchi } from '../../comune/blocchi.js';
import { scegliArgomenti, chipsArgomenti } from './scegli-argomenti.js';
import { campo } from './allievo-modulo.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

/** La linea del tempo: le corsie con le barre (il gruppo in oro, i singoli sotto col nome), la scala, poi l'elenco scritto. */
export function lineaTempo(blocchi, { durata, allievi = [], argomenti = [], onTocca = null } = {}) {
  const nomeA = (id) => nomeDi(allievi.find((a) => a.id === id)) || '…';
  const nomeArg = (id) => argomenti.find((a) => a.id === id)?.nome || '…';
  const c = corsie(blocchi, durata);
  const box = el('div', { class: 'linea-tempo' });
  for (const r of c.righe) {
    const corsia = el('div', { class: 'corsia' + (r.chi === 'gruppo' ? ' gruppo' : '') });
    for (const b of r.blocchi) {
      const e = el(onTocca ? 'button' : 'div', { class: 'barra', type: onTocca ? 'button' : null, title: `${orarioBlocco(b)} ${testoBlocco(b, nomeArg)}`, onclick: onTocca ? () => onTocca(b) : null }, [el('span', { testo: testoBlocco(b, nomeArg) })]);
      e.style.left = `${b.sinistra}%`; e.style.width = `${b.larghezza}%`;
      corsia.append(e);
    }
    box.append(el('div', { class: 'corsia-riga' }, [el('span', { class: 'corsia-nome', testo: r.chi === 'gruppo' ? 'Gruppo' : r.chi.map(nomeA).join(', ') }), corsia]));
  }
  if (c.righe.length) box.append(el('div', { class: 'scala' }, [el('span', { testo: '0′' }), el('span', { testo: `${Math.round(c.durata / 2)}′` }), el('span', { testo: `${c.durata}′` })]));
  const elenco = el('div', { class: 'elenco' });
  for (const b of ordinaBlocchi(normalizzaBlocchi(blocchi))) {
    const chi = eGruppo(b) ? null : b.chi.map(nomeA).join(', ');
    elenco.append(riga({ principale: [orarioBlocco(b), testoBlocco(b, nomeArg)].filter(Boolean).join(' · '), secondaria: [chi, (b.passi || []).length && (b.cosa || (b.argomenti || []).length) ? b.passi.join(' → ') : null].filter(Boolean).join(' · ') || null, pallino: b.fatto === true ? 'ok' : b.fatto === false ? 'neutro' : chi ? 'info' : 'attenzione', onclick: onTocca ? () => onTocca(b) : null }));
  }
  box.append(elenco);
  return box;
}

/** «Programma la lezione»: i blocchi, + Blocco, la nota, Salva. `s`: la sessione; `pr`: { nota, blocchi } o null. */
export async function foglioLezione(s, pr, ridisegna) {
  let argomenti = []; let allievi = [];
  try {
    const [arg, tutti, attesi] = await Promise.all([argomentiAttivi(), allieviAttivi(), s.tipo === 'privata' || !s.corso_id ? Promise.resolve([]) : attesiSessione(s.id).catch(() => [])]);
    argomenti = arg;
    const idAttesi = new Set(attesi.map((a) => a.allievo_id));
    allievi = s.tipo === 'privata' && s.allievo_id ? tutti.filter((a) => a.id === s.allievo_id).concat(tutti.filter((a) => a.id !== s.allievo_id)) : [...tutti.filter((a) => idAttesi.has(a.id)), ...tutti.filter((a) => !idAttesi.has(a.id))];
  } catch (e) { avvisa(e.message); return; }
  const durata = s.durata_minuti || 60;
  let blocchi = ordinaBlocchi(normalizzaBlocchi(pr?.blocchi, durata));
  const nota = el('textarea', { rows: '2', placeholder: 'una nota per quel giorno' }); nota.value = pr?.nota || '';
  const lista = el('div');
  const apri = (b) => foglioBlocco(b, { durata, allievi, argomenti, suSalva: (nuovo) => { blocchi = ordinaBlocchi(blocchi.map((x) => (x.id === b.id ? nuovo : x))); disegna(); }, suTogli: () => { blocchi = blocchi.filter((x) => x.id !== b.id); disegna(); } });
  const disegna = () => { lista.replaceChildren(blocchi.length ? lineaTempo(blocchi, { durata, allievi, argomenti, onTocca: apri }) : statoVuoto('Nessun blocco.')); };
  disegna();
  const aggiungi = el('button', { class: 'tasto bordo', testo: '+ Blocco', onclick: () => foglioBlocco(nuovoBlocco({ da: prossimoInizio(blocchi), a: null }), { durata, allievi, argomenti, suSalva: (b) => { blocchi = ordinaBlocchi([...blocchi, b]); disegna(); } }) });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    salva.disabled = true;
    try { await salvaProgramma({ sessioneId: s.id, nota: nota.value.trim() || null, argomenti: argomentiDeiBlocchi(blocchi), blocchi }); chiudi(); toast('Lezione programmata.'); ridisegna(); }
    catch (e) { avvisa(e.message); salva.disabled = false; }
  } });
  const chiudi = apriFoglio('Programma la lezione', el('div', {}, [lista, aggiungi, campo('Nota', nota), salva]));
}

/** Il nuovo blocco parte da dove finisce l'ultimo del gruppo (o da 0 se è il primo; senza orario se gli altri non ce l'hanno). */
function prossimoInizio(blocchi) {
  if (!blocchi.length) return 0;
  const fini = blocchi.filter((b) => eGruppo(b) && b.a !== null).map((b) => b.a);
  return fini.length ? Math.max(...fini) : null;
}

/** Il foglio di un blocco: chi, cosa, dal minuto al minuto (facoltativi), argomenti, passi. */
export function foglioBlocco(b0, { durata, allievi, argomenti, suSalva, suTogli = null }) {
  const b = nuovoBlocco(b0); b.id = b0.id || b.id;
  const scelti = new Set(eGruppo(b) ? [] : b.chi);
  const chipsChi = el('div', { class: 'chips' });
  const disegnaChi = () => {
    chipsChi.replaceChildren(el('button', { class: 'chip' + (!scelti.size ? ' scelto' : ''), type: 'button', testo: 'Gruppo', onclick: () => { scelti.clear(); disegnaChi(); } }));
    const mostrati = allievi.filter((a, i) => scelti.has(a.id) || i < 8);
    for (const a of mostrati) chipsChi.append(el('button', { class: 'chip' + (scelti.has(a.id) ? ' scelto' : ''), type: 'button', testo: nomeDi(a), onclick: () => { if (scelti.has(a.id)) scelti.delete(a.id); else scelti.add(a.id); disegnaChi(); } }));
    if (allievi.length > mostrati.length) chipsChi.append(el('button', { class: 'chip', type: 'button', testo: '+ altro…', onclick: () => scegliAllievo(allievi.filter((a) => !scelti.has(a.id)), (a) => { scelti.add(a.id); disegnaChi(); }) }));
  };
  disegnaChi();
  const cosa = el('textarea', { rows: '2', placeholder: 'es. riscaldamento · combinazione in coppia · Siu Nim Tao seconda sezione' }); cosa.value = b.cosa;
  const da = el('input', { type: 'number', min: '0', max: String(durata), step: '5', inputmode: 'numeric', value: b.da ?? '' });
  const a = el('input', { type: 'number', min: '0', max: String(durata), step: '5', inputmode: 'numeric', value: b.a ?? '' });
  const passi = el('textarea', { rows: '3', placeholder: 'un passo per riga, es.\nTan Sao\nBong Sao\ncombinazione' }); passi.value = (b.passi || []).join('\n');
  let arg = [...b.argomenti];
  const chipsArg = el('div');
  const disegnaArg = () => chipsArg.replaceChildren(arg.length ? chipsArgomenti(arg, argomenti) : el('span'));
  disegnaArg();
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Fatto', onclick: () => {
    const daN = da.value === '' ? null : Number(da.value); const aN = a.value === '' ? null : Number(a.value);
    if (!cosa.value.trim() && !arg.length && !passi.value.trim()) { avvisa('Cosa si fa?'); return; }
    suSalva(nuovoBlocco({ id: b.id, chi: scelti.size ? [...scelti] : 'gruppo', cosa: cosa.value.trim(), argomenti: arg, da: daN, a: aN, passi: passi.value.split('\n'), fatto: b.fatto }));
    chiudi();
  } });
  const figli = [
    el('p', { class: 'piccolo attenuato', testo: 'Chi' }), chipsChi,
    campo('Cosa', cosa),
    el('div', { class: 'griglia-campi' }, [campo('Dal minuto', da), campo('Al minuto', a)]),
    chipsArg, el('button', { class: 'tasto bordo', testo: arg.length ? 'Cambia gli argomenti' : 'Argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti: arg, titolo: 'Argomenti del blocco' }); if (r) { arg = r; disegnaArg(); } } }),
    campo('Passi, uno per riga', passi),
    salva,
    suTogli ? el('button', { class: 'tasto pericolo', testo: 'Togli il blocco', onclick: () => { suTogli(); chiudi(); } }) : null,
  ];
  const chiudi = apriFoglio(b0.cosa || (b0.argomenti || []).length ? 'Blocco' : 'Nuovo blocco', el('div', {}, figli));
}

/** Un foglio per scegliere un allievo (ricerca anche sui soprannomi); poi `dopo(allievo)`. */
export function scegliAllievo(candidati, dopo, titolo = 'Chi?') {
  const cerca = el('input', { type: 'search', placeholder: 'Chi?', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = candidati.filter((a) => !q || normalizza(nomeDi(a)).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))).slice(0, 12);
    if (!righe.length) elenco.append(statoVuoto('Nessuno.'));
    for (const a of righe) elenco.append(riga({ principale: nomeDi(a), onclick: () => { chiudi(); dopo(a); } }));
  };
  cerca.addEventListener('input', mostra);
  const chiudi = apriFoglio(titolo, el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco]));
  mostra();
}
