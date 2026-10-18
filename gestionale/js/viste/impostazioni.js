/* Longkai — viste/impostazioni.js: aspetto, allievi (gestione, CSV, regole), corsi, forme e tecniche, scadenze e avvisi (con le notifiche di questo telefono), promemoria agli allievi, segnalazioni, associazione, voce, IA, rapporti. */
import { el, VERSIONE_APP } from '../base.js';
import { leggiLocale, impostazioni, salvaImpostazione, elencoAllieviCompleto, importaAllievi, corsiCompleti, soloLettura, consumiMese, segnalazioniTutte, aggiornaSegnalazione, provaPush, profilo, scaricaCopia } from '../dati.js';
import { statoPush, attivaPush, disattivaPush, iphoneNonInstallata } from '../push.js';
import { TESTI_PREDEFINITI, messaggioPromemoria } from '../../comune/promemoria.js';
import { formattaData, oggiRoma } from '../../comune/date.js';
import { euro } from '../base.js';
import { puoRegistrare, formatoSupportato } from '../voce.js';
import { testata, sezione, riga, applicaAspetto, toast, avvisa, apriFoglio, statoVuoto } from '../ui.js';
import { analizzaCsv, allieviDaCsv, csvDaAllievi } from '../../comune/csv.js';
import { nomeCompleto } from '../../comune/allievi.js';
import { disegnaCorsi } from './corsi.js';
import { disegnaArgomenti } from './argomenti.js';
import { campo } from './allievo-modulo.js';

const GRUPPI = [
  ['Allievi', 'allievi', 'elenco, nuovo allievo, importa da un foglio, regole'],
  ['Corsi e private', 'corsi', 'giorni e ore dei corsi, durata delle private'],
  ['Forme e tecniche', 'forme', 'il vocabolario: forme con le sezioni, tecniche, pronunce'],
  ['Scadenze e avvisi', 'scadenze', 'soglie, ora degli avvisi, notifiche su questo telefono'],
  ['Promemoria agli allievi', 'promemoria', 'i testi dei messaggi WhatsApp'],
  ['Rapporti', 'rapporti', 'capitoli del PDF mensile, cosa includere, firma'],
  ['Voce e intelligenza artificiale', 'voce', 'modo di dettatura, tetto di spesa, consumi del mese'],
  ['Associazione', 'associazione', 'nome e sedi'],
  ['Segnalazioni', 'segnalazioni', 'i problemi segnalati e il loro stato'],
  ['Dati', 'dati', 'scarica una copia di tutto'],
];

export async function vistaImpostazioni(main, parametri) {
  const gruppo = parametri[0];
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaImpostazioni(main, parametri); };
  if (gruppo === 'allievi') { testata('Allievi', { indietro: 'impostazioni' }); await gruppoAllievi(main, lettura, ridisegna); return; }
  if (gruppo === 'corsi') { testata('Corsi e private', { indietro: 'impostazioni' }); await disegnaCorsi(main, ridisegna); main.append(await bloccoPrivate(lettura, ridisegna)); return; }
  if (gruppo === 'forme') { testata('Forme e tecniche', { indietro: 'impostazioni' }); await disegnaArgomenti(main, ridisegna); return; }
  if (gruppo === 'scadenze') { testata('Scadenze e avvisi', { indietro: 'impostazioni' }); await gruppoScadenze(main, lettura, ridisegna); return; }
  if (gruppo === 'associazione') { testata('Associazione', { indietro: 'impostazioni' }); await gruppoAssociazione(main, lettura, ridisegna); return; }
  if (gruppo === 'voce' || gruppo === 'ia') { testata('Voce e intelligenza artificiale', { indietro: 'impostazioni' }); await gruppoVoce(main, lettura, ridisegna); await gruppoIa(main, lettura, ridisegna); return; }
  if (gruppo === 'dati') { testata('Dati', { indietro: 'impostazioni' }); gruppoDati(main); return; }
  if (gruppo === 'rapporti') { testata('Rapporti', { indietro: 'impostazioni' }); await gruppoRapporti(main, lettura, ridisegna); return; }
  if (gruppo === 'promemoria') { testata('Promemoria agli allievi', { indietro: 'impostazioni' }); await gruppoPromemoria(main, lettura, ridisegna); return; }
  if (gruppo === 'segnalazioni') { testata('Segnalazioni', { indietro: 'impostazioni' }); await gruppoSegnalazioni(main, ridisegna); return; }
  if (gruppo && gruppo !== 'aspetto') {
    testata('Impostazioni', { indietro: 'impostazioni' });
    main.append(statoVuoto('Questo gruppo non esiste.'));
    return;
  }
  testata('Impostazioni', { indietro: 'altro' });
  const loc = leggiLocale();
  const chipsTema = el('div', { class: 'chips' });
  for (const [k, nome] of [['scuro', 'Scuro'], ['chiaro', 'Chiaro'], ['sistema', 'Come il telefono']]) {
    chipsTema.append(el('button', { class: 'chip' + ((loc.tema || 'scuro') === k ? ' scelto' : ''), testo: nome, onclick: () => { applicaAspetto({ tema: k }); toast('Tema cambiato.'); ridisegna(); } }));
  }
  const chipsTesto = el('div', { class: 'chips' });
  for (const [k, nome] of [['normale', 'Normale'], ['grande', 'Grande']]) {
    chipsTesto.append(el('button', { class: 'chip' + ((loc.testo || 'normale') === k ? ' scelto' : ''), testo: nome, onclick: () => { applicaAspetto({ testo: k }); toast('Testo cambiato.'); ridisegna(); } }));
  }
  main.append(sezione('Aspetto', [el('div', { class: 'blocco' }, [el('p', { class: 'piccolo attenuato', testo: 'Tema' }), chipsTema, el('p', { class: 'piccolo attenuato', style: null, testo: 'Dimensione del testo' }), chipsTesto])]));
  const altri = el('div', { class: 'elenco' });
  for (const [nome, k, cosa] of GRUPPI) altri.append(riga({ principale: nome, secondaria: cosa, href: '#/impostazioni/' + k }));
  main.append(sezione('Tutto il resto', altri));
}

