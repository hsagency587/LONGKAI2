/* Longkai — viste/allievo-modulo.js: il modulo dei dati di un allievo (nuovo o modifica), l'abbonamento, il caricamento di un documento. */
import { el } from '../base.js';
import { nuovoAllievo, salvaAllievo, iscrivi, chiudiIscrizione, corsiCompleti, impostazioni, salvaQuota, caricaDocumento } from '../dati.js';
import { toast, avvisa, apriFoglio, vai, statoVuoto } from '../ui.js';
import { validaAllievo, eMinorenne, scadenzaProposta } from '../../comune/allievi.js';
import { oggiRoma, aggiungiGiorni } from '../../comune/date.js';

/** Un campo con l'etichetta sopra (e un aiuto sotto, se serve). */
export function campo(etichetta, controllo, aiuto = null) {
  if (!controllo.id) controllo.id = 'c-' + Math.random().toString(36).slice(2, 8);
  const c = el('div', { class: 'campo' }, [el('label', { for: controllo.id, testo: etichetta }), controllo]);
  if (aiuto) c.append(el('span', { class: 'piccolo attenuato', testo: aiuto }));
  return c;
}
function testo(valore, attr = {}) { return el('input', Object.assign({ type: 'text', autocomplete: 'off' }, attr, { value: valore ?? '' })); }
function interruttore(etichetta, acceso) {
  const i = el('input', { type: 'checkbox' }); i.checked = Boolean(acceso);
  return { controllo: i, riga: el('label', { class: 'interruttore' }, [el('span', { testo: etichetta }), i]) };
}

