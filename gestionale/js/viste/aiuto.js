/* Longkai — viste/aiuto.js: la guida dentro l'app, in poche righe per ogni cosa. Niente nomi di persona. */
import { el } from '../base.js';
import { testata, sezione } from '../ui.js';

const CAPITOLI = [
  ['Il primo giorno', [
    'Allievi → + Allievo: nome, cognome, data di nascita, cellulare, il corso. Oppure dalla rotellina → Allievi → Importa da un foglio.',
    'Nella scheda di ogni allievo → Quote: quanto paga, ogni quanto, quando ha pagato l\'ultima volta. Da lì l\'app sa entro quando devono arrivare i soldi.',
    'Nella scheda → Documenti → + Carica: il certificato medico. La scadenza si calcola da sola e la vedi in Oggi.',
  ]],
  ['Ogni lezione, tre tocchi', [
    'Dopo la lezione tocca la bolla col microfono e racconta: chi c\'era, cosa avete fatto, chi ha fatto qualcosa di suo, chi ha pagato, cosa fare la prossima volta.',
    'Tocca Fine. L\'app lavora da sola, anche a telefono chiuso. Quando è pronta ti avvisa: «Revisione pronta».',
    'Apri la revisione, controlla, sistema i nomi non riconosciuti se ce ne sono, tocca Conferma.',
    'Senza voce: «A mano» apre la stessa schermata vuota, con le spunte per i presenti e i chip per gli argomenti.',
  ]],
  ['Le private', [
    'Oggi → + Privata: con chi, quando, quanto dura, se si ripete ogni settimana. Poi si detta o si fa a mano come una lezione.',
  ]],
  ['Programmare', [
    'Il mese: in Allenamenti → Programma tocca un mese e scrivi l\'idea, a parole. Serve a te, non cambia niente da solo.',
    'La lezione: in Oggi (o nel Programma) tocca «Programma la lezione» e metti i blocchi: chi (il gruppo o un allievo), cosa, dal minuto al minuto se vuoi, i passi. In Oggi la vedi come una linea del tempo: il gruppo in oro, i singoli sotto con il nome.',
    '«A che punto sono» mostra per ogni allievo le forme in corso e le ultime cose fatte.',
    'Nella scheda → Progressi, la card «Percorso»: dove vuole arrivare, il prossimo passo, su cosa sta lavorando.',
  ]],
  ['Le quote', [
    'Quote → Da incassare: chi deve pagare, quanto, entro quando. Un tocco e segni che ha pagato. Sotto, chi è in regola e fino a quando.',
    'Nella scheda dell\'allievo: «Ha pagato oggi» con la sua quota, o un\'altra data e importo. Un pagamento che avanza copre i mesi dopo; si annulla con motivo, mai si cancella.',
    'Chi non è iscritto al corso e viene lo stesso è una lezione in più da pagare (si cambia in recupero con un tocco).',
  ]],
  ['Gli avvisi e le notifiche', [
    'Ogni mattina l\'app guarda scadenze, quote, chi manca da tre lezioni, i file in cassetta, e mette gli Avvisi in Oggi.',
    'Le notifiche sul telefono sono al massimo due al giorno: al mattino solo se c\'è qualcosa, la sera solo se la lezione è ancora da chiudere. Si accendono dalla rotellina → Scadenze e avvisi.',
  ]],
  ['I promemoria agli allievi', [
    'Da una scadenza o da una quota aperta tocca «Ricorda su WhatsApp»: si apre WhatsApp con il messaggio già scritto, lo mandi tu. Serve il cellulare in scheda.',
  ]],
  ['Correggi parlando', [
    'Altro → Correggi parlando: scegli la cosa, l\'app la mostra e la legge, dici cosa cambiare, vedi prima → dopo, confermi. Tutto resta nella cronologia.',
  ]],
  ['Se qualcosa non va', [
    'Altro → Segnala un problema: scrivi cosa non va. Arriva come notifica a chi segue l\'app, senza dati personali.',
    'Altro → Diagnostica: la rete, il server, la coda dei lavori, le notifiche.',
  ]],
];

export function vistaAiuto(main) {
  testata('Aiuto', { indietro: 'altro' });
  main.append(el('p', { class: 'attenuato', testo: 'Le cinque schermate in basso: Oggi (la giornata), Allievi, Allenamenti (diario, programma, argomenti), Quote, Altro. La rotellina in alto apre le impostazioni. La bolla col microfono serve a dettare.' }));
  for (const [titolo, righe] of CAPITOLI) {
    main.append(sezione(titolo, el('div', { class: 'blocco' }, righe.map((t, i) => el('p', { class: i ? 'aiuto-riga' : 'aiuto-riga prima', testo: t })))));
  }
}