function tastoCorreggi(ambito = 'impostazioni') { return el('a', { class: 'tasto bordo', 'data-scrittura': '', href: '#/correggi/' + ambito, testo: 'Correggi parlando' }); }

/* ---------- Allievi: gestione, importazione, regole ---------- */
async function gruppoAllievi(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).allievi || {};
  const azioni = el('div', { class: 'elenco' }, [
    riga({ principale: 'Elenco degli allievi', secondaria: 'cerca, filtra, apri le schede', href: '#/allievi' }),
    lettura ? null : riga({ principale: 'Aggiungi un allievo', href: '#/allievi/nuovo' }),
    lettura ? null : riga({ principale: 'Importa da un foglio (CSV)', secondaria: 'colonne: nome, cognome, nascita, email, telefono, città, corso, note', onclick: () => foglioImporta(ridisegna) }),
    riga({ principale: 'Esporta l\'elenco (CSV)', onclick: async () => {
      try {
        const tutti = await elencoAllieviCompleto();
        const blob = new Blob([csvDaAllievi(tutti)], { type: 'text/csv;charset=utf-8' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'allievi-longkai.csv' }); document.body.append(a); a.click(); a.remove();
        toast('File pronto.');
      } catch (e) { avvisa(e.message); }
    } }),
  ]);
  main.append(sezione('Gestione', azioni));
  if (lettura) return;
  const tipo = el('div', { class: 'chips' });
  for (const [k, nome] of [['extra', 'Lezione in più (da pagare)'], ['normale', 'Normale']]) {
    tipo.append(el('button', { class: 'chip' + ((imp.tipo_non_iscritto || 'extra') === k ? ' scelto' : ''), testo: nome, onclick: async () => { try { await salvaImpostazione('allievi', 'tipo_non_iscritto', k); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  }
  const tutore = el('input', { type: 'checkbox' }); tutore.checked = imp.tutore_sotto_18 !== false;
  tutore.addEventListener('change', async () => { try { await salvaImpostazione('allievi', 'tutore_sotto_18', tutore.checked); toast('Salvato.'); } catch (e) { avvisa(e.message); } });
  main.append(sezione('Regole', el('div', { class: 'blocco' }, [
    tastoCorreggi(),
    el('p', { class: 'piccolo attenuato', style: null, testo: 'Chi viene a lezione senza essere iscritto a quel corso è segnato come:' }), tipo,
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Sotto i 18 anni serve il tutore' }), tutore]),
  ])));
}

function foglioImporta(ridisegna) {
  const file = el('input', { type: 'file', accept: '.csv,text/csv' });
  const anteprima = el('div');
  let letti = null;
  const importa = el('button', { class: 'tasto pieno grande', testo: 'Importa', disabled: true, onclick: async () => {
    if (!letti?.allievi.length) return;
    importa.disabled = true;
    try {
      const corsi = await corsiCompleti().catch(() => []);
      const r = await importaAllievi(letti.allievi, corsi);
      chiudi(); toast(`Importati ${r.inseriti} allievi` + (r.iscritti ? `, ${r.iscritti} iscritti ai corsi.` : '.')); ridisegna();
    } catch (e) { avvisa(e.message); importa.disabled = false; }
  } });
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    const testo = await f.text();
    letti = allieviDaCsv(analizzaCsv(testo));
    anteprima.replaceChildren();
    if (!letti.allievi.length) { anteprima.append(el('p', { class: 'errore-campo', testo: letti.colonne.includes('nome') ? 'Nessuna riga con un nome.' : 'Non trovo la colonna “nome” nella prima riga.' })); importa.disabled = true; return; }
    const elenco = el('div', { class: 'elenco' });
    for (const a of letti.allievi.slice(0, 5)) elenco.append(riga({ principale: nomeCompleto(a), secondaria: [a.nascita, a.citta, a.corso].filter(Boolean).join(' · ') }));
    anteprima.append(el('p', { class: 'attenuato', testo: `${letti.allievi.length} allievi letti` + (letti.scartate ? `, ${letti.scartate} righe senza nome scartate` : '') + `. Colonne riconosciute: ${letti.colonne.join(', ')}.` }), elenco);
    importa.disabled = false;
  });
  const chiudi = apriFoglio('Importa da un foglio', el('div', {}, [campo('File CSV', file, 'La prima riga sono le intestazioni: nome, cognome, nascita (gg/mm/aaaa), email, telefono, città, corso, note.'), anteprima, importa]));
}

/* ---------- Scadenze e avvisi ---------- */
async function gruppoScadenze(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).scadenze || {};
  const soglie = el('input', { type: 'text', value: (imp.soglie || [30, 15, 7]).join(', '), inputmode: 'numeric' });
  const cert = el('input', { type: 'number', min: '1', max: '36', value: imp.certificato_mesi ?? 12, inputmode: 'numeric' });
  const tess = el('input', { type: 'number', min: '1', max: '36', value: imp.tesseramento_mesi ?? 12, inputmode: 'numeric' });
  const richiamo = el('input', { type: 'number', min: '1', max: '10', value: imp.da_richiamare_lezioni ?? 3, inputmode: 'numeric' });
  const ora = el('input', { type: 'time', value: imp.ora_avvisi || '08:00', step: '3600' });
  const serale = el('input', { type: 'time', value: imp.promemoria_serale || '21:00', step: '3600' });
  const seraleAcceso = el('input', { type: 'checkbox' }); seraleAcceso.checked = imp.promemoria_serale_acceso !== false;
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    const s = soglie.value.split(/[,\s]+/).map((x) => Number(x)).filter((x) => x > 0);
    if (!s.length) { avvisa('Le soglie sono numeri di giorni, separati da virgola.'); return; }
    try {
      await salvaImpostazione('scadenze', 'soglie', s);
      await salvaImpostazione('scadenze', 'certificato_mesi', Number(cert.value) || 12);
      await salvaImpostazione('scadenze', 'tesseramento_mesi', Number(tess.value) || 12);
      await salvaImpostazione('scadenze', 'da_richiamare_lezioni', Number(richiamo.value) || 3);
      await salvaImpostazione('scadenze', 'ora_avvisi', /^\d{2}:\d{2}$/.test(ora.value) ? ora.value : '08:00');
      await salvaImpostazione('scadenze', 'promemoria_serale', /^\d{2}:\d{2}$/.test(serale.value) ? serale.value : '21:00');
      await salvaImpostazione('scadenze', 'promemoria_serale_acceso', seraleAcceso.checked);
      toast('Salvato.'); ridisegna();
    } catch (e) { avvisa(e.message); }
  } });
  const blocco = el('div', { class: 'blocco' }, [tastoCorreggi(), campo('Avvisi a (giorni prima)', soglie, 'es. 30, 15, 7 — e sempre allo scaduto'), el('div', { class: 'griglia-campi' }, [campo('Il certificato dura (mesi)', cert), campo('Il tesseramento dura (mesi)', tess)]), campo('“Da richiamare” dopo N lezioni di fila mancate', richiamo),
    el('div', { class: 'griglia-campi' }, [campo('Ora degli avvisi', ora, 'l\'orologio passa a ogni ora piena'), campo('Promemoria serale alle', serale)]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Promemoria serale se la lezione di oggi non è chiusa' }), seraleAcceso]),
    lettura ? null : salva]);
  if (lettura) blocco.querySelectorAll('input').forEach((x) => { x.disabled = true; });
  main.append(sezione('Scadenze', blocco));
  main.append(sezione('Notifiche su questo telefono', await bloccoNotifiche(ridisegna)));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'Al massimo due notifiche al giorno: al mattino solo se c\'è qualcosa di nuovo (un riassunto, mai una per cosa), la sera solo se la lezione di oggi è ancora da chiudere. Il giorno 1 del mese, il rapporto. Mai fra le 22 e le 7. Gli avvisi per intero stanno in Oggi.' }));
}

