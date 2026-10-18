/* Longkai — viste/programma.js: il programma dei mesi (tocca il mese e scrivi cosa vuoi fare), le prossime sessioni
   (tocca e scrivi cosa fare quel giorno), a che punto sono gli allievi, gli obiettivi aperti, i piani personali.
   A voce: Correggi parlando → Programma. */
import { el } from '../base.js';
import { prossimeSessioni, programmiMesi, salvaProgramma, aChePunto, obiettiviAperti, pianiAttivi, corsiCompleti, argomentiAttivi, allieviAttivi, impostazioni, soloLettura } from '../dati.js';
import { riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio } from '../ui.js';
import { formattaData, formattaMese, formattaOra, oggiRoma, primoDelMese, aggiungiMesi } from '../../comune/date.js';
import { previstoDalMese, tacche } from '../../comune/sessione.js';
import { normalizza } from '../../comune/fonetica.js';
import { scegliArgomenti, chipsArgomenti } from './scegli-argomenti.js';
import { foglioPiano, foglioObiettivo } from './progressi.js';
import { campo } from './allievo-modulo.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

export async function disegnaProgramma(box, ridisegna) {
  const lettura = soloLettura();
  const oggi = oggiRoma();
  const questo = primoDelMese(oggi);
  const prossimo = aggiungiMesi(questo, 1);
  box.append(scheletri(4));
  const [sessioni, mesi, corsi, argomenti, quadro, ob, piani, imp] = await Promise.all([prossimeSessioni(), programmiMesi([questo, prossimo]), corsiCompleti(), argomentiAttivi(), aChePunto().catch(() => null), obiettiviAperti(), pianiAttivi(), impostazioni().catch(() => ({}))]);
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const nome = (id) => argomenti.find((a) => a.id === id)?.nome || '…';

  /* ---------- IL PROGRAMMA DEI MESI: si tocca il mese ---------- */
  const mesiBox = el('div');
  for (const c of corsi.filter((x) => x.attivo)) {
    for (const m of [questo, prossimo]) {
      const pr = mesi.find((x) => x.corso_id === c.id && x.mese === m);
      const voci = [...(pr?.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine);
      const chips = el('div', { class: 'chips' });
      for (const v of voci) chips.append(el('span', { class: 'chip' + (v.fatto_il ? ' fatto' : ''), testo: (v.fatto_il ? '✓ ' : '') + nome(v.argomento_id) }));
      const fatti = voci.filter((v) => v.fatto_il).length;
      const vuoto = !voci.length && !pr?.nota;
      const figli = [
        el('div', { class: 'riga-stato' }, [el('strong', { testo: `${c.nome} · ${c.citta} · ${formattaMese(m)}` }), voci.length ? el('span', { class: 'piccolo attenuato', testo: `${fatti} di ${voci.length} fatti` }) : null]),
        pr?.nota ? el('p', { class: 'idea', testo: pr.nota }) : null,
        voci.length ? chips : null,
        vuoto ? el('p', { class: 'attenuato idea', testo: lettura ? 'Niente in programma.' : 'Niente in programma: tocca e scrivi.' }) : null,
      ];
      mesiBox.append(lettura ? el('div', { class: 'card-mese' }, figli) : el('button', { class: 'card-mese toccabile', type: 'button', onclick: () => foglioMese(c, m, pr, argomenti, ridisegna) }, figli));
    }
  }
  if (!mesiBox.childElementCount) mesiBox.append(statoVuoto('Nessun corso attivo.'));
  box.append(sezione('Il programma dei mesi', mesiBox));

  /* ---------- PROSSIME SESSIONI: si tocca la sessione ---------- */
  const elenco = el('div', { class: 'elenco' });
  for (const s of sessioni.filter((x) => x.stato === 'prevista')) {
    const chi = s.tipo === 'privata' ? `Privata · ${s.allievo_nome || ''} ${s.allievo_cognome || ''}`.trim() : `${s.corso_nome || 'Corso'} · ${s.citta || ''}`;
    let previsto = (s.previsto_argomenti || []).map(nome).join(', ');
    let daDove = '';
    if (!previsto && s.corso_id) {
      const m = mesi.find((x) => x.corso_id === s.corso_id && x.mese === s.data.slice(0, 7) + '-01');
      const ids = previstoDalMese({ argomenti: m?.programma_argomenti || [] });
      if (ids.length) { previsto = ids.map(nome).join(', '); daDove = ' (dal mese)'; }
    }
    if (!previsto && s.tipo === 'privata') { const p = piani.find((x) => x.allievo_id === s.allievo_id); if (p?.prossimo_passo_argomenti?.length) { previsto = p.prossimo_passo_argomenti.map(nome).join(', '); daDove = ' (dal piano)'; } else if (p?.prossimo_passo_nota) { previsto = p.prossimo_passo_nota; daDove = ' (dal piano)'; } }
    elenco.append(riga({ principale: `${formattaData(s.data, 'breve')} ${formattaOra(s.ora)} · ${chi}`, secondaria: previsto ? 'Previsto: ' + previsto + daDove + (s.previsto_nota ? ' · ' + s.previsto_nota : '') : 'niente di previsto', pallino: previsto ? 'ok' : 'neutro', onclick: lettura ? null : () => foglioPrevisto(s, argomenti, ridisegna) }));
  }
  if (!elenco.childElementCount) elenco.append(statoVuoto('Nessuna sessione nei prossimi 14 giorni.'));
  box.append(sezione(`Prossime sessioni · ${imp.programma?.orizzonte_giorni || 14} giorni`, elenco));

  /* ---------- A CHE PUNTO SONO: ogni allievo, le forme in corso e le ultime cose fatte ---------- */
  const quadroBox = el('div', { class: 'elenco' });
  for (const a of quadro?.allievi || []) {
    const forme = quadro.forme.filter((f) => f.allievo_id === a.id).map((f) => {
      const t = tacche({ ...f, sezioni: f.argomenti?.sezioni });
      const dove = f.stato === 'in_apprendimento' && t.totale ? ` · sez. ${Math.min(t.fatte + 1, t.totale)} di ${t.totale}` : f.stato === 'completa' ? ' · completa' : f.stato === 'in_rifinitura' ? ' · in rifinitura' : '';
      return (f.argomenti?.nome || 'forma') + dove;
    });
    const ultime = quadro.resto.filter((r) => r.allievo_id === a.id).slice(0, 3);
    if (!forme.length && !ultime.length) continue;
    quadroBox.append(riga({ principale: nomeDi(a), secondaria: [forme.join(', '), ultime.length ? 'ultime cose: ' + ultime.map((u) => u.nome).join(', ') + (ultime[0].ultima_volta ? ` (${formattaData(ultime[0].ultima_volta, 'numerico')})` : '') : null].filter(Boolean).join(' — '), pallino: forme.length ? 'ok' : 'info', href: `#/allievi/${a.id}/progressi` }));
  }
  if (!quadroBox.childElementCount) quadroBox.append(statoVuoto('Ancora niente.'));
  box.append(sezione('A che punto sono', quadroBox));

  /* ---------- OBIETTIVI E PIANI ---------- */
  const obBox = el('div', { class: 'elenco' });
  for (const o of ob) obBox.append(riga({ principale: nomeDi(o.allievi), secondaria: o.nota, pallino: 'attenzione', href: `#/allievi/${o.allievo_id}/progressi` }));
  if (!ob.length) obBox.append(statoVuoto('Nessun obiettivo aperto.'));
  box.append(sezione(`Obiettivi aperti · ${ob.length}`, obBox, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Obiettivo', onclick: () => scegliAllievo('Per chi è l\'obiettivo?', (a) => foglioObiettivo(a.id, null, ridisegna)) })));
  const piBox = el('div', { class: 'elenco' });
  for (const p of piani) piBox.append(riga({ principale: nomeDi(p.allievi), secondaria: [(p.prossimo_passo_argomenti || []).map(nome).join(', '), p.prossimo_passo_nota, p.obiettivo ? 'obiettivo: ' + p.obiettivo : null].filter(Boolean).join(' · ') || 'senza prossimo passo', pallino: 'info', onclick: lettura ? null : () => foglioPiano(p.allievo_id, p, ridisegna), href: lettura ? `#/allievi/${p.allievo_id}/progressi` : null }));
  if (!piani.length) piBox.append(statoVuoto('Nessun piano personale.'));
  box.append(sezione(`Piani personali · ${piani.length}`, piBox, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Piano', onclick: () => scegliAllievo('Per chi è il piano?', (a) => { const gia = piani.find((p) => p.allievo_id === a.id); foglioPiano(a.id, gia || null, ridisegna); }) })));
}

/** Un foglio per scegliere un allievo attivo (ricerca anche sui soprannomi); poi `dopo(allievo)`. */
function scegliAllievo(titolo, dopo) {
  const cerca = el('input', { type: 'search', placeholder: 'Chi?', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  let tutti = [];
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = tutti.filter((a) => !q || normalizza(nomeDi(a)).includes(q) || (a.soprannomi || []).some((x) => normalizza(x).includes(q))).slice(0, 12);
    if (!righe.length) elenco.append(statoVuoto(tutti.length ? 'Nessuno con questo nome.' : 'Nessun allievo attivo.'));
    for (const a of righe) elenco.append(riga({ principale: nomeDi(a), onclick: () => { chiudi(); dopo(a); } }));
  };
  cerca.addEventListener('input', mostra);
  const chiudi = apriFoglio(titolo, el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco]));
  allieviAttivi().then((t) => { tutti = t; mostra(); }).catch((e) => avvisa(e.message));
}

