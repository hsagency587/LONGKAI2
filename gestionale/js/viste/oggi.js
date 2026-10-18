/* Longkai — viste/oggi.js: la prima schermata. Il corso di oggi con il previsto, le private, Da fare, Scadenze, la giornata. */
import { el, icona, euro } from '../base.js';
import { sessioniDelGiorno, contiDaFare, contiScadenze, profilo, corsiCompleti, programmiMesi, argomentiAttivi, allieviAttivi, creaStraordinaria, creaPrivate, saltaSessione, riapriSessione, apriGiornata, chiudiGiornata, giornata, sessioniAperteIeri, pianiAttivi, impostazioni, leggiLocale, salvaLocale, obiettiviAperti, avvisiAperti, segnaAvvisiLetti, statoAvvio } from '../dati.js';
import { pushSupportato, iphoneNonInstallata, attivaPush, aggiornaBadge } from '../push.js';
import { testata, sezione, riga, scheletri, statoVuoto, statoErrore, toast, avvisa, apriFoglio, striscia, togliStriscia, vai } from '../ui.js';
import { oggiRoma, formattaData, formattaOra, primoDelMese, aggiungiGiorni } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';
import { previstoDalMese, statoGiornata } from '../../comune/sessione.js';
import { normalizza } from '../../comune/fonetica.js';
import { campo } from './allievo-modulo.js';
import { foglioAnnulla } from './sessione.js';
import { foglioRegistraPagamento } from './quote-fogli.js';
import { generaRapportino } from '../dati.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

