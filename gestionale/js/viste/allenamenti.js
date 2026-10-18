/* Longkai — viste/allenamenti.js: Diario · Programma · Argomenti. */
import { el } from '../base.js';
import { soloLettura } from '../dati.js';
import { testata } from '../ui.js';
import { disegnaArgomenti } from './argomenti.js';
import { disegnaDiario } from './diario.js';
import { disegnaProgramma } from './programma.js';

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
  if (scheda === 'programma') { await disegnaProgramma(main, ridisegna); return; }
  await disegnaDiario(main, parametri.slice(1));
}