/** Lo stato delle notifiche di questo telefono, con Attiva / Spegni / Manda una prova. Vale per tutti e due i ruoli: a Simone arrivano le segnalazioni. */
async function bloccoNotifiche(ridisegna) {
  const stato = await statoPush();
  const TESTI = {
    non_supportato: iphoneNonInstallata() ? 'Su iPhone le notifiche funzionano solo con l\'app aggiunta alla schermata Home: Condividi → Aggiungi alla schermata Home, poi torna qui.' : 'Questo browser non ha le notifiche.',
    negato: 'Bloccate dal telefono: si riattivano nelle impostazioni del telefono, alla voce di questo sito.',
    attivo: 'Attive su questo telefono.',
    spento: 'Spente su questo telefono.',
  };
  const figli = [el('div', { class: 'riga statica' }, [el('span', { class: 'pallino ' + (stato === 'attivo' ? 'ok' : stato === 'spento' ? 'neutro' : 'attenzione') }), el('div', {}, [el('div', { class: 'principale', testo: TESTI[stato] })])])];
  const tasti = [];
  if (stato === 'spento') tasti.push(el('button', { class: 'tasto pieno', testo: 'Attiva', onclick: async (e) => { e.target.disabled = true; try { await attivaPush(); toast('Notifiche attive.'); ridisegna(); } catch (err) { avvisa(err.message); e.target.disabled = false; } } }));
  if (stato === 'attivo') {
    tasti.push(el('button', { class: 'tasto bordo', testo: 'Manda una prova', onclick: async (e) => { e.target.disabled = true; try { await provaPush(); toast('Mandata: arriva fra pochi secondi.'); } catch (err) { avvisa(err.message); } finally { e.target.disabled = false; } } }));
    tasti.push(el('button', { class: 'tasto', testo: 'Spegni', onclick: async () => { try { await disattivaPush(); toast('Spente su questo telefono.'); ridisegna(); } catch (err) { avvisa(err.message); } } }));
  }
  if (tasti.length) figli.push(el('div', { class: 'tasti' }, tasti));
  return el('div', { class: 'blocco' }, figli);
}