export async function vistaOggi(main) {
  const oggi = oggiRoma();
  testata(formattaData(oggi));
  document.getElementById('barra-alto').classList.remove('nascosto');
  main.replaceChildren(scheletri(4));
  const p = await profilo().catch(() => null);
  const sifu = p?.ruolo === 'sifu';
  if (sifu) { try { await apriGiornata(oggi); } catch { /* l'orologio ci pensa alle 8 */ } }
  let sessioni, daFare, scad, piani, ieri, g, imp, obiettivi, avvisi;
  try {
    [sessioni, daFare, scad, piani, ieri, g, imp, obiettivi, avvisi] = await Promise.all([sessioniDelGiorno(oggi), contiDaFare(), contiScadenze(), pianiAttivi().catch(() => []), sifu ? sessioniAperteIeri(oggi) : Promise.resolve([]), giornata(oggi).catch(() => null), impostazioni().catch(() => ({})), obiettiviAperti().catch(() => []), avvisiAperti().catch(() => [])]);
  } catch (e) {
    main.replaceChildren(statoErrore(navigator.onLine ? e : new Error('Sei senza rete.'), () => vistaOggi(main)));
    return;
  }
  main.replaceChildren();
  const ridisegna = () => vistaOggi(main);

  // ieri non chiuso
  const vecchie = ieri.filter((s) => s.tipo !== 'privata');
  if (sifu && vecchie.length) striscia('ieri', `${vecchie.length === 1 ? 'Una lezione' : vecchie.length + ' lezioni'} da chiudere: ${formattaData(vecchie[0].data, 'breve')} ${vecchie[0].corso_nome || ''}`, { tipo: 'gialla', tasto: el('button', { class: 'tasto', testo: 'Apri', onclick: () => vai(`sessione/${vecchie[0].id}`) }) });
  else togliStriscia('ieri');

  // PER INIZIARE: i primi passi, finché mancano listino, allievi o abbonamenti (si può nascondere)
  if (sifu && !leggiLocale().guidaNascosta) {
    const st = await statoAvvio().catch(() => null);
    if (st && (!st.allievi || !st.abbonamenti || !st.documenti)) {
      const passi = [
        [st.allievi > 0, 'Aggiungi gli allievi', 'con + Allievo, o da un foglio', '#/allievi'],
        [st.abbonamenti > 0, 'Metti la quota a ognuno', 'scheda → Quote: quanto paga e quando ha pagato', '#/allievi'],
        [st.documenti > 0, 'Carica i certificati', 'scheda → Documenti', '#/allievi'],
      ];
      main.append(sezione('Per iniziare', el('div', { class: 'blocco guida' }, [
        ...passi.map(([fatto, titolo, sotto, href], i) => el('a', { class: 'passo' + (fatto ? ' fatto' : ''), href }, [el('span', { class: 'numero', testo: fatto ? '✓' : String(i + 1) }), el('div', {}, [el('div', { class: 'principale', testo: titolo }), el('div', { class: 'secondaria attenuato', testo: sotto })])])),
        el('button', { class: 'tasto', testo: 'Non mostrare più', onclick: () => { const l = leggiLocale(); l.guidaNascosta = true; salvaLocale(l); ridisegna(); } }),
      ])));
    }
  }

  // CORSO DI OGGI
  const corso = sessioni.find((s) => s.tipo === 'corso' || s.tipo === 'straordinaria');
  const blocco = el('div', { class: 'blocco' });
  if (corso) {
    let previsto = corso.previsto_argomenti;
    if (!previsto && corso.corso_id) {
      try {
        const [mesi, arg] = await Promise.all([programmiMesi([primoDelMese(oggi)]), argomentiAttivi()]);
        const m = mesi.find((x) => x.corso_id === corso.corso_id);
        const ids = previstoDalMese({ argomenti: m?.programma_argomenti || [] });
        if (ids.length) previsto = ids.map((id) => arg.find((a) => a.id === id)?.nome).filter(Boolean).join(', ') + ' (dal mese)';
      } catch { /* niente */ }
    }
    const pianiDelCorso = piani.length ? `${piani.length} con piano personale` : null;
    const obiettiviN = obiettivi.length ? `${obiettivi.length} obiettivi aperti` : null;
    const inCoda = leggiLocale().coda.some((l) => l.tipo === 'dettatura' && l.sessione_id === corso.id && l.stato !== 'fallito');
    const fallita = leggiLocale().coda.find((l) => l.tipo === 'dettatura' && l.sessione_id === corso.id && l.stato === 'fallito');
    const statoRiga = corso.stato === 'fatta' ? 'fatta ✓' : corso.stato === 'saltata' ? 'saltata' + (corso.motivo ? ': ' + corso.motivo : '') : corso.in_revisione ? 'in revisione: la bozza è pronta' : inCoda ? 'in coda: sto trascrivendo' : fallita ? 'dettatura ferma: ' + (fallita.errore || '') : 'da fare';
    blocco.append(
      el('div', { class: 'principale', testo: `${corso.corso_nome || 'Lezione'} · ${corso.citta || ''} · ${formattaOra(corso.ora)} · ${formattaMinuti(corso.durata_minuti)}` + (corso.tipo === 'straordinaria' ? ' · straordinaria' : '') }),
      el('div', { class: 'secondaria attenuato', testo: [statoRiga, corso.presenti ? `${corso.presenti} presenti` : null, pianiDelCorso, obiettiviN].filter(Boolean).join(' · ') }),
      previsto ? el('div', { class: 'secondaria', testo: 'Previsto: ' + previsto }) : el('div', { class: 'secondaria attenuato', testo: 'Niente di previsto: libero.' }),
    );
    if (sifu && corso.stato === 'prevista') {
      if (corso.in_revisione) {
        blocco.append(el('a', { class: 'tasto pieno grande', 'data-scrittura': '', href: `#/sessione/${corso.id}` }, [icona('spunta'), 'Rivedi e conferma']));
        blocco.append(el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('a', { class: 'tasto bordo', href: `#/detta/${corso.id}`, testo: 'Detta di nuovo' }), el('button', { class: 'tasto bordo', testo: 'Salta', onclick: () => foglioSalta(corso.id, ridisegna) })]));
      } else if (inCoda) {
        blocco.append(el('p', { class: 'attenuato', style: null }, [el('span', { class: 'in-coda', testo: '…' }), ' Sto trascrivendo: ti avviso io. Puoi chiudere l\'app.']));
        blocco.append(el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('a', { class: 'tasto bordo', href: `#/sessione/${corso.id}`, testo: 'Intanto a mano' }), el('a', { class: 'tasto', href: '#/diagnostica', testo: 'La coda' })]));
      } else {
        blocco.append(
          el('a', { class: 'tasto pieno grande', 'data-scrittura': '', href: `#/detta/${corso.id}` }, [icona('microfono'), 'Detta il rapportino']),
          el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [
            el('a', { class: 'tasto bordo', href: `#/sessione/${corso.id}`, testo: 'A mano' }),
            el('button', { class: 'tasto bordo', testo: 'Salta', onclick: () => foglioSalta(corso.id, ridisegna) }),
          ]),
        );
        if (fallita) blocco.append(el('a', { class: 'tasto', href: '#/diagnostica', testo: 'Vedi perché la dettatura si è fermata' }));
      }
    } else if (sifu && corso.stato === 'fatta') {
      blocco.append(el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('a', { class: 'tasto bordo', href: `#/sessione/${corso.id}`, testo: 'Modifica' }), el('button', { class: 'tasto', testo: 'PDF', onclick: async (e) => { e.target.disabled = true; const w = globalThis.open('', '_blank'); try { const r = await generaRapportino(corso.id); if (w) w.location.replace(r.url); else location.assign(r.url); } catch (err) { if (w) w.close(); avvisa(err.message || 'Non sono riuscito a fare il PDF.'); } finally { e.target.disabled = false; } } })]));
    } else if (sifu && corso.stato === 'saltata') {
      blocco.append(el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('button', { class: 'tasto bordo', testo: 'Riapri', onclick: async () => { try { await riapriSessione(corso.id); ridisegna(); } catch (e) { avvisa(e.message); } } })]));
    } else if (!sifu) {
      blocco.append(el('a', { class: 'tasto bordo', href: `#/sessione/${corso.id}`, testo: 'Vedi' }));
    }
  } else {
    blocco.append(el('div', { class: 'principale', testo: 'Oggi nessun corso' }));
    if (sifu) blocco.append(el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('button', { class: 'tasto bordo', testo: 'Straordinaria', onclick: () => foglioStraordinaria(oggi, ridisegna) })]));
  }
  main.append(sezione('Corso di oggi', blocco));

  // AVVISI: quelli nuovi, creati dall'orologio al mattino (la notifica ne porta il riassunto). Letti, spariscono.
  aggiornaBadge(avvisi.length);
  if (avvisi.length) {
    const box = el('div', { class: 'elenco' });
    const dove = (a) => a.tipo === 'cassetta' ? 'cassetta' : a.allievo_id ? `allievi/${a.allievo_id}` + (a.tipo === 'quota' ? '/quote' : a.tipo === 'certificato' || a.tipo === 'tesseramento' ? '/documenti' : '') : 'scadenze';
    const pallinoDi = (a) => a.soglia === 'scaduto' ? 'errore' : a.tipo === 'da_richiamare' || a.tipo === 'cassetta' ? 'info' : 'attenzione';
    for (const a of avvisi.slice(0, 10)) box.append(riga({ principale: a.testo, secondaria: formattaData(a.creato_il.slice(0, 10), 'breve'), pallino: pallinoDi(a), onclick: async () => { try { await segnaAvvisiLetti([a.id]); } catch { /* si rilegge la prossima volta */ } vai(dove(a)); } }));
    if (avvisi.length > 10) box.append(riga({ principale: `… e altri ${avvisi.length - 10}` }));
    main.append(sezione(`Avvisi · ${avvisi.length}`, box, el('button', { class: 'tasto azione', testo: 'Letti', onclick: async (e) => { e.target.disabled = true; try { await segnaAvvisiLetti(avvisi.map((a) => a.id)); aggiornaBadge(0); toast('Avvisi letti.'); ridisegna(); } catch (err) { avvisa(err.message); e.target.disabled = false; } } })));
  }

  // PRIVATE
  const priv = sessioni.filter((s) => s.tipo === 'privata');
  const elenco = el('div', { class: 'elenco' });
  if (!priv.length) elenco.append(statoVuoto('Nessuna privata oggi.'));
  for (const s of priv) {
    const piano = piani.find((x) => x.allievo_id === s.allievo_id);
    const pianoTesto = piano?.prossimo_passo_nota ? ' · piano: ' + piano.prossimo_passo_nota : '';
    elenco.append(riga({ principale: `${formattaOra(s.ora)} · ${nomeDi({ nome: s.allievo_nome, cognome: s.allievo_cognome })}`, secondaria: formattaMinuti(s.durata_minuti) + (s.stato === 'fatta' ? ' · fatta' : s.stato === 'saltata' ? ' · saltata' : s.in_revisione ? ' · bozza pronta: rivedi' : '') + pianoTesto, pallino: s.stato === 'fatta' ? 'ok' : s.stato === 'saltata' ? 'neutro' : 'attenzione', onclick: () => (sifu ? foglioPrivata(s, ridisegna) : vai(`sessione/${s.id}`)) }));
  }
  main.append(sezione('Private', elenco, sifu ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Privata', onclick: () => foglioNuovaPrivata(oggi, imp.private || {}, ridisegna) }) : null));

  // DA FARE
  const righe = [];
  if (daFare.quote) righe.push(riga({ principale: `${daFare.quote} quote da incassare`, destra: euro(daFare.quoteCent), pallino: 'attenzione', href: '#/allievi?f=da_pagare' }));
  if (daFare.daRichiamare) righe.push(riga({ principale: `${daFare.daRichiamare} da richiamare`, secondaria: `mancano da ${imp.scadenze?.da_richiamare_lezioni || 3} lezioni`, pallino: 'info', href: '#/allievi?f=da_richiamare' }));
  if (daFare.daCompletare) righe.push(riga({ principale: `${daFare.daCompletare} schede da completare`, pallino: 'info', href: '#/allievi?f=da_completare' }));
  const sg = statoGiornata(sessioni);
  const chiusa = g?.stato === 'chiusa';
  const tastoGiornata = sifu && sessioni.length ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: chiusa ? 'Giornata chiusa ✓' : 'Chiudi giornata', disabled: chiusa || !sg.chiudibile, onclick: async () => { try { await chiudiGiornata(oggi); toast('Giornata chiusa. Buona serata.'); ridisegna(); } catch (e) { avvisa(e.message); } } }) : null;
  if (sifu && !sg.chiudibile && sg.daFare) righe.push(riga({ principale: `${sg.daFare === 1 ? 'Una sessione' : sg.daFare + ' sessioni'} ancora da confermare`, pallino: 'attenzione' }));
  const azioniDaFare = sifu ? el('div', { class: 'tasti', 'data-scrittura': '' }, [el('button', { class: 'tasto azione', testo: '+ Pagamento', onclick: () => foglioRegistraPagamento({ dopo: ridisegna }) }), tastoGiornata].filter(Boolean)) : null;
  main.append(sezione('Da fare', righe.length ? el('div', { class: 'elenco' }, righe) : statoVuoto(chiusa ? 'Tutto chiuso. Bene.' : 'Niente da fare. Bene.'), azioniDaFare));

  // SCADENZE
  if (scad) {
    const testo = `${scad.scadute} scadute · ${scad.entro7} entro 7 giorni · ${scad.entro30} entro 30`;
    main.append(sezione('Scadenze', el('div', { class: 'elenco' }, riga({ principale: testo, pallino: scad.scadute ? 'errore' : scad.entro7 ? 'attenzione' : 'ok', href: '#/scadenze' }))));
  }

  // NOTIFICHE: la proposta, una volta sola, con la regola detta chiara
  const loc = leggiLocale();
  const iphone = iphoneNonInstallata();
  if (sifu && !loc.pushProposto && (iphone || (pushSupportato() && globalThis.Notification?.permission === 'default'))) {
    const segna = () => { const l = leggiLocale(); l.pushProposto = true; salvaLocale(l); };
    const box = el('div', { class: 'blocco' }, [
      el('p', { testo: iphone
        ? 'Per avere le notifiche su iPhone aggiungi l\'app alla schermata Home (Condividi → Aggiungi alla schermata Home) e attivale da Impostazioni → Scadenze e avvisi.'
        : 'Vuoi una notifica sul telefono? Al massimo due al giorno: al mattino solo se c\'è qualcosa da fare, la sera solo se la lezione è ancora da chiudere. Mai di notte.' }),
      el('div', { class: 'tasti' }, iphone ? [el('button', { class: 'tasto bordo', testo: 'Capito', onclick: () => { segna(); ridisegna(); } })] : [
        el('button', { class: 'tasto pieno', testo: 'Attiva', onclick: async (e) => { e.target.disabled = true; try { await attivaPush(); segna(); toast('Notifiche attive su questo telefono.'); ridisegna(); } catch (err) { avvisa(err.message); e.target.disabled = false; } } }),
        el('button', { class: 'tasto bordo', testo: 'Non ora', onclick: () => { segna(); ridisegna(); } }),
      ]),
    ]);
    main.append(sezione('Notifiche', box));
  }
}

