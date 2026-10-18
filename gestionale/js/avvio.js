/* Longkai — avvio.js: parte per ultimo. Accende tutto e decide dove andare. */

import { registraPassaggio } from './base.js';
import { configurato, sessione, profilo, suCambioAccesso, esci } from './dati.js';
import { registraVista, disegna, striscia, togliStriscia, avviaTocchi, applicaSolaLettura, applicaAspetto, mostraNav, toast, avvisa, vai, statoErrore, mostraBolla, apriFoglio, riga } from './ui.js';
import { el } from './base.js';
import { avviaCoda } from './coda.js';
import { vistaAccesso } from './viste/accesso.js';
import { vistaOggi } from './viste/oggi.js';
import { vistaAllievi } from './viste/allievi.js';
import { vistaAllenamenti } from './viste/allenamenti.js';
import { vistaQuote } from './viste/quote.js';
import { vistaAltro } from './viste/altro.js';
import { vistaDiagnostica } from './viste/diagnostica.js';
import { vistaSegnala } from './viste/segnala.js';
import { vistaImpostazioni } from './viste/impostazioni.js';
import { vistaNuovaPassword } from './viste/nuova-password.js';
import { vistaScadenze } from './viste/scadenze.js';
import { vistaCassetta } from './viste/cassetta.js';
import { vistaCorsi } from './viste/corsi.js';
import { vistaArgomenti } from './viste/argomenti.js';
import { vistaSessione } from './viste/sessione.js';
import { vistaDetta } from './viste/detta.js';
import { vistaCorreggi } from './viste/correggi.js';
import './dettatura.js';
import { sessioniDelGiorno } from './dati.js';
import { oggiRoma, formattaOra } from '../comune/date.js';

registraVista('accesso', vistaAccesso);
registraVista('oggi', vistaOggi);
registraVista('allievi', vistaAllievi);
registraVista('allenamenti', vistaAllenamenti);
registraVista('quote', vistaQuote);
registraVista('altro', vistaAltro);
registraVista('diagnostica', vistaDiagnostica);
registraVista('segnala', vistaSegnala);
registraVista('impostazioni', vistaImpostazioni);
registraVista('nuova-password', vistaNuovaPassword);
registraVista('scadenze', vistaScadenze);
registraVista('sessione', vistaSessione);
registraVista('detta', vistaDetta);
registraVista('correggi', vistaCorreggi);
registraVista('cassetta', vistaCassetta);
registraVista('corsi', vistaCorsi);
registraVista('argomenti', (main, p) => vistaArgomenti(main, p, { indietro: 'allenamenti/argomenti', titolo: 'Argomenti' }));
registraVista('non-trovata', (main) => { main.textContent = 'Questa schermata non esiste.'; });

const PUBBLICHE = new Set(['accesso']);
let recuperoInCorso = false;
// I rimandi sostituiscono la voce di cronologia invece di aggiungerne una: così Indietro non resta intrappolato fra accesso e oggi.
const rimanda = (hash) => location.replace(hash);

