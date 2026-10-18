/* Longkai — viste/correggi.js: "Correggi parlando", per ogni cosa. Si sceglie la cosa (una forma, un termine, un allievo,
   le tariffe, i corsi, le impostazioni, il programma), l'app la mostra tutta e la legge se serve, il Sifu dice le modifiche
   (o le scrive), Claude le propone prima → dopo, il Sifu spunta e conferma. Ogni correzione resta nella cronologia. */
import { el, icona } from '../base.js';
import { argomentiTutti, elencoAllieviCompleto, allievoCompleto, tariffeTutte, corsiCompleti, impostazioni, prossimeSessioni, programmiMesi, trascrivi, riordina, applicaCorrezioni, versioniRecenti, ripristinaArgomento, soloLettura } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, chiedi } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { oggiRoma, formattaData, formattaOra, formattaMese, primoDelMese, aggiungiMesi } from '../../comune/date.js';
import { nomeCompleto } from '../../comune/allievi.js';
import { registratore } from './detta.js';
import { estensioneDi } from '../voce.js';
import { campo } from './allievo-modulo.js';

const VOCI = [
  ['Forme', 'forme', 'Siu Nim Tao, Chum Kiu, le sezioni e i movimenti'],
  ['Tecniche e glossario', 'argomento', 'nomi, sinonimi, aree'],
  ['Pronunce', 'pronunce', 'come il Sifu dice le cose'],
  ['Allievi', 'allievo', 'dati, corsi, tariffa, soprannomi'],
  ['Corsi', 'corsi', 'giorni, ore, durata, sospensioni'],
  ['Tariffe e abbonamenti', 'tariffe', 'il listino'],
  ['Avvisi, soglie e testi', 'impostazioni', 'le impostazioni che si cambiano a voce'],
  ['Programma', 'programma', 'il mese, la prossima volta, i piani personali'],
];
const GIORNI = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export async function vistaCorreggi(main, parametri) {
  if (soloLettura()) { testata('Correggi parlando', { indietro: 'altro' }); main.append(statoVuoto('Solo il Sifu può correggere.')); return; }
  const voce = parametri[0];
  const id = parametri[1];
  if (!voce) { testata('Correggi parlando', { indietro: 'altro' }); await disegnaScelta(main); return; }
  if ((voce === 'forme' || voce === 'argomento' || voce === 'pronunce') && !id) { testata(VOCI.find((v) => v[1] === voce)?.[0] || 'Argomento', { indietro: 'correggi' }); await sceltaArgomento(main, voce); return; }
  if (voce === 'allievo' && !id) { testata('Allievi', { indietro: 'correggi' }); await sceltaAllievo(main); return; }
  const ambito = voce === 'forme' || voce === 'pronunce' ? 'argomento' : voce;
  testata('Correggi parlando', { indietro: id ? `correggi/${voce}` : 'correggi' });
  await disegnaCorrezione(main, ambito, id || null);
}

/* ---------- la scelta ---------- */
async function disegnaScelta(main) {
  const elenco = el('div', { class: 'elenco' });
  for (const [nome, k, aiuto] of VOCI) elenco.append(riga({ principale: nome, secondaria: aiuto, href: `#/correggi/${k}` }));
  main.append(el('p', { class: 'attenuato', testo: 'Tocca la cosa da correggere: te la faccio vedere tutta, poi dici cosa cambiare.' }), elenco, scheletri(2));
  let versioni = [];
  try { versioni = await versioniRecenti(); } catch { /* niente */ }
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const cr = el('div', { class: 'elenco' });
  for (const v of versioni.slice(0, 20)) {
    const cosa = v.genere === 'argomento' ? (v.argomenti?.nome || 'argomento') : v.campo;
    cr.append(riga({ principale: cosa, secondaria: [formattaData(String(v.creato_il).slice(0, 10), 'numerico'), v.testo_detto ? '“' + v.testo_detto.slice(0, 80) + '”' : 'a mano'].join(' · '), pallino: 'neutro', onclick: v.genere === 'argomento' && v.prima ? async () => {
      const ok = await chiedi('Ripristinare?', `${cosa} torna com'era prima di questa correzione.`, [{ testo: 'Ripristina', valore: true, classe: 'pieno' }, { testo: 'Lascia', valore: false }]);
      if (!ok) return;
      try { await ripristinaArgomento(v); toast('Ripristinato.'); main.replaceChildren(); disegnaScelta(main); } catch (e) { avvisa(e.message); }
    } : null }));
  }
  if (!versioni.length) cr.append(statoVuoto('Nessuna correzione ancora.'));
  main.append(sezione('Cronologia delle correzioni', cr));
}