/* ---------- il modulo dei dati ---------- */
export async function moduloAllievo(box, contesto) {
  const nuovo = !contesto;
  const a = contesto?.a || {};
  const lettura = contesto?.lettura || false;
  const oggi = oggiRoma();
  const [corsi, imp] = await Promise.all([corsiCompleti().catch(() => []), impostazioni().catch(() => ({}))]);
  const impAllievi = imp.allievi || {};
  const sedi = imp.associazione?.sedi || ['Mortara', 'Vigevano'];

  const nome = testo(a.nome, { autocomplete: 'given-name', autocapitalize: 'words' });
  const cognome = testo(a.cognome, { autocomplete: 'family-name', autocapitalize: 'words' });
  const nascita = el('input', { type: 'date', value: a.nascita || '' });
  const citta = testo(a.citta, { list: 'sedi' });
  const listaSedi = el('datalist', { id: 'sedi' }, sedi.map((s) => el('option', { value: s })));
  const email = testo(a.email, { type: 'email', inputmode: 'email', autocomplete: 'off' });
  const telefono = testo(a.telefono, { type: 'tel', inputmode: 'tel' });
  const famiglia = testo(a.famiglia, { placeholder: 'es. fratelli, stesso nucleo' });
  const soprannomi = testo((a.soprannomi || []).join(', '), { placeholder: 'come lo chiama il Sifu, separati da virgola' });
  const note = el('textarea', { rows: '3' }); note.value = a.note || '';
  const tutoreNome = testo(a.tutore_nome, { autocapitalize: 'words' });
  const tutoreTel = testo(a.tutore_telefono, { type: 'tel', inputmode: 'tel' });
  const tutoreEmail = testo(a.tutore_email, { type: 'email', inputmode: 'email' });
  const consenso = interruttore('Ha dato il consenso ai promemoria', a.consenso_promemoria);
  const consensoIl = el('input', { type: 'date', value: a.consenso_promemoria_il || '' });
  const consensoCome = el('select', {}, [['', '—'], ['foglio', 'Foglio firmato'], ['email', 'Email'], ['voce', 'A voce']].map(([v, t]) => el('option', { value: v, testo: t })));
  consensoCome.value = a.consenso_promemoria_come || '';
  const stato = el('select', {}, [['attivo', 'Attivo'], ['sospeso', 'Sospeso']].map(([v, t]) => el('option', { value: v, testo: t })));
  stato.value = a.stato === 'sospeso' ? 'sospeso' : 'attivo';
  const errori = el('p', { class: 'errore-campo', role: 'alert' });

  // i corsi: una spunta per corso; l'iscrizione parte da oggi
  const iscrizioniAttive = (contesto?.d?.iscrizioni || []).filter((i) => !i.al || i.al >= oggi);
  const spunteCorsi = corsi.filter((c) => c.attivo || iscrizioniAttive.some((i) => i.corso_id === c.id)).map((c) => {
    const i = interruttore(`${c.nome} · ${c.citta}`, iscrizioniAttive.some((x) => x.corso_id === c.id));
    i.corso = c; return i;
  });

  const bloccoTutore = el('div', { class: 'blocco' }, [campo('Nome del tutore', tutoreNome), campo('Telefono del tutore', tutoreTel), campo('Email del tutore', tutoreEmail)]);
  const aggiornaTutore = () => { bloccoTutore.classList.toggle('nascosto', !(eMinorenne(nascita.value, oggi) || tutoreNome.value || tutoreTel.value)); };
  nascita.addEventListener('change', aggiornaTutore);

  const form = el('form', { novalidate: true }, [
    el('div', { class: 'griglia-campi' }, [campo('Nome', nome), campo('Cognome', cognome), campo('Data di nascita', nascita), campo('Città', citta), listaSedi, campo('Telefono', telefono), campo('Email', email)]),
    bloccoTutore,
    el('h3', { class: 'titolo-blocco', testo: 'Corsi' }),
    el('div', { class: 'blocco' }, spunteCorsi.length ? spunteCorsi.map((s) => s.riga) : [statoVuoto('Nessun corso attivo: si creano da Altro → Corsi.')]),
    el('h3', { class: 'titolo-blocco', testo: 'Promemoria' }),
    el('div', { class: 'blocco' }, [consenso.riga, el('div', { class: 'griglia-campi' }, [campo('Dato il', consensoIl), campo('Come', consensoCome)])]),
    el('h3', { class: 'titolo-blocco', testo: 'Altro' }),
    el('div', { class: 'griglia-campi' }, [campo('Soprannomi', soprannomi, 'Servono alla dettatura: “il Du” → la sua scheda.'), campo('Famiglia', famiglia), nuovo ? null : campo('Stato', stato)]),
    campo('Note', note),
    errori,
  ]);
  const salva = el('button', { class: 'tasto pieno grande', type: 'submit', 'data-scrittura': '', testo: nuovo ? 'Aggiungi' : 'Salva' });
  if (!lettura) form.append(salva);
  else form.querySelectorAll('input, select, textarea').forEach((x) => { x.disabled = true; });
  box.append(form);
  aggiornaTutore();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errori.textContent = '';
    const dati = {
      nome: nome.value.trim(), cognome: cognome.value.trim(), nascita: nascita.value || null, citta: citta.value.trim() || null,
      email: email.value.trim() || null, telefono: telefono.value.trim() || null, famiglia: famiglia.value.trim() || null,
      soprannomi: soprannomi.value.split(',').map((x) => x.trim()).filter(Boolean), note: note.value.trim() || null,
      tutore_nome: tutoreNome.value.trim() || null, tutore_telefono: tutoreTel.value.trim() || null, tutore_email: tutoreEmail.value.trim() || null,
      consenso_promemoria: consenso.controllo.checked, consenso_promemoria_il: consenso.controllo.checked ? (consensoIl.value || oggi) : null, consenso_promemoria_come: consenso.controllo.checked ? (consensoCome.value || null) : null,
    };
    if (!nuovo) dati.stato = stato.value;
    const v = validaAllievo(dati, { oggi, tutoreObbligatorio: impAllievi.tutore_sotto_18 !== false });
    if (Object.keys(v.errori).length) { errori.textContent = Object.values(v.errori).join(' '); return; }
    dati.da_completare = v.daCompletare;
    salva.disabled = true;
    try {
      let id = contesto?.id;
      if (nuovo) id = await nuovoAllievo(dati);
      else await salvaAllievo(id, dati, a.aggiornato_il);
      // iscrizioni: le spunte nuove aprono, quelle tolte chiudono a oggi
      for (const s of spunteCorsi) {
        const era = iscrizioniAttive.find((i) => i.corso_id === s.corso.id);
        if (s.controllo.checked && !era) await iscrivi(id, s.corso.id, oggi);
        if (!s.controllo.checked && era) await chiudiIscrizione(era.id, aggiungiGiorni(oggi, -1) < era.dal ? era.dal : oggi);
      }
      const manca = v.mancaTutore ? 'manca il tutore' : !dati.cognome ? 'manca il cognome' : !dati.nascita ? 'manca la data di nascita' : null;
      toast(v.daCompletare && manca ? `Salvato. La scheda resta da completare: ${manca}.` : nuovo ? 'Allievo aggiunto.' : 'Salvato.');
      vai(`allievi/${id}`);
    } catch (err) {
      errori.textContent = err.message || 'Non sono riuscito a salvare.';
    } finally { salva.disabled = false; }
  });
}

