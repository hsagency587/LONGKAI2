/* Longkai — viste/detta.js: la dettatura. Libera (tutto in una volta, con le sei cose da dire sotto) o guidata (una domanda alla volta).
   L'audio finisce in coda: trascrizione e riordino avvengono sul server; quando la revisione è pronta, l'app avvisa. */
import { el, icona, nuovoId } from '../base.js';
import { sessioneCompleta, impostazioni, salvaImpostazione, leggiLocale, salvaLocale } from '../dati.js';
import { testata, statoVuoto, toast, avvisa, chiedi, vai } from '../ui.js';
import { accoda } from '../coda.js';
import { audioStore } from '../audio-store.js';
import { apriMicrofono, puoRegistrare } from '../voce.js';
import { formattaData, formattaOra } from '../../comune/date.js';

const PASSI = [
  { k: 'chi', domanda: 'Chi c\'era?', aiuto: 'I presenti, chi mancava, chi era in più.' },
  { k: 'gruppo', domanda: 'Cosa ha fatto il gruppo?', aiuto: 'Gli argomenti e due parole.' },
  { k: 'singoli', domanda: 'Qualcuno ha fatto qualcosa di suo?', aiuto: 'I singoli, le osservazioni, i passi avanti nelle forme.' },
  { k: 'private', domanda: 'Private di oggi?', aiuto: 'Per ognuna, cosa si è fatto.' },
  { k: 'pagamenti', domanda: 'Qualcuno ha pagato?', aiuto: 'Chi, quanto, per cosa.' },
  { k: 'prossima', domanda: 'La prossima volta?', aiuto: 'Cosa fare alla prossima lezione.' },
];
const PROMEMORIA = ['Chi c\'era, chi mancava, chi era in più', 'Cosa ha fatto il gruppo', 'Chi ha fatto qualcosa di suo, osservazioni, forme', 'Le private di oggi', 'Chi ha pagato, quanto, per cosa', 'La prossima volta'];

