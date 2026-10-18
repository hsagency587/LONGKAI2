/* Longkai — viste/quote.js: Da incassare · Pagamenti · Tariffe. */
import { el, euro, icona } from '../base.js';
import { daIncassare, pagamentiPeriodo, incassiMesi, tariffeTutte, salvaTariffa, soloLettura } from '../dati.js';
import { testata, statoVuoto, riga, sezione, scheletri, toast, apriFoglio } from '../ui.js';
import { oggiRoma, formattaMese, primoDelMese, aggiungiMesi, aggiungiGiorni } from '../../comune/date.js';
import { gruppoScadenza, GRUPPI_SCADENZA, totali, METODI } from '../../comune/quote.js';
import { normalizza } from '../../comune/fonetica.js';
import { foglioRegistraPagamento, foglioAddebito, foglioAddebitoAzioni, foglioPagamentoAzioni, rigaAddebito, rigaPagamento } from './quote-fogli.js';
import { campo } from './allievo-modulo.js';

const TIPI = [['mensile', 'Mensile'], ['trimestrale', 'Trimestrale'], ['annuale', 'Annuale'], ['pacchetto', 'Pacchetto di N lezioni'], ['lezione', 'A lezione'], ['ora_privata', 'A ora di privata'], ['tessera', 'Tessera / iscrizione'], ['altro', 'Altro']];
const NOME_TIPO = Object.fromEntries(TIPI);

export async function vistaQuote(main, parametri) {
  const scheda = ['incassare', 'pagamenti', 'tariffe'].includes(parametri[0]) ? parametri[0] : 'incassare';
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaQuote(main, parametri); };
  const azione = lettura ? null : scheda === 'tariffe' ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Tariffa', onclick: () => foglioTariffa(null, ridisegna) })
    : scheda === 'pagamenti' ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Pagamento', onclick: () => foglioRegistraPagamento({ dopo: ridisegna }) })
    : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Addebito', onclick: () => foglioAddebito({ dopo: ridisegna }) });
  testata('Quote', { azione });
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of [['incassare', 'Da incassare'], ['pagamenti', 'Pagamenti'], ['tariffe', 'Tariffe']]) chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/quote/' + k, testo: nome }));
  main.append(chips, el('div', { class: 'spazio' }));
  if (scheda === 'tariffe') { await disegnaTariffe(main, lettura, ridisegna); return; }
  if (scheda === 'pagamenti') { await disegnaPagamenti(main, parametri.slice(1), lettura, ridisegna); return; }
  await disegnaDaIncassare(main, lettura, ridisegna);
}

/* ---------- DA INCASSARE ---------- */
async function disegnaDaIncassare(main, lettura, ridisegna) {
  main.append(scheletri(3));
  const righe = await daIncassare();
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const oggi = oggiRoma();
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo', autocomplete: 'off' });
  const corpo = el('div');
  const mostra = () => {
    corpo.replaceChildren();
    const q = normalizza(cerca.value);
    const vis = righe.filter((d) => !q || normalizza(`${d.nome} ${d.cognome}`).includes(q) || normalizza(`${d.cognome} ${d.nome}`).includes(q));
    const scaduto = vis.filter((d) => gruppoScadenza(d.scadenza, oggi) === 'scaduto').reduce((t, d) => t + d.residuo_cent, 0);
    const totale = vis.reduce((t, d) => t + d.residuo_cent, 0);
    corpo.append(el('div', { class: 'blocco' }, [el('div', { class: 'principale', testo: `Da incassare: ${euro(totale)}` }), el('div', { class: 'secondaria attenuato', testo: scaduto ? `di cui scaduti: ${euro(scaduto)}` : 'niente di scaduto' })]));
    if (!vis.length) { corpo.append(statoVuoto(righe.length ? 'Nessuno con questo nome.' : 'Niente da incassare. Bene.')); return; }
    for (const [k, titolo] of GRUPPI_SCADENZA) {
      const del = vis.filter((d) => gruppoScadenza(d.scadenza, oggi) === k);
      if (!del.length) continue;
      const elenco = el('div', { class: 'elenco' });
      for (const d of del) elenco.append(riga({ principale: `${d.nome} ${d.cognome}`.trim(), secondaria: [d.descrizione || d.motivo, d.scadenza ? 'scade il ' + d.scadenza.split('-').reverse().join('/') : null, d.pagato_cent ? `pagato ${euro(d.pagato_cent)}` : null, d.stato_allievo !== 'attivo' ? d.stato_allievo : null].filter(Boolean).join(' · '), destra: euro(d.residuo_cent), pallino: k === 'scaduto' ? 'errore' : k === 'questo_mese' ? 'attenzione' : 'info', onclick: lettura ? () => location.assign(`#/allievi/${d.allievo_id}/quote`) : () => foglioAddebitoAzioni(d, ridisegna) }));
      corpo.append(sezione(`${titolo} · ${del.length} · ${euro(del.reduce((t, d) => t + d.residuo_cent, 0))}`, elenco));
    }
  };
  cerca.addEventListener('input', mostra);
  main.append(el('div', { class: 'campo' }, [cerca]), corpo);
  mostra();
}