async function sceltaArgomento(main, voce) {
  main.append(scheletri(4));
  const tutti = (await argomentiTutti()).filter((a) => voce !== 'forme' || a.area === 'Forme');
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const cerca = el('input', { type: 'search', placeholder: 'Cerca', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    for (const a of tutti.filter((x) => !q || normalizza(x.nome).includes(q) || (x.pronunce || []).some((p) => normalizza(p).includes(q)) || (x.sinonimi || []).some((p) => normalizza(p).includes(q))).slice(0, 40)) {
      elenco.append(riga({ principale: a.nome + (a.attivo ? '' : ' (spento)'), secondaria: [a.area, a.pronunce?.length ? 'dice: ' + a.pronunce.join(', ') : null].filter(Boolean).join(' · '), href: `#/correggi/${voce}/${a.id}` }));
    }
    if (!elenco.childElementCount) elenco.append(statoVuoto('Niente con questo nome.'));
  };
  cerca.addEventListener('input', mostra);
  main.append(el('div', { class: 'campo' }, [cerca]), elenco);
  mostra();
}

async function sceltaAllievo(main) {
  main.append(scheletri(4));
  const tutti = (await elencoAllieviCompleto()).filter((a) => a.stato !== 'uscito');
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    for (const a of tutti.filter((x) => !q || normalizza(nomeCompleto(x)).includes(q) || (x.soprannomi || []).some((p) => normalizza(p).includes(q))).slice(0, 40)) elenco.append(riga({ principale: nomeCompleto(a), secondaria: a.corsi || a.citta, href: `#/correggi/allievo/${a.id}` }));
    if (!elenco.childElementCount) elenco.append(statoVuoto('Nessuno.'));
  };
  cerca.addEventListener('input', mostra);
  main.append(el('div', { class: 'campo' }, [cerca]), elenco);
  mostra();
}

