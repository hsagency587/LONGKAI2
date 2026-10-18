/* Longkai — viste/scegli-argomenti.js: il foglio per scegliere gli argomenti (chip), con ricerca, aree e recenti. */
import { el, icona } from '../base.js';
import { argomentiAttivi, leggiLocale, salvaLocale } from '../dati.js';
import { apriFoglio, avvisa } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';

const ORDINE_AREE = ['Forme', 'Chi Sao', 'Tecniche di mano', 'Pugni e palmi', 'Gomiti e ginocchia', 'Gambe', 'Posizioni e passi', 'Applicazioni', 'Principi'];

/** Apre il foglio e risponde con gli id scelti (null se chiuso senza Fatto). */
export function scegliArgomenti({ scelti = [], titolo = 'Argomenti', soloForme = false } = {}) {
  return new Promise((risolvi) => {
    const selezione = new Set(scelti);
    let tutti = [];
    let area = 'tutte';
    let chiusoConFatto = false;
    const cerca = el('input', { type: 'search', placeholder: 'Cerca (anche come lo dice il Sifu)', autocomplete: 'off' });
    const sceltiBox = el('div', { class: 'chips' });
    const chips = el('div', { class: 'chips scorrevole' });
    const elenco = el('div', { class: 'elenco' });
    const fatto = el('button', { class: 'tasto pieno grande', testo: 'Fatto', onclick: () => { chiusoConFatto = true; chiudi(); } });
    const nome = (id) => tutti.find((a) => a.id === id)?.nome || '…';
    const disegnaScelti = () => {
      sceltiBox.replaceChildren();
      for (const id of selezione) sceltiBox.append(el('button', { class: 'chip scelto', onclick: () => { selezione.delete(id); disegnaScelti(); mostra(); } }, [nome(id), el('span', { class: 'x', testo: '×' })]));
      if (!selezione.size) sceltiBox.append(el('span', { class: 'piccolo attenuato', testo: 'Niente scelto ancora.' }));
    };
    const disegnaChips = () => {
      chips.replaceChildren();
      const aree = [...ORDINE_AREE.filter((x) => tutti.some((a) => a.area === x)), ...[...new Set(tutti.map((a) => a.area))].filter((x) => !ORDINE_AREE.includes(x))];
      for (const [k, n] of [['recenti', 'Recenti'], ['tutte', 'Tutte'], ...aree.map((x) => [x, x])]) chips.append(el('button', { class: 'chip' + (k === area ? ' scelto' : ''), testo: n, onclick: () => { area = k; disegnaChips(); mostra(); } }));
    };
    const mostra = () => {
      elenco.replaceChildren();
      const q = normalizza(cerca.value);
      const recenti = leggiLocale().argomentiRecenti || [];
      let visibili = tutti.filter((a) => !q || normalizza(a.nome).includes(q) || (a.sinonimi || []).some((s) => normalizza(s).includes(q)) || (a.pronunce || []).some((p) => normalizza(p).includes(q)));
      if (area === 'recenti' && !q) visibili = recenti.map((id) => tutti.find((a) => a.id === id)).filter(Boolean);
      else if (area !== 'tutte' && area !== 'recenti') visibili = visibili.filter((a) => a.area === area);
      if (!visibili.length) { elenco.append(el('div', { class: 'vuoto' }, [el('p', { testo: area === 'recenti' ? 'Nessun argomento recente.' : 'Niente con questo nome.' })])); return; }
      for (const a of visibili.slice(0, 60)) {
        const dentro = selezione.has(a.id);
        elenco.append(el('button', { class: 'riga' + (dentro ? ' selezionata' : ''), type: 'button', onclick: () => { if (dentro) selezione.delete(a.id); else selezione.add(a.id); disegnaScelti(); mostra(); } }, [
          el('span', { class: 'pallino ' + (dentro ? 'ok' : 'neutro') }),
          el('div', {}, [el('div', { class: 'principale', testo: a.nome }), el('div', { class: 'secondaria', testo: a.area + (a.pronunce?.length ? ' · ' + a.pronunce[0] : '') })]),
          el('div', { class: 'destra' }, dentro ? [icona('spunta')] : []),
        ]));
      }
    };
    cerca.addEventListener('input', () => { if (cerca.value && area === 'recenti') area = 'tutte'; mostra(); });
    const chiudi = apriFoglio(titolo, el('div', {}, [sceltiBox, el('div', { class: 'spazio' }), el('div', { class: 'campo' }, [cerca]), chips, el('div', { class: 'spazio' }), elenco, el('div', { class: 'spazio' }), fatto]), {
      suChiusura: () => {
        if (!chiusoConFatto) { risolvi(null); return; }
        const ids = [...selezione];
        const loc = leggiLocale(); loc.argomentiRecenti = [...ids, ...(loc.argomentiRecenti || []).filter((x) => !ids.includes(x))].slice(0, 12); salvaLocale(loc);
        risolvi(ids);
      },
    });
    argomentiAttivi().then((t) => { tutti = soloForme ? t.filter((a) => a.area === 'Forme') : t; area = (leggiLocale().argomentiRecenti || []).length ? 'recenti' : 'tutte'; disegnaScelti(); disegnaChips(); mostra(); }).catch((e) => avvisa(e.message));
  });
}

/** I nomi degli argomenti scelti come chip di sola lettura. */
export function chipsArgomenti(ids, argomenti, { vuoto = 'Niente' } = {}) {
  const box = el('div', { class: 'chips' });
  for (const id of ids || []) { const a = argomenti.find((x) => x.id === id); box.append(el('span', { class: 'chip', testo: a ? a.nome : '…' })); }
  if (!(ids || []).length) box.append(el('span', { class: 'piccolo attenuato', testo: vuoto }));
  return box;
}
