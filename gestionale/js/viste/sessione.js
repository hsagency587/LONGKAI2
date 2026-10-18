/* Longkai — viste/sessione.js: una sessione (corso, straordinaria o privata) fatta a mano: presenti, gruppo, singoli, forme,
   pagamenti, prossima volta. È la stessa revisione della dettatura (fase 4), senza il vocale. Una sessione fatta si riapre e si corregge. */
import { el, euro, nuovoId } from '../base.js';
import { sessioneCompleta, attesiSessione, allieviAttivi, argomentiAttivi, confermaSessione, saltaSessione, riapriSessione, annullaSessione, spostaSessione, nuovoAllievoVeloce, ultimoContenutoCorso, soloLettura, impostazioni, aggiungiSoprannome, aggiungiPronuncia, creaPrivate } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio, chiedi, vai } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { formattaData, formattaOra, oggiRoma } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';
import { datiPerConferma, minutiValidi, STATI_FORMA } from '../../comune/sessione.js';
import { scegliArgomenti, chipsArgomenti } from './scegli-argomenti.js';
import { campo } from './allievo-modulo.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

export async function vistaSessione(main, parametri) {
  const id = parametri[0];
  main.append(scheletri(5));
  const [d, imp] = await Promise.all([sessioneCompleta(id), impostazioni().catch(() => ({}))]);
  main.replaceChildren();
  if (!d) { testata('Sessione', { indietro: 'oggi' }); main.append(statoVuoto('Questa sessione non esiste.')); return; }
  const s = d.sessione;
  const lettura = soloLettura();
  const titolo = s.tipo === 'privata' ? `Privata · ${nomeDi({ nome: s.allievo_nome, cognome: s.allievo_cognome })}` : `${s.corso_nome || 'Corso'} · ${s.citta || ''}`;
  testata(titolo, { indietro: true });
  const [argomenti, attesi, tutti] = await Promise.all([argomentiAttivi(), s.tipo === 'privata' ? Promise.resolve([]) : attesiSessione(id), allieviAttivi()]);
  const forme = argomenti.filter((a) => a.area === 'Forme');
  const oggi = oggiRoma();
  const ridisegna = () => { main.replaceChildren(); vistaSessione(main, parametri); };

  // intestazione
  const statoTesto = s.stato === 'fatta' ? 'fatta' : s.stato === 'saltata' ? 'saltata' + (s.motivo ? ': ' + s.motivo : '') : s.stato === 'annullata' ? 'annullata' : 'da fare';
  main.append(el('div', { class: 'blocco' }, [
    el('div', { class: 'principale', testo: `${formattaData(s.data)} · ${formattaOra(s.ora)} · ${formattaMinuti(s.durata_minuti)}` }),
    el('div', { class: 'secondaria attenuato', testo: (s.tipo === 'straordinaria' ? 'Lezione straordinaria · ' : '') + statoTesto + (s.previsto_argomenti ? ' · previsto: ' + s.previsto_argomenti : '') }),
  ]));

  if (s.stato === 'annullata') { main.append(statoVuoto('Sessione annullata' + (s.annullata_perche ? ': ' + s.annullata_perche : '.'))); return; }
  if (lettura) { disegnaSolaLettura(main, d, argomenti); return; }
  if (s.stato === 'saltata') {
    main.append(statoVuoto('Questa sessione è stata saltata.', el('button', { class: 'tasto bordo', testo: 'Riapri', onclick: async () => { try { await riapriSessione(id); toast('Riaperta.'); ridisegna(); } catch (e) { avvisa(e.message); } } })));
    return;
  }

  /* ---------- lo stato del modulo, già riempito se la sessione è fatta ---------- */
  const st = { presenti: [], gruppo: { argomenti: [], nota: '' }, singoli: [], forme: [], pagamenti: [], prossima_volta: { argomenti: [], nota: '' }, piani: [], nota: s.nota || '', testo_grezzo: d.testoGrezzo || '' };
  const iscritti = new Set(attesi.map((a) => a.allievo_id));
  const giaPresenti = new Map(d.presenze.map((p) => [p.allievo_id, p]));
  const aggiungiPresente = (a, { presente, minuti, tipo }) => {
    if (st.presenti.some((p) => p.allievo_id === a.id)) return;
    st.presenti.push({ allievo_id: a.id, nome: nomeDi(a), sospeso: a.stato === 'sospeso', presente, minuti: minutiValidi(minuti, s.durata_minuti), tipo: tipo || (iscritti.has(a.id) || s.tipo === 'privata' ? 'normale' : (imp.allievi?.tipo_non_iscritto || 'extra')) });
  };
  for (const a of attesi) { const p = giaPresenti.get(a.allievo_id); aggiungiPresente({ id: a.allievo_id, nome: a.nome, cognome: a.cognome, stato: a.stato }, { presente: s.stato === 'fatta' ? Boolean(p) : a.stato !== 'sospeso', minuti: p?.minuti, tipo: p?.tipo }); }
  if (s.tipo === 'privata' && s.allievo_id) { const p = giaPresenti.get(s.allievo_id); aggiungiPresente({ id: s.allievo_id, nome: s.allievo_nome, cognome: s.allievo_cognome }, { presente: true, minuti: p?.minuti, tipo: 'normale' }); }
  for (const p of d.presenze) if (!st.presenti.some((x) => x.allievo_id === p.allievo_id)) aggiungiPresente({ id: p.allievo_id, nome: p.allievi?.nome, cognome: p.allievi?.cognome }, { presente: true, minuti: p.minuti, tipo: p.tipo });
  for (const c of d.contenuti) {
    const ids = (c.contenuti_argomenti || []).map((x) => x.argomento_id);
    if (!c.allievo_id) { st.gruppo = { argomenti: ids, nota: c.nota || '' }; }
    else singolo(c.allievo_id).argomenti = ids, singolo(c.allievo_id).nota = c.nota || '';
  }
  for (const o of d.osservazioni) singolo(o.allievo_id).osservazione = o.testo;
  for (const f of d.forme) st.forme.push({ allievo_id: f.allievo_id, forma_id: f.forma_id, stato: f.a_stato, sezione: f.a_sezione });
  for (const p of d.pagamenti) st.pagamenti.push({ allievo_id: p.allievo_id, importo_cent: p.importo_cent, metodo: p.metodo, nota: p.nota, registrato: true });
  if (d.programmaProssima) st.prossima_volta = { argomenti: [...(d.programmaProssima.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine).map((x) => x.argomento_id), nota: d.programmaProssima.nota || '' };
  // la bozza della dettatura (fase 4): riempie il modulo; quello che non è stato riconosciuto finisce in "Da sistemare"
  const b = s.stato !== 'fatta' && d.bozza ? d.bozza : null;
  const daSistemare = { nomi: [], argomenti: [] };
  if (b) {
    if (Array.isArray(b.presenti) && b.presenti.length) {
      const detti = new Map(b.presenti.map((p) => [p.allievo_id, p]));
      for (const p of st.presenti) { const x = detti.get(p.allievo_id); p.presente = Boolean(x); if (x?.minuti) p.minuti = minutiValidi(x.minuti, s.durata_minuti); if (x?.tipo) p.tipo = x.tipo; }
      for (const [aid, x] of detti) if (!st.presenti.some((p) => p.allievo_id === aid)) { const a = tutti.find((y) => y.id === aid); if (a) aggiungiPresente(a, { presente: true, minuti: x.minuti, tipo: x.tipo }); }
    }
    for (const aid of b.assenti_detti || []) { const p = st.presenti.find((x) => x.allievo_id === aid); if (p) p.presente = false; }
    if (b.gruppo) st.gruppo = { argomenti: b.gruppo.argomenti || [], nota: b.gruppo.nota || '' };
    for (const x of b.singoli || []) { const sg = singolo(x.allievo_id); sg.argomenti = x.argomenti || []; sg.nota = x.nota || ''; sg.osservazione = x.osservazione || ''; }
    for (const f of b.forme || []) st.forme.push({ allievo_id: f.allievo_id, forma_id: f.forma_id, stato: f.stato || 'in_apprendimento', sezione: f.sezione || 0 });
    for (const p of b.pagamenti || []) st.pagamenti.push({ allievo_id: p.allievo_id, importo_cent: p.importo_cent, metodo: p.metodo || 'contanti', nota: [p.periodo, p.nota].filter(Boolean).join(' · ') || null });
    if (b.prossima_volta && ((b.prossima_volta.argomenti || []).length || b.prossima_volta.nota)) st.prossima_volta = { argomenti: b.prossima_volta.argomenti || [], nota: b.prossima_volta.nota || '' };
    for (const p of b.piani || []) st.piani.push({ allievo_id: p.allievo_id, argomenti: p.argomenti || [], prossimo_passo: p.prossimo_passo || '' });
    daSistemare.nomi = (b.non_riconosciuti?.nomi || []).map((n) => ({ ...n, risolto: false }));
    daSistemare.argomenti = (b.non_riconosciuti?.argomenti || []).map((n) => ({ ...n, risolto: false }));
    st.privateDette = b.private || [];
  }
  function singolo(allievoId) { let x = st.singoli.find((y) => y.allievo_id === allievoId); if (!x) { x = { allievo_id: allievoId, argomenti: [], nota: '', osservazione: '' }; st.singoli.push(x); } return x; }

  /* ---------- DA SISTEMARE (dalla dettatura) ---------- */
  if (b && (daSistemare.nomi.length || daSistemare.argomenti.length)) {
    const boxDS = el('div', { class: 'elenco' });
    const disegnaDS = () => {
      boxDS.replaceChildren();
      for (const n of daSistemare.nomi) boxDS.append(riga({ principale: `“${n.sentito}”`, secondaria: n.risolto ? 'sistemato: ' + n.risolto : 'nome non riconosciuto' + (n.candidati?.length ? ' · forse: ' + n.candidati.map((id) => nomeDi(tutti.find((a) => a.id === id))).filter(Boolean).join(', ') : ''), pallino: n.risolto ? 'ok' : 'attenzione', onclick: n.risolto ? null : () => foglioNome(n) }));
      for (const n of daSistemare.argomenti) boxDS.append(riga({ principale: `“${n.sentito}”`, secondaria: n.risolto ? 'sistemato: ' + n.risolto : 'termine non riconosciuto' + (n.dove ? ' · detto in: ' + n.dove : ''), pallino: n.risolto ? 'ok' : 'attenzione', onclick: n.risolto ? null : () => foglioTermine(n) }));
    };
    const foglioNome = (n) => {
      const ricorda = el('input', { type: 'checkbox' }); ricorda.checked = imp.voce?.ricorda_pronunce !== false;
      const candidati = (n.candidati || []).map((id) => tutti.find((a) => a.id === id)).filter(Boolean);
      const cerca = el('input', { type: 'search', placeholder: 'Chi è?', autocomplete: 'off' });
      const elenco = el('div', { class: 'elenco' });
      const scegli = async (a) => {
        if (!st.presenti.some((p) => p.allievo_id === a.id)) aggiungiPresente(a, { presente: true, minuti: n.minuti });
        else st.presenti.find((p) => p.allievo_id === a.id).presente = true;
        n.risolto = nomeDi(a);
        if (ricorda.checked) { try { await aggiungiSoprannome(a.id, n.sentito); } catch { /* niente */ } }
        chiudi(); disegnaPresenti(); disegnaDS();
      };
      const mostra = () => { elenco.replaceChildren(); const q = normalizza(cerca.value); const righe = (q ? tutti.filter((a) => normalizza(nomeDi(a)).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))) : candidati).slice(0, 6); for (const a of righe) elenco.append(riga({ principale: nomeDi(a), secondaria: !q && candidati.includes(a) ? 'proposto' : null, onclick: () => scegli(a) })); if (!righe.length) elenco.append(statoVuoto('Nessuno.')); };
      cerca.addEventListener('input', mostra);
      const chiudi = apriFoglio(`“${n.sentito}”: chi è?`, el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco, el('label', { class: 'interruttore' }, [el('span', { testo: 'Ricorda come lo dico' }), ricorda]), el('button', { class: 'tasto bordo', testo: 'Nuovo allievo', onclick: async () => { try { const a = await nuovoAllievoVeloce(n.sentito); tutti.push(a); await scegli(a); toast('Creato: la scheda resta da completare.'); } catch (e) { avvisa(e.message); } } }), el('button', { class: 'tasto', testo: 'Lascia perdere', onclick: () => { n.risolto = '(ignorato)'; chiudi(); disegnaDS(); } })]));
      mostra();
    };
    const foglioTermine = (n) => {
      const ricorda = el('input', { type: 'checkbox' }); ricorda.checked = imp.voce?.ricorda_pronunce !== false;
      const cerca = el('input', { type: 'search', placeholder: 'Qual è?', autocomplete: 'off', value: '' });
      const elenco = el('div', { class: 'elenco' });
      const scegli = async (a) => {
        if (n.dove === 'prossima_volta') { if (!st.prossima_volta.argomenti.includes(a.id)) st.prossima_volta.argomenti.push(a.id); }
        else if (!st.gruppo.argomenti.includes(a.id)) st.gruppo.argomenti.push(a.id);
        n.risolto = a.nome;
        if (ricorda.checked) { try { await aggiungiPronuncia(a.id, n.sentito); } catch { /* niente */ } }
        chiudi(); disegnaGruppo(); disegnaDS();
      };
      const mostra = () => { elenco.replaceChildren(); const q = normalizza(cerca.value || n.sentito); const righe = argomenti.filter((a) => normalizza(a.nome).includes(q) || (a.sinonimi || []).some((x) => normalizza(x).includes(q)) || (a.pronunce || []).some((x) => normalizza(x).includes(q)) || (q.length > 3 && normalizza(a.nome).slice(0, 4) === q.slice(0, 4))).slice(0, 8); for (const a of righe) elenco.append(riga({ principale: a.nome, secondaria: a.area, onclick: () => scegli(a) })); if (!righe.length) elenco.append(statoVuoto('Niente di simile: cerca.')); };
      cerca.addEventListener('input', mostra);
      const chiudi = apriFoglio(`“${n.sentito}”: quale argomento?`, el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco, el('label', { class: 'interruttore' }, [el('span', { testo: 'Ricorda come lo dico' }), ricorda]), el('button', { class: 'tasto', testo: 'Lascia perdere', onclick: () => { n.risolto = '(ignorato)'; chiudi(); disegnaDS(); } })]));
      mostra();
    };
    disegnaDS();
    main.append(sezione('Da sistemare', boxDS));
  }
  if (b && b.titolo) main.append(el('p', { class: 'attenuato', testo: '“' + b.titolo + '”' }));

  /* ---------- PRESENTI ---------- */
  const boxPresenti = el('div', { class: 'elenco' });
  function disegnaPresenti() {
    boxPresenti.replaceChildren();
    if (!st.presenti.length) boxPresenti.append(statoVuoto('Nessun iscritto a questo corso: aggiungi chi c\'era.'));
    for (const p of st.presenti) {
      const r = el('div', { class: 'riga presenza' + (p.presente ? ' c-e' : '') });
      const spunta = el('button', { class: 'spunta-presenza' + (p.presente ? ' si' : ''), type: 'button', 'aria-pressed': p.presente ? 'true' : 'false', 'aria-label': (p.presente ? 'Presente: ' : 'Assente: ') + p.nome, onclick: () => { p.presente = !p.presente; disegnaPresenti(); } }, p.presente ? '✓' : '');
      const testo = el('div', {}, [el('div', { class: 'principale', testo: p.nome }), el('div', { class: 'secondaria', testo: p.sospeso ? 'sospeso' : p.tipo === 'extra' ? 'lezione in più (da pagare)' : p.tipo === 'recupero' ? 'recupero' : '' })]);
      const destra = el('div', { class: 'destra' });
      if (p.presente) {
        const meno = el('button', { class: 'tasto stepper-tasto', type: 'button', 'aria-label': 'Meno minuti', testo: '−', onclick: () => { p.minuti = Math.max(30, p.minuti - 30); disegnaPresenti(); } });
        const piu = el('button', { class: 'tasto stepper-tasto', type: 'button', 'aria-label': 'Più minuti', testo: '+', onclick: () => { p.minuti = Math.min(360, p.minuti + 30); disegnaPresenti(); } });
        destra.append(meno, el('span', { class: 'num', testo: formattaMinuti(p.minuti) }), piu);
        if (!iscritti.has(p.allievo_id) && s.tipo !== 'privata') destra.append(el('button', { class: 'chip ' + (p.tipo === 'extra' ? 'extra' : p.tipo === 'recupero' ? 'recupero' : ''), type: 'button', testo: p.tipo === 'extra' ? 'EXTRA' : p.tipo === 'recupero' ? 'RECUPERO' : 'normale', onclick: () => { p.tipo = p.tipo === 'extra' ? 'recupero' : p.tipo === 'recupero' ? 'normale' : 'extra'; disegnaPresenti(); } }));
      }
      r.append(spunta, testo, destra);
      boxPresenti.append(r);
    }
  }
  disegnaPresenti();
  const aggiungi = el('button', { class: 'tasto azione', testo: '+ Aggiungi', onclick: () => foglioAggiungi(tutti.filter((a) => !st.presenti.some((p) => p.allievo_id === a.id)), (a) => { aggiungiPresente(a, { presente: true }); disegnaPresenti(); }, async (nome, cognome) => { const a = await nuovoAllievoVeloce(nome, cognome); tutti.push(a); aggiungiPresente(a, { presente: true }); disegnaPresenti(); }) });
  main.append(sezione(`Presenti · ${s.tipo === 'privata' ? 'privata' : attesi.length + ' attesi'}`, boxPresenti, aggiungi));

  /* ---------- GRUPPO ---------- */
  const gruppoChips = el('div');
  const gruppoNota = el('textarea', { rows: '2', placeholder: 'Due parole su cosa si è fatto' }); gruppoNota.value = st.gruppo.nota;
  gruppoNota.addEventListener('input', () => { st.gruppo.nota = gruppoNota.value; });
  const disegnaGruppo = () => gruppoChips.replaceChildren(chipsArgomenti(st.gruppo.argomenti, argomenti, { vuoto: 'Nessun argomento ancora.' }));
  disegnaGruppo();
  const tastiGruppo = el('div', { class: 'tasti' }, [
    el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti: st.gruppo.argomenti, titolo: 'Cosa ha fatto il gruppo' }); if (r) { st.gruppo.argomenti = r; disegnaGruppo(); } } }),
    s.corso_id ? el('button', { class: 'tasto', testo: 'Copia dall\'ultima', onclick: async () => { try { const u = await ultimoContenutoCorso(s.corso_id, s.data); if (!u) { toast('Nessuna lezione precedente.'); return; } st.gruppo.argomenti = u.argomenti; if (u.nota && !st.gruppo.nota) { st.gruppo.nota = u.nota; gruppoNota.value = u.nota; } disegnaGruppo(); toast(`Copiato dal ${formattaData(u.data, 'numerico')}.`); } catch (e) { avvisa(e.message); } } }) : null,
    (s.previsto_argomenti && d.programma) ? el('button', { class: 'tasto', testo: 'Dal previsto', onclick: () => { st.gruppo.argomenti = [...(d.programma.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine).map((x) => x.argomento_id); disegnaGruppo(); } }) : null,
  ]);
  main.append(sezione(s.tipo === 'privata' ? 'Cosa si è fatto' : 'Cosa ha fatto il gruppo', el('div', { class: 'blocco' }, [gruppoChips, tastiGruppo, campo('Nota', gruppoNota)])));

  /* ---------- SINGOLI ---------- */
  if (s.tipo !== 'privata') {
    const boxSingoli = el('div', { class: 'elenco' });
    const disegnaSingoli = () => {
      boxSingoli.replaceChildren();
      const presenti = st.presenti.filter((p) => p.presente);
      if (!presenti.length) { boxSingoli.append(statoVuoto('Prima i presenti.')); return; }
      for (const p of presenti) {
        const x = st.singoli.find((y) => y.allievo_id === p.allievo_id);
        const fx = st.forme.filter((f) => f.allievo_id === p.allievo_id);
        const ha = x && ((x.argomenti || []).length || x.nota || x.osservazione);
        const riassunto = [ha && x.argomenti.length ? x.argomenti.map((id) => argomenti.find((a) => a.id === id)?.nome).filter(Boolean).join(', ') : null, ha && x.osservazione ? '“' + x.osservazione + '”' : null, ...fx.map((f) => `▲ ${forme.find((a) => a.id === f.forma_id)?.nome || 'forma'} ${f.stato === 'completa' ? 'completa' : 'sez. ' + f.sezione}`)].filter(Boolean).join(' · ');
        boxSingoli.append(riga({ principale: p.nome, secondaria: riassunto || 'niente di suo', pallino: ha || fx.length ? 'ok' : 'neutro', onclick: () => foglioSingolo(p, singolo(p.allievo_id), st, forme, argomenti, disegnaSingoli) }));
      }
    };
    disegnaSingoli();
    boxPresenti.addEventListener('click', () => setTimeout(disegnaSingoli, 0));
    main.append(sezione('Qualcuno ha fatto qualcosa di suo?', boxSingoli));
  } else if (s.allievo_id) {
    // nella privata l'allievo è uno: osservazione e forme direttamente
    const x = singolo(s.allievo_id);
    const oss = el('textarea', { rows: '2', placeholder: 'Un\'osservazione su di lui' }); oss.value = x.osservazione; oss.addEventListener('input', () => { x.osservazione = oss.value; });
    const boxForme = el('div');
    const disegnaForme = () => { boxForme.replaceChildren(); for (const f of st.forme.filter((y) => y.allievo_id === s.allievo_id)) boxForme.append(el('span', { class: 'chip', testo: `▲ ${forme.find((a) => a.id === f.forma_id)?.nome || 'forma'} · ${f.stato === 'completa' ? 'completa' : 'sezione ' + f.sezione}` })); };
    disegnaForme();
    main.append(sezione('Osservazioni e forme', el('div', { class: 'blocco' }, [campo('Osservazione', oss), boxForme, el('button', { class: 'tasto bordo', testo: '▲ Avanzamento in una forma', onclick: () => foglioForma({ allievo_id: s.allievo_id, nome: nomeDi({ nome: s.allievo_nome, cognome: s.allievo_cognome }) }, st, forme, disegnaForme) })])));
  }

  /* ---------- PRIVATE DETTE (dalla dettatura del corso) ---------- */
  if ((st.privateDette || []).length && s.tipo !== 'privata') {
    const boxPr = el('div', { class: 'elenco' });
    for (const p of st.privateDette) {
      const nome = nomeDi(tutti.find((a) => a.id === p.allievo_id)) || 'privata';
      boxPr.append(riga({ principale: nome + (p.ora ? ' · ' + p.ora : ''), secondaria: [(p.argomenti || []).map((id) => argomenti.find((a) => a.id === id)?.nome).filter(Boolean).join(', '), p.nota, p.osservazione ? '“' + p.osservazione + '”' : null].filter(Boolean).join(' · ') || 'detta a voce', pallino: 'info', onclick: async () => {
        try {
          const sid = p.sessione_id;
          if (!sid) { if (!p.allievo_id) { avvisa('Non so di chi è questa privata.'); return; } await creaPrivate({ allievoId: p.allievo_id, data: s.data, ora: p.ora || '17:00', minuti: p.minuti || 60 }); toast('Privata creata: aprila da Oggi per confermarla.'); return; }
          vai(`sessione/${sid}`);
        } catch (e) { avvisa(e.message); }
      } }));
    }
    main.append(sezione('Private dette', boxPr));
  }

  /* ---------- PAGAMENTI ---------- */
  const boxPag = el('div', { class: 'elenco' });
  const disegnaPag = () => {
    boxPag.replaceChildren();
    if (!st.pagamenti.length) boxPag.append(statoVuoto('Nessun pagamento oggi.'));
    st.pagamenti.forEach((p, i) => boxPag.append(riga({ principale: nomeDi(tutti.find((a) => a.id === p.allievo_id)) || '…', secondaria: (p.metodo || 'contanti') + (p.nota ? ' · ' + p.nota : '') + (p.registrato ? ' · già registrato' : ''), destra: euro(p.importo_cent), pallino: p.registrato ? 'ok' : 'attenzione', onclick: p.registrato ? null : () => { st.pagamenti.splice(i, 1); disegnaPag(); } })));
  };
  disegnaPag();
  main.append(sezione('Qualcuno ha pagato?', boxPag, el('button', { class: 'tasto azione', testo: '+ Pagamento', onclick: () => foglioPagamento(st.presenti.filter((p) => p.presente).map((p) => ({ id: p.allievo_id, nome: p.nome })), tutti, (pg) => { st.pagamenti.push(pg); disegnaPag(); }) })));

  /* ---------- PROSSIMA VOLTA ---------- */
  if (s.corso_id) {
    const pvChips = el('div');
    const pvNota = el('input', { type: 'text', placeholder: 'una nota per la prossima lezione' }); pvNota.value = st.prossima_volta.nota; pvNota.addEventListener('input', () => { st.prossima_volta.nota = pvNota.value; });
    const disegnaPv = () => pvChips.replaceChildren(chipsArgomenti(st.prossima_volta.argomenti, argomenti, { vuoto: d.prossima ? 'Niente di previsto: se vuoi, scegli.' : 'La prossima lezione non è ancora in calendario: si crea alla conferma.' }));
    disegnaPv();
    const giaPrevista = d.programmaProssima && (d.programmaProssima.programma_argomenti || []).length;
    main.append(sezione('La prossima volta' + (d.prossima ? ' · ' + formattaData(d.prossima.data, 'breve') : ''), el('div', { class: 'blocco' }, [
      giaPrevista ? el('p', { class: 'piccolo attenuato', testo: 'Già prevista (dal programma). Cambiala solo se vuoi.' }) : null,
      pvChips, el('button', { class: 'tasto bordo', testo: giaPrevista ? 'Cambia' : 'Scegli', onclick: async () => { const r = await scegliArgomenti({ scelti: st.prossima_volta.argomenti, titolo: 'La prossima volta' }); if (r) { st.prossima_volta.argomenti = r; disegnaPv(); } } }), campo('Nota', pvNota),
    ])));
  }

  /* ---------- NOTA E CONFERMA ---------- */
  const nota = el('textarea', { rows: '2', placeholder: 'Qualcosa da ricordare di questa sessione' }); nota.value = st.nota; nota.addEventListener('input', () => { st.nota = nota.value; });
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const conferma = el('button', { class: 'tasto pieno grande', testo: s.stato === 'fatta' ? 'Salva le modifiche' : 'Conferma', onclick: async () => {
    errore.textContent = '';
    const dati = datiPerConferma(st);
    if (!dati.presenze.length) { const ok = await chiedi('Nessun presente?', 'Confermi la sessione senza nessuno presente?', [{ testo: 'Sì, confermo', valore: true, classe: 'pieno' }, { testo: 'Torna', valore: false }]); if (!ok) return; }
    conferma.disabled = true;
    try {
      const r = await confermaSessione(nuovoId(), id, dati, s.aggiornato_il);
      toast(r?.gia_fatto ? 'Era già confermata.' : `Confermata: ${dati.presenze.length} presenti` + (r?.extra ? `, ${r.extra} in più` : '') + (r?.pagamenti ? `, ${r.pagamenti} pagamenti` : '') + '.');
      vai(s.data === oggi ? 'oggi' : 'allenamenti/diario');
    } catch (e) { errore.textContent = e.message || 'Non sono riuscito a confermare.'; conferma.disabled = false; }
  } });
  const secondari = el('div', { class: 'tasti' });
  if (s.stato === 'prevista') secondari.append(el('button', { class: 'tasto', testo: 'Salta', onclick: () => foglioSalta(id, ridisegna) }));
  if (s.tipo === 'privata' && s.stato === 'prevista') secondari.append(el('button', { class: 'tasto', testo: 'Sposta', onclick: () => foglioSposta(s, ridisegna) }));
  if (s.stato !== 'fatta') secondari.append(el('button', { class: 'tasto pericolo', testo: 'Annulla la sessione', onclick: () => foglioAnnulla(s, ridisegna) }));
  main.append(sezione('Nota', el('div', { class: 'blocco' }, [campo('Nota', nota)])));
  if (st.testo_grezzo) main.append(el('details', { class: 'area-dettagli' }, [el('summary', { testo: 'Il testo dettato' }), el('p', { class: 'piccolo attenuato', style: null, testo: st.testo_grezzo })]));
  main.append(errore, conferma, el('div', { class: 'spazio' }), secondari);
}

