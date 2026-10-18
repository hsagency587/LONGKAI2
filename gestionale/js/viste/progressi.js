/* Longkai — viste/progressi.js: nella scheda dell'allievo, Progressi (forme a parte da tutto il resto, osservazioni, obiettivi, numeri, piano personale) e Presenze. */
import { el } from '../base.js';
import { progressiAllievo, argomentiAttivi, aggiornaForma, salvaObiettivo, chiudiObiettivo, salvaPiano, chiudiPiano, presenzeAllievo } from '../dati.js';
import { riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio, chiedi } from '../ui.js';
import { formattaData, formattaMese, formattaOra, oggiRoma } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';
import { formeAttive, tacche, etichettaForma, copertura, STATI_FORMA } from '../../comune/sessione.js';
import { scegliArgomenti, chipsArgomenti } from './scegli-argomenti.js';
import { campo } from './allievo-modulo.js';

const ORDINE_AREE = ['Chi Sao', 'Tecniche di mano', 'Pugni e palmi', 'Gomiti e ginocchia', 'Gambe', 'Posizioni e passi', 'Applicazioni', 'Principi'];

export async function disegnaProgressi(box, { id, lettura, ridisegna, oggi = oggiRoma() }) {
  box.append(scheletri(4));
  const [pr, argomenti] = await Promise.all([progressiAllievo(id), argomentiAttivi()]);
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const formeTutte = argomenti.filter((a) => a.area === 'Forme');
  const nomeArg = (aid) => argomenti.find((a) => a.id === aid)?.nome || '…';

  /* ---------- FORME ---------- */
  const righeForme = formeTutte.map((f) => ({ ...(pr.forme.find((x) => x.forma_id === f.id) || { forma_id: f.id, stato: 'non_iniziata', sezione: 0, volte: 0, ultima_volta: null }), nome: f.nome, sezioni: f.sezioni }));
  const attive = formeAttive(righeForme.filter((f) => f.stato !== 'non_iniziata'), oggi);
  const sta = el('div', { class: 'chips' });
  for (const f of attive) sta.append(el('span', { class: 'chip scelto', testo: f.nome + (f.stato === 'in_apprendimento' ? ` · sez. ${Math.min((Number(f.sezione) || 0) + 1, (f.sezioni || []).length || 1)}` : '') }));
  if (!attive.length) sta.append(el('span', { class: 'piccolo attenuato', testo: 'Nessuna forma in corso.' }));
  const elencoForme = el('div', { class: 'elenco' });
  for (const f of righeForme) {
    const t = tacche(f);
    const tacc = el('span', { class: 'tacche' });
    for (let i = 1; i <= t.totale; i++) tacc.append(el('span', { class: i <= t.fatte ? 'piena' : i === t.corrente ? 'corrente' : '' }));
    const r = riga({ principale: f.nome, secondaria: [etichettaForma(f), f.dal ? 'dal ' + formattaData(f.dal, 'numerico') : null, f.ultima_volta ? 'ultima il ' + formattaData(f.ultima_volta, 'numerico') : null, f.volte ? `${f.volte} volte` : null, f.nota].filter(Boolean).join(' · '), pallino: f.stato === 'completa' ? 'ok' : f.stato === 'in_apprendimento' ? 'attenzione' : f.stato === 'in_rifinitura' ? 'info' : 'neutro', onclick: lettura ? null : () => foglioForma(id, f, ridisegna) });
    if (t.totale) r.querySelector('.destra').prepend(tacc);
    elencoForme.append(r);
  }
  box.append(sezione('Sta lavorando su', el('div', { class: 'blocco' }, [sta])), sezione('Forme', elencoForme));

  /* ---------- TUTTO IL RESTO ---------- */
  const aree = [...ORDINE_AREE.filter((x) => argomenti.some((a) => a.area === x)), ...[...new Set(argomenti.map((a) => a.area))].filter((x) => x !== 'Forme' && !ORDINE_AREE.includes(x))];
  const restoBox = el('div');
  for (const area of aree) {
    const diArea = argomenti.filter((a) => a.area === area);
    const fatti = pr.resto.filter((p) => p.area === area);
    const c = copertura(diArea, fatti);
    const riempimento = el('span'); riempimento.style.width = `${Math.round(c.quota * 100)}%`; // dalla CSSOM, non da un attributo: la CSP lo vieta
    const barra = el('div', { class: 'copertura' }, [riempimento]);
    const dettagli = el('details', { class: 'area-dettagli' }, [el('summary', {}, [el('div', { class: 'area-testa' }, [el('span', { class: 'principale', testo: area }), el('span', { class: 'piccolo attenuato', testo: `${c.fatti} di ${c.totale}` })]), barra])]);
    const lista = el('div', { class: 'elenco' });
    for (const a of diArea) {
      const p = fatti.find((x) => x.argomento_id === a.id);
      lista.append(riga({ principale: a.nome, secondaria: p ? `${p.volte} ${p.volte === 1 ? 'volta' : 'volte'} · ultima il ${formattaData(p.ultima_volta, 'numerico')}` : 'mai', pallino: p ? 'ok' : 'neutro' }));
    }
    dettagli.append(lista);
    restoBox.append(dettagli);
  }
  box.append(sezione('Tutto il resto', restoBox));

  /* ---------- OSSERVAZIONI ---------- */
  const oss = el('div', { class: 'elenco' });
  for (const o of pr.osservazioni.slice(0, 20)) oss.append(riga({ principale: o.testo, secondaria: o.sessioni ? formattaData(o.sessioni.data, 'numerico') + (o.sessioni.tipo === 'privata' ? ' · privata' : '') : null }));
  if (!pr.osservazioni.length) oss.append(statoVuoto('Nessuna osservazione ancora.'));
  box.append(sezione('Osservazioni', oss));

  /* ---------- OBIETTIVI ---------- */
  const ob = el('div', { class: 'elenco' });
  for (const o of pr.obiettivi) ob.append(riga({ principale: o.nota || '(senza testo)', secondaria: [(o.obiettivi_argomenti || []).map((x) => nomeArg(x.argomento_id)).join(', '), o.stato === 'raggiunto' ? 'raggiunto il ' + formattaData(o.raggiunto_il, 'numerico') : 'dal ' + formattaData(o.aperto_il, 'numerico')].filter(Boolean).join(' · '), pallino: o.stato === 'raggiunto' ? 'ok' : 'attenzione', onclick: lettura ? null : () => foglioObiettivo(id, o, ridisegna) }));
  if (!pr.obiettivi.length) ob.append(statoVuoto('Nessun obiettivo.'));
  box.append(sezione('Obiettivi', ob, lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Obiettivo', onclick: () => foglioObiettivo(id, null, ridisegna) })));

  /* ---------- NUMERI ---------- */
  const num = el('div', { class: 'elenco' });
  for (const m of pr.ore.slice(0, 12)) num.append(riga({ principale: formattaMese(m.mese), secondaria: [`${m.lezioni || 0} lezioni`, m.private ? `${m.private} private` : null, m.extra ? `${m.extra} in più` : null, m.recuperi ? `${m.recuperi} recuperi` : null].filter(Boolean).join(' · '), destra: formattaMinuti((m.minuti_corsi || 0) + (m.minuti_private || 0)) }));
  if (!pr.ore.length) num.append(statoVuoto('Nessuna presenza ancora.'));
  box.append(sezione('Numeri', num));

  /* ---------- PIANO PERSONALE ---------- */
  const piano = pr.piano;
  const pianoBox = el('div', { class: 'blocco' });
  if (piano) {
    pianoBox.append(
      el('p', { class: 'piccolo attenuato', testo: 'Sta lavorando su' }), chipsArgomenti(piano.sta_lavorando_su, argomenti, { vuoto: '—' }),
      el('p', { class: 'piccolo attenuato', style: null, testo: 'Prossimo passo' }), chipsArgomenti(piano.prossimo_passo_argomenti, argomenti, { vuoto: piano.prossimo_passo_nota ? '' : '—' }), piano.prossimo_passo_nota ? el('p', { testo: piano.prossimo_passo_nota }) : null,
      piano.obiettivo ? el('p', {}, [el('strong', { testo: 'Obiettivo: ' }), piano.obiettivo]) : null,
      lettura ? null : el('div', { class: 'tasti' }, [el('button', { class: 'tasto bordo', testo: 'Modifica', onclick: () => foglioPiano(id, piano, ridisegna) }), el('button', { class: 'tasto', testo: 'Chiudi il piano', onclick: async () => { const ok = await chiedi('Chiudere il piano?', 'Resta nella cronologia. Se ne può aprire un altro quando vuoi.', [{ testo: 'Chiudi', valore: true, classe: 'pieno' }, { testo: 'Lascia', valore: false }]); if (!ok) return; try { await chiudiPiano(piano.id); toast('Piano chiuso.'); ridisegna(); } catch (e) { avvisa(e.message); } } })]),
    );
  } else {
    pianoBox.append(el('p', { class: 'attenuato', testo: 'Nessun piano personale.' }), lettura ? null : el('button', { class: 'tasto pieno', 'data-scrittura': '', testo: '+ Piano personale', onclick: () => foglioPiano(id, null, ridisegna) }));
  }
  box.append(sezione('Piano personale', pianoBox));
}

function foglioForma(allievoId, f, ridisegna) {
  const stato = el('select', {}, Object.entries(STATI_FORMA).map(([v, t]) => el('option', { value: v, testo: t })));
  stato.value = f.stato || 'non_iniziata';
  const n = (f.sezioni || []).length;
  const sez = el('select', {}, [el('option', { value: '0', testo: 'nessuna ancora' }), ...Array.from({ length: n }, (_, i) => el('option', { value: String(i + 1), testo: `${i + 1}ª sezione fatta` + (f.sezioni[i]?.nome ? ' · ' + f.sezioni[i].nome : '') }))]);
  sez.value = String(Math.min(Number(f.sezione) || 0, n));
  const nota = el('input', { type: 'text', value: f.nota || '', placeholder: 'una nota su questa forma' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await aggiornaForma(allievoId, f.forma_id, stato.value, Number(sez.value), nota.value.trim() || null); chiudi(); toast('Segnato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const movimenti = n ? el('details', {}, [el('summary', { testo: 'Le sezioni e i movimenti' }), ...f.sezioni.map((s, i) => el('p', { class: 'piccolo' }, [el('strong', { testo: `${i + 1}. ${s.nome || ''} ` }), (s.movimenti || []).join(' · ')]))]) : null;
  const chiudi = apriFoglio(f.nome, el('div', {}, [campo('Stato', stato), n ? campo('Fino a', sez) : null, campo('Nota', nota), movimenti, salva]));
}

export function foglioObiettivo(allievoId, o, ridisegna) {
  const nota = el('textarea', { rows: '2', placeholder: 'es. pulire il Lap Sao con il passo' }); nota.value = o?.nota || '';
  let argomenti = (o?.obiettivi_argomenti || []).map((x) => x.argomento_id);
  const chipsBox = el('div');
  const disegna = async () => { const tutti = await argomentiAttivi(); chipsBox.replaceChildren(chipsArgomenti(argomenti, tutti, { vuoto: 'Nessun argomento legato.' })); };
  disegna();
  const figli = [campo('Obiettivo', nota), chipsBox, el('button', { class: 'tasto bordo', testo: 'Lega degli argomenti', onclick: async () => { const r = await scegliArgomenti({ scelti: argomenti, titolo: 'Argomenti dell\'obiettivo' }); if (r) { argomenti = r; disegna(); } } }),
    el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { if (!nota.value.trim()) { avvisa('Scrivi l\'obiettivo.'); return; } try { await salvaObiettivo(o?.id || null, allievoId, nota.value.trim(), argomenti); chiudi(); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } })];
  if (o && o.stato === 'aperto') figli.push(el('button', { class: 'tasto', testo: 'Segna raggiunto', onclick: async () => { try { await chiudiObiettivo(o.id, true); chiudi(); toast('Raggiunto. Bravo lui.'); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  if (o && o.stato === 'raggiunto') figli.push(el('button', { class: 'tasto', testo: 'Riapri', onclick: async () => { try { await chiudiObiettivo(o.id, false); chiudi(); ridisegna(); } catch (e) { avvisa(e.message); } } }));
  const chiudi = apriFoglio(o ? 'Obiettivo' : 'Nuovo obiettivo', el('div', {}, figli));
}

export function foglioPiano(allievoId, piano, ridisegna) {
  let sta = piano?.sta_lavorando_su || [];
  let prossimo = piano?.prossimo_passo_argomenti || [];
  const nota = el('input', { type: 'text', value: piano?.prossimo_passo_nota || '', placeholder: 'es. il Bong Sao con il passo' });
  const obiettivo = el('input', { type: 'text', value: piano?.obiettivo || '', placeholder: 'dove vuole arrivare' });
  const b1 = el('div'); const b2 = el('div');
  const disegna = async () => { const tutti = await argomentiAttivi(); b1.replaceChildren(chipsArgomenti(sta, tutti, { vuoto: '—' })); b2.replaceChildren(chipsArgomenti(prossimo, tutti, { vuoto: '—' })); };
  disegna();
  const chiudi = apriFoglio(piano ? 'Piano personale' : 'Nuovo piano personale', el('div', {}, [
    el('p', { class: 'piccolo attenuato' , testo: 'Sta lavorando su' }), b1, el('button', { class: 'tasto bordo', testo: 'Scegli', onclick: async () => { const r = await scegliArgomenti({ scelti: sta, titolo: 'Sta lavorando su' }); if (r) { sta = r; disegna(); } } }),
    el('p', { class: 'piccolo attenuato', style: null, testo: 'Prossimo passo' }), b2, el('button', { class: 'tasto bordo', testo: 'Scegli', onclick: async () => { const r = await scegliArgomenti({ scelti: prossimo, titolo: 'Prossimo passo' }); if (r) { prossimo = r; disegna(); } } }),
    campo('Prossimo passo, a parole', nota, 'es. il Bong Sao con il passo'), campo('Dove vuole arrivare', obiettivo, 'es. finire il Chum Kiu entro primavera'),
    el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaPiano(allievoId, { sta_lavorando_su: sta, prossimo_passo_argomenti: prossimo, prossimo_passo_nota: nota.value.trim() || null, obiettivo: obiettivo.value.trim() || null }); chiudi(); toast('Piano salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }),
  ]));
}

export async function disegnaPresenze(box, { id }) {
  box.append(scheletri(3));
  const pres = await presenzeAllievo(id);
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  if (!pres.length) { box.append(statoVuoto('Nessuna presenza ancora.')); return; }
  const perMese = new Map();
  for (const p of pres) { const m = p.sessioni.data.slice(0, 7) + '-01'; if (!perMese.has(m)) perMese.set(m, []); perMese.get(m).push(p); }
  for (const [mese, lista] of perMese) {
    const tot = lista.reduce((t, p) => t + (p.minuti || 0), 0);
    const elenco = el('div', { class: 'elenco' });
    for (const p of lista) {
      const s = p.sessioni;
      elenco.append(riga({ principale: `${formattaData(s.data, 'breve')} · ${s.tipo === 'privata' ? 'privata' : s.corsi?.nome || 'corso'}${s.tipo === 'straordinaria' ? ' (straordinaria)' : ''}`, secondaria: [formattaOra(s.ora), p.tipo === 'extra' ? 'lezione in più' : p.tipo === 'recupero' ? 'recupero' : null].filter(Boolean).join(' · '), destra: formattaMinuti(p.minuti), pallino: p.tipo === 'extra' ? 'attenzione' : p.tipo === 'recupero' ? 'info' : 'ok', href: `#/sessione/${s.id}` }));
    }
    box.append(sezione(`${formattaMese(mese)} · ${lista.length} presenze · ${formattaMinuti(tot)}`, elenco));
  }
}
