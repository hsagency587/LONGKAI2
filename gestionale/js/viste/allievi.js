/* Longkai — viste/allievi.js: in fase 0 l'elenco con la ricerca. La scheda arriva in fase 1. */
import { el } from '../base.js';
import { elencoAllievi } from '../dati.js';
import { testata, riga, scheletri, statoVuoto, toast } from '../ui.js';
import { normalizza } from '../../comune/fonetica.js';

export async function vistaAllievi(main) {
  testata('Allievi', { azione: el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Allievo', onclick: () => toast('In fase 1.') }) });
  main.append(scheletri(5));
  const tutti = await elencoAllievi();
  main.replaceChildren();
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un allievo', 'aria-label': 'Cerca un allievo', autocomplete: 'off' });
  const elenco = el('div', { class: 'elenco' });
  function mostra() {
    const q = normalizza(cerca.value);
    const filtrati = q ? tutti.filter((a) => normalizza(`${a.nome} ${a.cognome}`).includes(q) || normalizza(`${a.cognome} ${a.nome}`).includes(q)) : tutti;
    elenco.replaceChildren();
    if (!filtrati.length) { elenco.append(statoVuoto(tutti.length ? 'Nessun allievo con questo nome.' : 'Nessun allievo ancora.')); return; }
    for (const a of filtrati) {
      elenco.append(riga({ principale: `${a.cognome} ${a.nome}`.trim(), secondaria: [a.citta, a.stato !== 'attivo' ? a.stato : null, a.da_completare ? 'scheda da completare' : null].filter(Boolean).join(' · '), pallino: a.stato === 'attivo' ? 'ok' : 'neutro', onclick: () => toast('La scheda arriva in fase 1.') }));
    }
  }
  cerca.addEventListener('input', mostra);
  main.append(el('div', { class: 'campo' }, [cerca]), elenco);
  mostra();
}
