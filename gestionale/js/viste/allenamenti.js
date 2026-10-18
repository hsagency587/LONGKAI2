/* Longkai — viste/allenamenti.js: Diario · Programma · Argomenti. Gli argomenti si leggono e si correggono; Diario e Programma arrivano nelle fasi 2 e 5. */
import { el } from '../base.js';
import { soloLettura } from '../dati.js';
import { testata, statoVuoto, toast } from '../ui.js';
import { disegnaArgomenti } from './argomenti.js';

export async function vistaAllenamenti(main, parametri) {
  const scheda = parametri[0] || 'diario';
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaAllenamenti(main, parametri); };
  testata('Allenamenti', { azione: scheda === 'argomenti' && !lettura ? el('a', { class: 'tasto azione', 'data-scrittura': '', href: '#/impostazioni/forme', testo: 'Modifica' }) : null });
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of [['diario', 'Diario'], ['programma', 'Programma'], ['argomenti', 'Argomenti']]) {
    chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/allenamenti/' + k, testo: nome }));
  }
  main.append(chips, el('div', { class: 'spazio' }));
  if (scheda === 'argomenti') { await disegnaArgomenti(main, ridisegna); return; }
  main.append(statoVuoto(scheda === 'diario' ? 'Il diario delle sessioni arriva in fase 2.' : 'Il programma arriva in fase 2 (i chip) e in fase 4 (a voce).', el('button', { class: 'tasto bordo', testo: 'Come funzionerà', onclick: () => toast('Una frase a voce riempie il mese; ogni lezione eredita il previsto; la dettatura spunta il fatto.', { durata: 8000 }) })));
}