/* ---------- PAGAMENTI ---------- */
async function disegnaPagamenti(main, parametri, lettura, ridisegna) {
  const mese = /^\d{4}-\d{2}$/.test(parametri[0] || '') ? parametri[0] + '-01' : primoDelMese(oggiRoma());
  const nav = el('div', { class: 'mese-nav' }, [
    el('a', { class: 'tasto icona', href: `#/quote/pagamenti/${aggiungiMesi(mese, -1).slice(0, 7)}`, 'aria-label': 'Mese precedente' }, icona('indietro')),
    el('h2', { testo: formattaMese(mese) }),
    el('a', { class: 'tasto icona', href: `#/quote/pagamenti/${aggiungiMesi(mese, 1).slice(0, 7)}`, 'aria-label': 'Mese successivo' }, icona('freccia')),
  ]);
  main.append(nav, scheletri(3));
  const al = aggiungiGiorni(aggiungiMesi(mese, 1), -1);
  const [pag, incassi] = await Promise.all([pagamentiPeriodo(mese, al), incassiMesi()]);
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const t = totali(pag);
  main.append(el('div', { class: 'blocco' }, [
    el('div', { class: 'principale', testo: `Incassato: ${euro(t.netto)}` }),
    el('div', { class: 'secondaria attenuato', testo: [...Object.entries(t.perMetodo).map(([m, c]) => `${METODI[m] || m} ${euro(c)}`), t.rimborsi ? `rimborsi ${euro(t.rimborsi)}` : null].filter(Boolean).join(' · ') || 'nessun movimento' }),
  ]));
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo o una nota', autocomplete: 'off' });
  const corpo = el('div');
  const mostra = () => {
    corpo.replaceChildren();
    const q = normalizza(cerca.value);
    const vis = pag.filter((p) => !q || normalizza(`${p.allievi?.nome} ${p.allievi?.cognome} ${p.nota || ''}`).includes(q));
    if (!vis.length) { corpo.append(statoVuoto(pag.length ? 'Niente con questo nome.' : 'Nessun pagamento in questo mese.')); return; }
    const elenco = el('div', { class: 'elenco' });
    for (const p of vis) elenco.append(rigaPagamento(p, lettura ? null : () => foglioPagamentoAzioni(p, ridisegna)));
    corpo.append(sezione(`${vis.length} movimenti`, elenco));
  };
  cerca.addEventListener('input', mostra);
  main.append(el('div', { class: 'campo' }, [cerca]), corpo);
  mostra();
  const storico = el('div', { class: 'elenco' });
  const perMese = new Map();
  for (const r of incassi) { const k = r.mese; if (!perMese.has(k)) perMese.set(k, 0); perMese.set(k, perMese.get(k) + (r.tipo === 'rimborso' ? -1 : 1) * Number(r.totale_cent)); }
  for (const [m, c] of [...perMese.entries()].slice(0, 12)) storico.append(riga({ principale: formattaMese(m), destra: euro(c), href: `#/quote/pagamenti/${m.slice(0, 7)}` }));
  if (perMese.size) main.append(sezione('Mesi', storico));
}