/* ---------- fogli ---------- */
function foglioSalta(id, ridisegna) {
  const motivo = el('input', { type: 'text', placeholder: 'es. festa, palestra chiusa' });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Salta', onclick: async () => { try { await saltaSessione(id, motivo.value.trim() || null); chiudi(); toast('Saltata: non conta.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio('Salta la lezione di oggi', el('div', {}, [el('p', { class: 'attenuato', testo: 'Non conta come fatta né come mancata. Si può riaprire.' }), campo('Motivo', motivo), ok]));
}

async function foglioStraordinaria(oggi, ridisegna) {
  let corsi = [];
  try { corsi = (await corsiCompleti()).filter((c) => c.attivo); } catch (e) { avvisa(e.message); return; }
  if (!corsi.length) { avvisa('Nessun corso attivo.'); return; }
  const sel = el('select', {}, corsi.map((c) => el('option', { value: c.id, testo: `${c.nome} · ${c.citta}` })));
  const ora = el('input', { type: 'time', value: '19:00', step: '300' });
  const durata = el('input', { type: 'number', min: '30', max: '240', step: '30', value: corsi[0].durata_minuti });
  sel.addEventListener('change', () => { durata.value = corsi.find((c) => c.id === sel.value)?.durata_minuti || 60; });
  const nota = el('input', { type: 'text', placeholder: 'es. recupero della festa' });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Crea', onclick: async () => { try { const id = await creaStraordinaria(sel.value, oggi, ora.value || '19:00', Number(durata.value) || 60, nota.value.trim() || null); chiudi(); toast('Lezione straordinaria creata.'); vai(`sessione/${id}`); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio('Lezione straordinaria di oggi', el('div', {}, [campo('Corso', sel), el('div', { class: 'griglia-campi' }, [campo('Ora', ora), campo('Minuti', durata)]), campo('Nota', nota), ok]));
  void ridisegna;
}

