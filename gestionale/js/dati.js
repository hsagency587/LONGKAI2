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
  return data.session || null;
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
