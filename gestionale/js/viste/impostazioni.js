/* Longkai — viste/impostazioni.js: aspetto, allievi (gestione, CSV, regole), corsi, forme e tecniche, scadenze, associazione. Il resto arriva con le fasi. */
import { el } from '../base.js';
import { leggiLocale, impostazioni, salvaImpostazione, elencoAllieviCompleto, importaAllievi, corsiCompleti, soloLettura, consumiMese } from '../dati.js';
import { euro } from '../base.js';
import { puoRegistrare, formatoSupportato } from '../voce.js';
import { testata, sezione, riga, applicaAspetto, toast, avvisa, apriFoglio, statoVuoto } from '../ui.js';
import { analizzaCsv, allieviDaCsv, csvDaAllievi } from '../../comune/csv.js';
import { nomeCompleto } from '../../comune/allievi.js';
import { disegnaCorsi } from './corsi.js';
import { disegnaArgomenti } from './argomenti.js';
import { campo } from './allievo-modulo.js';

const GRUPPI = [['Associazione', 'associazione'], ['Accesso e sicurezza', 'sicurezza'], ['Voce', 'voce'], ['Corsi', 'corsi'], ['Allievi', 'allievi'], ['Forme e tecniche', 'forme'], ['Private', 'private'], ['Presenze e ore', 'presenze'], ['Programma', 'programma'], ['Quote', 'quote'], ['Scadenze e avvisi', 'scadenze'], ['Promemoria agli allievi', 'promemoria'], ['Rapporti', 'rapporti'], ['Intelligenza artificiale', 'ia'], ['Dati', 'dati'], ['Segnalazioni', 'segnalazioni']];

export async function vistaImpostazioni(main, parametri) {
  const gruppo = parametri[0];
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaImpostazioni(main, parametri); };
  if (gruppo === 'allievi') { testata('Allievi', { indietro: 'impostazioni' }); await gruppoAllievi(main, lettura, ridisegna); return; }
  if (gruppo === 'corsi') { testata('Corsi', { indietro: 'impostazioni' }); await disegnaCorsi(main, ridisegna); return; }
  if (gruppo === 'forme') { testata('Forme e tecniche', { indietro: 'impostazioni' }); await disegnaArgomenti(main, ridisegna); return; }
  if (gruppo === 'scadenze') { testata('Scadenze e avvisi', { indietro: 'impostazioni' }); await gruppoScadenze(main, lettura, ridisegna); return; }
  if (gruppo === 'associazione') { testata('Associazione', { indietro: 'impostazioni' }); await gruppoAssociazione(main, lettura, ridisegna); return; }
  if (gruppo === 'voce') { testata('Voce', { indietro: 'impostazioni' }); await gruppoVoce(main, lettura, ridisegna); return; }
  if (gruppo === 'ia') { testata('Intelligenza artificiale', { indietro: 'impostazioni' }); await gruppoIa(main, lettura, ridisegna); return; }
  if (gruppo === 'rapporti') { testata('Rapporti', { indietro: 'impostazioni' }); await gruppoRapporti(main, lettura, ridisegna); return; }
  if (gruppo && gruppo !== 'aspetto') {
    testata(GRUPPI.find(([, k]) => k === gruppo)?.[0] || 'Impostazioni', { indietro: 'impostazioni' });
    main.append(statoVuoto('Questo gruppo arriva in una fase successiva.'));
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
  for (const [nome, k] of GRUPPI) altri.append(riga({ principale: nome, href: '#/impostazioni/' + k }));
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
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    const s = soglie.value.split(/[,\s]+/).map((x) => Number(x)).filter((x) => x > 0);
    if (!s.length) { avvisa('Le soglie sono numeri di giorni, separati da virgola.'); return; }
    try {
      await salvaImpostazione('scadenze', 'soglie', s);
      await salvaImpostazione('scadenze', 'certificato_mesi', Number(cert.value) || 12);
      await salvaImpostazione('scadenze', 'tesseramento_mesi', Number(tess.value) || 12);
      await salvaImpostazione('scadenze', 'da_richiamare_lezioni', Number(richiamo.value) || 3);
      toast('Salvato.'); ridisegna();
    } catch (e) { avvisa(e.message); }
  } });
  const blocco = el('div', { class: 'blocco' }, [tastoCorreggi(), campo('Avvisi a (giorni prima)', soglie, 'es. 30, 15, 7 — e sempre allo scaduto'), el('div', { class: 'griglia-campi' }, [campo('Il certificato dura (mesi)', cert), campo('Il tesseramento dura (mesi)', tess)]), campo('“Da richiamare” dopo N lezioni di fila mancate', richiamo), lettura ? null : salva]);
  if (lettura) blocco.querySelectorAll('input').forEach((x) => { x.disabled = true; });
  main.append(sezione('Scadenze', blocco), el('p', { class: 'piccolo attenuato', testo: 'L\'ora degli avvisi, i canali (app, push, email) e il promemoria serale arrivano in fase 7.' }));
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
  const email = el('input', { type: 'email', value: imp.email_mittente || '', inputmode: 'email' });
  const salva = el('button', { class: 'tasto pieno', testo: 'Salva', onclick: async () => {
    try {
      await salvaImpostazione('associazione', 'nome', nome.value.trim() || 'Longkai');
      await salvaImpostazione('associazione', 'sedi', sedi.value.split(',').map((x) => x.trim()).filter(Boolean));
      await salvaImpostazione('associazione', 'email_mittente', email.value.trim());
      toast('Salvato.'); ridisegna();
    } catch (e) { avvisa(e.message); }
  } });
  const blocco = el('div', { class: 'blocco' }, [tastoCorreggi(), campo('Nome', nome), campo('Sedi', sedi, 'separate da virgola'), campo('Email mittente per gli avvisi', email, 'si usa dalla fase 7'), lettura ? null : salva]);
  if (lettura) blocco.querySelectorAll('input').forEach((x) => { x.disabled = true; });
  main.append(sezione('Associazione', blocco));
}
