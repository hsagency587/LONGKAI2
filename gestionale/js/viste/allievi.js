/* Longkai — viste/allievi.js: l'elenco con ricerca e filtri, la scheda (Panoramica · Progressi · Presenze · Quote · Documenti · Dati).
   Il modulo dei dati, l'abbonamento e il caricamento dei documenti stanno in allievo-modulo.js. */
import { el, icona, euro } from '../base.js';
import { elencoAllieviCompleto, allievoCompleto, cambiaStatoAllievo, mettiFuori, esportaAllievo, unisciAllievi, eliminaAllievo, apriDocumento, rinnovaScadenza, annullaScadenza, salvaAllievo, soloLettura, impostazioni } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio, chiedi, vai } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { FILTRI, nomeCompleto, filtraAllievi, secondaRiga, pallinoAllievo, eta, eMinorenne, scadenzaProposta } from '../../comune/allievi.js';
import { oggiRoma, formattaData, relativa } from '../../comune/date.js';
import { giorniMancanti } from '../../comune/scadenze.js';
import { moduloAllievo, foglioAbbonamento, foglioCaricaDocumento, campo } from './allievo-modulo.js';
import { disegnaProgressi, disegnaPresenze } from './progressi.js';
import { foglioRegistraPagamento, foglioRimborso, foglioAddebito, foglioAddebitoAzioni, foglioPagamentoAzioni, rigaAddebito, rigaPagamento } from './quote-fogli.js';
import { movimentiAllievo } from '../dati.js';
import { fraseSaldo } from '../../comune/quote.js';
import { foglioNuovaPrivata } from './oggi.js';

const ETICHETTE_TIPO = { certificato: 'Certificato medico', tesseramento: 'Tesseramento', quota: 'Quota', altro: 'Altro' };
const SCHEDE = [['panoramica', 'Panoramica'], ['progressi', 'Progressi'], ['presenze', 'Presenze'], ['quote', 'Quote'], ['documenti', 'Documenti'], ['dati', 'Dati']];

export async function vistaAllievi(main, parametri) {
  const id = parametri[0];
  const scheda = parametri[1] || 'panoramica';
  if (!id) {
    testata('Allievi', { azione: el('a', { class: 'tasto azione', 'data-scrittura': '', href: '#/allievi/nuovo', testo: '+ Allievo' }) });
    await disegnaElenco(main, null);
    return;
  }
  if (id === 'nuovo') {
    testata('Nuovo allievo', { indietro: 'allievi' });
    await moduloAllievo(main, null);
    return;
  }
  if (matchMedia('(min-width: 840px)').matches) {
    const sx = el('div'); const dx = el('div', { class: 'scheda-dettaglio' });
    main.append(el('div', { class: 'elenco-dettaglio' }, [sx, dx]));
    await Promise.all([disegnaElenco(sx, id, true), disegnaScheda(dx, id, scheda)]);
  } else {
    await disegnaScheda(main, id, scheda);
  }
}

