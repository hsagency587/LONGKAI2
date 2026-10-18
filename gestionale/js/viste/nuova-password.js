/* Longkai — viste/nuova-password.js: si sceglie la password.
   Ci si arriva in tre modi: dal link "scegli la password" mandato a mano (#/nuova-password/<codice>: il codice apre la
   sessione solo quando si tocca Salva, così un'anteprima del link non lo consuma), dal link di "Password dimenticata"
   via email (la sessione c'è già), o da Altro → Cambia password. */
import { el } from '../base.js';
import { aggiornaPassword, entraConCodice, sessione } from '../dati.js';
import { testata, toast, vai, mostraNav } from '../ui.js';

export async function vistaNuovaPassword(main, parametri = []) {
  const codice = parametri[0] || null;
  const dentro = Boolean(await sessione());
  testata('Nuova password', dentro && !codice ? { indietro: 'altro' } : undefined);
  document.getElementById('barra-alto').classList.remove('nascosto');
  if (!dentro) mostraNav(false);
  const p1 = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '12', id: 'p1' });
  const p2 = el('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '12', id: 'p2' });
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const tasto = el('button', { class: 'tasto pieno grande', type: 'submit', testo: 'Salva la password' });
  const form = el('form', { novalidate: true }, [
    el('p', { class: 'attenuato', testo: 'Almeno 12 caratteri, con lettere e numeri. Scegline una che usi solo qui.' }),
    el('div', { class: 'campo' }, [el('label', { for: 'p1', testo: 'Nuova password' }), p1]),
    el('div', { class: 'campo' }, [el('label', { for: 'p2', testo: 'Ripetila' }), p2]),
    errore, tasto,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errore.textContent = '';
    if (p1.value.length < 12 || !/[a-zA-Z]/.test(p1.value) || !/\d/.test(p1.value)) { errore.textContent = 'Almeno 12 caratteri, con lettere e numeri.'; return; }
    if (p1.value !== p2.value) { errore.textContent = 'Le due password non sono uguali.'; return; }
    tasto.disabled = true;
    try {
      if (codice && !(await sessione())) {
        try { await entraConCodice(codice); }
        catch { errore.textContent = 'Questo link è scaduto o già usato: chiedi un link nuovo.'; return; }
      }
      await aggiornaPassword(p1.value);
      toast('Password salvata.');
      history.replaceState(null, '', '#/oggi'); // il codice non resta nella cronologia
      vai('oggi');
    } catch (err) {
      errore.textContent = /same password|different from the old/i.test(err.message || '') ? 'È uguale a quella di prima: scegline una nuova.' : 'Non sono riuscito a salvarla: ' + (err.message || 'riprova');
    } finally { tasto.disabled = false; }
  });
  main.append(el('div', { class: 'accesso' }, [el('img', { src: 'icone/logo-oro.png', alt: 'Longkai' }), el('h1', { testo: 'Longkai' }), form]));
  setTimeout(() => p1.focus(), 50);
}