/* ---------- TARIFFE ---------- */
async function disegnaTariffe(main, lettura, ridisegna) {
  main.append(scheletri(3));
  const tariffe = await tariffeTutte();
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const elenco = el('div', { class: 'elenco' });
  for (const t of tariffe) {
    const dettagli = [NOME_TIPO[t.tipo] || t.tipo, t.tipo === 'pacchetto' && t.n_lezioni ? `${t.n_lezioni} lezioni` : null, t.comprende_private ? 'comprende le private' : null, t.comprende_extra ? 'comprende le lezioni in più' : null, t.attiva ? null : 'non in uso'].filter(Boolean).join(' · ');
    elenco.append(riga({ principale: t.nome, secondaria: dettagli, destra: euro(t.importo_cent), pallino: t.attiva ? 'ok' : 'neutro', onclick: lettura ? null : () => foglioTariffa(t, ridisegna) }));
  }
  main.append(tariffe.length ? elenco : statoVuoto('Nessuna tariffa: scrivi le tue con “+ Tariffa”.'));
  main.append(el('p', { class: 'piccolo attenuato', style: null, testo: 'Le tariffe sono il listino. L\'abbonamento di ogni allievo si sceglie dalla sua scheda, in Quote. La tariffa “a lezione” si usa per le lezioni in più, quella “a ora di privata” per le private.' }));
}

function foglioTariffa(t, ridisegna) {
  const nome = el('input', { type: 'text', value: t?.nome || '', placeholder: 'es. Mensile adulti' });
  const importo = el('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: t ? (t.importo_cent / 100).toFixed(2) : '' });
  const tipo = el('select', {}, TIPI.map(([v, n]) => el('option', { value: v, testo: n })));
  tipo.value = t?.tipo || 'mensile';
  const nLezioni = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: t?.n_lezioni || '' });
  const campoN = campo('Quante lezioni', nLezioni);
  campoN.classList.toggle('nascosto', tipo.value !== 'pacchetto');
  tipo.addEventListener('change', () => campoN.classList.toggle('nascosto', tipo.value !== 'pacchetto'));
  const private_ = el('input', { type: 'checkbox' }); private_.checked = Boolean(t?.comprende_private);
  const extra = el('input', { type: 'checkbox' }); extra.checked = Boolean(t?.comprende_extra);
  const attiva = el('input', { type: 'checkbox' }); attiva.checked = t ? t.attiva : true;
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    errore.textContent = '';
    const cent = Math.round(parseFloat(String(importo.value).replace(',', '.')) * 100);
    if (!nome.value.trim()) { errore.textContent = 'Serve il nome.'; return; }
    if (!(cent >= 0)) { errore.textContent = 'Serve l\'importo.'; return; }
    salva.disabled = true;
    try {
      await salvaTariffa(t?.id || null, { nome: nome.value.trim(), importo_cent: cent, tipo: tipo.value, n_lezioni: tipo.value === 'pacchetto' ? (Number(nLezioni.value) || null) : null, comprende_private: private_.checked, comprende_extra: extra.checked, attiva: attiva.checked, ordine: t?.ordine ?? 9 });
      chiudi(); toast('Tariffa salvata.'); ridisegna();
    } catch (e) { errore.textContent = e.message || 'Non sono riuscito a salvare.'; } finally { salva.disabled = false; }
  } });
  const chiudi = apriFoglio(t ? t.nome : 'Nuova tariffa', el('div', {}, [
    campo('Nome', nome), el('div', { class: 'griglia-campi' }, [campo('Importo (€)', importo), campo('Tipo', tipo)]), campoN,
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Comprende le lezioni private' }), private_]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Comprende le lezioni in più' }), extra]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'In uso' }), attiva]),
    errore, salva,
  ]));
}
export { rigaAddebito };
