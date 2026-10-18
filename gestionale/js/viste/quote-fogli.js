/* Longkai — viste/quote-fogli.js: i fogli delle quote, usati da Quote, dalla scheda dell'allievo e da Oggi:
   registra un pagamento, un rimborso, un addebito a mano; annulla; sconto. */
import { el, euro } from '../base.js';
import { registraPagamento, registraRimborso, nuovoAddebito, annullaPagamento, annullaAddebito, scontaAddebito, allieviAttivi, leggiLocale, salvaLocale } from '../dati.js';
import { riga, statoVuoto, toast, avvisa, apriFoglio, chiedi } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { oggiRoma, formattaData } from '../../comune/date.js';
import { residuo, MOTIVI, METODI, centesimiDa } from '../../comune/quote.js';
import { campo } from './allievo-modulo.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

/** Un campo di ricerca dell'allievo con i recenti; risponde { campo, scelto: () => allievo }. */
function cercaAllievo(iniziale = null) {
  let scelto = iniziale;
  let tutti = [];
  const cerca = el('input', { type: 'search', placeholder: 'Chi?', autocomplete: 'off', value: iniziale ? nomeDi(iniziale) : '' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const recenti = (leggiLocale().pagamentiRecenti || []).map((id) => tutti.find((a) => a.id === id)).filter(Boolean);
    const righe = (q ? tutti.filter((a) => normalizza(nomeDi(a)).includes(q) || normalizza(`${a.cognome} ${a.nome}`).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))) : recenti).slice(0, 6);
    for (const a of righe) elenco.append(riga({ principale: nomeDi(a), secondaria: !q ? 'recente' : null, pallino: scelto?.id === a.id ? 'ok' : 'neutro', onclick: () => { scelto = a; cerca.value = nomeDi(a); elenco.replaceChildren(); } }));
  };
  cerca.addEventListener('input', () => { scelto = null; mostra(); });
  if (!iniziale) allieviAttivi().then((t) => { tutti = t; mostra(); }).catch((e) => avvisa(e.message));
  const box = el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco]);
  if (iniziale) cerca.disabled = true;
  return { box, scelto: () => scelto, ricorda: () => { if (!scelto) return; const l = leggiLocale(); l.pagamentiRecenti = [scelto.id, ...(l.pagamentiRecenti || []).filter((x) => x !== scelto.id)].slice(0, 5); salvaLocale(l); } };
}

function campiImporto(importoIniziale = '') {
  const importo = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: importoIniziale });
  const metodo = el('select', {}, Object.entries(METODI).map(([v, t]) => el('option', { value: v, testo: t })));
  const data = el('input', { type: 'date', value: oggiRoma() });
  const nota = el('input', { type: 'text', placeholder: 'es. novembre' });
  return { importo, metodo, data, nota, griglia: el('div', { class: 'griglia-campi' }, [campo('Quanto (€)', importo), campo('Come', metodo), campo('Quando', data), campo('Per cosa', nota)]) };
}

/** Registra un pagamento: da Oggi (nessun allievo), dalla scheda (allievo fisso) o da un addebito (allievo e importo già messi). */
export function foglioRegistraPagamento({ allievo = null, addebito = null, dopo = () => {} } = {}) {
  const chi = cercaAllievo(allievo || (addebito ? { id: addebito.allievo_id, nome: addebito.nome, cognome: addebito.cognome } : null));
  const c = campiImporto(addebito ? (residuo(addebito) / 100).toFixed(2).replace('.', ',') : '');
  if (addebito?.descrizione) c.nota.value = addebito.descrizione;
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Registra', onclick: async () => {
    const a = chi.scelto();
    const cent = centesimiDa(c.importo.value);
    if (!a) { avvisa('Chi ha pagato?'); return; }
    if (!(cent > 0)) { avvisa('Quanto? Un importo in euro.'); return; }
    salva.disabled = true;
    try {
      await registraPagamento({ allievoId: a.id, importoCent: cent, data: c.data.value || oggiRoma(), metodo: c.metodo.value, nota: c.nota.value.trim() || null, addebitoId: addebito?.id || null });
      chi.ricorda(); chiudi(); toast(`Registrato: ${euro(cent)} da ${nomeDi(a)}.`); dopo();
    } catch (e) { avvisa(e.message); salva.disabled = false; }
  } });
  const chiudi = apriFoglio(addebito ? 'Registra il pagamento' : 'Pagamento', el('div', {}, [chi.box, c.griglia, el('p', { class: 'piccolo attenuato', testo: 'Si applica a quello che c\'è da pagare, dal più vecchio; se avanza, copre i periodi dopo o resta come credito.' }), salva]));
}

