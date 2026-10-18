/* Longkai — viste/rapporti.js: i rapporti mensili. Il riassunto del mese si legge e si corregge qui, prima del PDF; il PDF si genera, si rigenera, si apre. */
import { el, euro } from '../base.js';
import { rapportiMensili, generaRapporto, apriRapporto, salvaRiassunto, soloLettura, impostazioni } from '../dati.js';
import { testata, riga, sezione, scheletri, statoVuoto, toast, avvisa, apriFoglio, chiedi } from '../ui.js';
import { oggiRoma, formattaMese, primoDelMese, aggiungiMesi, formattaData } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';
import { campo } from './allievo-modulo.js';

export async function vistaRapporti(main) {
  const lettura = soloLettura();
  testata('Rapporti', { indietro: 'altro' });
  main.append(scheletri(3));
  const [fatti, imp] = await Promise.all([rapportiMensili(), impostazioni().catch(() => ({}))]);
  main.querySelectorAll('.scheletro').forEach((x) => x.remove());
  const ridisegna = () => { main.replaceChildren(); vistaRapporti(main); };
  const oggi = oggiRoma();
  const questo = primoDelMese(oggi);
  // i mesi: quello in corso (parziale), i passati fino a 12, più quelli già generati
  const mesi = new Set([questo]);
  for (let i = 1; i <= 12; i++) mesi.add(aggiungiMesi(questo, -i));
  for (const f of fatti) mesi.add(f.mese);
  const elenco = el('div', { class: 'elenco' });
  for (const m of [...mesi].sort().reverse()) {
    const f = fatti.find((x) => x.mese === m);
    const t = f?.totali || {};
    const sec = f ? [f.generato_il ? 'PDF del ' + formattaData(String(f.generato_il).slice(0, 10), 'numerico') : 'senza PDF', t.lezioni != null ? `${t.lezioni} lezioni · ${t.presenze} presenze` : null, f.riassunto ? (f.riassunto_corretto_il ? 'riassunto corretto' : 'riassunto da leggere') : 'senza riassunto'].filter(Boolean).join(' · ') : (m === questo ? 'mese in corso: si può generare parziale' : 'non ancora generato');
    elenco.append(riga({ principale: formattaMese(m) + (m === questo ? ' (in corso)' : ''), secondaria: sec, pallino: f?.pdf_percorso ? (f.riassunto_corretto_il ? 'ok' : 'attenzione') : 'neutro', onclick: () => foglioMese(m, f, lettura, imp, ridisegna) }));
  }
  main.append(el('p', { class: 'attenuato', testo: `Il rapporto del mese esce da solo il giorno ${imp.rapporti?.giorno || 1}. Qui lo leggi, correggi il riassunto, rigeneri il PDF.` }), elenco);
}

function foglioMese(mese, f, lettura, imp, ridisegna) {
  const t = f?.totali || null;
  const riassunto = el('textarea', { rows: '8', placeholder: 'Il riassunto del mese: lo scrive Claude dai dati veri, tu lo correggi come vuoi.' });
  riassunto.value = f?.riassunto || '';
  if (lettura) riassunto.disabled = true;
  const stato = el('p', { class: 'piccolo attenuato' });
  const apri = async (percorso) => {
    const w = globalThis.open('', '_blank');
    try { const url = await apriRapporto(percorso); if (w) w.location.replace(url); else location.assign(url); }
    catch (e) { if (w) w.close(); avvisa(e.message || 'Non riesco ad aprire il PDF.'); }
  };
  const genera = async (rigeneraRiassunto) => {
    stato.textContent = 'Sto preparando il PDF… (qualche secondo)';
    try {
      if (!lettura && riassunto.value.trim() !== (f?.riassunto || '') && !rigeneraRiassunto) await salvaRiassunto(mese, riassunto.value.trim() || null);
      const r = await generaRapporto(mese, rigeneraRiassunto);
      stato.textContent = '';
      if (r.riassunto && rigeneraRiassunto) riassunto.value = r.riassunto;
      toast('PDF pronto.');
      const w = globalThis.open(r.url, '_blank');
      if (!w) location.assign(r.url);
      ridisegna();
    } catch (e) { stato.textContent = ''; avvisa(e.message || 'Non sono riuscito a fare il PDF.'); }
  };
  const figli = [];
  if (t) figli.push(el('div', { class: 'blocco' }, [el('div', { class: 'secondaria attenuato', testo: [`${t.lezioni} lezioni`, `${t.private} private`, `${t.presenze} presenze`, formattaMinuti(t.minuti || 0), `${t.allievi_attivi} attivi`, imp.rapporti?.includi_importi !== false ? `incassato ${euro(t.incassato_cent)}` : null].filter(Boolean).join(' · ') })]));
  figli.push(campo('Riassunto del mese', riassunto, lettura ? null : 'Scrivilo o correggilo come lo racconteresti tu. Poi “Rigenera il PDF”.'));
  if (!lettura) {
    figli.push(el('div', { class: 'tasti' }, [
      el('button', { class: 'tasto pieno', testo: f?.pdf_percorso ? 'Rigenera il PDF' : 'Genera il PDF', onclick: () => genera(false) }),
      el('button', { class: 'tasto bordo', testo: 'Riscrivi il riassunto con Claude', onclick: async () => { const ok = await chiedi('Riscrivere il riassunto?', 'Claude lo riscrive dai dati del mese e sostituisce il testo attuale. Poi lo correggi di nuovo se vuoi.', [{ testo: 'Riscrivi', valore: true, classe: 'pieno' }, { testo: 'Lascia', valore: false }]); if (ok) genera(true); } }),
      el('button', { class: 'tasto', testo: 'Salva solo il riassunto', onclick: async () => { try { await salvaRiassunto(mese, riassunto.value.trim() || null); toast('Riassunto salvato.'); ridisegna(); } catch (e) { avvisa(e.message); } } }),
    ]));
  }
  if (f?.pdf_percorso) figli.push(el('button', { class: 'tasto bordo', testo: 'Apri il PDF', onclick: () => apri(f.pdf_percorso) }));
  figli.push(stato);
  const chiudi = apriFoglio(formattaMese(mese), el('div', {}, figli));
  void chiudi; void sezione; void statoVuoto;
}
