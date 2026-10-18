/* Longkai — viste/cassetta.js: i file arrivati senza una scheda (dall'app o, in fase 7, dalla posta): si aprono, si smistano a un allievo, si scartano. */
import { el } from '../base.js';
import { cassettaElenco, mettiInCassetta, smistaCassetta, scartaCassetta, apriCassetta, elencoAllieviCompleto, impostazioni, soloLettura } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio, chiedi } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';
import { nomeCompleto, secondaRiga, pallinoAllievo, scadenzaProposta } from '../../comune/allievi.js';
import { oggiRoma, formattaData } from '../../comune/date.js';
import { campo } from './allievo-modulo.js';

export async function vistaCassetta(main) {
  const lettura = soloLettura();
  const file = el('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png', class: 'nascosto' });
  const metti = el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ File', onclick: () => file.click() });
  testata('Cassetta', { indietro: 'altro', azione: lettura ? null : metti });
  main.append(file, el('p', { class: 'attenuato', testo: 'Qui finiscono i file da sistemare: un certificato fotografato di corsa, un documento arrivato per posta. Da qui si smistano alla scheda giusta.' }), scheletri(3));
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { avvisa('Il file è troppo grande: al massimo 15 MB.'); return; }
    try { await mettiInCassetta(f); toast('In cassetta.'); ridisegna(); } catch (e) { avvisa(e.message || 'Non sono riuscito a caricare il file.'); }
  });
  const ridisegna = () => { main.replaceChildren(); vistaCassetta(main); };
  const elenco = await cassettaElenco();
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const daSmistare = elenco.filter((x) => x.stato === 'da_smistare');
  const fatti = elenco.filter((x) => x.stato !== 'da_smistare').slice(0, 20);
  const box = el('div', { class: 'elenco' });
  for (const c of daSmistare) box.append(riga({ principale: c.nome, secondaria: `arrivato il ${formattaData(String(c.arrivato_il).slice(0, 10), 'numerico')} · ${c.fonte}` + (c.dimensione ? ` · ${Math.max(1, Math.round(c.dimensione / 1024))} KB` : ''), pallino: 'attenzione', onclick: () => foglioFile(c, lettura, ridisegna) }));
  if (!daSmistare.length) box.append(statoVuoto('Niente da smistare.'));
  main.append(sezione(`Da smistare · ${daSmistare.length}`, box));
  if (fatti.length) {
    const b2 = el('div', { class: 'elenco' });
    for (const c of fatti) b2.append(riga({ principale: c.nome, secondaria: c.stato === 'smistato' ? 'smistato a ' + (c.allievi ? nomeCompleto(c.allievi) : '—') : 'scartato', pallino: c.stato === 'smistato' ? 'ok' : 'neutro', href: c.allievo_id ? `#/allievi/${c.allievo_id}/documenti` : null }));
    main.append(sezione('Già sistemati', b2));
  }
}

function foglioFile(c, lettura, ridisegna) {
  const figli = [];
  if (!lettura) figli.push(el('button', { class: 'tasto bordo', testo: 'Apri', onclick: () => apriFile(() => apriCassetta(c.id)) }));
  if (!lettura) {
    figli.push(el('button', { class: 'tasto pieno', testo: 'Smista a un allievo', onclick: () => { chiudi(); foglioSmista(c, ridisegna); } }));
    figli.push(el('button', { class: 'tasto pericolo', testo: 'Scarta', onclick: async () => {
      const ok = await chiedi('Scartare?', 'Il file resta nell\'archivio ma non si vede più qui.', [{ testo: 'Scarta', valore: true, classe: 'terracotta' }, { testo: 'Lascia', valore: false }]);
      if (!ok) return;
      try { await scartaCassetta(c.id); chiudi(); toast('Scartato.'); ridisegna(); } catch (e) { avvisa(e.message); }
    } }));
  }
  if (!figli.length) figli.push(el('p', { class: 'attenuato', testo: 'Solo il Sifu può aprire e smistare i file.' }));
  const chiudi = apriFoglio(c.nome, el('div', { class: 'tasti-colonna' }, figli));
}

async function foglioSmista(c, ridisegna) {
  const oggi = oggiRoma();
  const imp = await impostazioni().catch(() => ({}));
  const cerca = el('input', { type: 'search', placeholder: 'A chi appartiene?', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  const scelto = el('p', { class: 'piccolo attenuato', testo: 'Scegli l\'allievo.' });
  const tipo = el('select', {}, [['certificato', 'Certificato medico'], ['tesseramento', 'Tesseramento'], ['altro', 'Altro']].map(([v, t]) => el('option', { value: v, testo: t })));
  const data = el('input', { type: 'date', value: oggi });
  const scadenza = el('input', { type: 'date', value: scadenzaProposta('certificato', oggi, imp.scadenze || {}) || '' });
  const proponi = () => { scadenza.value = scadenzaProposta(tipo.value, data.value || oggi, imp.scadenze || {}) || ''; };
  tipo.addEventListener('change', proponi); data.addEventListener('change', proponi);
  let allievoId = null;
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Smista', onclick: async () => {
    if (!allievoId) { avvisa('Scegli prima l\'allievo.'); return; }
    salva.disabled = true;
    try { await smistaCassetta(c.id, allievoId, tipo.value, data.value || oggi, scadenza.value || null); chiudi(); toast('Smistato.'); ridisegna(); } catch (e) { avvisa(e.message); } finally { salva.disabled = false; }
  } });
  let tutti = [];
  const mostra = () => {
    elenco.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = tutti.filter((x) => x.stato !== 'uscito' && (!q || normalizza(nomeCompleto(x)).includes(q) || (x.soprannomi || []).some((s) => normalizza(s).includes(q)))).slice(0, 6);
    for (const x of righe) elenco.append(riga({ principale: nomeCompleto(x), secondaria: secondaRiga(x), pallino: allievoId === x.id ? 'ok' : pallinoAllievo(x), onclick: () => { allievoId = x.id; scelto.textContent = 'Va a: ' + nomeCompleto(x); mostra(); } }));
    if (!righe.length) elenco.append(statoVuoto('Nessun allievo.'));
  };
  cerca.addEventListener('input', mostra);
  const chiudi = apriFoglio('Smista: ' + c.nome, el('div', {}, [el('div', { class: 'campo' }, [cerca]), elenco, scelto, campo('Cosa è', tipo), el('div', { class: 'griglia-campi' }, [campo('Data del documento', data), campo('Scade il', scadenza)]), salva]));
  elencoAllieviCompleto().then((t) => { tutti = t; mostra(); }).catch((e) => avvisa(e.message));
}

async function apriFile(prendiUrl) {
  const w = globalThis.open('', '_blank');
  try { const url = await prendiUrl(); if (w) w.location.replace(url); else location.assign(url); }
  catch (e) { if (w) w.close(); avvisa(e.message || 'Non riesco ad aprire il file.'); }
}
