/* Longkai — viste/allenamenti.js: Diario · Programma · Argomenti. In fase 0 gli argomenti si leggono; il resto arriva nelle fasi 2 e 5. */
import { el } from '../base.js';
import { sb } from '../dati.js';
import { testata, scheletri, statoVuoto, sezione, riga, toast } from '../ui.js';

export async function vistaAllenamenti(main, parametri) {
  const scheda = parametri[0] || 'diario';
  testata('Allenamenti');
  const chips = el('div', { class: 'chips' });
  for (const [k, nome] of [['diario', 'Diario'], ['programma', 'Programma'], ['argomenti', 'Argomenti']]) {
    chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/allenamenti/' + k, testo: nome }));
  }
  main.append(chips, el('div', { style: null, class: 'sezione' }));
  if (scheda === 'argomenti') {
    main.append(scheletri(4));
    const { data, error } = await sb().from('argomenti').select('id, area, nome, sinonimi, pronunce, sezioni, attivo').eq('attivo', true).order('area').order('ordine');
    main.querySelectorAll('.scheletro').forEach((x) => x.remove());
    if (error) throw error;
    const perArea = new Map();
    for (const a of data || []) { if (!perArea.has(a.area)) perArea.set(a.area, []); perArea.get(a.area).push(a); }
    const ordine = ['Forme', 'Chi Sao', 'Tecniche di mano', 'Pugni e palmi', 'Gomiti e ginocchia', 'Gambe', 'Posizioni e passi', 'Applicazioni', 'Principi'];
    for (const area of [...ordine.filter((x) => perArea.has(x)), ...[...perArea.keys()].filter((x) => !ordine.includes(x))]) {
      const elenco = el('div', { class: 'elenco' });
      for (const a of perArea.get(area)) {
        const sez = Array.isArray(a.sezioni) ? `${a.sezioni.length} sezioni` : null;
        const pron = a.pronunce?.length ? `il Sifu dice: ${a.pronunce.join(', ')}` : null;
        elenco.append(riga({ principale: a.nome, secondaria: [sez, pron, a.sinonimi?.slice(0, 3).join(' · ')].filter(Boolean).join(' — '), onclick: () => toast('Modifica e correzione a voce in fase 4.') }));
      }
      main.append(sezione(area, elenco));
    }
    if (!perArea.size) main.append(statoVuoto('Nessun argomento: il seme non è stato caricato.'));
  } else {
    main.append(statoVuoto(scheda === 'diario' ? 'Il diario arriva in fase 2.' : 'Il programma arriva in fase 5.'));
  }
}
