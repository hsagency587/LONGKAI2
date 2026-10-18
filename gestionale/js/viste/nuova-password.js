/* Longkai — viste/nuova-password.js: si arriva qui dal link "Password dimenticata" (o dal primo accesso) e si sceglie la password. */
import { el } from '../base.js';
import { aggiornaPassword } from '../dati.js';
import { testata, toast, vai } from '../ui.js';

export function vistaNuovaPassword(main) {
  testata('Nuova password', { indietro: 'altro' });
  document.getElementById('barra-alto').classList.remove('nascosto');
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
    try { await aggiornaPassword(p1.value); toast('Password salvata.'); vai('oggi'); }
    catch (err) { errore.textContent = 'Non sono riuscito a salvarla: ' + (err.message || 'riprova'); }
    finally { tasto.disabled = false; }
  });
  main.append(el('div', { class: 'accesso' }, [el('img', { src: 'icone/logo-oro.png', alt: 'Longkai' }), el('h1', { testo: 'Longkai' }), form]));
  setTimeout(() => p1.focus(), 50);
}