/* ---------- Promemoria agli allievi: i testi, mandati con un tocco su WhatsApp ---------- */
async function gruppoPromemoria(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).promemoria || {};
  const testi = { ...TESTI_PREDEFINITI, ...(imp.testi || {}) };
  const ETICHETTE = { certificato: 'Certificato medico', tesseramento: 'Tesseramento', quota: 'Quota' };
  const ESEMPI = { certificato: { nome: 'Allievo Uno', tipo: 'certificato medico', data: '2026-11-30' }, tesseramento: { nome: 'Allievo Uno', tipo: 'tesseramento', data: '2026-11-30' }, quota: { nome: 'Allievo Uno', tipo: 'il mensile di novembre', data: '2026-11-05', importo: '70,00 €' } };
  const aree = {}; const anteprime = {};
  const figli = [tastoCorreggi(), el('p', { class: 'piccolo attenuato', testo: 'Parole che si riempiono da sole: {nome} {tipo} {data} {importo}.' })];
  for (const k of ['certificato', 'tesseramento', 'quota']) {
    aree[k] = el('textarea', { rows: '3', maxlength: '500' }); aree[k].value = testi[k]; aree[k].disabled = lettura;
    anteprime[k] = el('p', { class: 'piccolo attenuato', testo: 'Esempio: ' + messaggioPromemoria(testi[k], ESEMPI[k]) });
    aree[k].addEventListener('input', () => { anteprime[k].textContent = 'Esempio: ' + messaggioPromemoria(aree[k].value, ESEMPI[k]); });
    figli.push(campo(ETICHETTE[k], aree[k]), anteprime[k]);
  }
  if (!lettura) figli.push(el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => { try { const nuovi = {}; for (const k of Object.keys(aree)) nuovi[k] = aree[k].value.trim() || TESTI_PREDEFINITI[k]; await salvaImpostazione('promemoria', 'testi', nuovi); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  main.append(sezione('I testi', el('div', { class: 'blocco' }, figli)));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'I promemoria non partono da soli. Da una scadenza (Altro → Scadenze) o da una quota aperta tocchi «Ricorda su WhatsApp»: si apre WhatsApp con il messaggio già scritto e lo mandi tu. Serve il cellulare nella scheda dell\'allievo.' }));
}

