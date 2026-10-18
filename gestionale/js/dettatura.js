/* Longkai — dettatura.js: il lavoro in coda "dettatura": manda i pezzi audio a trascrivi, il testo a riordina,
   salva la bozza nella sessione e avvisa "Revisione pronta". Senza rete aspetta; un errore di chiavi o di tetto si ferma e lo dice. */
import { registraEsecutore, ErroreRete, ErroreConfig, ErroreValidazione } from './coda.js';
import { trascrivi, riordina, salvaBozzaSessione } from './dati.js';
import { audioStore } from './audio-store.js';
import { toast, striscia, togliStriscia } from './ui.js';
import { estensioneDi } from './voce.js';

const ETICHETTE = { chi: 'Chi c\'era', gruppo: 'Cosa ha fatto il gruppo', singoli: 'Singoli', private: 'Private', pagamenti: 'Pagamenti', prossima: 'La prossima volta', libera: '' };

function avvisaPronta(lavoro) {
  toast('Revisione pronta: tocca per aprirla.', { durata: 10000, annulla: null });
  striscia('revisione', 'Revisione pronta.', { tipo: 'blu', tasto: Object.assign(document.createElement('button'), { className: 'tasto', textContent: 'Apri', onclick: () => { togliStriscia('revisione'); location.hash = `#/sessione/${lavoro.sessione_id}`; } }) });
  try { if (globalThis.Notification?.permission === 'granted' && document.hidden) new Notification('Longkai', { body: 'Revisione pronta.', icon: 'icone/icon-192.png' }); } catch { /* niente */ }
}

registraEsecutore('dettatura', async (lavoro) => {
  if (!navigator.onLine) throw new ErroreRete();
  lavoro.testi = lavoro.testi || {};
  // 1. ogni pezzo audio diventa testo (i pezzi già fatti non si rifanno)
  for (const p of lavoro.pezzi || []) {
    if (lavoro.testi[p.audio_id] != null) continue;
    const blob = await audioStore.prendi(p.audio_id);
    if (!blob) { lavoro.testi[p.audio_id] = ''; continue; }
    try {
      const r = await trascrivi(blob, { etichetta: p.etichetta, nomeFile: `${p.audio_id}.${estensioneDi(blob.type)}` });
      lavoro.testi[p.audio_id] = r.testo || '';
    } catch (e) {
      if (e.codice === 'silenzio') { lavoro.testi[p.audio_id] = ''; continue; }
      if (e.codice === 'chiave_mancante' || e.codice === 'ia_spenta' || e.codice === 'tetto') throw new ErroreConfig(e.message);
      if (e.codice === 'ingresso') throw new ErroreValidazione(e.message);
      if (!navigator.onLine || /fetch|rete|network/i.test(e.message || '')) throw new ErroreRete();
      throw e; // riprova con le attese della coda
    }
  }
  const testo = (lavoro.pezzi || []).map((p) => { const t = (lavoro.testi[p.audio_id] || '').trim(); if (!t) return ''; const et = ETICHETTE[p.etichetta] || p.etichetta || ''; return et ? `[${et}] ${t}` : t; }).filter(Boolean).join('\n\n');
  if (!testo) throw new ErroreValidazione('Non ho sentito niente: riprova a dettare, o usa “A mano”.');
  // 2. il testo diventa campi
  let r;
  try { r = await riordina({ modo: 'sessione', sessione_id: lavoro.sessione_id, testo }); }
  catch (e) {
    if (e.codice === 'chiave_mancante' || e.codice === 'ia_spenta' || e.codice === 'tetto') throw new ErroreConfig(e.message);
    if (e.codice === 'ingresso' || e.codice === 'non_trovato' || e.codice === 'silenzio') throw new ErroreValidazione(e.message);
    if (!navigator.onLine) throw new ErroreRete();
    throw e;
  }
  // 3. la bozza si salva nella sessione; gli audio si buttano
  await salvaBozzaSessione(lavoro.sessione_id, { testo_grezzo: testo, risposta_grezza: r.risposta });
  for (const p of lavoro.pezzi || []) { try { await audioStore.togli(p.audio_id); } catch { /* niente */ } }
  avvisaPronta(lavoro);
});
