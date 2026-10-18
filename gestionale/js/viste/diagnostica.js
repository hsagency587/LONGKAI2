/* Longkai — viste/diagnostica.js: versione, rete, coda, regione del server, service worker, ultimi passaggi. */
import { el, VERSIONE_APP, ultimiPassaggi, dispositivo } from '../base.js';
import { configurato, salute } from '../dati.js';
import { testata, riga, sezione, statoVuoto } from '../ui.js';
import { lavori, riprova, scarta, suCambioCoda } from '../coda.js';
import { statoPush } from '../push.js';

export async function vistaDiagnostica(main) {
  testata('Diagnostica', { indietro: 'altro' });
  const info = el('div', { class: 'elenco' });
  let versioneOnline = '—';
  try { const r = await fetch('versione.json', { cache: 'no-store' }); const j = await r.json(); versioneOnline = j.versione || '—'; } catch { /* senza rete */ }
  info.append(
    riga({ principale: 'Versione dell\'app', destra: VERSIONE_APP }),
    riga({ principale: 'Versione pubblicata', destra: versioneOnline }),
    riga({ principale: 'Rete', destra: navigator.onLine ? 'collegata' : 'assente', pallino: navigator.onLine ? 'ok' : 'errore' }),
    riga({ principale: 'Dispositivo', secondaria: dispositivo() }),
    riga({ principale: 'Service worker', destra: navigator.serviceWorker?.controller ? 'attivo' : 'non attivo' }),
    riga({ principale: 'Progetto Supabase', destra: configurato() ? 'configurato' : 'non configurato', pallino: configurato() ? 'ok' : 'attenzione' }),
  );
  const push = await statoPush();
  info.append(
    riga({ principale: 'Notifiche su questo telefono', destra: { attivo: 'attive', spento: 'spente', negato: 'bloccate', non_supportato: 'non disponibili' }[push], pallino: push === 'attivo' ? 'ok' : push === 'spento' ? 'neutro' : 'attenzione', href: '#/impostazioni/scadenze' }),
    riga({ principale: 'Segnalazioni', secondaria: 'nuove, viste, risolte', href: '#/impostazioni/segnalazioni' }),
  );
  main.append(sezione('App', info));

  const server = el('div', { class: 'elenco' });
  main.append(sezione('Server', server));
  if (configurato()) {
    server.append(riga({ principale: 'Sto chiedendo al server…' }));
    try {
      const s = await salute();
      server.replaceChildren(
        riga({ principale: 'Regione', destra: s.regione, pallino: s.regione_giusta ? 'ok' : 'attenzione', secondaria: s.regione_giusta ? 'Europa, Francoforte' : 'attenzione: non è la regione europea' }),
        riga({ principale: 'Versione delle funzioni', destra: s.versione }),
        riga({ principale: 'Ruolo riconosciuto', destra: s.ruolo }),
      );
    } catch (e) {
      server.replaceChildren(riga({ principale: 'Il server non risponde', secondaria: e.message, pallino: 'errore' }));
    }
  } else {
    server.append(statoVuoto('Compila config.js con l\'indirizzo del progetto.'));
  }

  const codaBox = el('div', { class: 'elenco' });
  function disegnaCoda() {
    codaBox.replaceChildren();
    const l = lavori();
    if (!l.length) { codaBox.append(statoVuoto('Nessun lavoro in coda.')); return; }
    for (const x of l) {
      const r = riga({ principale: `${x.tipo} · ${x.stato}`, secondaria: x.errore || x.creato, pallino: x.stato === 'fallito' ? 'errore' : x.stato === 'in_corso' ? 'info' : 'attenzione' });
      const tasti = el('div', { class: 'tasti riga-sotto' }, [
        el('button', { class: 'tasto bordo', testo: 'Riprova', onclick: () => riprova(x.id) }),
        el('button', { class: 'tasto pericolo', testo: 'Scarta', onclick: () => scarta(x.id) }),
      ]);
      codaBox.append(r, tasti);
    }
  }
  disegnaCoda();
  // l'ascoltatore si toglie da solo quando la schermata non è più nella pagina
  const togli = suCambioCoda(() => { if (!codaBox.isConnected) { togli(); return; } disegnaCoda(); });
  main.append(sezione('Coda dei lavori', codaBox));

  const passi = el('div', { class: 'elenco' });
  for (const p of ultimiPassaggi()) passi.append(riga({ principale: p.cosa, destra: p.t }));
  main.append(sezione('Ultimi passaggi (senza dati personali)', passi));
}
