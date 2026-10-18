/* Longkai — viste/programma.js: le prossime sessioni con il previsto, i mesi per corso, i non toccati, gli obiettivi aperti, i piani personali.
   Qui si programma con i chip; a voce dalla fase 4. */
import { el } from '../base.js';
import { prossimeSessioni, programmiMesi, salvaProgramma, nonToccati, obiettiviAperti, pianiAttivi, corsiCompleti, argomentiAttivi, impostazioni, soloLettura } from '../dati.js';
import { riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio } from '../ui.js';
import { formattaData, formattaMese, formattaOra, oggiRoma, primoDelMese, aggiungiMesi, giorniFra } from '../../comune/date.js';
import { previstoDalMese } from '../../comune/sessione.js';
import { scegliArgomenti, chipsArgomenti } from './scegli-argomenti.js';
import { campo } from './allievo-modulo.js';

export async function disegnaProgramma(box, ridisegna) {
  const lettura = soloLettura();
  const oggi = oggiRoma();
  const questo = primoDelMese(oggi);
  const prossimo = aggiungiMesi(questo, 1);
  box.append(scheletri(4));
  const [sessioni, mesi, corsi, argomenti, nt, ob, piani, imp] = await Promise.all([prossimeSessioni(), programmiMesi([questo, prossimo]), corsiCompleti(), argomentiAttivi(), nonToccati(), obiettiviAperti(), pianiAttivi(), impostazioni().catch(() => ({}))]);
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const nome = (id) => argomenti.find((a) => a.id === id)?.nome || '…';

  /* ---------- PROSSIME SESSIONI ---------- */
  const elenco = el('div', { class: 'elenco' });
  for (const s of sessioni.filter((x) => x.stato === 'prevista')) {
    const chi = s.tipo === 'privata' ? `Privata · ${s.allievo_nome || ''} ${s.allievo_cognome || ''}`.trim() : `${s.corso_nome || 'Corso'} · ${s.citta || ''}`;
    let previsto = (s.previsto_argomenti || []).map(nome).join(', ');
    let daDove = previsto ? '' : '';
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

  /* ---------- MESI PER CORSO ---------- */
  const mesiBox = el('div');
  for (const c of corsi.filter((x) => x.attivo)) {
    for (const m of [questo, prossimo]) {
      const pr = mesi.find((x) => x.corso_id === c.id && x.mese === m);
      const voci = [...(pr?.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine);
      const chips = el('div', { class: 'chips' });
      for (const v of voci) chips.append(el('span', { class: 'chip' + (v.fatto_il ? ' fatto' : ''), testo: (v.fatto_il ? '✓ ' : '') + nome(v.argomento_id) }));
      if (!voci.length) chips.append(el('span', { class: 'piccolo attenuato', testo: 'Niente in programma: libero.' }));
      const fatti = voci.filter((v) => v.fatto_il).length;
      const card = el('div', { class: 'card-mese' }, [
        el('div', { class: 'riga-stato' }, [el('strong', { testo: `${c.nome} · ${c.citta} · ${formattaMese(m)}` }), voci.length ? el('span', { class: 'piccolo attenuato', testo: `${fatti} di ${voci.length} fatti` }) : null]),
        chips, pr?.nota ? el('p', { class: 'piccolo attenuato', style: null, testo: pr.nota }) : null,
        lettura ? null : el('button', { class: 'tasto bordo', 'data-scrittura': '', testo: voci.length ? 'Cambia' : 'Programma il mese', onclick: () => foglioMese(c, m, pr, argomenti, ridisegna) }),
      ]);
      mesiBox.append(card);
    }
  }
  if (!mesiBox.childElementCount) mesiBox.append(statoVuoto('Nessun corso attivo.'));
  box.append(sezione('Mesi per corso', mesiBox));

  /* ---------- NON TOCCATI ---------- */
  const giorni = imp.programma?.non_toccati_giorni || 60;
  const vecchi = nt.filter((a) => !a.ultima_volta || giorniFra(a.ultima_volta, oggi) > giorni).sort((a, b) => (a.ultima_volta || '').localeCompare(b.ultima_volta || ''));
  const ntBox = el('div', { class: 'chips' });
  for (const a of vecchi.slice(0, 24)) ntBox.append(el('span', { class: 'chip', testo: a.nome + (a.ultima_volta ? ` · ${giorniFra(a.ultima_volta, oggi)} gg` : ' · mai') }));
  if (vecchi.length > 24) ntBox.append(el('span', { class: 'piccolo attenuato', testo: `e altri ${vecchi.length - 24}` }));
  if (!vecchi.length) ntBox.append(el('span', { class: 'piccolo attenuato', testo: 'Tutto toccato di recente.' }));
  box.append(sezione(`Non toccati da ${giorni} giorni · ${vecchi.length}`, el('div', { class: 'blocco' }, [ntBox])));

  /* ---------- OBIETTIVI E PIANI ---------- */
  const obBox = el('div', { class: 'elenco' });
  for (const o of ob) obBox.append(riga({ principale: `${o.allievi?.nome || ''} ${o.allievi?.cognome || ''}`.trim(), secondaria: o.nota, pallino: 'attenzione', href: `#/allievi/${o.allievo_id}/progressi` }));
  if (!ob.length) obBox.append(statoVuoto('Nessun obiettivo aperto.'));
  box.append(sezione(`Obiettivi aperti · ${ob.length}`, obBox));
  const piBox = el('div', { class: 'elenco' });
  for (const p of piani) piBox.append(riga({ principale: `${p.allievi?.nome || ''} ${p.allievi?.cognome || ''}`.trim(), secondaria: [(p.prossimo_passo_argomenti || []).map(nome).join(', '), p.prossimo_passo_nota].filter(Boolean).join(' · ') || 'senza prossimo passo', pallino: 'info', href: `#/allievi/${p.allievo_id}/progressi` }));
  if (!piani.length) piBox.append(statoVuoto('Nessun piano personale attivo (è una possibilità, non un obbligo).'));
  box.append(sezione(`Piani personali · ${piani.length}`, piBox));
}

function foglioPrevisto(s, argomenti, ridisegna) {
  let scelti = s.previsto_argomenti || [];
  const chipsBox = el('div');
  const disegna = () => chipsBox.replaceChildren(chipsArgomenti(scelti, argomenti, { vuoto: 'Niente ancora.' }));
  disegna();
  const nota = el('input', { type: 'text', value: s.previsto_nota || '', placeholder: 'una nota' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaProgramma({ sessioneId: s.id, nota: nota.value.trim() || null, argomenti: scelti }); chiudi(); toast('Previsto salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio(`${formattaData(s.data, 'breve')} · ${s.corso_nome || 'privata'}`, el('div', {}, [chipsBox, el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti, titolo: 'Previsto per ' + formattaData(s.data, 'breve') }); if (r) { scelti = r; disegna(); } } }), campo('Nota', nota), salva]));
}

function foglioMese(corso, mese, pr, argomenti, ridisegna) {
  let scelti = [...(pr?.programma_argomenti || [])].sort((a, b) => a.ordine - b.ordine).map((v) => v.argomento_id);
  const chipsBox = el('div');
  const disegna = () => chipsBox.replaceChildren(chipsArgomenti(scelti, argomenti, { vuoto: 'Niente ancora.' }));
  disegna();
  const nota = el('input', { type: 'text', value: pr?.nota || '', placeholder: 'l\'idea del mese, in due parole' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaProgramma({ corsoId: corso.id, mese, nota: nota.value.trim() || null, argomenti: scelti }); chiudi(); toast('Mese programmato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio(`${corso.nome} · ${corso.citta} · ${formattaMese(mese)}`, el('div', {}, [el('p', { class: 'piccolo attenuato', testo: 'Gli argomenti del mese, in ordine: le lezioni li ereditano da soli, uno dopo l\'altro.' }), chipsBox, el('button', { class: 'tasto bordo', testo: 'Scegli gli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti, titolo: `Il mese di ${corso.nome} · ${corso.citta}` }); if (r) { scelti = r; disegna(); } } }), campo('Nota', nota), salva]));
}
