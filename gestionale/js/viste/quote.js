/* Longkai — viste/quote.js: Da incassare · Pagamenti · Tariffe. Arriva in fase 3. In fase 0 mostra le tariffe. */
import { el, euro } from '../base.js';
import { sb } from '../dati.js';
import { testata, statoVuoto, riga, scheletri, toast } from '../ui.js';

export async function vistaQuote(main, parametri) {
  const scheda = parametri[0] || 'incassare';
  testata('Quote');
  const chips = el('div', { class: 'chips' });
  for (const [k, nome] of [['incassare', 'Da incassare'], ['pagamenti', 'Pagamenti'], ['tariffe', 'Tariffe']]) {
    chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/quote/' + k, testo: nome }));
  }
  main.append(chips, el('div', { class: 'sezione' }));
  if (scheda === 'tariffe') {
    main.append(scheletri(3));
    const { data, error } = await sb().from('tariffe').select('id, nome, importo_cent, tipo, attiva').order('ordine');
    main.querySelectorAll('.scheletro').forEach((x) => x.remove());
    if (error) throw error;
    const elenco = el('div', { class: 'elenco' });
    for (const t of data || []) elenco.append(riga({ principale: t.nome, secondaria: t.tipo.replace('_', ' '), destra: euro(t.importo_cent), onclick: () => toast('In fase 3.') }));
    main.append((data || []).length ? elenco : statoVuoto('Nessuna tariffa: le scrive il Sifu.'));
  } else {
    main.append(statoVuoto('Le quote arrivano in fase 3.'));
  }
}