/* ---------- fogli ---------- */
function foglioAggiungi(candidati, suScelta, suNuovo) {
  const cerca = el('input', { type: 'search', placeholder: 'Chi c\'era?', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = candidati.filter((a) => !q || normalizza(nomeDi(a)).includes(q) || normalizza(`${a.cognome} ${a.nome}`).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))).slice(0, 8);
    for (const a of righe) elenco.append(riga({ principale: nomeDi(a), secondaria: a.stato === 'sospeso' ? 'sospeso' : null, onclick: () => { suScelta(a); chiudi(); } }));
    if (!righe.length) elenco.append(statoVuoto('Nessuno con questo nome.'));
  };
  cerca.addEventListener('input', mostra);
  const nuovo = el('button', { class: 'tasto bordo', testo: 'Nuovo allievo', onclick: () => {
    const nome = el('input', { type: 'text', placeholder: 'Nome', autocapitalize: 'words', value: cerca.value });
    const cognome = el('input', { type: 'text', placeholder: 'Cognome', autocapitalize: 'words' });
    const ok = el('button', { class: 'tasto pieno', testo: 'Aggiungi', onclick: async () => { if (!nome.value.trim()) { avvisa('Serve il nome.'); return; } try { await suNuovo(nome.value.trim(), cognome.value.trim()); chiudi2(); chiudi(); toast('Creato: la scheda resta da completare.'); } catch (e) { avvisa(e.message); } } });
    const chiudi2 = apriFoglio('Nuovo allievo', el('div', {}, [el('p', { class: 'attenuato', testo: 'Solo il nome, il resto dopo dalla scheda.' }), campo('Nome', nome), campo('Cognome', cognome), ok]));
  } });
  const chiudi = apriFoglio('Aggiungi un presente', el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco, el('div', { class: 'spazio' }), nuovo]));
  mostra();
}