/* ---------- la quota: quanto paga, ogni quanto, quando ha pagato l'ultima volta ---------- */
export const PERIODI = [['mensile', 'ogni mese'], ['trimestrale', 'ogni 3 mesi'], ['annuale', 'ogni anno']];
export function foglioQuota(allievoId, attuale, ridisegna) {
  const oggi = oggiRoma();
  const quanto = el('input', { type: 'number', step: '0.01', min: '0', inputmode: 'decimal', value: attuale ? String(attuale.importo_cent / 100) : '' });
  const ogni = el('select', {}, PERIODI.map(([v, t]) => el('option', { value: v, testo: t })));
  ogni.value = attuale?.tipo || 'mensile';
  const ultimo = el('input', { type: 'date', value: oggi, max: oggi });
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Salva', onclick: async () => {
    errore.textContent = '';
    const cent = Math.round(parseFloat(String(quanto.value).replace(',', '.')) * 100);
    if (!(cent > 0)) { errore.textContent = 'Quanto paga?'; return; }
    salva.disabled = true;
    try { await salvaQuota(allievoId, { importoCent: cent, tipo: ogni.value, ultimoPagamento: attuale ? null : (ultimo.value || oggi), attuale }); chiudi(); toast('Quota salvata.'); ridisegna(); }
    catch (e) { errore.textContent = e.message || 'Non sono riuscito a salvare.'; salva.disabled = false; }
  } });
  const chiudi = apriFoglio(attuale ? 'Cambia la quota' : 'La quota', el('div', {}, [
    el('div', { class: 'griglia-campi' }, [campo('Paga (€)', quanto), campo('Ogni', ogni)]),
    attuale ? null : campo('Ultimo pagamento', ultimo),
    errore, salva,
  ]));
}

/* ---------- il caricamento di un documento ---------- */
export function foglioCaricaDocumento(allievoId, impScadenze, ridisegna, tipoIniziale = 'certificato') {
  const oggi = oggiRoma();
  const file = el('input', { type: 'file', accept: 'application/pdf,image/jpeg,image/png' });
  const tipo = el('select', {}, [['certificato', 'Certificato medico'], ['tesseramento', 'Tesseramento'], ['altro', 'Altro']].map(([v, t]) => el('option', { value: v, testo: t })));
  tipo.value = tipoIniziale;
  const data = el('input', { type: 'date', value: oggi });
  const scadenza = el('input', { type: 'date', value: scadenzaProposta(tipo.value, oggi, impScadenze) || '' });
  const proponi = () => { scadenza.value = scadenzaProposta(tipo.value, data.value || oggi, impScadenze) || ''; };
  tipo.addEventListener('change', proponi); data.addEventListener('change', proponi);
  const stato = el('p', { class: 'piccolo attenuato' });
  const salva = el('button', { class: 'tasto pieno grande', testo: 'Carica', onclick: async () => {
    const f = file.files?.[0];
    if (!f) { avvisa('Scegli un file: PDF o foto.'); return; }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) { avvisa('Solo PDF, JPEG o PNG.'); return; }
    if (f.size > 15 * 1024 * 1024) { avvisa('Il file è troppo grande: al massimo 15 MB.'); return; }
    salva.disabled = true; stato.textContent = 'Sto caricando…';
    try {
      await caricaDocumento(allievoId, f, { tipo: tipo.value, data: data.value || oggi, scadenza: scadenza.value || null });
      chiudi(); toast(scadenza.value ? 'Documento caricato, scadenza aggiornata.' : 'Documento caricato.'); ridisegna();
    } catch (e) { stato.textContent = ''; avvisa(e.message || 'Non sono riuscito a caricare il file.'); } finally { salva.disabled = false; }
  } });
  const chiudi = apriFoglio('Carica un documento', el('div', {}, [campo('File', file), campo('Cosa è', tipo), el('div', { class: 'griglia-campi' }, [campo('Data del documento', data), campo('Scade il', scadenza)]), stato, salva]));
}
