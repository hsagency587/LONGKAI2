/* Longkai — viste/segnala.js: il Sifu (o Simone) dice cosa non va. Si salva nell'app e a Simone arriva una notifica sul telefono. */
import { el, VERSIONE_APP, ultimiPassaggi, dispositivo } from '../base.js';
import { segnala, leggiLocale } from '../dati.js';
import { testata, toast, avvisa, vai } from '../ui.js';

export function vistaSegnala(main) {
  testata('Segnala un problema', { indietro: 'altro' });
  const testo = el('textarea', { id: 'problema', rows: '6', placeholder: 'Cosa non va? Scrivilo come lo diresti a voce.', maxlength: '4000', required: true });
  const tasto = el('button', { class: 'tasto pieno grande', type: 'submit', testo: 'Invia' });
  const form = el('form', { novalidate: true }, [
    el('div', { class: 'campo' }, [el('label', { for: 'problema', testo: 'Il problema' }), testo]),
    el('p', { class: 'piccolo attenuato', testo: `Allego da solo: schermata, versione ${VERSIONE_APP}, dispositivo, ora, gli ultimi passaggi. Mai dati personali.` }),
    tasto,
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!testo.value.trim()) { testo.focus(); return; }
    tasto.disabled = true;
    try {
      const r = await segnala({ testo: testo.value.trim(), schermata: leggiLocale().ultimaVista || 'altro', versione_app: VERSIONE_APP, dispositivo: dispositivo(), ultimi_passaggi: ultimiPassaggi() });
      toast(r?.notifiche ? 'Segnalazione mandata: Simone ha la notifica. Grazie.' : 'Segnalazione salvata. Grazie.');
      vai('altro');
    } catch (err) { avvisa(err.message || 'Non sono riuscito a mandarla.'); }
    finally { tasto.disabled = false; }
  });
  main.append(form);
  setTimeout(() => testo.focus(), 50);
}
