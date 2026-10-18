/* Longkai — viste/quote.js: Da incassare (chi deve pagare, quanto, entro quando) · Pagamenti (mese per mese).
   La quota di ogni allievo si imposta nella sua scheda: quanto paga, ogni quanto, quando ha pagato l'ultima volta. */
import { el, euro, icona } from '../base.js';
import { daIncassare, pagamentiPeriodo, incassiMesi, elencoAllieviCompleto, soloLettura } from '../dati.js';
import { testata, statoVuoto, riga, sezione, scheletri, azioneFissa } from '../ui.js';
import { oggiRoma, formattaMese, formattaData, primoDelMese, aggiungiMesi, aggiungiGiorni } from '../../comune/date.js';
import { gruppoScadenza, GRUPPI_SCADENZA, totali, METODI } from '../../comune/quote.js';
import { giorniMancanti } from '../../comune/scadenze.js';
import { normalizza } from '../../comune/fonetica.js';
import { foglioRegistraPagamento, foglioAddebitoAzioni, foglioPagamentoAzioni, rigaPagamento } from './quote-fogli.js';

export async function vistaQuote(main, parametri) {
  const scheda = parametri[0] === 'pagamenti' ? 'pagamenti' : 'incassare';
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaQuote(main, parametri); };
  testata('Quote');
  azioneFissa({ testo: 'Pagamento', onclick: () => foglioRegistraPagamento({ dopo: ridisegna }) });
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of [['incassare', 'Da incassare'], ['pagamenti', 'Pagamenti']]) chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/quote/' + k, testo: nome }));
  main.append(chips, el('div', { class: 'spazio' }));
  if (scheda === 'pagamenti') { await disegnaPagamenti(main, parametri.slice(1), lettura, ridisegna); return; }
  await disegnaDaIncassare(main, lettura, ridisegna);
}

/* ---------- DA INCASSARE: per allievo, quanto e entro quando; poi chi è in regola e chi è senza quota ---------- */
async function disegnaDaIncassare(main, lettura, ridisegna) {
  main.append(scheletri(3));
  const [righe, allievi] = await Promise.all([daIncassare(), elencoAllieviCompleto()]);
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const oggi = oggiRoma();
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo', autocomplete: 'off' });
  const corpo = el('div');
  const mostra = () => {
    corpo.replaceChildren();
    const q = normalizza(cerca.value);
    const nomeOk = (nome, cognome) => !q || normalizza(`${nome} ${cognome}`).includes(q) || normalizza(`${cognome} ${nome}`).includes(q);
    const vis = righe.filter((d) => nomeOk(d.nome, d.cognome));
    const totale = vis.reduce((t, d) => t + d.residuo_cent, 0);
    const scaduto = vis.filter((d) => gruppoScadenza(d.scadenza, oggi) === 'scaduto').reduce((t, d) => t + d.residuo_cent, 0);
    corpo.append(el('div', { class: 'blocco' }, [el('div', { class: 'principale', testo: `Da incassare: ${euro(totale)}` }), scaduto ? el('div', { class: 'secondaria attenuato', testo: `di cui scaduti: ${euro(scaduto)}` }) : null]));
    for (const [k, titolo] of GRUPPI_SCADENZA) {
      const del = vis.filter((d) => gruppoScadenza(d.scadenza, oggi) === k);
      if (!del.length) continue;
      const elenco = el('div', { class: 'elenco' });
      for (const d of del) {
        const g = d.scadenza ? giorniMancanti(d.scadenza, oggi) : null;
        const quando = g === null ? '' : g < 0 ? `scaduto da ${-g} giorni` : g === 0 ? 'entro oggi' : `entro il ${formattaData(d.scadenza, 'numerico')}`;
        elenco.append(riga({ principale: `${d.nome} ${d.cognome}`.trim(), secondaria: [quando, d.pagato_cent ? `pagato ${euro(d.pagato_cent)}` : null, d.stato_allievo !== 'attivo' ? d.stato_allievo : null].filter(Boolean).join(' · '), destra: euro(d.residuo_cent), pallino: k === 'scaduto' ? 'errore' : k === 'questo_mese' ? 'attenzione' : 'info', onclick: lettura ? () => location.assign(`#/allievi/${d.allievo_id}/quote`) : () => foglioAddebitoAzioni(d, ridisegna) }));
      }
      corpo.append(sezione(`${titolo} · ${del.length} · ${euro(del.reduce((t, d) => t + d.residuo_cent, 0))}`, elenco));
    }
    if (!vis.length) corpo.append(statoVuoto(righe.length ? 'Nessuno con questo nome.' : 'Niente da incassare.'));
    // gli altri: in regola (con la data) e senza quota
    const conDebito = new Set(righe.map((d) => d.allievo_id));
    const attivi = allievi.filter((a) => a.stato === 'attivo' && !conDebito.has(a.id) && nomeOk(a.nome, a.cognome));
    const inRegola = attivi.filter((a) => a.coperto_fino_al);
    const senza = attivi.filter((a) => !a.coperto_fino_al && !a.protetto);
    if (inRegola.length) {
      const e = el('div', { class: 'elenco' });
      for (const a of inRegola) e.append(riga({ principale: `${a.nome} ${a.cognome}`.trim(), secondaria: `prossima entro il ${formattaData(aggiungiGiorni(a.coperto_fino_al, 1), 'numerico')}`, pallino: 'ok', href: `#/allievi/${a.id}/quote` }));
      corpo.append(sezione(`In regola · ${inRegola.length}`, e));
    }
    if (senza.length) {
      const e = el('div', { class: 'elenco' });
      for (const a of senza) e.append(riga({ principale: `${a.nome} ${a.cognome}`.trim(), secondaria: 'quota da impostare', pallino: 'neutro', href: `#/allievi/${a.id}/quote` }));
      corpo.append(sezione(`Senza quota · ${senza.length}`, e));
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
