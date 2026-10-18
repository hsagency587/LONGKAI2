/* Longkai — viste/argomenti.js: il vocabolario del Wing Chun (forme con sezioni e movimenti; tecniche con sinonimi e pronunce).
   Si legge per area e si corregge a mano; la correzione a voce arriva in fase 4. */
import { el } from '../base.js';
import { argomentiTutti, salvaArgomento, soloLettura } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, apriFoglio, chiedi, azioneFissa } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { campo } from './allievo-modulo.js';

const ORDINE_AREE = ['Forme', 'Chi Sao', 'Tecniche di mano', 'Pugni e palmi', 'Gomiti e ginocchia', 'Gambe', 'Posizioni e passi', 'Applicazioni', 'Principi'];

export async function vistaArgomenti(main, parametri, { indietro = 'impostazioni', titolo = 'Forme e tecniche' } = {}) {
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaArgomenti(main, parametri, { indietro, titolo }); };
  testata(titolo, { indietro, azione: lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Argomento', onclick: () => foglioArgomento(null, [], ridisegna) }) });
  azioneFissa({ testo: 'Argomento', onclick: () => foglioArgomento(null, [], ridisegna) });
  await disegnaArgomenti(main, ridisegna);
}

export async function disegnaArgomenti(box, ridisegna) {
  const lettura = soloLettura();
  box.append(scheletri(4));
  const tutti = await argomentiTutti();
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const aree = [...ORDINE_AREE.filter((a) => tutti.some((x) => x.area === a)), ...[...new Set(tutti.map((x) => x.area))].filter((a) => !ORDINE_AREE.includes(a))];
  let area = 'tutte';
  let anchePenti = false;
  const cerca = el('input', { type: 'search', placeholder: 'Cerca una tecnica o una forma', 'aria-label': 'Cerca', autocomplete: 'off' });
  const chips = el('div', { class: 'chips scorrevole' });
  const corpo = el('div');
  const disegnaChips = () => {
    chips.replaceChildren();
    for (const [k, nome] of [['tutte', 'Tutte'], ...aree.map((a) => [a, a])]) chips.append(el('button', { class: 'chip' + (k === area ? ' scelto' : ''), testo: nome, onclick: () => { area = k; disegnaChips(); mostra(); } }));
  };
  const mostra = () => {
    corpo.replaceChildren();
    const q = normalizza(cerca.value);
    const visibili = tutti.filter((a) => (anchePenti || a.attivo) && (area === 'tutte' || a.area === area) && (!q || normalizza(a.nome).includes(q) || (a.sinonimi || []).some((s) => normalizza(s).includes(q)) || (a.pronunce || []).some((p) => normalizza(p).includes(q))));
    if (!visibili.length) { corpo.append(statoVuoto(tutti.length ? 'Niente con questo nome.' : 'Nessun argomento: il seme non è stato caricato.')); return; }
    for (const ar of (area === 'tutte' ? aree : [area])) {
      const del = visibili.filter((x) => x.area === ar);
      if (!del.length) continue;
      const elenco = el('div', { class: 'elenco' });
      for (const a of del) {
        const sez = Array.isArray(a.sezioni) && a.sezioni.length ? `${a.sezioni.length} sezioni` : null;
        const pron = a.pronunce?.length ? `il Sifu dice: ${a.pronunce.join(', ')}` : null;
        const sin = a.sinonimi?.length ? a.sinonimi.slice(0, 3).join(' · ') : null;
        elenco.append(riga({ principale: a.nome + (a.attivo ? '' : ' (spento)'), secondaria: [sez, pron, sin].filter(Boolean).join(' — '), pallino: a.attivo ? (sez ? 'info' : 'neutro') : 'neutro', onclick: () => foglioArgomento(a, aree, ridisegna, lettura) }));
      }
      corpo.append(sezione(`${ar} · ${del.length}`, elenco));
    }
  };
  cerca.addEventListener('input', mostra);
  const spenti = el('label', { class: 'interruttore piccolo' }, [el('span', { class: 'attenuato', testo: 'Mostra anche quelli spenti' }), el('input', { type: 'checkbox', onchange: (e) => { anchePenti = e.target.checked; mostra(); } })]);
  box.append(el('div', { class: 'campo' }, [cerca]), chips, el('div', { class: 'spazio' }), corpo, spenti);
  disegnaChips(); mostra();
}

function foglioArgomento(a, aree, ridisegna, lettura = false) {
  const nome = el('input', { type: 'text', value: a?.nome || '', autocapitalize: 'words' });
  const areaSel = el('select', {}, [...aree.map((x) => el('option', { value: x, testo: x })), el('option', { value: '__nuova', testo: 'Nuova area…' })]);
  areaSel.value = a?.area && aree.includes(a.area) ? a.area : aree[0] || '__nuova';
  const areaNuova = el('input', { type: 'text', placeholder: 'Nome della nuova area', class: areaSel.value === '__nuova' ? '' : 'nascosto' });
  areaSel.addEventListener('change', () => areaNuova.classList.toggle('nascosto', areaSel.value !== '__nuova'));
  const sinonimi = el('textarea', { rows: '2', placeholder: 'altri modi di chiamarla, separati da virgola' }); sinonimi.value = (a?.sinonimi || []).join(', ');
  const pronunce = el('textarea', { rows: '2', placeholder: 'come la dice il Sifu, separate da virgola (es. bon sao)' }); pronunce.value = (a?.pronunce || []).join(', ');
  const attivo = el('input', { type: 'checkbox' }); attivo.checked = a ? a.attivo : true;
  const eForma = (areaSel.value === 'Forme') || (Array.isArray(a?.sezioni) && a.sezioni.length > 0);
  const bloccoSezioni = el('div', { class: eForma ? '' : 'nascosto' });
  areaSel.addEventListener('change', () => bloccoSezioni.classList.toggle('nascosto', !(areaSel.value === 'Forme' || (a?.sezioni || []).length)));
  const sezioni = (Array.isArray(a?.sezioni) ? a.sezioni : []).map((s) => ({ nome: s.nome || '', movimenti: Array.isArray(s.movimenti) ? s.movimenti.slice() : [] }));
  const listaSezioni = el('div');
  const disegnaSezioni = () => {
    listaSezioni.replaceChildren();
    sezioni.forEach((s, i) => {
      const n = el('input', { type: 'text', value: s.nome, placeholder: `Sezione ${i + 1}` });
      n.addEventListener('input', () => { s.nome = n.value; });
      const m = el('textarea', { rows: '3', placeholder: 'un movimento per riga' }); m.value = s.movimenti.join('\n');
      m.addEventListener('input', () => { s.movimenti = m.value.split('\n').map((x) => x.trim()).filter(Boolean); });
      listaSezioni.append(el('div', { class: 'sezione-forma' }, [
        el('div', { class: 'riga-stato' }, [el('strong', { testo: `${i + 1}ª sezione` }), lettura ? null : el('button', { class: 'tasto pericolo', testo: 'Togli', onclick: async () => { const ok = await chiedi('Togliere la sezione?', 'Chi “sta” in questa sezione va spostato a mano nei progressi.', [{ testo: 'Togli', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]); if (!ok) return; sezioni.splice(i, 1); disegnaSezioni(); } })]),
        campo('Nome', n), campo('Movimenti', m),
      ]));
    });
    if (!lettura) listaSezioni.append(el('button', { class: 'tasto bordo', testo: '+ Sezione', onclick: () => { sezioni.push({ nome: '', movimenti: [] }); disegnaSezioni(); } }));
  };
  disegnaSezioni();
  bloccoSezioni.append(el('h3', { class: 'titolo-blocco', testo: 'Sezioni della forma' }), listaSezioni);
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    errore.textContent = '';
    const area = areaSel.value === '__nuova' ? areaNuova.value.trim() : areaSel.value;
    if (!nome.value.trim() || !area) { errore.textContent = 'Servono il nome e l\'area.'; return; }
    const dati = { nome: nome.value.trim(), area, sinonimi: sinonimi.value.split(',').map((x) => x.trim()).filter(Boolean), pronunce: pronunce.value.split(',').map((x) => x.trim()).filter(Boolean), attivo: attivo.checked,
      sezioni: bloccoSezioni.classList.contains('nascosto') ? (a?.sezioni ?? null) : sezioni.map((s, i) => ({ n: i + 1, nome: s.nome || `Sezione ${i + 1}`, movimenti: s.movimenti })) };
    if (dati.sezioni && !dati.sezioni.length) dati.sezioni = null;
    salva.disabled = true;
    try {
      await salvaArgomento(a?.id || null, dati, a ? { nome: a.nome, area: a.area, sinonimi: a.sinonimi, pronunce: a.pronunce, attivo: a.attivo, sezioni: a.sezioni } : null);
      chiudi(); toast('Salvato.'); ridisegna();
    } catch (e) { errore.textContent = /23505|duplicate/i.test(e.message || '') ? 'C\'è già un argomento con questo nome in quest\'area.' : (e.message || 'Non sono riuscito a salvare.'); } finally { salva.disabled = false; }
  } });
  const figli = [
    lettura || !a ? null : el('a', { class: 'tasto bordo', href: `#/correggi/argomento/${a.id}`, testo: 'Correggi parlando', onclick: () => chiudi() }),
    el('div', { class: 'griglia-campi' }, [campo('Nome', nome), campo('Area', areaSel)]), areaNuova,
    campo('Sinonimi', sinonimi), campo('Pronunce del Sifu', pronunce, 'Così la dettatura capisce: “bon sao” → Bong Sao.'),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'In uso' }), attivo]),
    bloccoSezioni, errore, lettura ? null : salva,
  ];
  const chiudi = apriFoglio(a ? a.nome : 'Nuovo argomento', el('div', {}, figli));
  if (lettura) setTimeout(() => document.querySelectorAll('.foglio input, .foglio textarea, .foglio select').forEach((x) => { x.disabled = true; }), 0);
}
