/* Longkai — viste/scadenze.js: certificati, tesseramenti e quote in scadenza, in quattro gruppi. */
import { el } from '../base.js';
import { scadenzeAperte, rinnovaScadenza, impostazioni, soloLettura } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio } from '../ui.js';
import { oggiRoma, formattaData } from '../../comune/date.js';
import { giorniMancanti } from '../../comune/scadenze.js';
import { scadenzaProposta } from '../../comune/allievi.js';
import { messaggioPromemoria, linkWhatsApp, linkChiama, TESTI_PREDEFINITI } from '../../comune/promemoria.js';
import { campo } from './allievo-modulo.js';

const ETICHETTE = { certificato: 'Certificato medico', tesseramento: 'Tesseramento', quota: 'Quota' };
const FILTRI = [['tutte', 'Tutte'], ['certificato', 'Certificati'], ['tesseramento', 'Tesseramenti'], ['quota', 'Quote']];

export async function vistaScadenze(main, parametri) {
  testata('Scadenze', { indietro: 'altro' });
  const filtro = parametri[0] && FILTRI.some(([k]) => k === parametri[0]) ? parametri[0] : 'tutte';
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of FILTRI) chips.append(el('a', { class: 'chip' + (k === filtro ? ' scelto' : ''), href: '#/scadenze/' + k, testo: nome }));
  main.append(chips, el('div', { class: 'spazio' }), scheletri(4));
  const [tutte, imp] = await Promise.all([scadenzeAperte(), impostazioni().catch(() => ({}))]);
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const oggi = oggiRoma();
  const lettura = soloLettura();
  const righe = (filtro === 'tutte' ? tutte : tutte.filter((s) => s.tipo === filtro)).map((s) => ({ ...s, giorni: giorniMancanti(s.data, oggi) }));
  const gruppi = [
    ['Scadute', righe.filter((s) => s.giorni < 0), 'errore'],
    ['Entro 7 giorni', righe.filter((s) => s.giorni >= 0 && s.giorni <= 7), 'attenzione'],
    ['Entro 30 giorni', righe.filter((s) => s.giorni > 7 && s.giorni <= 30), 'attenzione'],
    ['Più avanti', righe.filter((s) => s.giorni > 30), 'ok'],
  ];
  if (!righe.length) { main.append(statoVuoto('Nessuna scadenza aperta. Le scadenze nascono dai documenti caricati nelle schede.')); return; }
  const ridisegna = () => { main.replaceChildren(); vistaScadenze(main, parametri); };
  for (const [titolo, elenco, pallino] of gruppi) {
    if (!elenco.length) continue;
    const box = el('div', { class: 'elenco' });
    for (const s of elenco) {
      const nome = `${s.allievi?.nome || ''} ${s.allievi?.cognome || ''}`.trim();
      const quando = s.giorni < 0 ? `scaduto ${-s.giorni} giorni fa` : s.giorni === 0 ? 'scade oggi' : `fra ${s.giorni} giorni`;
      box.append(riga({ principale: nome, secondaria: `${ETICHETTE[s.tipo] || s.tipo} · ${formattaData(s.data, 'numerico')} · ${quando}`, pallino, onclick: () => foglioScadenza(s, nome, imp, lettura, ridisegna) }));
    }
    main.append(sezione(`${titolo} · ${elenco.length}`, box));
  }
}

function foglioScadenza(s, nome, imp, lettura, ridisegna) {
  const oggi = oggiRoma();
  const impScadenze = imp.scadenze || {};
  const figli = [el('p', { class: 'attenuato', testo: `${ETICHETTE[s.tipo] || s.tipo} · ${formattaData(s.data, 'numerico')}` })];
  figli.push(el('a', { class: 'tasto bordo', href: `#/allievi/${s.allievo_id}/documenti`, testo: 'Apri la scheda', onclick: () => chiudi() }));
  if (linkChiama(s.allievi?.telefono)) figli.push(el('a', { class: 'tasto bordo', href: linkChiama(s.allievi.telefono), testo: 'Chiama' }));
  if (!lettura && s.tipo !== 'quota') {
    const data = el('input', { type: 'date', value: scadenzaProposta(s.tipo, oggi, impScadenze) || oggi });
    const segna = el('button', { class: 'tasto pieno', testo: 'Segna rinnovata', onclick: async () => {
      segna.disabled = true;
      try { await rinnovaScadenza(s.allievo_id, s.tipo, data.value || oggi); chiudi(); toast('Rinnovata.'); ridisegna(); } catch (e) { avvisa(e.message); } finally { segna.disabled = false; }
    } });
    figli.push(el('div', { class: 'blocco' }, [campo('Nuova scadenza', data), segna]));
    // il promemoria all'allievo: un tocco, si apre WhatsApp con il testo già scritto, lo manda il Sifu
    const testi = { ...TESTI_PREDEFINITI, ...(imp.promemoria?.testi || {}) };
    const messaggio = messaggioPromemoria(testi[s.tipo], { nome: s.allievi?.nome || '', tipo: (ETICHETTE[s.tipo] || s.tipo).toLowerCase(), data: s.data });
    const link = linkWhatsApp(s.allievi?.telefono, messaggio);
    figli.push(link
      ? el('a', { class: 'tasto', href: link, target: '_blank', rel: 'noopener', testo: 'Ricorda su WhatsApp', onclick: () => chiudi() })
      : el('p', { class: 'piccolo attenuato', testo: s.allievi?.telefono ? 'Il numero in scheda non sembra un cellulare: niente WhatsApp.' : 'Manca il cellulare nella scheda: niente WhatsApp.' }));
  }
  if (s.tipo === 'quota') figli.push(el('a', { class: 'tasto pieno', href: `#/allievi/${s.allievo_id}/quote`, testo: 'Vai alle quote', onclick: () => chiudi() }));
  const chiudi = apriFoglio(nome, el('div', { class: 'tasti-colonna' }, figli));
}