export async function vistaDetta(main, parametri) {
  const id = parametri[0];
  testata('Detta', { indietro: true });
  if (!puoRegistrare()) { main.append(statoVuoto('Questo telefono o browser non registra l\'audio.', el('a', { class: 'tasto pieno', href: `#/sessione/${id}`, testo: 'Fai a mano' }))); return; }
  const [d, imp] = await Promise.all([sessioneCompleta(id), impostazioni().catch(() => ({}))]);
  if (!d) { main.append(statoVuoto('Questa sessione non esiste.')); return; }
  const s = d.sessione;
  if (s.stato === 'fatta') { main.append(statoVuoto('Questa sessione è già confermata: per correggerla, aprila.', el('a', { class: 'tasto pieno', href: `#/sessione/${id}`, testo: 'Apri' }))); return; }
  const voce = imp.voce || {};
  let modo = (location.hash.match(/modo=(libera|guidata)/) || [])[1] || voce.modo || 'libera';
  const privata = s.tipo === 'privata';
  const passi = PASSI.filter((p) => !(privata && (p.k === 'chi' || p.k === 'private')) && !(p.k === 'prossima' && d.programmaProssima && (d.programmaProssima.programma_argomenti || []).length && voce.chiedi_prossima_volta !== 'sempre'));
  const prossimaPrevista = d.programmaProssima && (d.programmaProssima.programma_argomenti || []).length;

  const box = el('div', { class: 'detta' });
  box.append(el('p', { class: 'attenuato', testo: `${privata ? 'Privata · ' + (s.allievo_nome || '') + ' ' + (s.allievo_cognome || '') : (s.corso_nome || 'Corso') + ' · ' + (s.citta || '')} · ${formattaData(s.data, 'breve')} ${formattaOra(s.ora)}` }));
  const chips = el('div', { class: 'chips', style: null });
  const corpo = el('div');
  const disegnaChips = () => {
    chips.replaceChildren();
    for (const [k, n] of [['libera', 'Libera'], ['guidata', 'Guidata']]) chips.append(el('button', { class: 'chip' + (modo === k ? ' scelto' : ''), testo: n, onclick: () => { modo = k; disegnaChips(); disegna(); } }));
  };
  const pezzi = [];
  const lavoroId = nuovoId();
  let passo = 0;

  function chiudiEAccoda() {
    if (!pezzi.length) { avvisa('Non hai registrato niente.'); return; }
    try { if (globalThis.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch { /* niente */ }
    accoda({ tipo: 'dettatura', id: lavoroId, sessione_id: id, pezzi: pezzi.map((p) => ({ audio_id: p.audio_id, etichetta: p.etichetta, secondi: p.secondi })) });
    const n = (voce.dettature_fatte || 0) + 1;
    salvaImpostazione('voce', 'dettature_fatte', n).catch(() => {});
    const loc = leggiLocale(); loc.ultimaDettatura = Date.now(); salvaLocale(loc);
    toast(navigator.onLine ? 'In coda: ti avviso quando la revisione è pronta.' : 'Senza rete: parte da solo quando torna.', { durata: 7000 });
    vai('oggi');
  }

  function disegna() {
    corpo.replaceChildren();
    if (modo === 'libera') {
      corpo.append(el('p', { class: 'domanda', testo: 'Racconta la sessione' }));
      corpo.append(registratore({ suFine: async (blob, secondi) => { const aid = nuovoId(); await audioStore.metti(aid, blob); pezzi.length = 0; pezzi.push({ audio_id: aid, etichetta: 'libera', secondi }); await chiudiEAccoda(); } }));
      corpo.append(el('ol', { class: 'promemoria piccolo' }, PROMEMORIA.map((t, i) => el('li', { testo: t, class: i === 5 && prossimaPrevista ? 'nascosto' : '' }))));
      if (prossimaPrevista) corpo.append(el('p', { class: 'piccolo attenuato', testo: 'Prossima volta già prevista: non serve dirla.' }));
    } else {
      const p = passi[passo];
      const puntini = el('div', { class: 'passi' }, passi.map((_, i) => el('span', { class: i < passo ? 'fatto' : i === passo ? 'corrente' : '' })));
      corpo.append(puntini, el('p', { class: 'domanda', testo: p.domanda }), el('p', { class: 'attenuato', testo: p.aiuto }));
      const avanti = async () => { passo++; if (passo >= passi.length) await chiudiEAccoda(); else disegna(); };
      corpo.append(registratore({ suFine: async (blob, secondi) => { const aid = nuovoId(); await audioStore.metti(aid, blob); pezzi.push({ audio_id: aid, etichetta: p.k, secondi }); await avanti(); } }));
      corpo.append(el('div', { class: 'tasti', style: null }, [el('button', { class: 'tasto', testo: passo === passi.length - 1 ? 'Salta e chiudi' : 'Salta', onclick: avanti })]));
    }
    if (voce.aiuto_prime_dettature !== false && (voce.dettature_fatte || 0) < 3) corpo.append(el('p', { class: 'piccolo attenuato', style: null, testo: 'Parla come parleresti a una persona: nomi, cosa avete fatto, chi ha pagato. L\'app riordina tutto e tu confermi.' }));
    corpo.append(el('p', {}, [el('a', { class: 'tasto', href: `#/sessione/${id}`, testo: 'Preferisco fare a mano' })]));
  }
  disegnaChips(); disegna();
  main.append(box, chips, el('div', { class: 'spazio' }), corpo);
  main.prepend(box);
  void chiedi;
}

/** Il registratore: un microfono grande, il tempo, le tacchette, Pausa e Fine. */
export function registratore({ suFine }) {
  const mic = el('button', { class: 'mic', 'aria-label': 'Registra' }, icona('microfono'));
  const tempo = el('div', { class: 'tempo', testo: '0:00' });
  const tacchette = el('div', { class: 'tacchette' }, Array.from({ length: 16 }, () => el('span')));
  const tasti = el('div', { class: 'tasti', style: null });
  const stato = el('p', { class: 'piccolo attenuato', testo: 'Tocca il microfono e parla.' });
  let rec = null; let timer = null; let anim = null; let finito = false;
  const aggiorna = () => {
    if (!rec) return;
    const s = rec.secondi(); tempo.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= 15 * 60) fine();
  };
  const animazione = () => {
    if (!rec || rec.inPausa()) return;
    const l = rec.livello();
    const n = Math.round(l * 16);
    [...tacchette.children].forEach((x, i) => { x.classList.toggle('viva', i < n); x.style.height = `${6 + (i < n ? Math.round(l * 22) : 0)}px`; });
    anim = requestAnimationFrame(animazione);
  };
  async function avvia() {
    try { rec = await apriMicrofono(); }
    catch { avvisa('Non riesco ad aprire il microfono: controlla i permessi del telefono.'); return; }
    rec.avvia();
    mic.classList.add('registra'); mic.setAttribute('aria-label', 'In registrazione');
    stato.textContent = 'Sto ascoltando. Quando hai finito, tocca Fine.';
    timer = setInterval(aggiorna, 500); anim = requestAnimationFrame(animazione);
    tasti.replaceChildren(
      el('button', { class: 'tasto bordo', testo: 'Pausa', onclick: (e) => { if (rec.inPausa()) { rec.riprendi(); e.target.textContent = 'Pausa'; mic.classList.remove('pausa'); anim = requestAnimationFrame(animazione); } else { rec.pausa(); e.target.textContent = 'Riprendi'; mic.classList.add('pausa'); } } }),
      el('button', { class: 'tasto pieno', testo: 'Fine', onclick: fine }),
    );
  }
  async function fine() {
    if (!rec || finito) return;
    finito = true;
    clearInterval(timer); cancelAnimationFrame(anim);
    const { blob, secondi } = await rec.fine();
    mic.classList.remove('registra', 'pausa');
    if (!blob.size || secondi < 1) { finito = false; rec = null; stato.textContent = 'Non ho sentito niente. Riprova.'; tasti.replaceChildren(); return; }
    stato.textContent = 'Salvo…';
    try { await suFine(blob, secondi); } catch (e) { avvisa(e.message || 'Non sono riuscito a salvare l\'audio.'); finito = false; }
  }
  mic.addEventListener('click', () => { if (!rec) avvia(); else if (rec.inPausa()) { rec.riprendi(); mic.classList.remove('pausa'); anim = requestAnimationFrame(animazione); } else fine(); });
  const box = el('div', {}, [mic, tempo, tacchette, stato, tasti]);
  // se si cambia schermata a metà, il microfono si chiude
  const oss = new MutationObserver(() => { if (!box.isConnected) { rec?.chiudi(); clearInterval(timer); cancelAnimationFrame(anim); oss.disconnect(); } });
  setTimeout(() => oss.observe(document.getElementById('contenuto'), { childList: true, subtree: false }), 0);
  return box;
}