function foglioSingolo(p, x, st, forme, argomenti, ridisegna) {
  const chipsBox = el('div');
  const disegnaChips = () => chipsBox.replaceChildren(chipsArgomenti(x.argomenti, argomenti, { vuoto: 'Nessun argomento suo.' }));
  disegnaChips();
  const nota = el('input', { type: 'text', placeholder: 'una nota' }); nota.value = x.nota; nota.addEventListener('input', () => { x.nota = nota.value; });
  const oss = el('textarea', { rows: '2', placeholder: 'es. sta migliorando la struttura' }); oss.value = x.osservazione; oss.addEventListener('input', () => { x.osservazione = oss.value; });
  const boxForme = el('div', { class: 'chips' });
  const disegnaForme = () => { boxForme.replaceChildren(); for (const f of st.forme.filter((y) => y.allievo_id === p.allievo_id)) boxForme.append(el('button', { class: 'chip', onclick: () => { st.forme = st.forme.filter((y) => y !== f); disegnaForme(); } }, [`▲ ${forme.find((a) => a.id === f.forma_id)?.nome || 'forma'} · ${f.stato === 'completa' ? 'completa' : 'sez. ' + f.sezione}`, el('span', { class: 'x', testo: '×' })])); };
  disegnaForme();
  const chiudi = apriFoglio(p.nome, el('div', {}, [
    chipsBox, el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti: x.argomenti, titolo: 'Cosa ha fatto ' + p.nome }); if (r) { x.argomenti = r; disegnaChips(); } } }),
    campo('Nota', nota), campo('Osservazione', oss),
    el('h3', { class: 'titolo-blocco', testo: 'Forme' }), boxForme,
    el('button', { class: 'tasto bordo', testo: '▲ Avanzamento in una forma', onclick: () => foglioForma(p, st, forme, disegnaForme) }),
    el('div', { class: 'spazio' }), el('button', { class: 'tasto pieno grande', testo: 'Fatto', onclick: () => chiudi() }),
  ]), { suChiusura: ridisegna });
}

