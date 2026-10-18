/* Longkai — viste/diario.js: tutte le sessioni, mese per mese, con filtri e ricerca. */
import { el, icona } from '../base.js';
import { diario, soloLettura } from '../dati.js';
import { riga, sezione, scheletri, statoVuoto } from '../ui.js';
import { formattaData, formattaMese, formattaOra, oggiRoma, aggiungiMesi, primoDelMese } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';
import { normalizza } from '../../comune/fonetica.js';

const FILTRI = [['tutte', 'Tutte'], ['mortara', 'Mortara'], ['vigevano', 'Vigevano'], ['private', 'Private']];

export async function disegnaDiario(box, parametri = []) {
  const mese = /^\d{4}-\d{2}$/.test(parametri[0] || '') ? parametri[0] + '-01' : primoDelMese(oggiRoma());
  const filtro = FILTRI.some(([k]) => k === parametri[1]) ? parametri[1] : 'tutte';
  const lettura = soloLettura();
  const nav = el('div', { class: 'mese-nav' }, [
    el('a', { class: 'tasto icona', href: `#/allenamenti/diario/${aggiungiMesi(mese, -1).slice(0, 7)}/${filtro}`, 'aria-label': 'Mese precedente' }, icona('indietro')),
    el('h2', { testo: formattaMese(mese) }),
    el('a', { class: 'tasto icona', href: `#/allenamenti/diario/${aggiungiMesi(mese, 1).slice(0, 7)}/${filtro}`, 'aria-label': 'Mese successivo' }, icona('freccia')),
  ]);
  const chips = el('div', { class: 'chips scorrevole' });
  for (const [k, nome] of FILTRI) chips.append(el('a', { class: 'chip' + (k === filtro ? ' scelto' : ''), href: `#/allenamenti/diario/${mese.slice(0, 7)}/${k}`, testo: nome }));
  const cerca = el('input', { type: 'search', placeholder: 'Cerca un argomento o un nome', autocomplete: 'off' });
  const corpo = el('div');
  box.append(nav, chips, el('div', { class: 'spazio' }), el('div', { class: 'campo' }, [cerca]), corpo, scheletri(3));
  const al = aggiungiMesi(mese, 1);
  const tutte = await diario(mese, aggiungiMesiMeno1(al));
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const mostra = () => {
    corpo.replaceChildren();
    const q = normalizza(cerca.value);
    const righe = tutte.filter((s) => {
      if (filtro === 'private' && s.tipo !== 'privata') return false;
      if ((filtro === 'mortara' || filtro === 'vigevano') && !normalizza(s.citta || '').includes(filtro)) return false;
      if (q) { const testo = normalizza([s.corso_nome, s.citta, s.allievo_nome, s.allievo_cognome, s.argomenti_gruppo, s.nota, s.previsto_argomenti].filter(Boolean).join(' ')); if (!testo.includes(q)) return false; }
      return true;
    });
    if (!righe.length) { corpo.append(statoVuoto(tutte.length ? 'Niente con questi filtri.' : 'Nessuna sessione in questo mese.')); return; }
    const fatte = righe.filter((s) => s.stato === 'fatta').length;
    const elenco = el('div', { class: 'elenco' });
    for (const s of righe) {
      const chi = s.tipo === 'privata' ? `Privata · ${s.allievo_nome || ''} ${s.allievo_cognome || ''}`.trim() : `${s.corso_nome || 'Corso'} · ${s.citta || ''}` + (s.tipo === 'straordinaria' ? ' · straordinaria' : '');
      const stato = s.stato === 'fatta' ? `${s.presenti} presenti` : s.stato === 'saltata' ? 'saltata' + (s.motivo ? ': ' + s.motivo : '') : s.stato === 'annullata' ? 'annullata' : 'da fare';
      elenco.append(riga({ principale: `${formattaData(s.data, 'breve')} ${formattaOra(s.ora)} · ${chi}`, secondaria: [stato, formattaMinuti(s.durata_minuti), s.argomenti_gruppo || (s.stato === 'prevista' && s.previsto_argomenti ? 'previsto: ' + s.previsto_argomenti : null)].filter(Boolean).join(' · '), pallino: s.stato === 'fatta' ? 'ok' : s.stato === 'prevista' ? 'attenzione' : 'neutro', href: `#/sessione/${s.id}` }));
    }
    corpo.append(sezione(`${righe.length} sessioni · ${fatte} fatte`, elenco));
  };
  cerca.addEventListener('input', mostra);
  mostra();
  void lettura;
}

function aggiungiMesiMeno1(primoDelMeseDopo) {
  const [a, m, g] = primoDelMeseDopo.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g - 1, 12));
  return d.toISOString().slice(0, 10);
}