/* ---------- lo stato attuale, in una pagina sola ---------- */
async function statoAttuale(ambito, id) {
  const righe = []; // [principale, secondaria]
  let titolo = '';
  if (ambito === 'argomento') {
    const a = (await argomentiTutti()).find((x) => x.id === id);
    if (!a) return null;
    titolo = a.nome;
    righe.push(['Area', a.area], ['Pronunce del Sifu', (a.pronunce || []).join(', ') || 'nessuna'], ['Sinonimi', (a.sinonimi || []).join(', ') || 'nessuno'], ['In uso', a.attivo ? 'sì' : 'no']);
    if (Array.isArray(a.sezioni) && a.sezioni.length) a.sezioni.forEach((s, i) => righe.push([`${i + 1}ª sezione: ${s.nome || ''}`, (s.movimenti || []).join(' · ') || 'nessun movimento']));
  } else if (ambito === 'allievo') {
    const d = await allievoCompleto(id);
    if (!d?.allievo) return null;
    const a = d.allievo; const oggi = oggiRoma();
    titolo = nomeCompleto(a);
    righe.push(['Nascita', a.nascita ? formattaData(a.nascita, 'numerico') : '—'], ['Città', a.citta || '—'], ['Telefono', a.telefono || '—'], ['Email', a.email || '—'], ['Stato', a.stato], ['Soprannomi', (a.soprannomi || []).join(', ') || 'nessuno']);
    righe.push(['Corsi', d.iscrizioni.filter((i) => !i.al || i.al >= oggi).map((i) => `${i.corsi?.nome} · ${i.corsi?.citta}`).join(', ') || 'nessuno']);
    righe.push(['Abbonamento', d.abbonamenti.filter((x) => !x.al || x.al >= oggi).map((x) => x.tariffe?.nome).join(', ') || 'nessuno']);
    if (a.tutore_nome) righe.push(['Tutore', `${a.tutore_nome} ${a.tutore_telefono || ''}`]);
    if (a.note) righe.push(['Note', a.note]);
  } else if (ambito === 'tariffe') {
    titolo = 'Tariffe';
    for (const t of await tariffeTutte()) righe.push([t.nome + (t.attiva ? '' : ' (non in uso)'), `${(t.importo_cent / 100).toFixed(2)} € · ${t.tipo}`]);
    if (!righe.length) righe.push(['Nessuna tariffa', 'dille a voce: “nuova tariffa mensile a sessanta euro”']);
  } else if (ambito === 'corsi') {
    titolo = 'Corsi';
    for (const c of await corsiCompleti()) righe.push([`${c.nome} · ${c.citta}` + (c.attivo ? '' : ' (spento)'), [...(c.corsi_orari || [])].sort((x, y) => x.giorno - y.giorno).map((o) => `${GIORNI[o.giorno]} ${formattaOra(o.ora)}`).join(', ') + ` · ${c.durata_minuti} min` + (c.sospeso_dal ? ` · sospeso dal ${formattaData(c.sospeso_dal, 'numerico')}` : '')]);
  } else if (ambito === 'impostazioni') {
    titolo = 'Avvisi, soglie e testi';
    const v = await impostazioni();
    righe.push(['Avvisi a (giorni prima)', (v.scadenze?.soglie || []).join(', ')], ['Il certificato dura (mesi)', v.scadenze?.certificato_mesi], ['Il tesseramento dura (mesi)', v.scadenze?.tesseramento_mesi], ['Da richiamare dopo N lezioni', v.scadenze?.da_richiamare_lezioni], ['Ora degli avvisi', v.scadenze?.ora_avvisi], ['Promemoria serale', v.scadenze?.promemoria_serale], ['Le private durano (minuti)', v.private?.durata_minuti], ['Settimane di private create', v.private?.settimane_avanti], ['Non toccati da (giorni)', v.programma?.non_toccati_giorni], ['Dettatura di partenza', v.voce?.modo], ['Tetto mensile IA (€)', ((v.ia?.tetto_mensile_cent ?? 500) / 100).toFixed(0)], ['Testo promemoria certificato', v.promemoria_allievi?.testi?.certificato], ['Testo promemoria tesseramento', v.promemoria_allievi?.testi?.tesseramento], ['Testo promemoria quota', v.promemoria_allievi?.testi?.quota]);
  } else if (ambito === 'programma') {
    titolo = 'Programma';
    const oggi = oggiRoma();
    const [prossime, mesi, arg, corsi] = await Promise.all([prossimeSessioni(), programmiMesi([primoDelMese(oggi), aggiungiMesi(primoDelMese(oggi), 1)]), argomentiTutti(), corsiCompleti()]);
    const nome = (x) => arg.find((a) => a.id === x)?.nome || '…';
    for (const m of mesi) { const c = corsi.find((x) => x.id === m.corso_id); righe.push([`${c?.nome || ''} · ${c?.citta || ''} · ${formattaMese(m.mese)}`, (m.programma_argomenti || []).sort((a, b) => a.ordine - b.ordine).map((x) => nome(x.argomento_id)).join(', ') + (m.nota ? ' · ' + m.nota : '')]); }
    for (const s of prossime.filter((x) => x.stato === 'prevista').slice(0, 8)) righe.push([`${formattaData(s.data, 'breve')} ${formattaOra(s.ora)} · ${s.tipo === 'privata' ? 'privata ' + (s.allievo_nome || '') : s.corso_nome + ' · ' + s.citta}`, (s.previsto_argomenti || []).map(nome).join(', ') || 'niente di previsto']);
  }
  return { titolo, righe: righe.map(([p, s]) => [String(p), s == null ? '—' : String(s)]) };
}