function foglioForma(p, st, forme, dopo) {
  const sel = el('select', {}, forme.map((f) => el('option', { value: f.id, testo: f.nome })));
  const stato = el('select', {}, Object.entries(STATI_FORMA).map(([v, t]) => el('option', { value: v, testo: t })));
  stato.value = 'in_apprendimento';
  const sezione_ = el('select', {});
  const riempiSezioni = () => { const f = forme.find((x) => x.id === sel.value); const n = Array.isArray(f?.sezioni) ? f.sezioni.length : 0; sezione_.replaceChildren(el('option', { value: '0', testo: 'nessuna ancora' })); for (let i = 1; i <= n; i++) sezione_.append(el('option', { value: String(i), testo: `${i}ª sezione fatta` + (f.sezioni[i - 1]?.nome ? ' · ' + f.sezioni[i - 1].nome : '') })); };
  riempiSezioni(); sel.addEventListener('change', riempiSezioni);
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Segna', onclick: () => { st.forme = st.forme.filter((y) => !(y.allievo_id === p.allievo_id && y.forma_id === sel.value)); st.forme.push({ allievo_id: p.allievo_id, forma_id: sel.value, stato: stato.value, sezione: Number(sezione_.value) }); chiudi(); dopo(); } });
  const chiudi = apriFoglio('Avanzamento: ' + p.nome, el('div', {}, [campo('Forma', sel), campo('Stato', stato), campo('Fino a', sezione_), ok]));
}