function foglioPrevisto(s, argomenti, ridisegna) {
  let scelti = s.previsto_argomenti || [];
  const chipsBox = el('div');
  const disegna = () => chipsBox.replaceChildren(chipsArgomenti(scelti, argomenti, { vuoto: 'Nessun argomento scelto.' }));
  disegna();
  const nota = el('textarea', { rows: '2', placeholder: 'es. ripasso della prima sezione, poi Pak Sao in coppia' }); nota.value = s.previsto_nota || '';
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaProgramma({ sessioneId: s.id, nota: nota.value.trim() || null, argomenti: scelti }); chiudi(); toast('Previsto salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio(`${formattaData(s.data, 'breve')} · ${s.corso_nome || 'privata'}`, el('div', {}, [campo('Cosa fare quel giorno', nota), chipsBox, el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti, titolo: 'Previsto per ' + formattaData(s.data, 'breve') }); if (r) { scelti = r; disegna(); } } }), salva]));
}

function foglioMese(corso, mese, pr, argomenti, ridisegna) {
  let scelti = [...(pr?.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine).map((v) => v.argomento_id);
  const chipsBox = el('div');
  const disegna = () => chipsBox.replaceChildren(chipsArgomenti(scelti, argomenti, { vuoto: 'Nessun argomento scelto.' }));
  disegna();
  const nota = el('textarea', { rows: '3', placeholder: 'es. chiudere la prima sezione del Siu Nim Tao, lavorare sul Pak Sao in coppia, iniziare i calci' }); nota.value = pr?.nota || '';
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaProgramma({ corsoId: corso.id, mese, nota: nota.value.trim() || null, argomenti: scelti }); chiudi(); toast('Mese programmato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio(`${corso.nome} · ${corso.citta} · ${formattaMese(mese)}`, el('div', {}, [
    campo('Cosa vuoi fare questo mese', nota),
    chipsBox,
    el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti, titolo: `Il mese di ${corso.nome} · ${corso.citta}` }); if (r) { scelti = r; disegna(); } } }),
    salva,
  ]));
}