/* ---------- l'elenco ---------- */
async function disegnaElenco(box, selezionato, compatto = false) {
  box.append(scheletri(5));
  let tutti;
  try { tutti = await elencoAllieviCompleto(); } catch (e) { box.replaceChildren(); throw e; }
  box.replaceChildren();
  let filtro = (location.hash.match(/[?&]f=([a-z_]+)/) || [])[1] || 'tutti';
  if (!FILTRI.some(([k]) => k === filtro)) filtro = 'tutti';
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo', 'aria-label': 'Cerca un allievo', autocomplete: 'off' });
  const chips = el('div', { class: 'chips scorrevole', role: 'tablist' });
  const elenco = el('div', { class: 'elenco' });
  const conto = el('p', { class: 'piccolo attenuato' });
  function disegnaChips() {
    chips.replaceChildren();
    for (const [k, nome] of FILTRI) {
      const n = filtraAllievi(tutti, k).length;
      if (!n && !['tutti', 'usciti'].includes(k) && k !== filtro) continue; // un filtro vuoto non si mostra
      chips.append(el('button', { class: 'chip' + (k === filtro ? ' scelto' : ''), role: 'tab', 'aria-selected': k === filtro ? 'true' : 'false', testo: n ? `${nome} ${n}` : nome, onclick: () => { filtro = k; const base = location.hash.split('?')[0]; history.replaceState(null, '', k === 'tutti' ? base : `${base}?f=${k}`); disegnaChips(); mostra(); } }));
    }
  }
  function mostra() {
    const righe = filtraAllievi(tutti, filtro, normalizza, cerca.value);
    elenco.replaceChildren();
    conto.textContent = righe.length === 1 ? '1 allievo' : `${righe.length} allievi`;
    if (!righe.length) {
      elenco.append(statoVuoto(tutti.length ? (cerca.value ? 'Nessun allievo con questo nome.' : 'Nessuno in questo gruppo.') : 'Nessun allievo ancora: aggiungi il primo con “+ Allievo”.'));
      return;
    }
    for (const a of righe) {
      const r = riga({ principale: nomeCompleto(a), secondaria: secondaRiga(a), pallino: pallinoAllievo(a), href: `#/allievi/${a.id}`, destra: a.da_pagare_cent > 0 ? euro(a.da_pagare_cent) : null });
      if (a.id === selezionato) r.classList.add('selezionata');
      elenco.append(r);
    }
  }
  cerca.addEventListener('input', mostra);
  box.append(el('div', { class: 'campo' }, [cerca]), chips, conto, elenco);
  disegnaChips();
  mostra();
  if (!compatto) setTimeout(() => { if (!matchMedia('(pointer: coarse)').matches) cerca.focus(); }, 50);
}

/* ---------- la scheda ---------- */
async function disegnaScheda(box, id, scheda) {
  box.append(scheletri(4));
  let d;
  try { d = await allievoCompleto(id); } catch (e) { box.replaceChildren(); throw e; }
  box.replaceChildren();
  if (!d.allievo) { testata('Allievi', { indietro: 'allievi' }); box.append(statoVuoto('Questa scheda non esiste più.')); return; }
  const a = d.allievo;
  const lettura = soloLettura();
  testata(nomeCompleto(a), { indietro: 'allievi', azione: lettura ? null : el('a', { class: 'tasto azione', 'data-scrittura': '', href: `#/allievi/${id}/dati`, testo: 'Modifica' }) });
  const chips = el('div', { class: 'chips scorrevole', role: 'tablist' });
  for (const [k, nome] of SCHEDE) chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), role: 'tab', 'aria-selected': k === scheda ? 'true' : 'false', href: `#/allievi/${id}/${k}`, testo: nome }));
  box.append(chips, el('div', { class: 'spazio' }));
  const ridisegna = () => { box.replaceChildren(); disegnaScheda(box, id, scheda); };
  const contesto = { id, d, a, lettura, ridisegna, oggi: oggiRoma() };
  if (scheda === 'dati') { await moduloAllievo(box, contesto); return; }
  if (scheda === 'quote') { await disegnaQuote(box, contesto); return; }
  if (scheda === 'documenti') { await disegnaDocumenti(box, contesto); return; }
  if (scheda === 'progressi') { await disegnaProgressi(box, contesto); return; }
  if (scheda === 'presenze') { await disegnaPresenze(box, contesto); return; }
  disegnaPanoramica(box, contesto);
}

function chipStato(a) {
  const testo = a.stato === 'attivo' ? 'Attivo' : a.stato === 'sospeso' ? 'Sospeso' : 'Uscito' + (a.uscito_il ? ' il ' + formattaData(a.uscito_il, 'numerico') : '');
  return el('span', { class: 'stato-chip ' + a.stato, testo });
}

