/* Longkai — viste/altro.js: il menù delle altre cose. */
import { el, icona } from '../base.js';
import { esci, profilo, leggiLocale } from '../dati.js';
import { testata, riga, chiedi, toast, vai } from '../ui.js';

export async function vistaAltro(main, parametri) {
  const sotto = parametri[0];
  if (sotto) { testata(sotto[0].toUpperCase() + sotto.slice(1), { indietro: 'altro' }); main.append(el('div', { class: 'vuoto' }, [el('p', { testo: 'Questa parte arriva in una fase successiva.' })])); return; }
  testata('Altro');
  const p = await profilo().catch(() => null);
  const voci = [
    ['Rapporti', 'rapporto', '#/altro/rapporti'],
    ['Scadenze', 'avviso', '#/altro/scadenze'],
    ['Corsi', 'calendario', '#/altro/corsi'],
    ['Cassetta', 'documento', '#/altro/cassetta'],
    ['Impostazioni', 'impostazioni', '#/impostazioni'],
    ['Cambia password', 'esci', '#/nuova-password'],
    ['Correggi parlando', 'microfono', '#/altro/correggi'],
    ['Segnala un problema', 'segnala', '#/segnala'],
    ['Aiuto', 'aiuto', '#/altro/aiuto'],
    ['Diagnostica', 'rete', '#/diagnostica'],
  ];
  const elenco = el('div', { class: 'elenco' });
  for (const [nome, ic, href] of voci) {
    const r = riga({ principale: nome, href });
    r.prepend(icona(ic));
    r.classList.remove('senza-icona');
    elenco.append(r);
  }
  main.append(el('p', { class: 'attenuato', testo: p ? `${p.nome || p.email || ''} · ${p.ruolo === 'sifu' ? 'Sifu' : 'sola lettura'}` : '' }), elenco);
  main.append(el('div', { class: 'tasti', style: null }, [el('button', { class: 'tasto pericolo', testo: 'Esci', onclick: async () => {
    const inCoda = leggiLocale().coda?.length || 0;
    const ok = await chiedi('Uscire?', inCoda ? `Hai ${inCoda} cose non ancora inviate: uscendo andranno perse. Dovrai rientrare con email e password.` : 'Dovrai rientrare con email e password.', [{ testo: 'Esci', valore: true, classe: 'pieno' }, { testo: 'Resta', valore: false }]);
    if (ok) { try { await esci(); toast('Sei uscito.'); vai('accesso'); } catch { toast('Non sono riuscito a uscire. Riprova.', { tipo: 'errore' }); } }
  } })]));
}