export function foglioRimborso({ allievo, creditoCent = 0, dopo = () => {} }) {
  const c = campiImporto(creditoCent > 0 ? (creditoCent / 100).toFixed(2).replace('.', ',') : '');
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Rimborsa', onclick: async () => {
    const cent = centesimiDa(c.importo.value);
    if (!(cent > 0)) { avvisa('Quanto?'); return; }
    salva.disabled = true;
    try { await registraRimborso({ allievoId: allievo.id, importoCent: cent, data: c.data.value || oggiRoma(), metodo: c.metodo.value, nota: c.nota.value.trim() || null }); chiudi(); toast(`Rimborsati ${euro(cent)}.`); dopo(); }
    catch (e) { avvisa(e.message); salva.disabled = false; }
  } });
  const chiudi = apriFoglio('Rimborso a ' + nomeDi(allievo), el('div', {}, [el('p', { class: 'attenuato', testo: `Credito disponibile: ${euro(creditoCent)}. Un rimborso lo riduce.` }), c.griglia, salva]));
}

export function foglioAddebito({ allievo = null, dopo = () => {} } = {}) {
  const chi = cercaAllievo(allievo);
  const importo = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00' });
  const motivo = el('select', {}, Object.entries(MOTIVI).filter(([v]) => v !== 'abbonamento').map(([v, t]) => el('option', { value: v, testo: t })));
  motivo.value = 'altro';
  const descrizione = el('input', { type: 'text', placeholder: 'es. divisa, stage' });
  const scadenza = el('input', { type: 'date', value: oggiRoma() });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Aggiungi', onclick: async () => {
    const a = chi.scelto();
    const cent = centesimiDa(importo.value);
    if (!a) { avvisa('A chi?'); return; }
    if (!(cent > 0)) { avvisa('Quanto?'); return; }
    salva.disabled = true;
    try { await nuovoAddebito({ allievoId: a.id, importoCent: cent, motivo: motivo.value, descrizione: descrizione.value.trim() || null, scadenza: scadenza.value || null }); chiudi(); toast('Addebito aggiunto.'); dopo(); }
    catch (e) { avvisa(e.message); salva.disabled = false; }
  } });
  const chiudi = apriFoglio('Addebito a mano', el('div', {}, [chi.box, el('div', { class: 'griglia-campi' }, [campo('Quanto (€)', importo), campo('Motivo', motivo), campo('Descrizione', descrizione), campo('Scade il', scadenza)]), salva]));
}

