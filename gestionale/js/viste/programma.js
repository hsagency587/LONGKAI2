/* Longkai — viste/programma.js: i mesi (l'idea del Sifu, a parole), le prossime lezioni a blocchi (si toccano e si programmano),
   a che punto sono gli allievi. A voce: il mese da Correggi parlando → Programma; la lezione da «Programma la lezione» (pezzo 3). */
import { el } from '../base.js';
import { prossimeSessioni, programmiMesi, salvaProgramma, aChePunto, corsiCompleti, argomentiAttivi, allieviAttivi, impostazioni, soloLettura } from '../dati.js';
import { riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio } from '../ui.js';
import { formattaData, formattaMese, formattaOra, oggiRoma, primoDelMese, aggiungiMesi } from '../../comune/date.js';
import { tacche } from '../../comune/sessione.js';
import { riassuntoBlocchi } from '../../comune/blocchi.js';
import { foglioLezione } from './blocchi.js';
import { campo } from './allievo-modulo.js';

const nomeDi = (a) => `${a?.nome || ''} ${a?.cognome || ''}`.trim();

export async function disegnaProgramma(box, ridisegna) {
  const lettura = soloLettura();
  const oggi = oggiRoma();
  const questo = primoDelMese(oggi);
  const prossimo = aggiungiMesi(questo, 1);
  box.append(scheletri(4));
  const [sessioni, mesi, corsi, argomenti, allievi, quadro, imp] = await Promise.all([prossimeSessioni(), programmiMesi([questo, prossimo]), corsiCompleti(), argomentiAttivi(), allieviAttivi().catch(() => []), aChePunto().catch(() => null), impostazioni().catch(() => ({}))]);
  box.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const nomeArg = (id) => argomenti.find((a) => a.id === id)?.nome || '…';
  const nomeAll = (id) => nomeDi(allievi.find((a) => a.id === id)) || '…';

  /* ---------- I MESI: l'idea, a parole ---------- */
  const mesiBox = el('div');
  for (const c of corsi.filter((x) => x.attivo)) {
    for (const m of [questo, prossimo]) {
      const pr = mesi.find((x) => x.corso_id === c.id && x.mese === m);
      const figli = [
        el('div', { class: 'riga-stato' }, [el('strong', { testo: `${c.nome} · ${c.citta} · ${formattaMese(m)}` })]),
        pr?.nota ? el('p', { class: 'idea', testo: pr.nota }) : el('p', { class: 'attenuato idea', testo: lettura ? 'Niente scritto.' : 'Tocca e scrivi cosa vuoi fare questo mese.' }),
      ];
      mesiBox.append(lettura ? el('div', { class: 'card-mese' }, figli) : el('button', { class: 'card-mese toccabile', type: 'button', onclick: () => foglioMese(c, m, pr, ridisegna) }, figli));
    }
  }
  if (!mesiBox.childElementCount) mesiBox.append(statoVuoto('Nessun corso attivo.'));
  box.append(sezione('I mesi', mesiBox));

  /* ---------- LE PROSSIME LEZIONI: si toccano e si programmano a blocchi ---------- */
  const elenco = el('div', { class: 'elenco' });
  for (const s of sessioni.filter((x) => x.stato === 'prevista')) {
    const chi = s.tipo === 'privata' ? `Privata · ${s.allievo_nome || ''} ${s.allievo_cognome || ''}`.trim() : `${s.corso_nome || 'Corso'} · ${s.citta || ''}`;
    const riassunto = riassuntoBlocchi(s.blocchi || [], { nomeArgomento: nomeArg, nomeAllievo: nomeAll });
    elenco.append(riga({ principale: `${formattaData(s.data, 'breve')} ${formattaOra(s.ora)} · ${chi}`, secondaria: riassunto || s.previsto_nota || 'niente di programmato', pallino: riassunto ? 'ok' : 'neutro', onclick: lettura ? null : () => foglioLezione(s, { nota: s.previsto_nota, blocchi: s.blocchi }, ridisegna) }));
  }
  if (!elenco.childElementCount) elenco.append(statoVuoto('Nessuna lezione nei prossimi 14 giorni.'));
  box.append(sezione(`Prossime lezioni · ${imp.programma?.orizzonte_giorni || 14} giorni`, elenco));

  /* ---------- A CHE PUNTO SONO ---------- */
  const quadroBox = el('div', { class: 'elenco' });
  for (const a of quadro?.allievi || []) {
    const forme = quadro.forme.filter((f) => f.allievo_id === a.id).map((f) => {
      const t = tacche({ ...f, sezioni: f.argomenti?.sezioni });
      const dove = f.stato === 'in_apprendimento' && t.totale ? ` · sez. ${Math.min(t.fatte + 1, t.totale)} di ${t.totale}` : f.stato === 'completa' ? ' · completa' : f.stato === 'in_rifinitura' ? ' · in rifinitura' : '';
      return (f.argomenti?.nome || 'forma') + dove;
    });
    const ultime = quadro.resto.filter((r) => r.allievo_id === a.id).slice(0, 3);
    if (!forme.length && !ultime.length) continue;
    quadroBox.append(riga({ principale: nomeDi(a), secondaria: [forme.join(', '), ultime.length ? 'ultime cose: ' + ultime.map((u) => u.nome).join(', ') + (ultime[0].ultima_volta ? ` (${formattaData(ultime[0].ultima_volta, 'numerico')})` : '') : null].filter(Boolean).join(' — '), pallino: forme.length ? 'ok' : 'info', href: `#/allievi/${a.id}/progressi` }));
  }
  if (!quadroBox.childElementCount) quadroBox.append(statoVuoto('Ancora niente.'));
  box.append(sezione('A che punto sono', quadroBox));
}

function foglioMese(corso, mese, pr, ridisegna) {
  const nota = el('textarea', { rows: '4', placeholder: 'es. chiudere la prima sezione del Siu Nim Tao, lavorare sul Pak Sao in coppia, iniziare i calci' }); nota.value = pr?.nota || '';
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => { try { await salvaProgramma({ corsoId: corso.id, mese, nota: nota.value.trim() || null, argomenti: [] }); chiudi(); toast('Salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } });
  const chiudi = apriFoglio(`${corso.nome} · ${corso.citta} · ${formattaMese(mese)}`, el('div', {}, [campo('Cosa vuoi fare questo mese', nota), salva]));
}