function foglioPagamento(presenti, tutti, suScelta) {
  const sel = el('select', {}, [...presenti.map((p) => el('option', { value: p.id, testo: p.nome })), el('option', { value: '', testo: '— altro allievo —' })]);
  const altro = el('input', { type: 'search', placeholder: 'cerca un altro allievo', class: 'nascosto', autocomplete: 'off' });
  let altroId = null;
  const elencoAltri = el('div', { class: 'elenco nascosto' });
  sel.addEventListener('change', () => { const si = sel.value === ''; altro.classList.toggle('nascosto', !si); elencoAltri.classList.toggle('nascosto', !si); });
  altro.addEventListener('input', () => { elencoAltri.replaceChildren(); const q = normalizza(altro.value); for (const a of tutti.filter((x) => q && (normalizza(nomeDi(x)).includes(q) || (x.soprannomi || []).some((y) => normalizza(y).includes(q)))).slice(0, 5)) elencoAltri.append(riga({ principale: nomeDi(a), onclick: () => { altroId = a.id; altro.value = nomeDi(a); elencoAltri.replaceChildren(); } })); });
  const importo = el('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', placeholder: '0,00' });
  const metodo = el('select', {}, [['contanti', 'Contanti'], ['bonifico', 'Bonifico'], ['altro', 'Altro']].map(([v, t]) => el('option', { value: v, testo: t })));
  const nota = el('input', { type: 'text', placeholder: 'es. novembre' });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Aggiungi', onclick: () => {
    const id = sel.value || altroId;
    const cent = Math.round(parseFloat(String(importo.value).replace(',', '.')) * 100);
    if (!id) { avvisa('Chi ha pagato?'); return; }
    if (!(cent > 0)) { avvisa('Quanto?'); return; }
    suScelta({ allievo_id: id, importo_cent: cent, metodo: metodo.value, nota: nota.value.trim() || null }); chiudi();
  } });
  const chiudi = apriFoglio('Pagamento', el('div', {}, [campo('Chi', sel), altro, elencoAltri, el('div', { class: 'griglia-campi' }, [campo('Quanto (€)', importo), campo('Come', metodo)]), campo('Per cosa', nota), el('p', { class: 'piccolo attenuato', testo: 'Si registra alla conferma della sessione.' }), ok]));
}