/* ---------- Segnalazioni: l'elenco con lo stato (le gestisce Simone) ---------- */
async function gruppoSegnalazioni(main, ridisegna) {
  let tutte = [];
  try { tutte = await segnalazioniTutte(); } catch (e) { avvisa(e.message); }
  const p = await profilo().catch(() => null);
  const STATI = { nuova: ['nuova', 'attenzione'], vista: ['vista', 'info'], risolta: ['risolta', 'ok'] };
  const elenco = el('div', { class: 'elenco' });
  if (!tutte.length) elenco.append(statoVuoto('Nessuna segnalazione. Si manda da Altro → Segnala un problema.'));
  for (const s of tutte) {
    const [nomeStato, pallino] = STATI[s.stato] || [s.stato, 'neutro'];
    elenco.append(riga({ principale: s.titolo || s.testo.slice(0, 80), secondaria: [formattaData(s.creato_il.slice(0, 10), 'numerico'), s.profili?.nome, s.schermata, s.versione_app ? 'v' + s.versione_app : null, nomeStato + (s.risolta_versione ? ' nella ' + s.risolta_versione : '')].filter(Boolean).join(' · '), pallino, onclick: () => foglioSegnalazione(s, Boolean(p), ridisegna) }));
  }
  main.append(sezione(`Segnalazioni · ${tutte.length}`, elenco));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'Ogni segnalazione arriva a Simone come notifica sul telefono. Qui si vede lo stato: nuova, vista, risolta (con la versione).' }));
}

function foglioSegnalazione(s, puoGestire, ridisegna) {
  const figli = [
    el('p', { class: 'attenuato', testo: [formattaData(s.creato_il.slice(0, 10), 'numerico'), s.profili?.nome, s.schermata, s.versione_app ? 'versione ' + s.versione_app : null].filter(Boolean).join(' · ') }),
    el('p', { testo: s.testo }),
    s.dispositivo ? el('p', { class: 'piccolo attenuato', testo: s.dispositivo }) : null,
  ];
  if (puoGestire) {
    const versione = el('input', { type: 'text', value: s.risolta_versione || '', placeholder: 'es. ' + VERSIONE_APP });
    const aggiorna = async (dati, msg) => { try { await aggiornaSegnalazione(s.id, dati); chiudi(); toast(msg); ridisegna(); } catch (e) { avvisa(e.message); } };
    if (s.stato === 'nuova') figli.push(el('button', { class: 'tasto bordo', testo: 'Segna vista', onclick: () => aggiorna({ stato: 'vista' }, 'Vista.') }));
    if (s.stato !== 'risolta') figli.push(campo('Risolta nella versione', versione), el('button', { class: 'tasto pieno', testo: 'Segna risolta', onclick: () => aggiorna({ stato: 'risolta', risolta_versione: versione.value.trim() || VERSIONE_APP }, 'Risolta.') }));
    else figli.push(el('button', { class: 'tasto', testo: 'Riapri', onclick: () => aggiorna({ stato: 'vista', risolta_versione: null }, 'Riaperta.') }));
  }
  const chiudi = apriFoglio(s.titolo || 'Segnalazione', el('div', { class: 'tasti-colonna' }, figli.filter(Boolean)));
}

