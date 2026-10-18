/* Longkai — viste/corsi.js: i corsi di Longkai (giorni, ore, durata, sospensioni). Un corso attivo per giorno. */
import { el } from '../base.js';
import { corsiCompleti, salvaCorso, soloLettura } from '../dati.js';
import { testata, riga, scheletri, statoVuoto, toast, apriFoglio } from '../ui.js';
import { formattaMinuti } from '../../comune/ore.js';
import { formattaData, formattaOra } from '../../comune/date.js';
import { campo } from './allievo-modulo.js';

const GIORNI = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const GIORNI_BREVI = ['', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

export async function vistaCorsi(main, parametri, { indietro = 'altro' } = {}) {
  const lettura = soloLettura();
  testata('Corsi', { indietro, azione: lettura ? null : el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Corso', onclick: () => foglioCorso(null, () => { main.replaceChildren(); vistaCorsi(main, parametri, { indietro }); }) }) });
  await disegnaCorsi(main, () => { main.replaceChildren(); vistaCorsi(main, parametri, { indietro }); });
}

export async function disegnaCorsi(box, ridisegna) {
  const lettura = soloLettura();
  box.append(scheletri(2));
  const corsi = await corsiCompleti();
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const elenco = el('div', { class: 'elenco' });
  for (const c of corsi) {
    const orari = [...(c.corsi_orari || [])].sort((a, b) => a.giorno - b.giorno).map((o) => `${GIORNI_BREVI[o.giorno]} ${formattaOra(o.ora)}`).join(', ');
    const stato = !c.attivo ? 'spento' : c.sospeso_dal ? `sospeso dal ${formattaData(c.sospeso_dal, 'numerico')}` + (c.sospeso_al ? ` al ${formattaData(c.sospeso_al, 'numerico')}` : '') : null;
    elenco.append(riga({ principale: `${c.nome} · ${c.citta}`, secondaria: [orari || 'nessun orario', formattaMinuti(c.durata_minuti), stato].filter(Boolean).join(' · '), pallino: !c.attivo ? 'neutro' : c.sospeso_dal ? 'attenzione' : 'ok', onclick: lettura ? null : () => foglioCorso(c, ridisegna) }));
  }
  if (!corsi.length) elenco.append(statoVuoto('Nessun corso: aggiungi il primo.'));
  box.append(elenco, el('p', { class: 'piccolo attenuato', style: null, testo: 'Le lezioni dei prossimi 14 giorni si creano da sole dagli orari. Se cambi un orario, quelle future vuote si rifanno.' }));
}

function foglioCorso(c, ridisegna) {
  const nome = el('input', { type: 'text', value: c?.nome || '', autocapitalize: 'words', placeholder: 'es. Mortara' });
  const citta = el('input', { type: 'text', value: c?.citta || '', autocapitalize: 'words' });
  const durata = el('input', { type: 'number', min: '30', max: '240', step: '30', inputmode: 'numeric', value: c?.durata_minuti || 60 });
  const attivo = el('input', { type: 'checkbox' }); attivo.checked = c ? c.attivo : true;
  const sospesoDal = el('input', { type: 'date', value: c?.sospeso_dal || '' });
  const sospesoAl = el('input', { type: 'date', value: c?.sospeso_al || '' });
  const orari = [];
  const bloccoOrari = el('div', { class: 'blocco' });
  for (let g = 1; g <= 7; g++) {
    const esistente = (c?.corsi_orari || []).find((o) => o.giorno === g);
    const spunta = el('input', { type: 'checkbox' }); spunta.checked = Boolean(esistente);
    const ora = el('input', { type: 'time', value: esistente ? formattaOra(esistente.ora) : '19:00', step: '300' });
    ora.disabled = !spunta.checked;
    spunta.addEventListener('change', () => { ora.disabled = !spunta.checked; });
    orari.push({ giorno: g, spunta, ora });
    bloccoOrari.append(el('div', { class: 'riga-orario' }, [el('label', { class: 'interruttore' }, [el('span', { testo: GIORNI[g] }), spunta]), ora]));
  }
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    errore.textContent = '';
    if (!nome.value.trim() || !citta.value.trim()) { errore.textContent = 'Servono nome e città.'; return; }
    const d = Number(durata.value);
    if (!(d >= 30 && d <= 240)) { errore.textContent = 'La durata va da 30 a 240 minuti.'; return; }
    const scelti = orari.filter((o) => o.spunta.checked).map((o) => ({ giorno: o.giorno, ora: o.ora.value || '19:00' }));
    if (attivo.checked && !scelti.length) { errore.textContent = 'Un corso attivo ha almeno un giorno.'; return; }
    salva.disabled = true;
    try {
      await salvaCorso(c?.id || null, { nome: nome.value.trim(), citta: citta.value.trim(), durata_minuti: d, attivo: attivo.checked, sospeso_dal: sospesoDal.value || null, sospeso_al: sospesoAl.value || null, ordine: c?.ordine ?? 9 }, scelti);
      chiudi(); toast('Corso salvato.'); ridisegna();
    } catch (e) {
      errore.textContent = /23505|già un corso/i.test(e.message || e.code || '') ? 'C\'è già un corso attivo in uno di questi giorni: un corso al giorno.' : (e.message || 'Non sono riuscito a salvare.');
    } finally { salva.disabled = false; }
  } });
  const chiudi = apriFoglio(c ? c.nome : 'Nuovo corso', el('div', {}, [
    el('div', { class: 'griglia-campi' }, [campo('Nome', nome), campo('Città', citta), campo('Durata (minuti)', durata)]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Corso attivo' }), attivo]),
    el('h3', { class: 'titolo-blocco', testo: 'Giorni e ore' }), bloccoOrari,
    el('h3', { class: 'titolo-blocco', testo: 'Sospensione (vacanze, chiusure)' }),
    el('div', { class: 'griglia-campi' }, [campo('Dal', sospesoDal), campo('Al', sospesoAl, 'vuoto = finché non si toglie')]),
    errore, salva,
  ]));
}