export async function foglioNuovaPrivata(dataIniziale, impPrivate, ridisegna, allievoFisso = null) {
  let tutti = [];
  try { tutti = await allieviAttivi(); } catch (e) { avvisa(e.message); return; }
  const loc = leggiLocale();
  const recenti = (loc.privateRecenti || []).map((id) => tutti.find((a) => a.id === id)).filter(Boolean);
  let scelto = allievoFisso ? tutti.find((a) => a.id === allievoFisso) || null : null;
  const cerca = el('input', { type: 'search', placeholder: 'Con chi?', autocomplete: 'off', value: scelto ? nomeDi(scelto) : '' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = (q ? tutti.filter((a) => normalizza(nomeDi(a)).includes(q) || normalizza(`${a.cognome} ${a.nome}`).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))) : recenti).slice(0, 6);
    for (const a of righe) elenco.append(riga({ principale: nomeDi(a), secondaria: !q && recenti.includes(a) ? 'recente' : null, pallino: scelto?.id === a.id ? 'ok' : 'neutro', onclick: () => { scelto = a; cerca.value = nomeDi(a); elenco.replaceChildren(); } }));
  };
  cerca.addEventListener('input', () => { scelto = null; mostra(); });
  const data = el('input', { type: 'date', value: dataIniziale });
  const ora = el('input', { type: 'time', value: '17:00', step: '300' });
  const durata = el('input', { type: 'number', min: '30', max: '360', step: '30', value: impPrivate.durata_minuti || 60 });
  const ripeti = el('input', { type: 'checkbox' }); ripeti.checked = Boolean(impPrivate.ripeti_settimanale);
  const settimane = el('input', { type: 'number', min: '2', max: '52', value: impPrivate.settimane_avanti || 8 });
  const campoSett = campo('Per quante settimane', settimane); campoSett.classList.toggle('nascosto', !ripeti.checked);
  ripeti.addEventListener('change', () => campoSett.classList.toggle('nascosto', !ripeti.checked));
  const nota = el('input', { type: 'text', placeholder: 'es. lavoriamo sul Chum Kiu' });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Segna', onclick: async () => {
    if (!scelto) { avvisa('Scegli l\'allievo.'); return; }
    ok.disabled = true;
    try {
      const n = ripeti.checked ? Math.max(2, Number(settimane.value) || 8) : 1;
      await creaPrivate({ allievoId: scelto.id, data: data.value || dataIniziale, ora: ora.value || '17:00', minuti: Number(durata.value) || 60, settimane: n, nota: nota.value.trim() || null });
      const l = leggiLocale(); l.privateRecenti = [scelto.id, ...(l.privateRecenti || []).filter((x) => x !== scelto.id)].slice(0, 5); salvaLocale(l);
      chiudi(); toast(n > 1 ? `Segnate ${n} private, una a settimana.` : 'Privata segnata.'); ridisegna();
    } catch (e) { avvisa(e.message); ok.disabled = false; }
  } });
  const chiudi = apriFoglio('Nuova privata', el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco, el('div', { class: 'griglia-campi' }, [campo('Giorno', data), campo('Ora', ora), campo('Minuti', durata)]), el('label', { class: 'interruttore' }, [el('span', { testo: 'Ripeti ogni settimana' }), ripeti]), campoSett, campo('Nota', nota), ok]));
  mostra();
}