/* ---------- Private: la durata e la ripetizione di partenza (si usano in Oggi → + Privata) ---------- */
async function bloccoPrivate(lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).private || {};
  const durata = el('input', { type: 'number', min: '30', max: '240', step: '30', value: imp.durata_minuti || 60, inputmode: 'numeric' });
  const ripeti = el('input', { type: 'checkbox' }); ripeti.checked = Boolean(imp.ripeti_settimanale);
  const settimane = el('input', { type: 'number', min: '2', max: '52', value: imp.settimane_avanti || 8, inputmode: 'numeric' });
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    try { await salvaImpostazione('private', 'durata_minuti', Number(durata.value) || 60); await salvaImpostazione('private', 'ripeti_settimanale', ripeti.checked); await salvaImpostazione('private', 'settimane_avanti', Number(settimane.value) || 8); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); }
  } });
  const b = el('div', { class: 'blocco' }, [el('div', { class: 'griglia-campi' }, [campo('Durata di una privata (minuti)', durata), campo('Settimane in avanti, se si ripete', settimane)]), el('label', { class: 'interruttore' }, [el('span', { testo: 'Una privata nuova si ripete ogni settimana' }), ripeti]), lettura ? null : salva]);
  if (lettura) b.querySelectorAll('input').forEach((x) => { x.disabled = true; });
  return sezione('Private', b);
}

/* ---------- Dati: la copia ---------- */
function gruppoDati(main) {
  const scarica = el('button', { class: 'tasto pieno', testo: 'Scarica una copia (JSON)', onclick: async (e) => {
    e.target.disabled = true;
    try {
      const dati = await scaricaCopia();
      const blob = new Blob([JSON.stringify(dati)], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `longkai-copia-${oggiRoma()}.json` }); document.body.append(a); a.click(); a.remove();
      toast('Copia pronta.');
    } catch (err) { avvisa(err.message); } finally { e.target.disabled = false; }
  } });
  main.append(sezione('Copia dei dati', el('div', { class: 'blocco' }, [el('p', { testo: 'Tutto quello che c\'è nell\'app, in un file. Una copia cifrata si fa da sola ogni settimana; questa la tieni tu dove vuoi.' }), scarica])));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'I documenti caricati (certificati, PDF) non sono nel file: stanno al sicuro sul server.' }));
}