async function instrada() {
  // Un link di recupero scaduto arriva come #error=...: lo si dice e si torna all'accesso.
  if (/^#error=/.test(location.hash)) {
    avvisa('Questo link è scaduto o già usato: serve un link nuovo.');
    rimanda('#/accesso');
    return;
  }
  // Il link di "Password dimenticata" arriva con i gettoni nell'indirizzo: li legge supabase-js, poi si va a scegliere la password.
  if (/access_token=|type=recovery|type=invite/.test(location.hash)) {
    recuperoInCorso = /type=(recovery|invite)/.test(location.hash);
    await sessione();
    rimanda(recuperoInCorso ? '#/nuova-password' : '#/oggi');
    return;
  }
  // Un'ancora qualsiasi (es. "Vai al contenuto") non è una rotta: si porta il fuoco e basta.
  // Se però la pagina si apre direttamente con quell'ancora, non c'è ancora niente disegnato: si va a Oggi.
  if (location.hash && !location.hash.startsWith('#/')) {
    if (!document.getElementById('contenuto').childElementCount) { history.replaceState(null, '', '#/oggi'); }
    else { document.getElementById(location.hash.slice(1))?.focus({ preventScroll: false }); return; }
  }
  const pezzi = location.hash.replace(/^#\/?/, '').split('/');
  const rotta = pezzi[0] || 'oggi';
  // #/nuova-password/<codice>: il link "scegli la password" mandato a mano; si entra senza sessione, il codice la crea
  const conLink = rotta === 'nuova-password' && Boolean(pezzi[1]);
  if (!configurato()) {
    // senza progetto configurato si può vedere solo l'accesso e la diagnostica
    mostraNav(false);
    if (rotta !== 'diagnostica') { rimanda('#/accesso'); return; }
    await disegna();
    return;
  }
  const s = await sessione();
  if (!s) mostraNav(false);
  if (!s && !PUBBLICHE.has(rotta) && !conLink) { rimanda('#/accesso'); return; }
  if (s && PUBBLICHE.has(rotta)) { rimanda('#/oggi'); return; }
  if (s) {
    let p = null; let lettura_fallita = false;
    try { p = await profilo(); } catch { lettura_fallita = true; /* rete o server: non si tira nessuna conclusione, si riprova alla prossima vista */ }
    if (!lettura_fallita && (!p || !p.attivo)) {
      // la lettura è riuscita e il profilo manca o è spento: l'account non è attivo
      avvisa('Questo account non è attivo. Chiedi al Sifu.');
      try { await esci(); } catch { /* niente */ }
      mostraNav(false); rimanda('#/accesso'); return;
    }
    applicaSolaLettura();
    mostraNav(true);
    mostraBolla(p?.ruolo === 'sifu', bollaAzione);
  }
  document.body.classList.toggle('senza-bolla', ['detta', 'accesso', 'nuova-password', 'sessione', 'correggi'].includes(rotta));
  await disegna();
}

/** La bolla: un tocco e si detta. Se oggi c'è una sola sessione da fare ci va dritta; se ce ne sono di più chiede quale; se non ce ne sono lo dice. */
async function bollaAzione() {
  const oggi = oggiRoma();
  let sessioni = [];
  try { sessioni = (await sessioniDelGiorno(oggi)).filter((s) => s.stato === 'prevista'); } catch (e) { avvisa(e.message); return; }
  if (sessioni.length === 1) { vai(`detta/${sessioni[0].id}`); return; }
  const elenco = el('div', { class: 'elenco' });
  for (const s of sessioni) elenco.append(riga({ principale: s.tipo === 'privata' ? `${formattaOra(s.ora)} · Privata · ${s.allievo_nome || ''} ${s.allievo_cognome || ''}`.trim() : `${formattaOra(s.ora)} · ${s.corso_nome || 'Corso'} · ${s.citta || ''}`, secondaria: s.in_revisione ? 'bozza pronta' : 'da fare', pallino: s.in_revisione ? 'ok' : 'attenzione', onclick: () => { chiudi(); vai(`detta/${s.id}`); } }));
  if (!sessioni.length) elenco.append(el('div', { class: 'vuoto' }, [el('p', { testo: 'Oggi non c\'è niente da dettare.' }), el('a', { class: 'tasto bordo', href: '#/oggi', onclick: () => chiudi(), testo: 'Vai a Oggi' })]));
  const chiudi = apriFoglio('Cosa detti?', el('div', {}, [elenco, el('div', { class: 'spazio' }), el('div', { class: 'tasti' }, [el('a', { class: 'tasto bordo', href: '#/correggi', onclick: () => chiudi(), testo: 'Correggi parlando' }), el('a', { class: 'tasto', href: '#/segnala', onclick: () => chiudi(), testo: 'Segnala un problema' })])]));
}

function avviaRete() {
  const aggiorna = () => {
    if (navigator.onLine) togliStriscia('rete');
    else striscia('rete', 'Sei senza rete: quello che fai partirà da solo quando torna.', { tipo: 'gialla' });
  };
  addEventListener('online', aggiorna); addEventListener('offline', aggiorna); aggiorna();
}

async function avviaServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let aggiornamentoChiesto = false;
  const proponi = (nuovo) => {
    if (!navigator.serviceWorker.controller) return; // prima installazione: niente da aggiornare
    toast('Nuova versione pronta.', { durata: 15000, annulla: null });
    striscia('aggiorna', 'Nuova versione dell\'app.', { tipo: 'blu', tasto: Object.assign(document.createElement('button'), { className: 'tasto', textContent: 'Aggiorna', onclick: () => { aggiornamentoChiesto = true; nuovo.postMessage({ tipo: 'AGGIORNA' }); } }) });
  };
  const osserva = (w) => { if (!w) return; if (w.state === 'installed') proponi(w); else w.addEventListener('statechange', () => { if (w.state === 'installed') proponi(w); }); };
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    // un worker già pronto da una visita precedente, o già in installazione prima che si ascoltasse: si propone subito
    osserva(reg.waiting); osserva(reg.installing);
    reg.addEventListener('updatefound', () => osserva(reg.installing));
    // si ricarica solo se l'aggiornamento è stato chiesto: mai da soli alla prima visita, mai durante una dettatura
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (aggiornamentoChiesto) location.reload(); });
  } catch { /* senza service worker l'app funziona lo stesso, solo online */ }
}

/* Un errore fuori dalle viste (un file che non si carica, un'eccezione imprevista) non deve lasciare lo schermo vuoto. */
function erroreGlobale(e) {
  const err = e.reason || e.error || new Error(e.message || 'Errore imprevisto');
  console.error(err);
  const main = document.getElementById('contenuto');
  if (main && !main.childElementCount) {
    main.replaceChildren(statoErrore(err, () => location.reload()));
    main.querySelector('.tasto')?.replaceChildren('Ricarica');
  }
}
addEventListener('error', erroreGlobale);
addEventListener('unhandledrejection', erroreGlobale);

async function avvio() {
  applicaAspetto();
  avviaTocchi();
  avviaRete();
  avviaCoda();
  registraPassaggio('avvio');
  addEventListener('hashchange', instrada);
  suCambioAccesso((evento) => {
    if (evento === 'SIGNED_OUT') { applicaSolaLettura(true); mostraNav(false); mostraBolla(false); vai('accesso'); }
    if (evento === 'PASSWORD_RECOVERY') { recuperoInCorso = true; vai('nuova-password'); }
  });
  await instrada();
  avviaServiceWorker();
}

avvio();
