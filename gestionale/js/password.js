/* Lòngkai — password.js: la pagina "scegli la password" (password.html#<codice>).
   Sta fuori dall'app e non importa niente: così funziona anche se il telefono ha in memoria una versione vecchia.
   Il codice del link apre la sessione solo quando si tocca Salva: un'anteprima del link non lo consuma. */
(function () {
  const codice = location.hash.replace(/^#\/?/, '').trim();
  const errore = document.getElementById('errore');
  const salva = document.getElementById('salva');
  const p1 = document.getElementById('p1');
  const p2 = document.getElementById('p2');
  const cfg = globalThis.CONFIG || {};
  const lib = globalThis.supabase;

  function dici(testo) { errore.textContent = testo; }

  if (!lib || !cfg.supabaseUrl) { dici('Un file non si è caricato: ricarica la pagina.'); return; }
  if (!codice) { dici('Questo indirizzo non è completo: chiedi un link nuovo.'); salva.disabled = true; return; }

  const sb = lib.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  document.getElementById('modulo').addEventListener('submit', async (e) => {
    e.preventDefault();
    dici('');
    if (p1.value.length < 12 || !/[a-zA-Z]/.test(p1.value) || !/\d/.test(p1.value)) { dici('Almeno 12 caratteri, con lettere e numeri.'); return; }
    if (p1.value !== p2.value) { dici('Le due password non sono uguali.'); return; }
    salva.disabled = true;
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.verifyOtp({ token_hash: codice, type: 'recovery' });
        if (error) { dici('Questo link è scaduto o già usato: chiedi un link nuovo.'); return; }
      }
      const { error: e2 } = await sb.auth.updateUser({ password: p1.value });
      if (e2) { dici(/same password|different from the old/i.test(e2.message || '') ? 'È uguale a quella di prima: scegline una nuova.' : 'Non sono riuscito a salvarla: ' + (e2.message || 'riprova')); return; }
      // la sessione è salvata sul telefono: l'app si apre già dentro
      location.replace('./');
    } catch (err) {
      dici(navigator.onLine ? 'Non sono riuscito a salvarla: ' + (err && err.message ? err.message : 'riprova') : 'Sei senza rete: riprova quando torna.');
    } finally { salva.disabled = false; }
  });
  setTimeout(() => p1.focus(), 50);
})();
