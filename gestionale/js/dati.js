/* Longkai — dati.js: l'unico file che parla con Supabase e con la memoria del telefono.
   Le viste chiedono a lui. Le regole per riga stanno sul server: qui non si filtra "per sicurezza", si chiede e basta. */

let client = null;
let profiloCorrente = null;
const CHIAVE_LOCALE = 'longkai.locale';

export function configurato() {
  const c = globalThis.CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

export function sb() {
  if (client) return client;
  if (!configurato()) throw new Error('progetto non configurato');
  const lib = globalThis.supabase;
  if (!lib) throw new Error('Un file dell\'app non si è caricato (vendor/supabase.js). Ricarica la pagina.');
  client = lib.createClient(globalThis.CONFIG.supabaseUrl, globalThis.CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/* ---------- la memoria del telefono: preferenze e coda ---------- */
export function leggiLocale() {
  try { return Object.assign({ tema: null, testo: 'normale', coda: [], ultimaVista: null, passaggiGuida: 0 }, JSON.parse(localStorage.getItem(CHIAVE_LOCALE) || '{}')); }
  catch { return { tema: null, testo: 'normale', coda: [], ultimaVista: null, passaggiGuida: 0 }; }
}
export function salvaLocale(loc) {
  try { localStorage.setItem(CHIAVE_LOCALE, JSON.stringify(loc)); } catch { /* memoria piena o bloccata: si va avanti */ }
}
export function svuotaLocale() {
  try { localStorage.removeItem(CHIAVE_LOCALE); } catch { /* niente */ }
}

/* ---------- accesso ---------- */
export async function sessione() {
  if (!configurato()) return null;
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session;
  // Senza rete il gettone scaduto non si può rinnovare: si resta dentro con la sessione salvata sul telefono
  // (la password non si chiede a ogni apertura) e si rinnova da soli appena la rete torna.
  if (!navigator.onLine) return sessioneSalvata();
  return null;
}
function sessioneSalvata() {
  try {
    const ref = new URL(globalThis.CONFIG.supabaseUrl).hostname.split('.')[0];
    const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null');
    return s?.user && s?.refresh_token ? s : null;
  } catch { return null; }
}
export async function accedi(email, password) {
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  profiloCorrente = null;
  return data.session;
}
export async function passwordDimenticata(email) {
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}
export async function aggiornaPassword(password) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
}
/** Il codice del link "scegli la password" (mandato a mano, es. su WhatsApp) apre la sessione: solo quando lo si usa, mai in anteprima. */
export async function entraConCodice(codice) {
  const { data, error } = await sb().auth.verifyOtp({ token_hash: codice, type: 'recovery' });
  if (error) throw error;
  profiloCorrente = null;
  return data.session;
}
export async function esci() {
  // 'local' chiude la sessione su questo dispositivo anche senza rete. La libreria toglie la sessione locale
  // anche quando il server risponde con un errore: quindi prima si pulisce qui, poi si riferisce l'errore.
  const { error } = await sb().auth.signOut({ scope: 'local' });
  profiloCorrente = null;
  const loc = leggiLocale();
  svuotaLocale();
  salvaLocale({ tema: loc.tema, testo: loc.testo }); // tema e grandezza del testo sono del telefono, non dell'account
  if (error) throw error;
}
export function suCambioAccesso(fn) {
  if (!configurato()) return;
  sb().auth.onAuthStateChange((evento, s) => { if (evento === 'SIGNED_OUT') profiloCorrente = null; fn(evento, s); });
}

/** Il profilo di chi è dentro: { id, nome, ruolo, attivo }. */
export async function profilo(forza = false) {
  if (profiloCorrente && !forza) return profiloCorrente;
  const s = await sessione();
  if (!s) return null;
  const { data, error } = await sb().from('profili').select('id, nome, email, ruolo, attivo').eq('id', s.user.id).maybeSingle();
  if (error) throw error;
  profiloCorrente = data;
  return data;
}
export function soloLettura() { return profiloCorrente?.ruolo === 'osservatore'; }

/* ---------- impostazioni ---------- */
export async function impostazioni() {
  const { data, error } = await sb().from('impostazioni').select('valori, aggiornato_il').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.valori || {};
}
export async function salvaImpostazioni(valori) {
  const { error } = await sb().from('impostazioni').update({ valori }).eq('id', 1);
  if (error) throw error;
}

/* ---------- letture di fase 0 ---------- */
export async function corsoDelGiorno(data) {
  const { data: righe, error } = await sb().from('v_corso_del_giorno').select('*').eq('data', data).limit(1);
  if (error) throw error;
  return righe?.[0] || null;
}
export async function privateDelGiorno(data) {
  const { data: righe, error } = await sb().from('sessioni').select('id, ora, durata_minuti, stato, stato_revisione, allievo_id, allievi(nome, cognome)').eq('tipo', 'privata').eq('data', data).neq('stato', 'annullata').order('ora');
  if (error) throw error;
  return righe || [];
}
export async function contiDaFare() {
  const [saldi, richiamare, incompleti] = await Promise.all([
    sb().from('v_saldo_allievo').select('allievo_id, da_pagare_cent').gt('da_pagare_cent', 0),
    sb().from('v_da_richiamare').select('allievo_id'),
    sb().from('allievi').select('id').eq('da_completare', true).eq('stato', 'attivo'),
  ]);
  // un errore non è "zero": si dice, non si mostra "Niente da fare"
  const guasto = saldi.error || richiamare.error || incompleti.error;
  if (guasto) throw guasto;
  return {
    quote: saldi.data?.length || 0,
    quoteCent: (saldi.data || []).reduce((t, r) => t + (r.da_pagare_cent || 0), 0),
    daRichiamare: richiamare.data?.length || 0,
    daCompletare: incompleti.data?.length || 0,
  };
}
export async function contiScadenze() {
  const { data, error } = await sb().from('v_scadenze').select('giorni_mancanti');
  if (error) throw error;
  const g = (data || []).map((r) => r.giorni_mancanti);
  return { scadute: g.filter((x) => x < 0).length, entro7: g.filter((x) => x >= 0 && x <= 7).length, entro30: g.filter((x) => x >= 0 && x <= 30).length };
}
export async function elencoAllievi() {
  const { data, error } = await sb().from('allievi').select('id, nome, cognome, stato, citta, da_completare').neq('stato', 'uscito').order('cognome').order('nome');
  if (error) throw error;
  return data || [];
}
export async function corsi() {
  const { data, error } = await sb().from('corsi').select('id, nome, citta, durata_minuti, attivo, corsi_orari(giorno, ora)').order('ordine');
  if (error) throw error;
  return data || [];
}

/* ---------- funzioni server ---------- */
export async function chiamaFunzione(nome, corpo = {}) {
  const { data, error } = await sb().functions.invoke(nome, { body: corpo, headers: { 'x-region': globalThis.CONFIG.regioneAttesa || 'eu-central-1' } });
  if (error) {
    let dettaglio = null;
    try { dettaglio = await error.context?.json?.(); } catch { /* niente */ }
    const e = new Error(dettaglio?.messaggio || error.message || 'Errore del server');
    e.codice = dettaglio?.errore || 'servizio';
    throw e;
  }
  return data;
}
export const salute = () => chiamaFunzione('salute');
export const segnala = (dati) => chiamaFunzione('segnala', dati);

/* ============================================================
   FASE 1 — allievi, documenti, scadenze, cassetta, corsi, argomenti, tariffe, impostazioni
   ============================================================ */

function controlla(...risposte) { for (const r of risposte) if (r.error) throw r.error; }
function oggi() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export class ErroreConflitto extends Error { constructor() { super('Qualcun altro ha modificato questa scheda nel frattempo: ricarica e riprova.'); this.name = 'ErroreConflitto'; } }
function nomeFileSicuro(nome) {
  return String(nome || 'file').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}
function idNuovo() { return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

/* ---------- allievi ---------- */
export async function elencoAllieviCompleto() {
  const r = await sb().from('v_allievi_elenco').select('*').order('cognome').order('nome');
  controlla(r);
  return r.data || [];
}
export async function allievoCompleto(id) {
  const [a, isc, abb, doc, sc, saldo] = await Promise.all([
    sb().from('allievi').select('*').eq('id', id).maybeSingle(),
    sb().from('iscrizioni').select('id, corso_id, dal, al, corsi(nome, citta)').eq('allievo_id', id).order('dal'),
    sb().from('abbonamenti').select('id, tariffa_id, dal, al, rinnovo_automatico, importo_personalizzato_cent, lezioni_rimanenti, nota, tariffe(nome, importo_cent, tipo)').eq('allievo_id', id).order('dal', { ascending: false }),
    sb().from('documenti').select('id, tipo, nome, dimensione, mime, data, scadenza, creato_il').eq('allievo_id', id).order('data', { ascending: false }),
    sb().from('scadenze').select('id, tipo, data, stato, documento_id').eq('allievo_id', id).order('data'),
    sb().from('v_saldo_allievo').select('*').eq('allievo_id', id).maybeSingle(),
  ]);
  controlla(a, isc, abb, doc, sc, saldo);
  return { allievo: a.data, iscrizioni: isc.data || [], abbonamenti: abb.data || [], documenti: doc.data || [], scadenze: sc.data || [], saldo: saldo.data };
}
export async function nuovoAllievo(dati) {
  const r = await sb().from('allievi').insert(dati).select('id').single();
  controlla(r);
  return r.data.id;
}
/** Salva con il blocco ottimistico: se la riga è cambiata dopo la lettura, non scrive e lo dice. */
export async function salvaAllievo(id, dati, aggiornatoIl) {
  let q = sb().from('allievi').update(dati).eq('id', id);
  if (aggiornatoIl) q = q.eq('aggiornato_il', aggiornatoIl);
  const r = await q.select('aggiornato_il');
  controlla(r);
  if (!r.data?.length) throw new ErroreConflitto();
  return r.data[0].aggiornato_il;
}
export async function cambiaStatoAllievo(id, stato) {
  const r = await sb().from('allievi').update({ stato, uscito_il: stato === 'uscito' ? oggi() : null }).eq('id', id).select('id');
  controlla(r);
}
export async function iscrivi(allievoId, corsoId, dal = oggi()) {
  const r = await sb().from('iscrizioni').insert({ allievo_id: allievoId, corso_id: corsoId, dal }).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function chiudiIscrizione(id, al = oggi()) {
  const r = await sb().from('iscrizioni').update({ al }).eq('id', id).select('id');
  controlla(r);
}
export async function salvaAbbonamento(allievoId, dati, idEsistente = null) {
  const corpo = { allievo_id: allievoId, tariffa_id: dati.tariffa_id, dal: dati.dal, al: dati.al || null, rinnovo_automatico: dati.rinnovo_automatico !== false, importo_personalizzato_cent: dati.importo_personalizzato_cent ?? null, nota: dati.nota || null };
  const r = idEsistente ? await sb().from('abbonamenti').update(corpo).eq('id', idEsistente).select('id').single() : await sb().from('abbonamenti').insert(corpo).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function chiudiAbbonamento(id, al = oggi()) {
  const r = await sb().from('abbonamenti').update({ al, rinnovo_automatico: false }).eq('id', id).select('id');
  controlla(r);
}
export async function mettiFuori(id, data = oggi()) {
  const r = await sb().rpc('metti_fuori_allievo', { p_allievo: id, p_data: data });
  controlla(r);
  return r.data; // il saldo che resta, in centesimi
}
export async function esportaAllievo(id) {
  const r = await sb().rpc('esporta_allievo', { p_allievo: id });
  controlla(r);
  return r.data;
}
export async function unisciAllievi(tieni, togli) {
  const r = await sb().rpc('unisci_allievi', { p_tieni: tieni, p_togli: togli });
  controlla(r);
}
export async function eliminaAllievo(id) {
  const r = await sb().rpc('elimina_allievo', { p_allievo: id });
  controlla(r);
}
/** Importa gli allievi da un CSV già letto: inserisce le schede e, se il corso è riconosciuto, l'iscrizione. */
export async function importaAllievi(allievi, corsiDisponibili) {
  let inseriti = 0; let iscritti = 0;
  for (const a of allievi) {
    const { corso, ...dati } = a;
    dati.da_completare = !dati.cognome || !dati.nascita;
    const r = await sb().from('allievi').insert(dati).select('id').single();
    controlla(r);
    inseriti++;
    const c = corso ? (corsiDisponibili || []).find((x) => x.nome.toLowerCase() === corso.toLowerCase() || x.citta.toLowerCase() === corso.toLowerCase()) : null;
    if (c) { await iscrivi(r.data.id, c.id); iscritti++; }
  }
  return { inseriti, iscritti };
}

/* ---------- documenti e scadenze ---------- */
export async function caricaDocumento(allievoId, file, { tipo, data, scadenza }) {
  const percorso = `allievi/${allievoId}/${idNuovo()}-${nomeFileSicuro(file.name)}`;
  const { error } = await sb().storage.from('documenti').upload(percorso, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  const r = await sb().rpc('carica_documento', { p_allievo: allievoId, p_tipo: tipo, p_percorso: percorso, p_nome: String(file.name).slice(0, 120), p_dimensione: file.size, p_mime: file.type, p_data: data, p_scadenza: scadenza || null });
  controlla(r);
  return r.data;
}
export async function apriDocumento(id) {
  const r = await chiamaFunzione('apri-documento', { documento_id: id });
  return r.url;
}
export async function spostaDocumento(documentoId, allievoId) {
  const r1 = await sb().from('documenti').update({ allievo_id: allievoId }).eq('id', documentoId).select('id');
  const r2 = await sb().from('scadenze').update({ allievo_id: allievoId }).eq('documento_id', documentoId).select('id');
  controlla(r1, r2);
}
export async function rinnovaScadenza(allievoId, tipo, data) {
  const r = await sb().rpc('rinnova_scadenza', { p_allievo: allievoId, p_tipo: tipo, p_data: data });
  controlla(r);
  return r.data;
}
export async function annullaScadenza(id) {
  const r = await sb().from('scadenze').update({ stato: 'annullata' }).eq('id', id).select('id');
  controlla(r);
}
export async function scadenzeAperte() {
  const r = await sb().from('scadenze').select('id, tipo, data, stato, allievo_id, allievi(nome, cognome, telefono, stato)').eq('stato', 'aperta').order('data');
  controlla(r);
  return (r.data || []).filter((s) => s.allievi && s.allievi.stato !== 'uscito');
}

/* ---------- cassetta ---------- */
export async function cassettaElenco() {
  const r = await sb().from('cassetta').select('id, nome, mime, dimensione, arrivato_il, fonte, stato, allievo_id, documento_id, allievi(nome, cognome)').order('arrivato_il', { ascending: false }).limit(100);
  controlla(r);
  return r.data || [];
}
export async function mettiInCassetta(file) {
  const percorso = `cassetta/${idNuovo()}-${nomeFileSicuro(file.name)}`;
  const { error } = await sb().storage.from('documenti').upload(percorso, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  const r = await sb().from('cassetta').insert({ percorso, nome: String(file.name).slice(0, 120), mime: file.type, dimensione: file.size, fonte: 'app' }).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function smistaCassetta(id, allievoId, tipo, data, scadenza) {
  const r = await sb().rpc('smista_cassetta', { p_cassetta: id, p_allievo: allievoId, p_tipo: tipo, p_data: data, p_scadenza: scadenza || null });
  controlla(r);
  return r.data;
}
export async function scartaCassetta(id) {
  const r = await sb().from('cassetta').update({ stato: 'scartato' }).eq('id', id).select('id');
  controlla(r);
}
export async function apriCassetta(id) {
  const r = await chiamaFunzione('apri-documento', { cassetta_id: id });
  return r.url;
}

/* ---------- corsi ---------- */
export async function corsiCompleti() {
  const r = await sb().from('corsi').select('id, nome, citta, durata_minuti, attivo, sospeso_dal, sospeso_al, ordine, aggiornato_il, corsi_orari(id, giorno, ora)').order('ordine');
  controlla(r);
  return r.data || [];
}
/** Salva un corso e i suoi orari (giorno + ora): toglie quelli spariti, aggiunge i nuovi, aggiorna le ore cambiate. */
export async function salvaCorso(id, dati, orari) {
  let corsoId = id;
  if (corsoId) { const r = await sb().from('corsi').update(dati).eq('id', corsoId).select('id'); controlla(r); if (!r.data?.length) throw new Error('corso non trovato'); }
  else { const r = await sb().from('corsi').insert(dati).select('id').single(); controlla(r); corsoId = r.data.id; }
  const esistenti = await sb().from('corsi_orari').select('id, giorno, ora').eq('corso_id', corsoId);
  controlla(esistenti);
  const vecchi = esistenti.data || [];
  for (const v of vecchi) {
    const n = orari.find((o) => o.giorno === v.giorno);
    if (!n) { const r = await sb().from('corsi_orari').delete().eq('id', v.id); controlla(r); }
    else if (n.ora !== String(v.ora).slice(0, 5)) { const r = await sb().from('corsi_orari').update({ ora: n.ora }).eq('id', v.id); controlla(r); }
  }
  for (const n of orari) {
    if (!vecchi.some((v) => v.giorno === n.giorno)) { const r = await sb().from('corsi_orari').insert({ corso_id: corsoId, giorno: n.giorno, ora: n.ora }); controlla(r); }
  }
  return corsoId;
}

/* ---------- argomenti ---------- */
export async function argomentiTutti() {
  const r = await sb().from('argomenti').select('id, area, nome, sinonimi, pronunce, sezioni, attivo, ordine, aggiornato_il').order('area').order('ordine').order('nome');
  controlla(r);
  return r.data || [];
}
/** Salva un argomento e scrive la versione (prima → dopo) nella cronologia delle correzioni. */
export async function salvaArgomento(id, dati, prima = null, testoDetto = null) {
  let argId = id;
  if (argId) { const r = await sb().from('argomenti').update(dati).eq('id', argId).select('id'); controlla(r); if (!r.data?.length) throw new Error('argomento non trovato'); }
  else { const r = await sb().from('argomenti').insert(dati).select('id').single(); controlla(r); argId = r.data.id; }
  const s = await sessione();
  const v = await sb().from('argomenti_versioni').insert({ argomento_id: argId, prima, dopo: dati, testo_detto: testoDetto, profilo_id: s?.user?.id || null });
  controlla(v);
  return argId;
}

/* ---------- tariffe ---------- */
export async function tariffeTutte() {
  const r = await sb().from('tariffe').select('id, nome, importo_cent, tipo, n_lezioni, comprende_private, comprende_extra, attiva, ordine').order('ordine').order('nome');
  controlla(r);
  return r.data || [];
}
export async function salvaTariffa(id, dati) {
  const r = id ? await sb().from('tariffe').update(dati).eq('id', id).select('id').single() : await sb().from('tariffe').insert(dati).select('id').single();
  controlla(r);
  return r.data.id;
}

/* ============================================================
   FASE 2 — sessioni, private, progressi, diario, programma
   ============================================================ */
export async function sessioniDelGiorno(data) {
  const r = await sb().from('v_sessioni_diario').select('*').eq('data', data).neq('stato', 'annullata').order('ora');
  controlla(r);
  return r.data || [];
}
export async function sessioneCompleta(id) {
  const s = await sb().from('v_sessioni_diario').select('*').eq('id', id).maybeSingle();
  controlla(s);
  if (!s.data) return null;
  const [pres, cont, oss, forme, pag, prog, prossima] = await Promise.all([
    sb().from('presenze').select('allievo_id, minuti, tipo, origine, allievi(nome, cognome, soprannomi)').eq('sessione_id', id),
    sb().from('contenuti').select('id, allievo_id, nota, contenuti_argomenti(argomento_id)').eq('sessione_id', id),
    sb().from('osservazioni').select('allievo_id, testo').eq('sessione_id', id),
    sb().from('forme_storia').select('allievo_id, forma_id, a_stato, a_sezione').eq('sessione_id', id),
    sb().from('pagamenti').select('id, allievo_id, importo_cent, metodo, nota, creato_il').eq('sessione_id', id).is('annullato_il', null).order('creato_il'),
    sb().from('programma').select('id, nota, programma_argomenti(argomento_id, ordine, fatto_il)').eq('sessione_id', id).maybeSingle(),
    s.data.corso_id ? sb().from('sessioni').select('id, data, ora').eq('corso_id', s.data.corso_id).eq('tipo', 'corso').eq('stato', 'prevista').gt('data', s.data.data).order('data').limit(1) : Promise.resolve({ data: [] }),
  ]);
  controlla(pres, cont, oss, forme, pag, prog, prossima);
  let programmaProssima = null;
  if (prossima.data?.[0]) {
    const p = await sb().from('programma').select('id, nota, programma_argomenti(argomento_id, ordine, fatto_il)').eq('sessione_id', prossima.data[0].id).maybeSingle();
    controlla(p);
    programmaProssima = p.data;
  }
  return { sessione: s.data, presenze: pres.data || [], contenuti: cont.data || [], osservazioni: oss.data || [], forme: forme.data || [], pagamenti: pag.data || [], programma: prog.data, prossima: prossima.data?.[0] || null, programmaProssima };
}
export async function attesiSessione(id) {
  const r = await sb().rpc('attesi_sessione', { p_sessione: id });
  controlla(r);
  return r.data || [];
}
export async function allieviAttivi() {
  const r = await sb().from('allievi').select('id, nome, cognome, soprannomi, stato').neq('stato', 'uscito').order('cognome').order('nome');
  controlla(r);
  return r.data || [];
}
let cacheArgomenti = { quando: 0, dati: [] };
export async function argomentiAttivi(forza = false) {
  if (!forza && cacheArgomenti.dati.length && Date.now() - cacheArgomenti.quando < 300000) return cacheArgomenti.dati;
  const r = await sb().from('argomenti').select('id, area, nome, sezioni, sinonimi, pronunce, ordine').eq('attivo', true).order('area').order('ordine').order('nome');
  controlla(r);
  cacheArgomenti = { quando: Date.now(), dati: r.data || [] };
  return cacheArgomenti.dati;
}
export async function confermaSessione(lavoroId, sessioneId, dati, aggiornatoIl = null) {
  const r = await sb().rpc('conferma_sessione', { p_lavoro_id: lavoroId, p_sessione: sessioneId, p_dati: dati, p_aggiornato_il: aggiornatoIl });
  if (r.error) { if (r.error.code === 'P0002') throw new ErroreConflitto(); throw r.error; }
  return r.data;
}
export async function saltaSessione(id, motivo = null) { const r = await sb().rpc('salta_sessione', { p_sessione: id, p_motivo: motivo }); controlla(r); }
export async function riapriSessione(id) { const r = await sb().rpc('riapri_sessione', { p_sessione: id }); controlla(r); }
export async function annullaSessione(id, perche = null, serie = false) { const r = await sb().rpc('annulla_sessione', { p_sessione: id, p_perche: perche, p_serie: serie }); controlla(r); return r.data; }
export async function spostaSessione(id, { data, ora, durata_minuti }) {
  const r = await sb().from('sessioni').update({ data, ora, durata_minuti }).eq('id', id).eq('stato', 'prevista').select('id');
  controlla(r);
  if (!r.data?.length) throw new Error('si sposta solo una sessione ancora da fare');
}
export async function creaStraordinaria(corsoId, data, ora, minuti, nota = null) {
  const r = await sb().from('sessioni').insert({ tipo: 'straordinaria', corso_id: corsoId, data, ora, durata_minuti: minuti, nota }).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function creaPrivate({ allievoId, data, ora, minuti = 60, settimane = 1, nota = null }) {
  const r = await sb().rpc('crea_serie_private', { p_allievo: allievoId, p_data: data, p_ora: ora, p_minuti: minuti, p_settimane: settimane, p_nota: nota });
  controlla(r);
  return r.data;
}
export async function apriGiornata(data) { const r = await sb().rpc('apri_giornata', { p_data: data }); controlla(r); return r.data; }
export async function chiudiGiornata(data) { const r = await sb().rpc('chiudi_giornata', { p_data: data }); controlla(r); }
export async function giornata(data) { const r = await sb().from('giornate').select('id, data, stato, chiusa_il').eq('data', data).maybeSingle(); controlla(r); return r.data; }
export async function sessioniAperteIeri(oggiStr, giorniIndietro = 7) {
  const dal = new Date(Date.parse(oggiStr) - giorniIndietro * 86400000).toISOString().slice(0, 10);
  const r = await sb().from('v_sessioni_diario').select('id, tipo, data, ora, corso_nome, allievo_nome, allievo_cognome').lt('data', oggiStr).gte('data', dal).eq('stato', 'prevista').order('data', { ascending: false });
  controlla(r);
  return r.data || [];
}
export async function nuovoAllievoVeloce(nome, cognome = '') {
  const r = await sb().from('allievi').insert({ nome, cognome, da_completare: true }).select('id, nome, cognome, soprannomi, stato').single();
  controlla(r);
  return r.data;
}
export async function ultimoContenutoCorso(corsoId, primaDi) {
  const s = await sb().from('sessioni').select('id, data').eq('corso_id', corsoId).eq('stato', 'fatta').lt('data', primaDi).order('data', { ascending: false }).limit(1);
  controlla(s);
  if (!s.data?.length) return null;
  const c = await sb().from('contenuti').select('nota, contenuti_argomenti(argomento_id)').eq('sessione_id', s.data[0].id).is('allievo_id', null).maybeSingle();
  controlla(c);
  return { data: s.data[0].data, argomenti: (c.data?.contenuti_argomenti || []).map((x) => x.argomento_id), nota: c.data?.nota || null };
}

/* ---------- progressi ---------- */
export async function progressiAllievo(id) {
  const [forme, resto, oss, ob, piano, ore] = await Promise.all([
    sb().from('v_progressi_forme').select('*').eq('allievo_id', id),
    sb().from('v_progressi_resto').select('*').eq('allievo_id', id),
    sb().from('osservazioni').select('id, testo, creato_il, sessioni(data, tipo)').eq('allievo_id', id).order('creato_il', { ascending: false }).limit(50),
    sb().from('obiettivi').select('id, nota, stato, aperto_il, raggiunto_il, obiettivi_argomenti(argomento_id)').eq('allievo_id', id).order('aperto_il', { ascending: false }),
    sb().from('piani_personali').select('*').eq('allievo_id', id).eq('stato', 'attivo').maybeSingle(),
    sb().from('v_ore_allievo').select('*').eq('allievo_id', id).order('mese', { ascending: false }),
  ]);
  controlla(forme, resto, oss, ob, piano, ore);
  return { forme: forme.data || [], resto: resto.data || [], osservazioni: oss.data || [], obiettivi: ob.data || [], piano: piano.data, ore: ore.data || [] };
}
export async function aggiornaForma(allievoId, formaId, stato, sezione = 0, nota = null) {
  const r = await sb().rpc('aggiorna_forma', { p_allievo: allievoId, p_forma: formaId, p_stato: stato, p_sezione: sezione, p_nota: nota });
  controlla(r);
}
export async function salvaObiettivo(id, allievoId, nota, argomenti = []) {
  let obId = id;
  if (obId) { const r = await sb().from('obiettivi').update({ nota }).eq('id', obId).select('id'); controlla(r); }
  else { const r = await sb().from('obiettivi').insert({ allievo_id: allievoId, nota }).select('id').single(); controlla(r); obId = r.data.id; }
  const d = await sb().from('obiettivi_argomenti').delete().eq('obiettivo_id', obId); controlla(d);
  if (argomenti.length) { const i = await sb().from('obiettivi_argomenti').insert(argomenti.map((a) => ({ obiettivo_id: obId, argomento_id: a }))); controlla(i); }
  return obId;
}
export async function chiudiObiettivo(id, raggiunto = true) {
  const r = await sb().from('obiettivi').update(raggiunto ? { stato: 'raggiunto', raggiunto_il: oggi() } : { stato: 'aperto', raggiunto_il: null }).eq('id', id).select('id');
  controlla(r);
}
export async function salvaPiano(allievoId, dati) {
  const corpo = { sta_lavorando_su: dati.sta_lavorando_su || [], prossimo_passo_argomenti: dati.prossimo_passo_argomenti || [], prossimo_passo_nota: dati.prossimo_passo_nota || null, obiettivo: dati.obiettivo || null };
  const e = await sb().from('piani_personali').select('id').eq('allievo_id', allievoId).eq('stato', 'attivo').maybeSingle();
  controlla(e);
  const r = e.data ? await sb().from('piani_personali').update(corpo).eq('id', e.data.id).select('id').single() : await sb().from('piani_personali').insert({ allievo_id: allievoId, ...corpo }).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function chiudiPiano(id) { const r = await sb().from('piani_personali').update({ stato: 'chiuso', chiuso_il: oggi() }).eq('id', id).select('id'); controlla(r); }
export async function presenzeAllievo(id) {
  const r = await sb().from('presenze').select('minuti, tipo, sessioni(id, data, ora, tipo, stato, corso_id, corsi(nome, citta))').eq('allievo_id', id);
  controlla(r);
  return (r.data || []).filter((p) => p.sessioni).sort((a, b) => (b.sessioni.data + (b.sessioni.ora || '')).localeCompare(a.sessioni.data + (a.sessioni.ora || '')));
}

/* ---------- diario e programma ---------- */
export async function diario(dal, al) {
  const r = await sb().from('v_sessioni_diario').select('*').gte('data', dal).lte('data', al).order('data', { ascending: false }).order('ora', { ascending: false });
  controlla(r);
  return r.data || [];
}
export async function prossimeSessioni() { const r = await sb().from('v_prossime_sessioni').select('*'); controlla(r); return r.data || []; }
export async function programmiMesi(mesi) {
  const r = await sb().from('programma').select('id, corso_id, mese, nota, programma_argomenti(argomento_id, ordine, fatto_il)').in('mese', mesi);
  controlla(r);
  return r.data || [];
}
export async function salvaProgramma({ corsoId = null, mese = null, sessioneId = null, nota = null, argomenti = [] }) {
  const r = await sb().rpc('salva_programma', { p_corso: corsoId, p_mese: mese, p_sessione: sessioneId, p_nota: nota, p_argomenti: argomenti });
  controlla(r);
  return r.data;
}
export async function nonToccati() { const r = await sb().from('v_non_toccati').select('*'); controlla(r); return r.data || []; }
export async function pianiAttivi() { const r = await sb().from('piani_personali').select('*, allievi(nome, cognome)').eq('stato', 'attivo'); controlla(r); return r.data || []; }
export async function obiettiviAperti() { const r = await sb().from('obiettivi').select('id, nota, aperto_il, allievo_id, allievi(nome, cognome), obiettivi_argomenti(argomento_id)').eq('stato', 'aperto').order('aperto_il'); controlla(r); return r.data || []; }

/* ---------- impostazioni: un campo alla volta, con la cronologia ---------- */
export async function salvaImpostazione(gruppo, campo, valore, testoDetto = null) {
  const r = await sb().from('impostazioni').select('valori').eq('id', 1).maybeSingle();
  controlla(r);
  const valori = r.data?.valori || {};
  const prima = valori[gruppo]?.[campo];
  valori[gruppo] = { ...(valori[gruppo] || {}), [campo]: valore };
  const u = await sb().from('impostazioni').update({ valori }).eq('id', 1).select('id');
  controlla(u);
  const s = await sessione();
  const v = await sb().from('impostazioni_versioni').insert({ campo: `${gruppo}.${campo}`, prima: prima ?? null, dopo: valore, testo_detto: testoDetto, profilo_id: s?.user?.id || null });
  controlla(v);
  return valori;
}