function foglioPrivata(s, ridisegna) {
  const figli = [el('p', { class: 'attenuato', testo: `${formattaData(s.data)} · ${formattaOra(s.ora)} · ${formattaMinuti(s.durata_minuti)}` + (s.nota ? ' · ' + s.nota : '') })];
  if (s.stato === 'prevista') {
    figli.push(el('a', { class: 'tasto pieno', href: `#/sessione/${s.id}`, testo: s.in_revisione ? 'Rivedi e conferma' : 'A mano', onclick: () => chiudi() }));
    figli.push(el('a', { class: 'tasto bordo', href: `#/detta/${s.id}`, testo: 'Detta', onclick: () => chiudi() }));
    figli.push(el('button', { class: 'tasto bordo', testo: 'Salta', onclick: async () => { try { await saltaSessione(s.id, null); chiudi(); toast('Saltata.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
    figli.push(el('button', { class: 'tasto bordo', testo: 'Sposta a domani', onclick: async () => { try { const { spostaSessione } = await import('../dati.js'); await spostaSessione(s.id, { data: aggiungiGiorni(s.data, 1), ora: s.ora, durata_minuti: s.durata_minuti }); chiudi(); toast('Spostata a domani.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
    figli.push(el('button', { class: 'tasto pericolo', testo: 'Annulla', onclick: () => { chiudi(); foglioAnnulla(s, ridisegna); } }));
  } else if (s.stato === 'fatta') {
    figli.push(el('a', { class: 'tasto pieno', href: `#/sessione/${s.id}`, testo: 'Vedi o modifica', onclick: () => chiudi() }));
  } else if (s.stato === 'saltata') {
    figli.push(el('button', { class: 'tasto bordo', testo: 'Riapri', onclick: async () => { try { await riapriSessione(s.id); chiudi(); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  }
  const chiudi = apriFoglio(nomeDi({ nome: s.allievo_nome, cognome: s.allievo_cognome }), el('div', { class: 'tasti-colonna' }, figli));
}
