/* Longkai — viste/accesso.js */
import { el } from '../base.js';
import { accedi, passwordDimenticata, configurato } from '../dati.js';
import { testata, toast, avvisa, vai } from '../ui.js';

export function vistaAccesso(main) {
  testata('Longkai');
  document.getElementById('barra-alto').classList.add('nascosto');
  const email = el('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, inputmode: 'email', placeholder: 'nome@esempio.it' });
  const password = el('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, minlength: '12' });
  const errore = el('p', { class: 'errore-campo', role: 'alert' });
  const tasto = el('button', { class: 'tasto pieno grande', type: 'submit', testo: 'Entra' });
  const form = el('form', { novalidate: true }, [
    el('div', { class: 'campo' }, [el('label', { for: 'email', testo: 'Email' }), email]),
    el('div', { class: 'campo' }, [el('label', { for: 'password', testo: 'Password' }), password]),
    errore,
    tasto,
    el('div', { class: 'tasti', style: null }, [el('button', { class: 'tasto', type: 'button', testo: 'Password dimenticata', onclick: async (e) => {
      if (!email.value) { errore.textContent = 'Scrivi prima la tua email.'; return; }
      const b = e.currentTarget; b.disabled = true; // un tocco solo: la seconda email verrebbe rifiutata
      try { await passwordDimenticata(email.value.trim()); toast('Ti ho mandato un\'email con il link.'); b.textContent = 'Email mandata'; setTimeout(() => { b.disabled = false; b.textContent = 'Password dimenticata'; }, 60000); }
      catch { avvisa('Non sono riuscito a mandare l\'email.'); b.disabled = false; }
    } })]),
  ]);
  email.id = 'email'; password.id = 'password';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errore.textContent = '';
    if (!configurato()) { errore.textContent = 'Il progetto non è ancora configurato (config.js).'; return; }
    tasto.disabled = true;
    try {
      await accedi(email.value.trim(), password.value);
      document.getElementById('barra-alto').classList.remove('nascosto');
      vai('oggi');
    } catch (err) {
      errore.textContent = /invalid/i.test(err.message || '') ? 'Email o password sbagliate.' : 'Non riesco a entrare: ' + (err.message || 'riprova');
    } finally { tasto.disabled = false; }
  });
  main.replaceChildren(el('div', { class: 'accesso' }, [
    el('img', { src: 'icone/logo-oro.png', alt: 'Longkai' }),
    el('h1', { testo: 'Longkai' }),
    el('p', { class: 'attenuato', testo: configurato() ? 'Il gestionale del Sifu' : 'Progetto non ancora configurato' }),
    form,
  ]));
  setTimeout(() => email.focus(), 50);
}
