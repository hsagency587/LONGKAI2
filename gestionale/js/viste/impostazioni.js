/* Longkai — viste/impostazioni.js: in fase 0 l'aspetto (tema, testo) e l'elenco dei gruppi che arriveranno. */
import { el } from '../base.js';
import { leggiLocale } from '../dati.js';
import { testata, sezione, riga, applicaAspetto, toast } from '../ui.js';

export function vistaImpostazioni(main, parametri) {
  const gruppo = parametri[0];
  if (gruppo && gruppo !== 'aspetto') {
    testata('Impostazioni', { indietro: 'impostazioni' });
    main.append(el('div', { class: 'vuoto' }, [el('p', { testo: 'Questo gruppo arriva in una fase successiva.' })]));
    return;
  }
  testata('Impostazioni', { indietro: 'altro' });
  const loc = leggiLocale();
  const ridisegna = () => { main.replaceChildren(); vistaImpostazioni(main, ['aspetto']); };
  const chipsTema = el('div', { class: 'chips' });
  for (const [k, nome] of [['scuro', 'Scuro'], ['chiaro', 'Chiaro'], ['sistema', 'Come il telefono']]) {
    chipsTema.append(el('button', { class: 'chip' + ((loc.tema || 'scuro') === k ? ' scelto' : ''), testo: nome, onclick: () => { applicaAspetto({ tema: k }); toast('Tema cambiato.'); ridisegna(); } }));
  }
  const chipsTesto = el('div', { class: 'chips' });
  for (const [k, nome] of [['normale', 'Normale'], ['grande', 'Grande']]) {
    chipsTesto.append(el('button', { class: 'chip' + ((loc.testo || 'normale') === k ? ' scelto' : ''), testo: nome, onclick: () => { applicaAspetto({ testo: k }); toast('Testo cambiato.'); ridisegna(); } }));
  }
  main.replaceChildren();
  main.append(sezione('Aspetto', [el('div', { class: 'blocco' }, [el('p', { class: 'piccolo attenuato', testo: 'Tema' }), chipsTema, el('p', { class: 'piccolo attenuato', style: null, testo: 'Dimensione del testo' }), chipsTesto])]));
  const altri = el('div', { class: 'elenco' });
  for (const [nome, k] of [['Associazione', 'associazione'], ['Accesso e sicurezza', 'sicurezza'], ['Voce', 'voce'], ['Corsi', 'corsi'], ['Allievi', 'allievi'], ['Forme e tecniche', 'forme'], ['Private', 'private'], ['Presenze e ore', 'presenze'], ['Programma', 'programma'], ['Quote', 'quote'], ['Scadenze e avvisi', 'scadenze'], ['Promemoria agli allievi', 'promemoria'], ['Rapporti', 'rapporti'], ['Intelligenza artificiale', 'ia'], ['Dati', 'dati'], ['Segnalazioni', 'segnalazioni']]) {
    altri.append(riga({ principale: nome, href: '#/impostazioni/' + k }));
  }
  main.append(sezione('Tutto il resto', altri));
}
