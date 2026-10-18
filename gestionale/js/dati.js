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
  // il primo periodo nasce subito, così il saldo si vede senza aspettare l'orologio
  try { await sb().rpc('genera_addebiti_in_arrivo', { p_giorni: 7 }); } catch { /* l'orologio ci pensa domattina */ }
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
export async function contaPagamenti(allievoId) {
  const r = await sb().from('pagamenti').select('id', { count: 'exact', head: true }).eq('allievo_id', allievoId);
  controlla(r);
  return r.count || 0;
}
export async function eliminaAllievo(id, anchePagamenti = false) {
  const r = await sb().rpc('elimina_allievo', { p_allievo: id, p_anche_pagamenti: anchePagamenti });
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
  const [pres, cont, oss, forme, pag, prog, prossima, grezzo] = await Promise.all([
    sb().from('presenze').select('allievo_id, minuti, tipo, origine, allievi(nome, cognome, soprannomi)').eq('sessione_id', id),
    sb().from('contenuti').select('id, allievo_id, nota, contenuti_argomenti(argomento_id)').eq('sessione_id', id),
    sb().from('osservazioni').select('allievo_id, testo').eq('sessione_id', id),
    sb().from('forme_storia').select('allievo_id, forma_id, a_stato, a_sezione').eq('sessione_id', id),
    sb().from('pagamenti').select('id, allievo_id, importo_cent, metodo, nota, creato_il').eq('sessione_id', id).is('annullato_il', null).order('creato_il'),
    sb().from('programma').select('id, nota, programma_argomenti(argomento_id, ordine, fatto_il)').eq('sessione_id', id).maybeSingle(),
    s.data.corso_id ? sb().from('sessioni').select('id, data, ora').eq('corso_id', s.data.corso_id).eq('tipo', 'corso').eq('stato', 'prevista').gt('data', s.data.data).order('data').limit(1) : Promise.resolve({ data: [] }),
    sb().from('sessioni').select('testo_grezzo, risposta_grezza, stato_revisione').eq('id', id).maybeSingle(),
  ]);
  controlla(pres, cont, oss, forme, pag, prog, prossima, grezzo);
  let programmaProssima = null;
  if (prossima.data?.[0]) {
    const p = await sb().from('programma').select('id, nota, programma_argomenti(argomento_id, ordine, fatto_il)').eq('sessione_id', prossima.data[0].id).maybeSingle();
    controlla(p);
    programmaProssima = p.data;
  }
  return { sessione: s.data, presenze: pres.data || [], contenuti: cont.data || [], osservazioni: oss.data || [], forme: forme.data || [], pagamenti: pag.data || [], programma: prog.data, prossima: prossima.data?.[0] || null, programmaProssima, bozza: grezzo.data?.stato_revisione === 'bozza' ? grezzo.data.risposta_grezza : null, testoGrezzo: grezzo.data?.testo_grezzo || null };
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

/* ============================================================
   FASE 3 — quote: addebiti, pagamenti, rimborsi, annullamenti
   ============================================================ */
export async function daIncassare() { const r = await sb().from('v_da_incassare').select('*').order('scadenza', { ascending: true, nullsFirst: false }); controlla(r); return r.data || []; }
export async function registraPagamento({ allievoId, importoCent, data = oggi(), metodo = 'contanti', nota = null, addebitoId = null, lavoroId = null }) {
  const r = await sb().rpc('registra_pagamento', { p_allievo: allievoId, p_importo_cent: importoCent, p_data: data, p_metodo: metodo, p_nota: nota, p_sessione: null, p_lavoro_id: lavoroId || idNuovo(), p_addebito: addebitoId });
  controlla(r);
  return r.data;
}
export async function annullaPagamento(id, perche = null) { const r = await sb().rpc('annulla_pagamento', { p_pagamento: id, p_perche: perche }); controlla(r); }
export async function registraRimborso({ allievoId, importoCent, data = oggi(), metodo = 'contanti', nota = null }) {
  const r = await sb().rpc('registra_rimborso', { p_allievo: allievoId, p_importo_cent: importoCent, p_data: data, p_metodo: metodo, p_nota: nota, p_lavoro_id: idNuovo() });
  controlla(r);
  return r.data;
}
export async function nuovoAddebito({ allievoId, importoCent, motivo = 'altro', descrizione = null, scadenza = null, data = oggi() }) {
  const r = await sb().from('addebiti').insert({ allievo_id: allievoId, importo_cent: importoCent, motivo, descrizione, scadenza, data }).select('id').single();
  controlla(r);
  return r.data.id;
}
export async function annullaAddebito(id, perche = null) { const r = await sb().rpc('annulla_addebito', { p_addebito: id, p_perche: perche }); controlla(r); }
export async function scontaAddebito(id, scontoCent) { const r = await sb().from('addebiti').update({ sconto_cent: scontoCent }).eq('id', id).select('id'); controlla(r); }
export async function pagamentiPeriodo(dal, al) {
  const r = await sb().from('pagamenti').select('id, allievo_id, data, importo_cent, tipo, metodo, nota, credito_residuo_cent, sessione_id, annullato_il, annullato_perche, creato_il, allievi(nome, cognome)').gte('data', dal).lte('data', al).order('data', { ascending: false }).order('creato_il', { ascending: false });
  controlla(r);
  return r.data || [];
}
export async function incassiMesi() { const r = await sb().from('v_incassi_mese').select('*').order('mese', { ascending: false }); controlla(r); return r.data || []; }
export async function movimentiAllievo(id) {
  const [ad, pg] = await Promise.all([
    sb().from('addebiti').select('id, data, scadenza, importo_cent, sconto_cent, pagato_cent, motivo, descrizione, periodo_dal, periodo_al, stato, annullato_perche, sessione_id').eq('allievo_id', id).order('data', { ascending: false }),
    sb().from('pagamenti').select('id, data, importo_cent, tipo, metodo, nota, credito_residuo_cent, annullato_il, annullato_perche, creato_il').eq('allievo_id', id).order('data', { ascending: false }).order('creato_il', { ascending: false }),
  ]);
  controlla(ad, pg);
  return { addebiti: ad.data || [], pagamenti: pg.data || [] };
}
export async function generaAddebitiInArrivo(giorni = 7) { const r = await sb().rpc('genera_addebiti_in_arrivo', { p_giorni: giorni }); controlla(r); return r.data; }

/* ============================================================
   FASE 4 — la voce: trascrizione, riordino, bozza della sessione, consumi, "ricorda come lo dico"
   ============================================================ */
export function trascrivi(blob, { etichetta = '', nomeFile = 'audio.webm' } = {}) {
  const fd = new FormData();
  fd.append('audio', blob, nomeFile);
  fd.append('etichetta', etichetta);
  return chiamaFunzione('trascrivi', fd);
}
export const riordina = (corpo) => chiamaFunzione('riordina', corpo);
export async function salvaBozzaSessione(id, { testo_grezzo, risposta_grezza }) {
  const r = await sb().from('sessioni').update({ testo_grezzo, risposta_grezza, stato_revisione: 'bozza' }).eq('id', id).select('id');
  controlla(r);
}
export async function bozzaSessione(id) {
  const r = await sb().from('sessioni').select('testo_grezzo, risposta_grezza, stato_revisione').eq('id', id).maybeSingle();
  controlla(r);
  return r.data;
}
export async function consumiMese() {
  const mese = oggi().slice(0, 7) + '-01';
  const r = await sb().from('consumi_ia').select('*').eq('mese', mese);
  controlla(r);
  return r.data || [];
}
/** "Ricorda come lo dico": il nome sentito diventa un soprannome dell'allievo. */
export async function aggiungiSoprannome(allievoId, sentito) {
  const s = String(sentito || '').trim();
  if (!s) return;
  const r = await sb().from('allievi').select('soprannomi').eq('id', allievoId).maybeSingle();
  controlla(r);
  const lista = r.data?.soprannomi || [];
  if (lista.some((x) => x.toLowerCase() === s.toLowerCase())) return;
  const u = await sb().from('allievi').update({ soprannomi: [...lista, s] }).eq('id', allievoId).select('id');
  controlla(u);
}
/** "Ricorda come lo dico": il termine sentito diventa una pronuncia dell'argomento, con la versione. */
export async function aggiungiPronuncia(argomentoId, sentito) {
  const s = String(sentito || '').trim();
  if (!s) return;
  const r = await sb().from('argomenti').select('nome, area, sinonimi, pronunce, attivo, sezioni').eq('id', argomentoId).maybeSingle();
  controlla(r);
  const lista = r.data?.pronunce || [];
  if (lista.some((x) => x.toLowerCase() === s.toLowerCase())) return;
  await salvaArgomento(argomentoId, { pronunce: [...lista, s] }, r.data, `“${s}”`);
  cacheArgomenti = { quando: 0, dati: [] };
}

/* ---------- avvisi e notifiche (fase 7) ---------- */
export async function avvisiAperti() {
  const s = await sessione();
  if (!s) return [];
  const r = await sb().from('avvisi').select('id, tipo, soglia, testo, allievo_id, scadenza_id, creato_il, stato').eq('canale', 'app').eq('profilo_id', s.user.id).in('stato', ['mandato', 'da_mandare']).order('creato_il', { ascending: false }).limit(50);
  controlla(r);
  return r.data || [];
}
export async function segnaAvvisiLetti(ids) {
  if (!ids?.length) return;
  const r = await sb().from('avvisi').update({ stato: 'letto', letto_il: new Date().toISOString() }).in('id', ids).select('id');
  controlla(r);
}
export async function dispositiviPush() {
  const s = await sessione();
  if (!s) return [];
  const r = await sb().from('dispositivi_push').select('id, endpoint, creato_il, ultimo_uso').eq('profilo_id', s.user.id);
  controlla(r);
  return r.data || [];
}
export async function iscriviPush(abbonamento) {
  const s = await sessione();
  const j = abbonamento.toJSON ? abbonamento.toJSON() : abbonamento;
  const r = await sb().from('dispositivi_push').upsert({ profilo_id: s.user.id, endpoint: j.endpoint, chiavi: j.keys }, { onConflict: 'endpoint' }).select('id');
  controlla(r);
}
export async function togliPush(endpoint) {
  const r = await sb().from('dispositivi_push').delete().eq('endpoint', endpoint);
  controlla(r);
}
export const provaPush = () => chiamaFunzione('avvisi', { azione: 'prova' });
export async function segnalazioniTutte() {
  const r = await sb().from('segnalazioni').select('id, titolo, testo, schermata, versione_app, dispositivo, stato, risolta_versione, creato_il, profili(nome)').order('creato_il', { ascending: false }).limit(100);
  controlla(r);
  return r.data || [];
}
export async function aggiornaSegnalazione(id, dati) {
  const r = await sb().from('segnalazioni').update(dati).eq('id', id).select('id');
  controlla(r);
}

/* ---------- rapporti (fase 6) ---------- */
export async function rapportiMensili() {
  const r = await sb().from('rapporti_mensili').select('id, mese, pdf_percorso, generato_il, totali, riassunto, riassunto_corretto_il').order('mese', { ascending: false });
  controlla(r);
  return r.data || [];
}
export const generaRapporto = (mese, rigeneraRiassunto = false) => chiamaFunzione('pdf', { tipo: 'mensile', mese, rigenera_riassunto: rigeneraRiassunto });
export const generaRapportino = (sessioneId) => chiamaFunzione('pdf', { tipo: 'rapportino', sessione_id: sessioneId });
export async function apriRapporto(percorso) { const r = await chiamaFunzione('pdf', { tipo: 'apri', percorso }); return r.url; }
export async function salvaRiassunto(mese, testo) {
  const r = await sb().from('rapporti_mensili').upsert({ mese, riassunto: testo, riassunto_corretto_il: new Date().toISOString() }, { onConflict: 'mese' }).select('id');
  controlla(r);
}

/* ---------- Correggi parlando: applica le operazioni spuntate ---------- */
function daSiNo(v) { const t = String(v ?? '').trim().toLowerCase(); return ['si', 'sì', 'true', 'acceso', 'on', '1'].includes(t); }
function numeri(v) { return String(v ?? '').split(/[,\s]+/).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0); }
export async function applicaCorrezioni(operazioni, testoDetto = null) {
  let fatte = 0;
  for (const o of operazioni) {
    if (o.ambito === 'argomento') {
      if (o.tipo === 'nuovo_argomento') { await salvaArgomento(null, { nome: String(o.testo || o.valore || '').trim(), area: String(o.valore && o.testo ? o.valore : 'Tecniche di mano'), sinonimi: [], pronunce: [], attivo: true, sezioni: null }, null, testoDetto); fatte++; continue; }
      const a = (await argomentiTutti()).find((x) => x.id === o.id) || (await sb().from('argomenti').select('*').eq('id', o.id).maybeSingle()).data;
      if (!a) continue;
      const prima = { nome: a.nome, area: a.area, sinonimi: a.sinonimi, pronunce: a.pronunce, attivo: a.attivo, sezioni: a.sezioni };
      const d = { nome: a.nome, area: a.area, sinonimi: [...(a.sinonimi || [])], pronunce: [...(a.pronunce || [])], attivo: a.attivo, sezioni: Array.isArray(a.sezioni) ? a.sezioni.map((s) => ({ ...s, movimenti: [...(s.movimenti || [])] })) : a.sezioni };
      const senza = (lista, t) => lista.filter((x) => x.toLowerCase() !== String(t).toLowerCase());
      const n = Number(o.n) || 0;
      switch (o.tipo) {
        case 'rinomina': d.nome = String(o.testo || o.valore || d.nome).trim(); break;
        case 'area': d.area = String(o.testo || o.valore || d.area).trim(); break;
        case 'aggiungi_sinonimo': if (!d.sinonimi.some((x) => x.toLowerCase() === String(o.testo).toLowerCase())) d.sinonimi.push(String(o.testo)); break;
        case 'togli_sinonimo': d.sinonimi = senza(d.sinonimi, o.testo); break;
        case 'aggiungi_pronuncia': if (!d.pronunce.some((x) => x.toLowerCase() === String(o.testo).toLowerCase())) d.pronunce.push(String(o.testo)); break;
        case 'togli_pronuncia': d.pronunce = senza(d.pronunce, o.testo); break;
        case 'attiva': d.attivo = o.attivo !== false; break;
        case 'rinomina_sezione': d.sezioni = d.sezioni || []; if (d.sezioni[n - 1]) d.sezioni[n - 1].nome = String(o.testo || o.valore || ''); break;
        case 'aggiungi_sezione': d.sezioni = d.sezioni || []; d.sezioni.splice(n > 0 ? n : d.sezioni.length, 0, { nome: String(o.testo || o.valore || `Sezione ${d.sezioni.length + 1}`), movimenti: o.movimenti || [] }); break;
        case 'togli_sezione': d.sezioni = (d.sezioni || []).filter((_, i) => i !== n - 1); break;
        case 'movimenti_sezione': d.sezioni = d.sezioni || []; if (d.sezioni[n - 1]) d.sezioni[n - 1].movimenti = o.movimenti || []; break;
        default: continue;
      }
      if (Array.isArray(d.sezioni)) d.sezioni = d.sezioni.map((s, i) => ({ n: i + 1, nome: s.nome || `Sezione ${i + 1}`, movimenti: s.movimenti || [] }));
      await salvaArgomento(a.id, d, prima, testoDetto); fatte++;
    } else if (o.ambito === 'allievo') {
      const allievoId = o.allievo_id || o.contesto_id || null;
      const cerca = async (id) => (await sb().from('allievi').select('id, aggiornato_il, soprannomi').eq('id', id).maybeSingle()).data;
      if (o.tipo === 'campo') { const a = await cerca(o.id); if (!a) continue; const ammessi = ['nome', 'cognome', 'nascita', 'citta', 'telefono', 'email', 'famiglia', 'note', 'tutore_nome', 'tutore_telefono', 'tutore_email']; if (!ammessi.includes(o.campo)) continue; await salvaAllievo(a.id, { [o.campo]: String(o.valore ?? '').trim() || null }, a.aggiornato_il); fatte++; }
      else if (o.tipo === 'aggiungi_soprannome') { await aggiungiSoprannome(o.id, o.testo); fatte++; }
      else if (o.tipo === 'togli_soprannome') { const a = await cerca(o.id); if (!a) continue; await salvaAllievo(a.id, { soprannomi: (a.soprannomi || []).filter((x) => x.toLowerCase() !== String(o.testo).toLowerCase()) }, a.aggiornato_il); fatte++; }
      else if (o.tipo === 'stato') { await cambiaStatoAllievo(o.id, o.valore === 'sospeso' ? 'sospeso' : 'attivo'); fatte++; }
      else if (o.tipo === 'iscrivi' || o.tipo === 'togli_corso' || o.tipo === 'abbonamento') {
        // qui o.id è il corso o la tariffa; l'allievo è quello della pagina
        const chi = allievoId || o.allievo;
        if (!chi) continue;
        if (o.tipo === 'iscrivi') { await iscrivi(chi, o.id, o.dal || oggi()); fatte++; }
        else if (o.tipo === 'togli_corso') { const i = await sb().from('iscrizioni').select('id').eq('allievo_id', chi).eq('corso_id', o.id).is('al', null); controlla(i); for (const x of i.data || []) await chiudiIscrizione(x.id, o.al || oggi()); fatte++; }
        else { const ab = await sb().from('abbonamenti').select('id, dal, tariffa_id').eq('allievo_id', chi).is('al', null); controlla(ab); for (const x of ab.data || []) if (x.tariffa_id !== o.id) await chiudiAbbonamento(x.id, oggi()); if (!(ab.data || []).some((x) => x.tariffa_id === o.id)) await salvaAbbonamento(chi, { tariffa_id: o.id, dal: o.dal || oggi(), rinnovo_automatico: true }, null); fatte++; }
      }
    } else if (o.ambito === 'tariffe') {
      if (o.tipo === 'nuova_tariffa') { await salvaTariffa(null, { nome: String(o.testo || 'Nuova tariffa'), importo_cent: Number(o.importo_cent) || 0, tipo: ['mensile', 'trimestrale', 'annuale', 'pacchetto', 'lezione', 'ora_privata', 'tessera', 'altro'].includes(o.valore) ? o.valore : 'altro', attiva: true, comprende_private: false, comprende_extra: false, ordine: 9 }); fatte++; }
      else if (o.tipo === 'importo') { await salvaTariffa(o.id, { importo_cent: Number(o.importo_cent) || 0 }); fatte++; }
      else if (o.tipo === 'rinomina_tariffa') { await salvaTariffa(o.id, { nome: String(o.testo || '') }); fatte++; }
      else if (o.tipo === 'attiva_tariffa') { await salvaTariffa(o.id, { attiva: o.attivo !== false }); fatte++; }
    } else if (o.ambito === 'corsi') {
      const c = (await corsiCompleti()).find((x) => x.id === o.id);
      if (!c) continue;
      const dati = { nome: c.nome, citta: c.citta, durata_minuti: c.durata_minuti, attivo: c.attivo, sospeso_dal: c.sospeso_dal, sospeso_al: c.sospeso_al, ordine: c.ordine };
      let orari = (c.corsi_orari || []).map((x) => ({ giorno: x.giorno, ora: String(x.ora).slice(0, 5) }));
      if (o.tipo === 'orario') { orari = orari.filter((x) => x.giorno !== o.giorno); orari.push({ giorno: Number(o.giorno), ora: String(o.ora || '19:00').slice(0, 5) }); }
      else if (o.tipo === 'togli_giorno') orari = orari.filter((x) => x.giorno !== Number(o.giorno));
      else if (o.tipo === 'durata') dati.durata_minuti = Number(o.minuti) || dati.durata_minuti;
      else if (o.tipo === 'sospendi') { dati.sospeso_dal = o.dal || oggi(); dati.sospeso_al = o.al || null; }
      else if (o.tipo === 'riattiva') { dati.sospeso_dal = null; dati.sospeso_al = null; dati.attivo = true; }
      else if (o.tipo === 'rinomina_corso') dati.nome = String(o.testo || dati.nome);
      else continue;
      await salvaCorso(c.id, dati, orari); fatte++;
    } else if (o.ambito === 'impostazioni' && o.tipo === 'campo_impostazione') {
      const pezzi = String(o.campo || '').split('.');
      const v = o.valore;
      if (pezzi[0] === 'promemoria_allievi' && pezzi[1] === 'testi' && pezzi[2]) { const imp = await impostazioni(); const testi = { ...(imp.promemoria_allievi?.testi || {}), [pezzi[2]]: String(v || '') }; await salvaImpostazione('promemoria_allievi', 'testi', testi, testoDetto); fatte++; continue; }
      if (pezzi.length !== 2) continue;
      const [gruppo, campo] = pezzi;
      const liste = ['soglie', 'canali', 'sedi']; const booleani = ['tutore_sotto_18', 'accesa', 'ricorda_pronunce', 'riempi_previsto', 'promemoria_serale_acceso', 'ripeti_settimanale']; const interi = ['certificato_mesi', 'tesseramento_mesi', 'da_richiamare_lezioni', 'durata_minuti', 'settimane_avanti', 'non_toccati_giorni', 'orizzonte_giorni', 'tetto_mensile_cent', 'giorno', 'avviso_pacchetto_a', 'tolleranza_giorni', 'forma_attiva_giorni'];
      const valore = liste.includes(campo) ? (campo === 'soglie' ? numeri(v).sort((a, b) => b - a) : String(v).split(',').map((x) => x.trim()).filter(Boolean)) : booleani.includes(campo) ? daSiNo(v) : interi.includes(campo) ? Math.round(Number(String(v).replace(',', '.'))) : String(v ?? '');
      if (interi.includes(campo) && !Number.isFinite(valore)) continue;
      await salvaImpostazione(gruppo, campo, valore, testoDetto); fatte++;
    } else if (o.ambito === 'programma') {
      if (o.tipo === 'mese') { await salvaProgramma({ corsoId: o.id, mese: o.mese || oggi().slice(0, 7) + '-01', nota: o.valore || null, argomenti: o.argomenti || [] }); fatte++; }
      else if (o.tipo === 'sessione') { await salvaProgramma({ sessioneId: o.id, nota: o.valore || null, argomenti: o.argomenti || [] }); fatte++; }
      else if (o.tipo === 'piano') { const e = await sb().from('piani_personali').select('sta_lavorando_su').eq('allievo_id', o.id).eq('stato', 'attivo').maybeSingle(); await salvaPiano(o.id, { sta_lavorando_su: e.data?.sta_lavorando_su || [], prossimo_passo_argomenti: o.argomenti || [], prossimo_passo_nota: o.valore || null }); fatte++; }
    }
  }
  cacheArgomenti = { quando: 0, dati: [] };
  return fatte;
}
/** La cronologia delle correzioni (argomenti e impostazioni), le ultime. */
export async function versioniRecenti() {
  const [a, i] = await Promise.all([
    sb().from('argomenti_versioni').select('id, argomento_id, prima, dopo, testo_detto, creato_il, argomenti(nome)').order('creato_il', { ascending: false }).limit(20),
    sb().from('impostazioni_versioni').select('id, campo, prima, dopo, testo_detto, creato_il').order('creato_il', { ascending: false }).limit(20),
  ]);
  controlla(a, i);
  return [...(a.data || []).map((x) => ({ ...x, genere: 'argomento' })), ...(i.data || []).map((x) => ({ ...x, genere: 'impostazione' }))].sort((x, y) => String(y.creato_il).localeCompare(String(x.creato_il)));
}
export async function ripristinaArgomento(v) {
  if (!v?.argomento_id || !v.prima) throw new Error('niente da ripristinare');
  const attuale = (await sb().from('argomenti').select('nome, area, sinonimi, pronunce, attivo, sezioni').eq('id', v.argomento_id).maybeSingle()).data;
  await salvaArgomento(v.argomento_id, { nome: v.prima.nome, area: v.prima.area, sinonimi: v.prima.sinonimi || [], pronunce: v.prima.pronunce || [], attivo: v.prima.attivo !== false, sezioni: v.prima.sezioni ?? null }, attuale, 'ripristino');
  cacheArgomenti = { quando: 0, dati: [] };
}

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
