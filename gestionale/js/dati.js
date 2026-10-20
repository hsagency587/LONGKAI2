/* Lòngkai — dati.js: l'unico file che parla con Supabase e con la memoria del telefono.
   Le regole per riga stanno sul server: qui si chiede e basta.
   Ogni cambio va in una coda salvata sul telefono: senza rete resta lì e riparte da sola, appena la rete torna.
   Sul telefono resta anche una copia degli ultimi dati, per guardarli senza rete. */

let client = null;
const CODA = 'longkai.coda';
const COPIA = 'longkai.dati';
const TEMA = 'longkai.tema';

export function configurato() {
  const c = globalThis.CONFIG || {};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

export function sb() {
  if (client) return client;
  if (!configurato()) throw new Error('progetto non configurato');
  const lib = globalThis.supabase;
  if (!lib) throw new Error('Un file dell\'app non si è caricato: ricarica la pagina.');
  client = lib.createClient(globalThis.CONFIG.supabaseUrl, globalThis.CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export const nuovoId = () => crypto.randomUUID();
export const versione = () => (globalThis.CONFIG && globalThis.CONFIG.versione) || 'locale';

/* ---------- la memoria del telefono ---------- */
function leggi(k, vuoto) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : vuoto; } catch { return vuoto; }
}
function scrivi(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memoria piena o bloccata: si va avanti */ }
}
function togli(k) {
  try { localStorage.removeItem(k); } catch { /* niente */ }
}
export const temaSalvato = () => leggi(TEMA, 'chiaro') === 'scuro' ? 'scuro' : 'chiaro';
export const salvaTema = t => scrivi(TEMA, t);