/** Le azioni su un addebito aperto: registra, sconto, annulla, chiama, scheda. */
export function foglioAddebitoAzioni(d, dopo = () => {}) {
  const figli = [
    el('p', { class: 'attenuato', testo: [MOTIVI[d.motivo] || d.motivo, d.descrizione, d.scadenza ? 'scade il ' + formattaData(d.scadenza, 'numerico') : null, d.sconto_cent ? 'sconto ' + euro(d.sconto_cent) : null, d.pagato_cent ? 'già pagato ' + euro(d.pagato_cent) : null].filter(Boolean).join(' · ') }),
    el('button', { class: 'tasto pieno', testo: `Registra ${euro(residuo(d))}`, onclick: () => { chiudi(); foglioRegistraPagamento({ addebito: d, dopo }); } }),
    el('button', { class: 'tasto bordo', testo: 'Registra una parte', onclick: () => { chiudi(); foglioRegistraPagamento({ addebito: { ...d, importo_cent: 0, sconto_cent: 0, pagato_cent: 0 }, dopo }); } }),
    el('button', { class: 'tasto bordo', testo: 'Sconto', onclick: () => {
      const sc = el('input', { type: 'text', inputmode: 'decimal', placeholder: '0,00', value: d.sconto_cent ? (d.sconto_cent / 100).toFixed(2).replace('.', ',') : '' });
      const ok = el('button', { class: 'tasto pieno grande', testo: 'Applica', onclick: async () => { const cent = centesimiDa(sc.value); if (cent === null) { avvisa('Un importo.'); return; } try { await scontaAddebito(d.id, cent); chiudi2(); chiudi(); toast('Sconto applicato.'); dopo(); } catch (e) { avvisa(e.message); } } });
      const chiudi2 = apriFoglio('Sconto', el('div', {}, [campo('Sconto (€)', sc), ok]));
    } }),
    d.telefono ? el('a', { class: 'tasto bordo', href: 'tel:' + String(d.telefono).replace(/\s+/g, ''), testo: 'Chiama' }) : null,
    el('button', { class: 'tasto', testo: 'Ricorda all\'allievo', onclick: () => toast('I promemoria agli allievi arrivano in fase 9.') }),
    el('a', { class: 'tasto', href: `#/allievi/${d.allievo_id}/quote`, testo: 'Apri la scheda', onclick: () => chiudi() }),
    el('button', { class: 'tasto pericolo', testo: 'Annulla l\'addebito', onclick: async () => {
      const ok = await chiedi('Annullare?', 'Resta nello storico come annullato. Se è stato pagato in parte, prima si annulla il pagamento.', [{ testo: 'Annulla l\'addebito', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]);
      if (!ok) return;
      try { await annullaAddebito(d.id, null); chiudi(); toast('Annullato.'); dopo(); } catch (e) { avvisa(e.message); }
    } }),
  ];
  const chiudi = apriFoglio(`${nomeDi(d)} · ${euro(residuo(d))}`, el('div', { class: 'tasti-colonna' }, figli));
}

/** Le azioni su un pagamento: annulla con motivo. */
export function foglioPagamentoAzioni(p, dopo = () => {}) {
  const nome = p.allievi ? nomeDi(p.allievi) : '';
  const figli = [el('p', { class: 'attenuato', testo: [formattaData(p.data, 'numerico'), METODI[p.metodo] || p.metodo, p.nota, p.credito_residuo_cent > 0 ? `credito residuo ${euro(p.credito_residuo_cent)}` : null, p.sessione_id ? 'dalla sessione' : null].filter(Boolean).join(' · ') })];
  if (p.annullato_il) figli.push(el('p', { class: 'errore-campo', testo: 'Annullato' + (p.annullato_perche ? ': ' + p.annullato_perche : '.') }));
  else {
    const perche = el('input', { type: 'text', placeholder: 'perché' });
    figli.push(campo('Motivo', perche), el('button', { class: 'tasto pericolo', testo: p.tipo === 'rimborso' ? 'Annulla il rimborso' : 'Annulla il pagamento', onclick: async () => {
      const ok = await chiedi('Annullare?', 'Gli addebiti tornano come prima. Il pagamento resta nello storico come annullato.', [{ testo: 'Annulla', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]);
      if (!ok) return;
      try { await annullaPagamento(p.id, perche.value.trim() || null); chiudi(); toast('Annullato.'); dopo(); } catch (e) { avvisa(e.message); }
    } }));
  }
  if (p.allievo_id) figli.push(el('a', { class: 'tasto', href: `#/allievi/${p.allievo_id}/quote`, testo: 'Apri la scheda', onclick: () => chiudi() }));
  const chiudi = apriFoglio(`${nome} · ${p.tipo === 'rimborso' ? '−' : ''}${euro(p.importo_cent)}`, el('div', { class: 'tasti-colonna' }, figli));
}

export function rigaAddebito(d, onclick) {
  const r = residuo(d);
  const stato = d.stato === 'annullato' ? 'annullato' + (d.annullato_perche ? ': ' + d.annullato_perche : '') : d.stato === 'pagato' ? 'pagato' : d.pagato_cent > 0 ? `pagato ${euro(d.pagato_cent)}, resta ${euro(r)}` : d.scadenza ? 'scade il ' + formattaData(d.scadenza, 'numerico') : null;
  return riga({ principale: d.descrizione || MOTIVI[d.motivo] || d.motivo, secondaria: [formattaData(d.data, 'numerico'), MOTIVI[d.motivo], stato, d.sconto_cent ? 'sconto ' + euro(d.sconto_cent) : null].filter(Boolean).join(' · '), destra: euro(d.importo_cent - (d.sconto_cent || 0)), pallino: d.stato === 'annullato' ? 'neutro' : d.stato === 'pagato' ? 'ok' : 'attenzione', onclick });
}
export function rigaPagamento(p, onclick) {
  return riga({ principale: (p.tipo === 'rimborso' ? 'Rimborso' : 'Pagamento') + (p.allievi ? ' · ' + nomeDi(p.allievi) : ''), secondaria: [formattaData(p.data, 'numerico'), METODI[p.metodo] || p.metodo, p.nota, p.credito_residuo_cent > 0 ? `credito ${euro(p.credito_residuo_cent)}` : null, p.annullato_il ? 'annullato' : null].filter(Boolean).join(' · '), destra: (p.tipo === 'rimborso' ? '−' : '') + euro(p.importo_cent), pallino: p.annullato_il ? 'neutro' : p.tipo === 'rimborso' ? 'info' : 'ok', onclick });
}
export { statoVuoto };
