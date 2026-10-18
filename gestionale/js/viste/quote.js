/* Longkai — viste/quote.js: Da incassare · Pagamenti · Tariffe. Da incassare e Pagamenti arrivano in fase 3; le tariffe si scrivono già. */
import { el, euro } from '../base.js';
import { tariffeTutte, salvaTariffa, soloLettura } from '../dati.js';
import { testata, statoVuoto, riga, scheletri, toast, apriFoglio } from '../ui.js';
import { campo } from './allievo-modulo.js';

const TIPI = [['mensile', 'Mensile'], ['trimestrale', 'Trimestrale'], ['annuale', 'Annuale'], ['pacchetto', 'Pacchetto di N lezioni'], ['lezione', 'A lezione'], ['ora_privata', 'A ora di privata'], ['tessera', 'Tessera / iscrizione'], ['altro', 'Altro']];
const NOME_TIPO = Object.fromEntries(TIPI);

export async function vistaQuote(main, parametri) {
  const scheda = parametri[0] || 'incassare';
  const lettura = soloLettura();
  const ridisegna = () => { main.replaceChildren(); vistaQuote(main, parametri); };
  testata('Quote', { azione: scheda === 'tariffe' && !lettura ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Tariffa', onclick: () => foglioTariffa(null, ridisegna) }) : null });
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of [['incassare', 'Da incassare'], ['pagamenti', 'Pagamenti'], ['tariffe', 'Tariffe']]) {
    chips.append(el('a', { class: 'chip' + (k === scheda ? ' scelto' : ''), href: '#/quote/' + k, testo: nome }));
  }
  main.append(chips, el('div', { class: 'spazio' }));
  if (scheda === 'tariffe') {
    main.append(scheletri(3));
    const tariffe = await tariffeTutte();
    main.querySelectorAll('.scheletro').forEach((x) => x.remove());
    const elenco = el('div', { class: 'elenco' });
    for (const t of tariffe) {
      const dettagli = [NOME_TIPO[t.tipo] || t.tipo, t.tipo === 'pacchetto' && t.n_lezioni ? `${t.n_lezioni} lezioni` : null, t.comprende_private ? 'comprende le private' : null, t.comprende_extra ? 'comprende le lezioni in più' : null, t.attiva ? null : 'non in uso'].filter(Boolean).join(' · ');
      elenco.append(riga({ principale: t.nome, secondaria: dettagli, destra: euro(t.importo_cent), pallino: t.attiva ? 'ok' : 'neutro', onclick: lettura ? null : () => foglioTariffa(t, ridisegna) }));
    }
    main.append(tariffe.length ? elenco : statoVuoto('Nessuna tariffa: scrivi le tue con “+ Tariffa”.'));
    main.append(el('p', { class: 'piccolo attenuato', style: null, testo: 'Le tariffe sono il listino. L\'abbonamento di ogni allievo si sceglie dalla sua scheda, in Quote.' }));
  } else {
    main.append(statoVuoto(scheda === 'incassare' ? 'Da incassare, con “Registra un pagamento”, arriva in fase 3.' : 'Il registro dei pagamenti arriva in fase 3.'));
  }
}

function foglioTariffa(t, ridisegna) {
  const nome = el('input', { type: 'text', value: t?.nome || '', placeholder: 'es. Mensile adulti' });
  const importo = el('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: t ? (t.importo_cent / 100).toFixed(2) : '' });
  const tipo = el('select', {}, TIPI.map(([v, n]) => el('option', { value: v, testo: n })));
  tipo.value = t?.tipo || 'mensile';
  const nLezioni = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: t?.n_lezioni || '' });
  const campoN = campo('Quante lezioni', nLezioni);
  campoN.classList.toggle('nascosto', tipo.value !== 'pacchetto');
  tipo.addEventListener('change', () => campoN.classList.toggle('nascosto', tipo.value !== 'pacchetto'));
  const private_ = el('input', { type: 'checkbox' }); private_.checked = Boolean(t?.comprende_private);
  const extra = el('input', { type: 'checkbox' }); extra.checked = Boolean(t?.comprende_extra);
  const attiva = el('input', { type: 'checkbox' }); attiva.checked = t ? t.attiva : true;
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    errore.textContent = '';
    const cent = Math.round(parseFloat(String(importo.value).replace(',', '.')) * 100);
    if (!nome.value.trim()) { errore.textContent = 'Serve il nome.'; return; }
    if (!(cent >= 0)) { errore.textContent = 'Serve l\'importo.'; return; }
    salva.disabled = true;
    try {
      await salvaTariffa(t?.id || null, { nome: nome.value.trim(), importo_cent: cent, tipo: tipo.value, n_lezioni: tipo.value === 'pacchetto' ? (Number(nLezioni.value) || null) : null, comprende_private: private_.checked, comprende_extra: extra.checked, attiva: attiva.checked, ordine: t?.ordine ?? 9 });
      chiudi(); toast('Tariffa salvata.'); ridisegna();
    } catch (e) { errore.textContent = e.message || 'Non sono riuscito a salvare.'; } finally { salva.disabled = false; }
  } });
  const chiudi = apriFoglio(t ? t.nome : 'Nuova tariffa', el('div', {}, [
    campo('Nome', nome), el('div', { class: 'griglia-campi' }, [campo('Importo (€)', importo), campo('Tipo', tipo)]), campoN,
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Comprende le lezioni private' }), private_]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'Comprende le lezioni in più' }), extra]),
    el('label', { class: 'interruttore' }, [el('span', { testo: 'In uso' }), attiva]),
    errore, salva,
  ]));
}