/* ---------- Voce ---------- */
async function gruppoVoce(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).voce || {};
  const modo = el('div', { class: 'chips' });
  for (const [k, nome] of [['libera', 'Libera: tutto in una volta'], ['guidata', 'Guidata: una domanda alla volta']]) {
    modo.append(el('button', { class: 'chip' + ((imp.modo || 'libera') === k ? ' scelto' : ''), testo: nome, disabled: lettura, onclick: async () => { try { await salvaImpostazione('voce', 'modo', k); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  }
  const interr = (etichetta, campo, valore) => { const i = el('input', { type: 'checkbox' }); i.checked = valore; i.disabled = lettura; i.addEventListener('change', async () => { try { await salvaImpostazione('voce', campo, i.checked); toast('Salvato.'); } catch (e) { avvisa(e.message); } }); return el('label', { class: 'interruttore' }, [el('span', { testo: etichetta }), i]); };
  const prossima = el('div', { class: 'chips' });
  for (const [k, nome] of [['solo_se_manca', 'Solo se manca'], ['sempre', 'Sempre'], ['mai', 'Mai']]) prossima.append(el('button', { class: 'chip' + ((imp.chiedi_prossima_volta || 'solo_se_manca') === k ? ' scelto' : ''), testo: nome, disabled: lettura, onclick: async () => { try { await salvaImpostazione('voce', 'chiedi_prossima_volta', k); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  main.append(sezione('Dettatura', el('div', { class: 'blocco' }, [
    el('p', { class: 'piccolo attenuato', testo: 'Modo di partenza' }), modo,
    el('p', { class: 'piccolo attenuato', style: null, testo: 'In guidata, la domanda “La prossima volta?”' }), prossima,
    interr('“Ricorda come lo dico” acceso', 'ricorda_pronunce', imp.ricorda_pronunce !== false),
    interr('Aiuto sotto Detta per le prime tre dettature', 'aiuto_prime_dettature', imp.aiuto_prime_dettature !== false),
    el('p', { class: 'piccolo attenuato', style: null, testo: `Dettature fatte: ${imp.dettature_fatte || 0}. Microfono: ${puoRegistrare() ? 'disponibile (' + (formatoSupportato() || 'formato di sistema') + ')' : 'non disponibile su questo browser'}.` }),
  ])), el('p', { class: 'piccolo attenuato', testo: 'Le pronunce si vedono e si correggono in Forme e tecniche. La calibrazione della voce arriva più avanti.' }));
}

/* ---------- Intelligenza artificiale ---------- */
async function gruppoIa(main, lettura, ridisegna) {
  const [impTutte, consumi] = await Promise.all([impostazioni().catch(() => ({})), consumiMese().catch(() => [])]);
  const imp = impTutte.ia || {};
  const accesa = el('input', { type: 'checkbox' }); accesa.checked = imp.accesa !== false; accesa.disabled = lettura;
  accesa.addEventListener('change', async () => { try { await salvaImpostazione('ia', 'accesa', accesa.checked); toast(accesa.checked ? 'Accesa.' : 'Spenta: la dettatura si ferma, “A mano” funziona.'); } catch (e) { avvisa(e.message); } });
  const tetto = el('input', { type: 'number', min: '0', step: '1', value: ((imp.tetto_mensile_cent ?? 500) / 100).toFixed(0), inputmode: 'numeric' });
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva il tetto', onclick: async () => { try { await salvaImpostazione('ia', 'tetto_mensile_cent', Math.round(Number(tetto.value) * 100) || 0); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const speso = consumi.reduce((t, c) => t + (c.spesa_cent || 0), 0);
  const elenco = el('div', { class: 'elenco' });
  for (const c of consumi) elenco.append(riga({ principale: c.funzione === 'trascrivi' ? 'Trascrizione' : c.funzione === 'riordina' ? 'Riordino' : c.funzione, secondaria: [c.chiamate ? `${c.chiamate} chiamate` : null, c.secondi_audio ? `${Math.round(c.secondi_audio / 60)} minuti di audio` : null, c.token_in ? `${c.token_in + c.token_out} token` : null].filter(Boolean).join(' · '), destra: euro(c.spesa_cent) }));
  if (!consumi.length) elenco.append(statoVuoto('Nessun consumo questo mese.'));
  main.append(sezione('Questo mese', el('div', { class: 'blocco' }, [el('div', { class: 'principale', testo: `Speso: ${euro(speso)} su ${euro(imp.tetto_mensile_cent ?? 500)}` }), el('div', { class: 'copertura', style: null }, [(() => { const s = el('span'); s.style.width = `${Math.min(100, Math.round((speso / Math.max(1, imp.tetto_mensile_cent ?? 500)) * 100))}%`; return s; })()])])), sezione('Consumi', elenco));
  main.append(sezione('Regole', el('div', { class: 'blocco' }, [el('label', { class: 'interruttore' }, [el('span', { testo: 'Intelligenza artificiale accesa' }), accesa]), campo('Tetto mensile di spesa (€)', tetto, 'Raggiunto il tetto, la dettatura si ferma e “A mano” continua a funzionare.'), lettura ? null : salva])));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'I costi sono stime prudenti (Groq per la voce, Claude per il riordino). Le chiavi stanno sul server, mai nell\'app.' }));
}

/* ---------- Rapporti: i capitoli e cosa includere ---------- */
async function gruppoRapporti(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).rapporti || {};
  const TUTTI = [['in_breve', 'Il mese in breve'], ['corsi', 'I corsi, lezione per lezione'], ['private', 'Le private'], ['allievi', 'Gli allievi'], ['quote', 'Le quote'], ['scadenze', 'Le scadenze in arrivo'], ['mese_prossimo', 'Il mese prossimo']];
  let attivi = Array.isArray(imp.capitoli) && imp.capitoli.length ? [...imp.capitoli] : TUTTI.map(([k]) => k);
  const nomi = { ...(imp.nomi_capitoli || {}) };
  const elenco = el('div', { class: 'elenco' });
  const disegna = () => {
    elenco.replaceChildren();
    const ordinati = [...attivi.map((k) => TUTTI.find(([x]) => x === k)).filter(Boolean), ...TUTTI.filter(([k]) => !attivi.includes(k))];
    ordinati.forEach(([k, nomeStd]) => {
      const acceso = attivi.includes(k);
      const r = el('div', { class: 'riga statica' }, [
        el('span', { class: 'pallino ' + (acceso ? 'ok' : 'neutro') }),
        el('div', {}, [el('div', { class: 'principale', testo: nomi[k] || nomeStd }), el('div', { class: 'secondaria', testo: nomi[k] ? 'nome standard: ' + nomeStd : (acceso ? 'nel rapporto' : 'escluso') })]),
        lettura ? el('div') : el('div', { class: 'destra' }, [
          acceso ? el('button', { class: 'tasto stepper-tasto', 'aria-label': 'Su', testo: '\u2191', onclick: () => { const i = attivi.indexOf(k); if (i > 0) { attivi.splice(i, 1); attivi.splice(i - 1, 0, k); disegna(); } } }) : null,
          el('button', { class: 'tasto', testo: acceso ? 'Escludi' : 'Includi', onclick: () => { attivi = acceso ? attivi.filter((x) => x !== k) : [...attivi, k]; disegna(); } }),
          el('button', { class: 'tasto', testo: 'Nome', onclick: () => { const n = el('input', { type: 'text', value: nomi[k] || nomeStd }); const ok = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: () => { if (n.value.trim() && n.value.trim() !== nomeStd) nomi[k] = n.value.trim(); else delete nomi[k]; chiudi(); disegna(); } }); const chiudi = apriFoglio('Nome del capitolo', el('div', {}, [campo('Nome', n), ok])); } }),
        ]),
      ]);
      elenco.append(r);
    });
  };
  disegna();
  const interr = (etichetta, campoK, valore) => { const i = el('input', { type: 'checkbox' }); i.checked = valore; i.disabled = lettura; i.addEventListener('change', async () => { try { await salvaImpostazione('rapporti', campoK, i.checked); toast('Salvato.'); } catch (e) { avvisa(e.message); } }); return el('label', { class: 'interruttore' }, [el('span', { testo: etichetta }), i]); };
  const giorno = el('input', { type: 'number', min: '1', max: '28', value: imp.giorno || 1, inputmode: 'numeric' });
  const firma = el('input', { type: 'text', value: imp.firma || '', placeholder: 'es. Sifu Diego Ceriani' });
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    try {
      await salvaImpostazione('rapporti', 'capitoli', attivi);
      await salvaImpostazione('rapporti', 'nomi_capitoli', nomi);
      await salvaImpostazione('rapporti', 'giorno', Math.min(28, Math.max(1, Number(giorno.value) || 1)));
      await salvaImpostazione('rapporti', 'firma', firma.value.trim() || null);
      toast('Salvato.'); ridisegna();
    } catch (e) { avvisa(e.message); }
  } });
  main.append(sezione('I capitoli del rapporto mensile', [tastoCorreggi('impostazioni'), elenco]));
  main.append(sezione('Cosa includere', el('div', { class: 'blocco' }, [interr('Le osservazioni sugli allievi', 'includi_osservazioni', imp.includi_osservazioni !== false), interr('Gli importi (incassi, da incassare)', 'includi_importi', imp.includi_importi !== false), interr('Chi non si \u00e8 mai visto nel mese', 'includi_assenti', imp.includi_assenti === true), interr('Il riassunto scritto da Claude', 'riassunto_ia', imp.riassunto_ia !== false)])));
  main.append(sezione('Generazione', el('div', { class: 'blocco' }, [el('div', { class: 'griglia-campi' }, [campo('Giorno del mese in cui esce', giorno, 'il rapporto del mese prima'), campo('Firma in fondo', firma)]), lettura ? null : salva])));
  main.append(el('p', { class: 'piccolo attenuato', testo: 'Il modello grafico (carta, carattere, colori) \u00e8 il brand e resta fisso. Il rapportino della giornata esce su richiesta da Oggi o dalla sessione.' }));
}

/* ---------- Associazione ---------- */
async function gruppoAssociazione(main, lettura, ridisegna) {
  const imp = (await impostazioni().catch(() => ({}))).associazione || {};
  const nome = el('input', { type: 'text', value: imp.nome || 'Longkai' });
  const sedi = el('input', { type: 'text', value: (imp.sedi || []).join(', ') });
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    try {
      await salvaImpostazione('associazione', 'nome', nome.value.trim() || 'Longkai');
      await salvaImpostazione('associazione', 'sedi', sedi.value.split(',').map((x) => x.trim()).filter(Boolean));
      toast('Salvato.'); ridisegna();
    } catch (e) { avvisa(e.message); }
  } });
  const blocco = el('div', { class: 'blocco' }, [tastoCorreggi(), campo('Nome', nome), campo('Sedi', sedi, 'separate da virgola'), lettura ? null : salva]);
  if (lettura) blocco.querySelectorAll('input').forEach((x) => { x.disabled = true; });
  main.append(sezione('Associazione', blocco));
}