/* ---------- accesso ---------- */
export async function sessione() {
  if (!configurato()) return null;
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session;
  // Senza rete il gettone scaduto non si rinnova: si resta dentro con la sessione salvata sul telefono
  // e si rinnova da soli appena la rete torna.
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
/** Esce da questo telefono: anche senza rete. Via la copia dei dati e la coda (si esce solo con la coda vuota). */
export async function esci() {
  const { error } = await sb().auth.signOut({ scope: 'local' });
  togli(COPIA); togli(CODA); coda = [];
  if (error) throw error;
}
export function suCambioAccesso(fn) {
  if (configurato()) sb().auth.onAuthStateChange((evento, s) => fn(evento, s));
}
/** Il profilo di chi è dentro: { id, nome, email, ruolo, attivo }. */
export async function profilo() {
  const s = await sessione();
  if (!s) return null;
  const { data, error } = await sb().from('profili').select('id, nome, email, ruolo, attivo').eq('id', s.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------- i dati ---------- */
async function tutte(tabella, ordine) {     // il server ne dà mille alla volta
  const righe = [];
  for (let da = 0; ; da += 1000) {
    let q = sb().from(tabella).select('*');
    for (const o of ordine) q = q.order(o);
    const { data, error } = await q.range(da, da + 999);
    if (error) throw error;
    righe.push(...data);
    if (data.length < 1000) return righe;
  }
}
/** Tutto quello che serve all'app, dal database. Resta una copia sul telefono. */
export async function scarica() {
  const [allievi, lezioni, pagamenti, imp, cal] = await Promise.all([
    tutte('allievi', ['id']), tutte('lezioni', ['id']), tutte('pagamenti', ['allievo_id', 'mese']),
    sb().from('impostazioni').select('valori').eq('id', 1).maybeSingle(),
    sb().from('lavori_fatti').select('fatto_il, esito').eq('nome', 'calendario').order('fatto_il', { ascending: false }).limit(1),
  ]);
  if (imp.error) throw imp.error;
  const d = { allievi, lezioni, pagamenti, valori: imp.data?.valori || {}, calendario: cal.data?.[0] || null };
  scrivi(COPIA, d);
  return d;
}
export const copiaSalvata = () => leggi(COPIA, null);
/** Dopo un cambio fatto qui: la copia sul telefono diventa come l'app, così senza rete si riapre com'era. */
export function aggiornaCopia(r) {
  const c = copiaSalvata() || { valori: {}, calendario: null };
  scrivi(COPIA, { ...c, allievi: [...r.allievi.values()], lezioni: [...r.lezioni.values()], pagamenti: [...r.pagamenti.values()], valori: { ...c.valori, ...r.valori } });
}

/* ---------- la coda dei cambi ----------
   Un cambio: { chiave, tabella, tipo, riga }. tipo: 'salva' (la riga intera), 'contenuto' (una privata del calendario:
   solo quello che dice il Sifu; giorno e ora sono del calendario), 'togli', 'impostazioni' (si uniscono a quelle che ci sono).
   Per la stessa riga vale l'ultimo cambio. */
let coda = leggi(CODA, []);
let inCorso = null;
let riprova = null;
const ascoltatori = new Set();
export const inCoda = () => coda.length;
export const suSalvataggio = fn => ascoltatori.add(fn);   // fn({ tipo: 'senza_rete' | 'salvato' | 'errore', messaggio })
const dici = e => { for (const fn of ascoltatori) { try { fn(e); } catch { /* niente */ } } };

const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** I cambi fra due fotografie delle righe (prima e dopo), da mandare al database. */
export function differenze(p, d) {
  const cambi = [];
  if (!uguali(p.valori, d.valori)) cambi.push({ chiave: 'impostazioni', tabella: 'impostazioni', tipo: 'impostazioni', riga: d.valori });
  for (const [id, r] of d.allievi) if (!uguali(p.allievi.get(id), r)) cambi.push({ chiave: `allievi:${id}`, tabella: 'allievi', tipo: 'salva', riga: r });
  for (const id of p.allievi.keys()) if (!d.allievi.has(id)) cambi.push({ chiave: `allievi:${id}`, tabella: 'allievi', tipo: 'togli', riga: { id } });
  for (const [k, r] of d.pagamenti) if (!uguali(p.pagamenti.get(k), r)) cambi.push({ chiave: `pagamenti:${k}`, tabella: 'pagamenti', tipo: 'salva', riga: r });
  for (const [k, r] of p.pagamenti) if (!d.pagamenti.has(k)) cambi.push({ chiave: `pagamenti:${k}`, tabella: 'pagamenti', tipo: 'togli', riga: { allievo_id: r.allievo_id, mese: r.mese } });
  for (const [id, r] of d.lezioni) if (!uguali(p.lezioni.get(id), r)) cambi.push({ chiave: `lezioni:${id}`, tabella: 'lezioni', tipo: r.dal_calendario ? 'contenuto' : 'salva', riga: r });
  for (const [id, r] of p.lezioni) if (!d.lezioni.has(id) && !r.dal_calendario) cambi.push({ chiave: `lezioni:${id}`, tabella: 'lezioni', tipo: 'togli', riga: { id } });
  return cambi;
}

/** Mette i cambi in coda e prova subito a salvarli. */
export function salva(cambi) {
  if (!cambi.length) return Promise.resolve();
  for (const c of cambi) { coda = coda.filter(x => x.chiave !== c.chiave); coda.push(c); }
  scrivi(CODA, coda);
  return svuota();
}

/** Sopra i dati del server, i cambi ancora in coda: l'app mostra quello che il Sifu ha fatto, anche se non è ancora salvato. */
export function conCoda(d) {
  if (!coda.length) return d;
  const mappa = (righe, k) => new Map(righe.map(r => [k(r), r]));
  const t = {
    allievi: mappa(d.allievi, r => r.id), lezioni: mappa(d.lezioni, r => r.id),
    pagamenti: mappa(d.pagamenti, r => `${r.allievo_id}|${String(r.mese).slice(0, 7)}`),
  };
  let valori = d.valori;
  for (const c of coda) {
    if (c.tipo === 'impostazioni') { valori = { ...valori, ...c.riga }; continue; }
    const k = c.chiave.slice(c.tabella.length + 1);
    if (c.tipo === 'togli') t[c.tabella].delete(k);
    else if (c.tipo === 'contenuto') { if (t.lezioni.has(k)) t.lezioni.set(k, { ...t.lezioni.get(k), ...contenuto(c.riga) }); }
    else t[c.tabella].set(k, c.riga);
  }
  return { ...d, allievi: [...t.allievi.values()], lezioni: [...t.lezioni.values()], pagamenti: [...t.pagamenti.values()], valori };
}
const contenuto = r => ({ iscritti: r.iscritti, assenti: r.assenti, fatto: r.fatto, previsto: r.previsto, non_fatta: r.non_fatta, motivo: r.motivo });

// Un errore di rete (o del server che non risponde) non fa perdere niente: si riprova. Gli altri si dicono.
const temporaneo = r => !navigator.onLine || !r.status || r.status >= 500 || r.status === 401 || r.status === 408 || r.status === 429
  || /fetch|network|load failed/i.test(r.error?.message || '');
class ErroreRete extends Error {}
function controlla(r) {
  if (!r.error) return r;
  if (temporaneo(r)) throw new ErroreRete(r.error.message);
  throw r.error;
}

const ORDINE = ['impostazioni', 'allievi:salva', 'pagamenti:salva', 'pagamenti:togli', 'lezioni:salva', 'lezioni:contenuto', 'lezioni:togli', 'allievi:togli'];
const gruppo = c => c.tipo === 'impostazioni' ? 'impostazioni' : `${c.tabella}:${c.tipo}`;

async function manda(g, cambi) {
  const s = sb();
  if (g === 'impostazioni') {
    const r = controlla(await s.from('impostazioni').select('valori').eq('id', 1).single());
    controlla(await s.from('impostazioni').update({ valori: { ...r.data.valori, ...cambi.at(-1).riga } }).eq('id', 1));
  } else if (g === 'allievi:salva' || g === 'lezioni:salva') {
    controlla(await s.from(g.split(':')[0]).upsert(cambi.map(c => c.riga), { onConflict: 'id' }));
  } else if (g === 'pagamenti:salva') {
    controlla(await s.from('pagamenti').upsert(cambi.map(c => c.riga), { onConflict: 'allievo_id,mese' }));
  } else if (g === 'lezioni:contenuto') {
    for (const c of cambi) controlla(await s.from('lezioni').update(contenuto(c.riga)).eq('id', c.riga.id));
  } else if (g === 'pagamenti:togli') {
    for (const c of cambi) controlla(await s.from('pagamenti').delete().eq('allievo_id', c.riga.allievo_id).eq('mese', c.riga.mese));
  } else {
    controlla(await s.from(g.split(':')[0]).delete().in('id', cambi.map(c => c.riga.id)));
  }
}

/** Manda la coda al database. Senza rete si ferma e riprova da sola; un cambio che il database rifiuta si toglie e si dice. */
export function svuota() {
  if (inCorso) return inCorso.then(() => (coda.length ? svuota() : undefined));
  if (!coda.length || !configurato()) return Promise.resolve();
  clearTimeout(riprova);
  inCorso = (async () => {
    const giro = [...coda];
    const fatti = new Set();
    try {
      for (const g of ORDINE) {
        const cambi = giro.filter(c => gruppo(c) === g);
        if (!cambi.length) continue;
        try {
          await manda(g, cambi);
          cambi.forEach(c => fatti.add(c));
        } catch (e) {
          if (e instanceof ErroreRete) throw e;
          // un cambio rifiutato dal database si toglie e si dice (l'app ricarica i dati veri);
          // se erano più d'uno, si mandano uno alla volta per salvare tutti gli altri
          if (cambi.length === 1) { fatti.add(cambi[0]); dici({ tipo: 'errore', messaggio: e.message }); continue; }
          for (const c of cambi) {
            try { await manda(g, [c]); } catch (e1) { if (e1 instanceof ErroreRete) throw e1; dici({ tipo: 'errore', messaggio: e1.message }); }
            fatti.add(c);
          }
        }
      }
      dici({ tipo: 'salvato' });
    } catch (e) {
      // senza rete (o un errore che non si capisce): niente si perde, si riprova fra poco
      dici(e instanceof ErroreRete || !navigator.onLine ? { tipo: 'senza_rete' } : { tipo: 'errore', messaggio: e.message });
      riprova = setTimeout(svuota, 20000);
    } finally {
      coda = coda.filter(c => !fatti.has(c));
      scrivi(CODA, coda);
      inCorso = null;
    }
  })();
  return inCorso;
}
globalThis.addEventListener?.('online', () => svuota());

/* ---------- le funzioni del server ---------- */
export async function chiamaFunzione(nome, corpo = {}) {
  const { data, error } = await sb().functions.invoke(nome, { body: corpo, headers: { 'x-region': globalThis.CONFIG.regioneAttesa || 'eu-central-1' } });
  if (error) {
    let dettaglio = null;
    try { dettaglio = await error.context?.json?.(); } catch { /* niente */ }
    const e = new Error(dettaglio?.messaggio || error.message || 'Errore del server');
    e.codice = dettaglio?.errore || 'servizio';
    e.rete = error.name === 'FunctionsFetchError' || !navigator.onLine;
    throw e;
  }
  return data;
}
export function trascrivi(blob, nomeFile) {
  const fd = new FormData();
  fd.append('audio', blob, nomeFile);
  return chiamaFunzione('trascrivi', fd);
}
export const riordina = corpo => chiamaFunzione('riordina', corpo);
export const segnala = corpo => chiamaFunzione('segnala', corpo);

/* ---------- le notifiche di questo telefono ---------- */
export async function iscriviPush(abbonamento) {
  const s = await sessione();
  const j = abbonamento.toJSON ? abbonamento.toJSON() : abbonamento;
  const r = await sb().from('dispositivi_push').upsert({ profilo_id: s.user.id, endpoint: j.endpoint, chiavi: j.keys }, { onConflict: 'endpoint' }).select('id');
  if (r.error) throw r.error;
}
export async function togliPush(endpoint) {
  const r = await sb().from('dispositivi_push').delete().eq('endpoint', endpoint);
  if (r.error) throw r.error;
}