/* ---------- la correzione ---------- */
async function disegnaCorrezione(main, ambito, id) {
  main.append(scheletri(3));
  let st;
  try { st = await statoAttuale(ambito, id); } catch (e) { main.replaceChildren(); throw e; }
  main.replaceChildren();
  if (!st) { main.append(statoVuoto('Non trovo questa cosa.')); return; }
  const ridisegna = () => { main.replaceChildren(); disegnaCorrezione(main, ambito, id); };
  const blocco = el('div', { class: 'elenco' });
  for (const [p, s] of st.righe) blocco.append(riga({ principale: p, secondaria: s }));
  const leggi = el('button', { class: 'tasto bordo', testo: 'Leggimela', onclick: () => {
    if (!globalThis.speechSynthesis) { toast('Questo telefono non legge ad alta voce.'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(st.titolo + '. ' + st.righe.map(([p, s]) => `${p}: ${s}.`).join(' '));
    u.lang = 'it-IT'; u.rate = 0.95; speechSynthesis.speak(u);
  } });
  main.append(sezione(st.titolo, blocco, leggi));

  // dire o scrivere
  const esito = el('div');
  const testo = el('textarea', { rows: '3', placeholder: 'Oppure scrivi qui cosa cambiare' });
  const invia = el('button', { class: 'tasto bordo', testo: 'Proponi le modifiche', onclick: () => { if (!testo.value.trim()) { avvisa('Scrivi o detta cosa cambiare.'); return; } proponi(testo.value.trim(), null); } });
  const lavora = el('p', { class: 'piccolo attenuato' });
  async function proponi(detto, rispostaPrecedente) {
    if (!navigator.onLine) { avvisa('Serve la rete per correggere a voce.'); return; }
    lavora.textContent = 'Sto riordinando…'; esito.replaceChildren();
    try {
      const r = await riordina({ modo: 'correzioni', ambito, id, testo: detto, risposta_precedente: rispostaPrecedente });
      lavora.textContent = '';
      mostraProposte(r, detto);
    } catch (e) { lavora.textContent = ''; avvisa(e.message || 'Non sono riuscito a riordinare.'); }
  }
  function mostraProposte(r, detto) {
    esito.replaceChildren();
    if (r.domanda) {
      const tasti = el('div', { class: 'tasti' }, (r.domanda.opzioni || []).map((o) => el('button', { class: 'tasto bordo', testo: o, onclick: () => proponi(detto, o) })));
      const altra = el('input', { type: 'text', placeholder: 'oppure rispondi qui' });
      altra.addEventListener('keydown', (e) => { if (e.key === 'Enter' && altra.value.trim()) proponi(detto, altra.value.trim()); });
      esito.append(sezione('Una domanda', el('div', { class: 'blocco' }, [el('p', { testo: r.domanda.testo }), tasti, campo('Risposta', altra)])));
      return;
    }
    const ops = r.operazioni || [];
    if (!ops.length) { esito.append(statoVuoto(r.non_capito ? 'Non ho capito: ' + r.non_capito : 'Non ho capito cosa cambiare. Prova a dirlo in un altro modo.')); return; }
    const spunte = [];
    const elenco = el('div', { class: 'elenco' });
    ops.forEach((o, i) => {
      const s = el('input', { type: 'checkbox' }); s.checked = true; spunte.push(s);
      elenco.append(el('label', { class: 'riga prima-dopo' }, [s, el('div', {}, [el('div', { class: 'principale', testo: o.dopo || o.tipo }), el('div', { class: 'secondaria', testo: 'prima: ' + (o.prima || '—') })]), el('span', { class: 'piccolo attenuato', testo: String(i + 1) })]));
    });
    const conferma = el('button', { class: 'tasto pieno grande', testo: 'Conferma', onclick: async () => {
      const scelte = ops.filter((_, i) => spunte[i].checked);
      if (!scelte.length) { avvisa('Niente spuntato.'); return; }
      conferma.disabled = true;
      try { const n = await applicaCorrezioni(scelte.map((o) => ({ ...o, contesto_id: id })), detto); toast(n === 1 ? 'Una modifica fatta.' : `${n} modifiche fatte.`); ridisegna(); }
      catch (e) { avvisa(e.message || 'Qualcosa non è andato: controlla cosa è cambiato.'); conferma.disabled = false; ridisegna(); }
    } });
    esito.append(sezione('Le modifiche: spunta quelle giuste', [elenco, r.scartate?.length ? el('p', { class: 'piccolo attenuato', testo: 'Non ammesse: ' + r.scartate.join('; ') }) : null, conferma].filter(Boolean)));
  }
  const rec = registratore({ suFine: async (blob, secondi) => {
    lavora.textContent = `Sto trascrivendo (${secondi} s)…`;
    try { const t = await trascrivi(blob, { etichetta: 'correzione', nomeFile: `correzione.${estensioneDi(blob.type)}` }); testo.value = t.testo || ''; await proponi(t.testo, null); }
    catch (e) { lavora.textContent = ''; avvisa(e.message || 'Non sono riuscito a trascrivere.'); }
  } });
  main.append(sezione('Cosa cambio?', el('div', { class: 'blocco detta' }, [rec, lavora, campo('Scrivi', testo), invia])), esito);
  void icona;
}