function disegnaPanoramica(box, { id, d, a, lettura, ridisegna, oggi }) {
  const anni = eta(a.nascita, oggi);
  const corsiAttivi = d.iscrizioni.filter((i) => !i.al || i.al >= oggi);
  const testa = el('div', { class: 'blocco' }, [
    el('div', { class: 'riga-stato' }, [chipStato(a), anni !== null ? el('span', { class: 'attenuato', testo: `${anni} anni` }) : null, eMinorenne(a.nascita, oggi) ? el('span', { class: 'chip extra', testo: 'MINORENNE' }) : null]),
    el('div', { class: 'secondaria attenuato', testo: corsiAttivi.length ? 'Corsi: ' + corsiAttivi.map((i) => `${i.corsi?.nome || ''} (${i.corsi?.citta || ''})`).join(', ') : 'Nessun corso: si iscrive da Dati.' }),
  ]);
  if (a.da_completare) testa.append(el('a', { class: 'avviso-riga', href: `#/allievi/${id}/dati` }, [icona('avviso'), 'Scheda da completare: mancano dei dati.']));
  box.append(sezione('Chi è', testa));

  // quote
  const s = d.saldo || {};
  const righeQuote = [];
  if (s.da_pagare_cent > 0) righeQuote.push(riga({ principale: 'Da pagare', destra: euro(s.da_pagare_cent), pallino: 'errore', href: `#/allievi/${id}/quote` }));
  else if (s.coperto_fino_al) righeQuote.push(riga({ principale: 'In regola fino al ' + formattaData(s.coperto_fino_al, 'numerico'), pallino: 'ok', href: `#/allievi/${id}/quote` }));
  else righeQuote.push(riga({ principale: 'Nessuna quota aperta', pallino: 'neutro', href: `#/allievi/${id}/quote` }));
  if (s.in_arrivo_cent > 0) righeQuote.push(riga({ principale: 'In arrivo', destra: euro(s.in_arrivo_cent), pallino: 'info', secondaria: s.prima_scadenza ? 'scade ' + relativa(s.prima_scadenza, oggi) : null }));
  const abbAttivo = d.abbonamenti.find((x) => !x.al || x.al >= oggi);
  if (abbAttivo) righeQuote.push(riga({ principale: abbAttivo.tariffe?.nome || 'Abbonamento', secondaria: `dal ${formattaData(abbAttivo.dal, 'numerico')}` + (abbAttivo.importo_personalizzato_cent != null ? ' · importo personalizzato' : ''), destra: euro(abbAttivo.importo_personalizzato_cent ?? abbAttivo.tariffe?.importo_cent), href: `#/allievi/${id}/quote` }));
  box.append(sezione('Quote', el('div', { class: 'elenco' }, righeQuote)));

  // scadenze
  const aperte = d.scadenze.filter((x) => x.stato === 'aperta');
  const righeSc = aperte.map((x) => {
    const g = giorniMancanti(x.data, oggi);
    return riga({ principale: ETICHETTE_TIPO[x.tipo] || x.tipo, secondaria: formattaData(x.data, 'numerico') + ' · ' + (g < 0 ? `scaduto ${-g} giorni fa` : g === 0 ? 'scade oggi' : `fra ${g} giorni`), pallino: g < 0 ? 'errore' : g <= 30 ? 'attenzione' : 'ok', href: `#/allievi/${id}/documenti` });
  });
  box.append(sezione('Scadenze', righeSc.length ? el('div', { class: 'elenco' }, righeSc) : statoVuoto('Nessuna scadenza registrata.', lettura ? null : el('a', { class: 'tasto bordo', 'data-scrittura': '', href: `#/allievi/${id}/documenti`, testo: 'Carica un documento' }))));

  // contatti
  const contatti = [];
  if (a.telefono) contatti.push(riga({ principale: a.telefono, secondaria: 'telefono', href: 'tel:' + a.telefono.replace(/\s+/g, '') }));
  if (a.email) contatti.push(riga({ principale: a.email, secondaria: 'email', href: 'mailto:' + a.email }));
  if (a.tutore_nome || a.tutore_telefono) contatti.push(riga({ principale: a.tutore_nome || 'Tutore', secondaria: ['tutore', a.tutore_telefono, a.tutore_email].filter(Boolean).join(' · '), href: a.tutore_telefono ? 'tel:' + a.tutore_telefono.replace(/\s+/g, '') : null }));
  if (a.emergenza_contatto) contatti.push(riga({ principale: a.emergenza_contatto, secondaria: 'contatto di emergenza' }));
  if (contatti.length) box.append(sezione('Contatti', el('div', { class: 'elenco' }, contatti)));

  const altro = [];
  if (a.soprannomi?.length) altro.push(riga({ principale: a.soprannomi.join(', '), secondaria: 'come lo chiama il Sifu' }));
  if (a.famiglia) altro.push(riga({ principale: a.famiglia, secondaria: 'famiglia' }));
  if (a.note) altro.push(riga({ principale: a.note, secondaria: 'note' }));
  if (altro.length) box.append(sezione('Altro', el('div', { class: 'elenco' }, altro)));

  if (lettura) return;
  const tasti = el('div', { class: 'tasti', 'data-scrittura': '' });
  if (a.stato === 'attivo') tasti.append(el('button', { class: 'tasto bordo', testo: 'Sospendi', onclick: async () => { try { await cambiaStatoAllievo(id, 'sospeso'); toast('Sospeso.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  if (a.stato === 'sospeso') tasti.append(el('button', { class: 'tasto bordo', testo: 'Riattiva', onclick: async () => { try { await cambiaStatoAllievo(id, 'attivo'); toast('Di nuovo attivo.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  if (a.stato !== 'uscito') tasti.append(el('button', { class: 'tasto bordo', testo: 'Segna una privata', onclick: async () => { const imp = await impostazioni().catch(() => ({})); foglioNuovaPrivata(oggi, imp.private || {}, ridisegna, id); } }));
  if (a.stato !== 'uscito') tasti.append(el('button', { class: 'tasto bordo', testo: 'Metti fuori', onclick: async () => {
    const ok = await chiedi('Metterlo fuori?', 'Esce dai corsi e dagli abbonamenti da oggi. Le sue private future si annullano. I periodi non ancora iniziati non si pagano. Resta tutto nello storico.', [{ testo: 'Metti fuori', valore: true, classe: 'terracotta' }, { testo: 'Resta', valore: false }]);
    if (!ok) return;
    try { const resto = await mettiFuori(id); toast(resto > 0 ? `Messo fuori. Deve ancora ${euro(resto)}.` : 'Messo fuori.'); ridisegna(); } catch (e) { avvisa(e.message); }
  } }));
  if (a.stato === 'uscito') tasti.append(el('button', { class: 'tasto bordo', testo: 'Riprendi', onclick: async () => { try { await cambiaStatoAllievo(id, 'attivo'); toast('Di nuovo dentro: controlla corsi e abbonamento.'); vai(`allievi/${id}/dati`); } catch (e) { avvisa(e.message); } } }));
  tasti.append(el('button', { class: 'tasto bordo', testo: 'Esporta i suoi dati', onclick: async () => {
    try {
      const dati = await esportaAllievo(id);
      const blob = new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' });
      const link = el('a', { href: URL.createObjectURL(blob), download: `${nomeCompleto(a).replace(/\s+/g, '-') || 'allievo'}-dati.json` });
      document.body.append(link); link.click(); link.remove();
      toast('File pronto.');
    } catch (e) { avvisa(e.message); }
  } }));
  tasti.append(el('button', { class: 'tasto bordo', testo: 'Unisci con un\'altra scheda', onclick: () => foglioUnisci(id, a, ridisegna) }));
  if (a.stato === 'uscito') tasti.append(el('button', { class: 'tasto pericolo', testo: 'Elimina', onclick: async () => {
    const ok = await chiedi('Eliminare la scheda?', 'Sparisce tutto quello che lo riguarda: presenze, contenuti, documenti. Non si torna indietro. Se ha pagamenti registrati non si può.', [{ testo: 'Elimina', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]);
    if (!ok) return;
    try { await eliminaAllievo(id); toast('Scheda eliminata.'); vai('allievi'); } catch (e) { avvisa(e.message); }
  } }));
  box.append(sezione('Azioni', el('div', { class: 'blocco' }, tasti)));
}

function foglioUnisci(id, a, ridisegna) {
  const cerca = el('input', { type: 'search', placeholder: 'Cerca l\'altra scheda', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const box = el('div', {}, [el('p', { class: 'attenuato', testo: `Tutto passa su ${nomeCompleto(a)}; l'altra scheda esce. Si fa quando la stessa persona ha due schede (per esempio creata a voce e poi a mano).` }), el('div', { class: 'campo' }, [cerca]), elenco]);
  let tutti = [];
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = tutti.filter((x) => x.id !== id && (!q || normalizza(nomeCompleto(x)).includes(q) || (x.soprannomi || []).some((s) => normalizza(s).includes(q)))).slice(0, 8);
    if (!righe.length) elenco.append(statoVuoto('Nessuna scheda.'));
    for (const x of righe) elenco.append(riga({ principale: nomeCompleto(x), secondaria: secondaRiga(x), pallino: pallinoAllievo(x), onclick: async () => {
      const ok = await chiedi('Unire?', `${nomeCompleto(x)} viene unito a ${nomeCompleto(a)}. La scheda di ${nomeCompleto(x)} esce con una nota.`, [{ testo: 'Unisci', valore: true, classe: 'pieno' }, { testo: 'No', valore: false }]);
      if (!ok) return;
      try { await unisciAllievi(id, x.id); chiudi(); toast('Schede unite.'); ridisegna(); } catch (e) { avvisa(e.message); }
    } }));
  };
  const chiudi = apriFoglio('Unisci con un\'altra scheda', box);
  elencoAllieviCompleto().then((t) => { tutti = t; mostra(); }).catch((e) => avvisa(e.message));
  cerca.addEventListener('input', mostra);
}

/* ---------- quote ---------- */
async function disegnaQuote(box, { id, d, a, lettura, ridisegna, oggi }) {
  const s = d.saldo || {};
  const frase = fraseSaldo(s, euro, (x) => formattaData(x, 'numerico'));
  const righe = [
    riga({ principale: frase.testo, pallino: frase.tono }),
    riga({ principale: 'Da pagare', destra: euro(s.da_pagare_cent || 0), pallino: s.da_pagare_cent > 0 ? 'errore' : 'ok' }),
    riga({ principale: 'In arrivo', destra: euro(s.in_arrivo_cent || 0), pallino: 'info', secondaria: s.prima_scadenza ? 'prossima scadenza ' + formattaData(s.prima_scadenza, 'numerico') : null }),
  ];
  if (s.credito_cent > 0) righe.push(riga({ principale: 'Credito', destra: euro(s.credito_cent), pallino: 'ok' }));
  if (s.coperto_fino_al) righe.push(riga({ principale: 'Coperto fino al', destra: formattaData(s.coperto_fino_al, 'numerico') }));
  box.append(sezione('Saldo', el('div', { class: 'elenco' }, righe)));
  const attivi = d.abbonamenti.filter((x) => !x.al || x.al >= oggi);
  const passati = d.abbonamenti.filter((x) => x.al && x.al < oggi);
  const elenco = el('div', { class: 'elenco' });
  for (const ab of attivi) elenco.append(riga({ principale: ab.tariffe?.nome || 'Abbonamento', secondaria: `dal ${formattaData(ab.dal, 'numerico')}` + (ab.al ? ` al ${formattaData(ab.al, 'numerico')}` : '') + (ab.rinnovo_automatico ? ' · si rinnova' : ' · non si rinnova') + (ab.nota ? ' · ' + ab.nota : ''), destra: euro(ab.importo_personalizzato_cent ?? ab.tariffe?.importo_cent), onclick: lettura ? null : () => foglioAbbonamento(id, ab, ridisegna) }));
  if (!attivi.length) elenco.append(statoVuoto('Nessun abbonamento attivo.'));
  box.append(sezione('Abbonamento', elenco, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: attivi.length ? 'Cambia' : '+ Abbonamento', onclick: () => foglioAbbonamento(id, attivi[0] || null, ridisegna) })));
  if (passati.length) {
    const vecchi = el('div', { class: 'elenco' });
    for (const ab of passati) vecchi.append(riga({ principale: ab.tariffe?.nome || 'Abbonamento', secondaria: `dal ${formattaData(ab.dal, 'numerico')} al ${formattaData(ab.al, 'numerico')}`, destra: euro(ab.importo_personalizzato_cent ?? ab.tariffe?.importo_cent) }));
    box.append(sezione('Abbonamenti passati', vecchi));
  }
  // movimenti: addebiti e pagamenti, con le azioni
  const mov = await movimentiAllievo(id);
  const tasti = lettura ? null : el('div', { class: 'tasti', 'data-scrittura': '' }, [
    el('button', { class: 'tasto pieno', testo: '+ Pagamento', onclick: () => foglioRegistraPagamento({ allievo: a, dopo: ridisegna }) }),
    el('button', { class: 'tasto bordo', testo: '+ Addebito', onclick: () => foglioAddebito({ allievo: a, dopo: ridisegna }) }),
    s.credito_cent > 0 ? el('button', { class: 'tasto bordo', testo: 'Rimborso', onclick: () => foglioRimborso({ allievo: a, creditoCent: s.credito_cent, dopo: ridisegna }) }) : null,
  ]);
  const aperti = mov.addebiti.filter((x) => x.stato === 'da_pagare');
  const chiusi = mov.addebiti.filter((x) => x.stato !== 'da_pagare');
  const e1 = el('div', { class: 'elenco' });
  for (const x of aperti) e1.append(rigaAddebito(x, lettura ? null : () => foglioAddebitoAzioni({ ...x, allievo_id: id, nome: a.nome, cognome: a.cognome, telefono: a.telefono }, ridisegna)));
  if (!aperti.length) e1.append(statoVuoto('Niente da pagare.'));
  box.append(sezione('Da pagare', [tasti, e1].filter(Boolean)));
  const e2 = el('div', { class: 'elenco' });
  for (const p of mov.pagamenti) e2.append(rigaPagamento(p, lettura ? null : () => foglioPagamentoAzioni({ ...p, allievo_id: id }, ridisegna)));
  if (!mov.pagamenti.length) e2.append(statoVuoto('Nessun pagamento ancora.'));
  box.append(sezione('Pagamenti', e2));
  if (chiusi.length) {
    const e3 = el('div', { class: 'elenco' });
    for (const x of chiusi.slice(0, 30)) e3.append(rigaAddebito(x, null));
    box.append(sezione('Addebiti chiusi', e3));
  }
}

/* ---------- documenti ---------- */
async function disegnaDocumenti(box, { id, d, a, lettura, ridisegna, oggi }) {
  const imp = await impostazioni().catch(() => ({}));
  const elenco = el('div', { class: 'elenco' });
  for (const doc of d.documenti) {
    elenco.append(riga({ principale: doc.nome, secondaria: [ETICHETTE_TIPO[doc.tipo] || doc.tipo, doc.data ? 'del ' + formattaData(doc.data, 'numerico') : null, doc.scadenza ? 'scade il ' + formattaData(doc.scadenza, 'numerico') : null, doc.dimensione ? Math.max(1, Math.round(doc.dimensione / 1024)) + ' KB' : null].filter(Boolean).join(' · '), pallino: doc.mime === 'application/pdf' ? 'info' : 'neutro', onclick: lettura ? null : () => apriFile(() => apriDocumento(doc.id)) }));
  }
  if (!d.documenti.length) elenco.append(statoVuoto(lettura ? 'Nessun documento.' : 'Nessun documento: carica il certificato medico o il tesseramento.'));
  box.append(sezione('Documenti', elenco, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Carica', onclick: () => foglioCaricaDocumento(id, imp.scadenze || {}, ridisegna) })));

  const aperte = d.scadenze.filter((x) => x.stato === 'aperta');
  const sc = el('div', { class: 'elenco' });
  for (const x of aperte) {
    const g = giorniMancanti(x.data, oggi);
    sc.append(riga({ principale: ETICHETTE_TIPO[x.tipo] || x.tipo, secondaria: formattaData(x.data, 'numerico') + ' · ' + (g < 0 ? `scaduto ${-g} giorni fa` : g === 0 ? 'scade oggi' : `fra ${g} giorni`), pallino: g < 0 ? 'errore' : g <= 30 ? 'attenzione' : 'ok', onclick: lettura || x.tipo === 'quota' ? null : () => foglioRinnova(id, x, imp.scadenze || {}, ridisegna) }));
  }
  if (!aperte.length) sc.append(statoVuoto('Nessuna scadenza aperta.'));
  box.append(sezione('Scadenze', sc, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Scadenza', onclick: () => foglioRinnova(id, null, imp.scadenze || {}, ridisegna) })));

  // salute ed emergenze
  const emergenza = el('input', { type: 'text', value: a.emergenza_contatto || '', placeholder: 'Nome e telefono di chi chiamare', autocomplete: 'off' });
  const mediche = el('textarea', { rows: '3', placeholder: 'Allergie, condizioni da sapere, farmaci. Solo quello che serve in palestra.' });
  mediche.value = a.note_mediche || '';
  const salva = el('button', { class: 'tasto pieno', 'data-scrittura': '', testo: 'Salva', onclick: async () => {
    try { await salvaAllievo(id, { emergenza_contatto: emergenza.value.trim() || null, note_mediche: mediche.value.trim() || null }, a.aggiornato_il); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); }
  } });
  if (lettura) { emergenza.disabled = true; mediche.disabled = true; }
  box.append(sezione('Salute ed emergenze', el('div', { class: 'blocco' }, [campo('Contatto di emergenza', emergenza), campo('Note mediche', mediche), lettura ? null : salva])));
}

/** Apre un file in un'altra scheda del browser: la finestra si apre subito (altrimenti il telefono la blocca), l'indirizzo arriva dopo. */
async function apriFile(prendiUrl) {
  const w = globalThis.open('', '_blank');
  try {
    const url = await prendiUrl();
    if (w) w.location.replace(url); else location.assign(url);
  } catch (e) {
    if (w) w.close();
    avvisa(e.message || 'Non riesco ad aprire il file.');
  }
}

function foglioRinnova(allievoId, scadenza, impScadenze, ridisegna) {
  const tipo = el('select', {}, [el('option', { value: 'certificato', testo: 'Certificato medico' }), el('option', { value: 'tesseramento', testo: 'Tesseramento' })]);
  if (scadenza) { tipo.value = scadenza.tipo; tipo.disabled = true; }
  const oggi = oggiRoma();
  const data = el('input', { type: 'date', value: scadenzaProposta(tipo.value, oggi, impScadenze) || oggi });
  tipo.addEventListener('change', () => { data.value = scadenzaProposta(tipo.value, oggi, impScadenze) || oggi; });
  const salva = el('button', { class: 'tasto pieno grande', testo: scadenza ? 'Segna rinnovata' : 'Aggiungi', onclick: async () => {
    if (!data.value) { avvisa('Serve la data.'); return; }
    salva.disabled = true;
    try { await rinnovaScadenza(allievoId, tipo.value, data.value); chiudi(); toast(scadenza ? 'Scadenza rinnovata.' : 'Scadenza aggiunta.'); ridisegna(); } catch (e) { avvisa(e.message); } finally { salva.disabled = false; }
  } });
  const figli = [
    el('p', { class: 'attenuato', testo: scadenza ? 'Se hai il documento nuovo, caricalo da “+ Carica”: la scadenza si rinnova da sola. Qui la segni a mano.' : 'La nuova scadenza, senza documento. Se hai il documento, usa “+ Carica”.' }),
    campo('Cosa', tipo), campo('Scade il', data), salva,
  ];
  if (scadenza) figli.push(el('button', { class: 'tasto pericolo', testo: 'Annulla questa scadenza', onclick: async () => {
    const ok = await chiedi('Annullare?', 'La scadenza sparisce dagli avvisi. Il documento resta.', [{ testo: 'Annulla la scadenza', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]);
    if (!ok) return;
    try { await annullaScadenza(scadenza.id); chiudi(); toast('Scadenza annullata.'); ridisegna(); } catch (e) { avvisa(e.message); }
  } }));
  const chiudi = apriFoglio(scadenza ? 'Rinnova la scadenza' : 'Nuova scadenza', el('div', {}, figli));
}
