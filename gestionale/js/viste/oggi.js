/* Longkai — viste/oggi.js: la prima schermata. In fase 0 legge il corso del giorno, le private, i conti di Da fare e Scadenze. */
import { el, icona, euro } from '../base.js';
import { corsoDelGiorno, privateDelGiorno, contiDaFare, contiScadenze, profilo } from '../dati.js';
import { testata, sezione, riga, scheletri, statoVuoto, statoErrore, toast } from '../ui.js';
import { oggiRoma, formattaData, formattaOra } from '../../comune/date.js';
import { formattaMinuti } from '../../comune/ore.js';

export async function vistaOggi(main) {
  const oggi = oggiRoma();
  testata(formattaData(oggi));
  document.getElementById('barra-alto').classList.remove('nascosto');
  main.replaceChildren(scheletri(4));
  const p = await profilo().catch(() => null);
  let corso, priv, daFare, scad;
  try {
    [corso, priv, daFare, scad] = await Promise.all([corsoDelGiorno(oggi), privateDelGiorno(oggi), contiDaFare(), contiScadenze()]);
  } catch (e) {
    // un errore non è "niente da mostrare": si dice e si offre Riprova
    main.replaceChildren(statoErrore(navigator.onLine ? e : new Error('Sei senza rete.'), () => vistaOggi(main)));
    return;
  }
  main.replaceChildren();

  // CORSO DI OGGI
  const blocco = el('div', { class: 'blocco' });
  if (corso) {
    blocco.append(
      el('div', { class: 'principale', testo: `${corso.nome} · ${corso.citta} · ${formattaOra(corso.ora)} · ${formattaMinuti(corso.durata_minuti)}` }),
      el('div', { class: 'secondaria attenuato', testo: `${corso.attesi} attesi` + (corso.stato_sessione === 'fatta' ? ' · fatto' : '') }),
      el('button', { class: 'tasto pieno grande', 'data-scrittura': '', style: null, onclick: () => toast('La dettatura arriva in fase 4.') }, [icona('microfono'), 'Detta il rapportino']),
      el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [
        el('button', { class: 'tasto bordo', testo: 'A mano', onclick: () => toast('Le presenze a mano arrivano in fase 2.') }),
        el('button', { class: 'tasto bordo', testo: 'Salta', onclick: () => toast('In fase 2.') }),
      ]),
    );
  } else {
    blocco.append(el('div', { class: 'principale', testo: 'Oggi nessun corso' }), el('div', { class: 'tasti riga-sotto', 'data-scrittura': '' }, [el('button', { class: 'tasto bordo', testo: 'Straordinaria', onclick: () => toast('In fase 2.') })]));
  }
  main.append(sezione('Corso di oggi', blocco));

  // PRIVATE
  const elenco = el('div', { class: 'elenco' });
  if (!priv.length) elenco.append(statoVuoto('Nessuna privata oggi.'));
  for (const s of priv) {
    const nome = s.allievi ? `${s.allievi.nome} ${s.allievi.cognome}`.trim() : 'da abbinare';
    elenco.append(riga({ principale: `${formattaOra(s.ora)} · ${nome}`, secondaria: formattaMinuti(s.durata_minuti), destra: s.stato_revisione === 'confermata' ? 'fatto' : 'da fare', pallino: s.stato_revisione === 'confermata' ? 'ok' : 'neutro', onclick: () => toast('In fase 2.') }));
  }
  main.append(sezione('Private', elenco, el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Privata', onclick: () => toast('In fase 2.') })));

  // DA FARE
  if (daFare) {
    const righe = [];
    if (daFare.quote) righe.push(riga({ principale: `${daFare.quote} quote da incassare`, destra: euro(daFare.quoteCent), pallino: 'attenzione', href: '#/allievi?f=da_pagare' }));
    if (daFare.daRichiamare) righe.push(riga({ principale: `${daFare.daRichiamare} da richiamare`, secondaria: 'mancano da 3 lezioni', pallino: 'info', href: '#/allievi?f=da_richiamare' }));
    if (daFare.daCompletare) righe.push(riga({ principale: `${daFare.daCompletare} schede da completare`, pallino: 'info', href: '#/allievi?f=da_completare' }));
    main.append(sezione('Da fare', righe.length ? el('div', { class: 'elenco' }, righe) : statoVuoto('Niente da fare. Bene.'), p?.ruolo === 'sifu' ? el('button', { class: 'tasto azione', 'data-scrittura': '', testo: '+ Pagamento', onclick: () => toast('In fase 3.') }) : null));
  }

  // SCADENZE
  if (scad) {
    const testo = `${scad.scadute} scadute · ${scad.entro7} entro 7 giorni · ${scad.entro30} entro 30`;
    main.append(sezione('Scadenze', el('div', { class: 'elenco' }, riga({ principale: testo, pallino: scad.scadute ? 'errore' : scad.entro7 ? 'attenzione' : 'ok', href: '#/scadenze' }))));
  }
}