function foglioSalta(id, ridisegna) {
  const motivo = el('input', { type: 'text', placeholder: 'es. festa, palestra chiusa' });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Salta', onclick: async () => { try { await saltaSessione(id, motivo.value.trim() || null); chiudi(); toast('Saltata: non conta.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio('Salta questa sessione', el('div', {}, [el('p', { class: 'attenuato', testo: 'Non conta come fatta né come mancata. Si può riaprire.' }), campo('Motivo', motivo), ok]));
}

function foglioSposta(s, ridisegna) {
  const data = el('input', { type: 'date', value: s.data });
  const ora = el('input', { type: 'time', value: formattaOra(s.ora), step: '300' });
  const durata = el('input', { type: 'number', min: '30', max: '360', step: '30', value: s.durata_minuti });
  const ok = el('button', { class: 'tasto pieno grande', testo: 'Sposta', onclick: async () => { try { await spostaSessione(s.id, { data: data.value, ora: ora.value, durata_minuti: Number(durata.value) || s.durata_minuti }); chiudi(); toast('Spostata.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio('Sposta la privata', el('div', {}, [el('div', { class: 'griglia-campi' }, [campo('Giorno', data), campo('Ora', ora), campo('Minuti', durata)]), ok]));
}

export function foglioAnnulla(s, dopo) {
  const perche = el('input', { type: 'text', placeholder: 'perché' });
  const serie = el('input', { type: 'checkbox' });
  const ok = el('button', { class: 'tasto terracotta grande', testo: 'Annulla la sessione', onclick: async () => { try { const n = await annullaSessione(s.id, perche.value.trim() || null, serie.checked); chiudi(); toast(n > 1 ? `Annullate ${n} sessioni.` : 'Annullata.'); dopo(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio('Annullare?', el('div', {}, [el('p', { class: 'attenuato', testo: 'Resta nello storico come annullata. Non si elimina.' }), campo('Motivo', perche), s.serie_id ? el('label', { class: 'interruttore' }, [el('span', { testo: 'Anche tutte le prossime della serie' }), serie]) : null, ok]));
}

function disegnaSolaLettura(main, d, argomenti) {
  const s = d.sessione;
  const nomeArg = (id) => argomenti.find((a) => a.id === id)?.nome || '…';
  const pres = el('div', { class: 'elenco' });
  for (const p of d.presenze) pres.append(riga({ principale: nomeDi(p.allievi), secondaria: p.tipo !== 'normale' ? p.tipo : null, destra: formattaMinuti(p.minuti) }));
  if (!d.presenze.length) pres.append(statoVuoto(s.stato === 'fatta' ? 'Nessun presente.' : 'Ancora da fare.'));
  main.append(sezione('Presenti', pres));
  const g = d.contenuti.find((c) => !c.allievo_id);
  if (g) main.append(sezione('Gruppo', el('div', { class: 'blocco' }, [chipsArgomenti((g.contenuti_argomenti || []).map((x) => x.argomento_id), argomenti), g.nota ? el('p', { testo: g.nota }) : null])));
  const singoli = d.contenuti.filter((c) => c.allievo_id);
  if (singoli.length || d.osservazioni.length) {
    const box = el('div', { class: 'elenco' });
    for (const c of singoli) { const p = d.presenze.find((x) => x.allievo_id === c.allievo_id); box.append(riga({ principale: nomeDi(p?.allievi) || '…', secondaria: [(c.contenuti_argomenti || []).map((x) => nomeArg(x.argomento_id)).join(', '), c.nota].filter(Boolean).join(' · ') })); }
    for (const o of d.osservazioni) { const p = d.presenze.find((x) => x.allievo_id === o.allievo_id); box.append(riga({ principale: nomeDi(p?.allievi) || '…', secondaria: '“' + o.testo + '”' })); }
    main.append(sezione('Singoli', box));
  }
  if (s.nota) main.append(sezione('Nota', el('div', { class: 'blocco' }, [el('p', { testo: s.nota })])));
}
