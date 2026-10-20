/* Lòngkai — app.js: l'app del Sifu. È il prototipo approvato (prototipi/app.html, versione 16), con i dati veri:
   si caricano dal database (js/dati.js) all'apertura e quando l'app torna davanti; ogni cambio si salva subito;
   Annulla rimette com'era e salva. I conti stanno in comune/regole.js, uguali per l'app e per il server. */
import {
  GG, MESI, MESI3, ORDINALI, FORME, due, daChiave, sposta, dataLunga, dataMedia, dataBreve, dataCorta, elide, ilGiorno, dataPiena,
  giorniFra, lunediDi, nomeMese, etichettaSettimana, etichettaIntervallo, meseDopo, dalGiorno, dataParole, ilData, delGiorno,
  maiuscola, adessoRoma, aggiornaOrario, oreFra, lezioniDeiCorsi, impostazioniDa, daDatabase, versoDatabase, creaRegole,
} from '../comune/regole.js';
import * as db from './dati.js';
import { apriMicrofono, estensioneDi, registrazioni } from './voce.js';
import { attivaPush, disattivaPush, statoPush, sincronizzaPush, iphoneNonInstallata, aggiornaBadge } from './push.js';

// --- Date: oggi è il giorno di Roma; il primo giorno d'uso viene dalle Impostazioni ---------------
let OGGI = adessoRoma().giorno;
let MESE = OGGI.slice(0, 7);
let PRIMO_GIORNO = OGGI;            // prima non si va
const dataAnno = k => k.slice(0, 4) === OGGI.slice(0, 4) ? dataCorta(k) : dataPiena(k);   // l'anno solo se non è quest'anno

// --- I dati: vengono dal database (js/dati.js) ------------------------------
const CORSI = {};      // i corsi delle Impostazioni: { Mortara: { giorni, inizio, fine, orario, ore, prezzo, settimane, prima } }

// I messaggi già scritti (FUNZIONALITA punto 7): si cambiano nelle Impostazioni. Tra { } quello che l'app mette da sola.
const TESTI = {
  cert30: { nome: 'Certificato, 30 giorni', testo: 'Ciao {nome}, il tuo certificato medico scade il {data}. Comincia a informarti per rifarlo, così resti in regola per allenarti.' },
  cert15: { nome: 'Certificato, 15 giorni', testo: 'Ciao {nome}, ti ricordo che il certificato medico scade il {data}, {tra}. Senza certificato non possiamo fare lezione: fallo appena riesci.' },
  scaduto: { nome: 'Certificato scaduto', testo: 'Ciao {nome}, il tuo certificato medico è scaduto il {data}. Senza certificato non possiamo fare lezione: rifallo appena riesci.' },
  manca: { nome: 'Certificato che manca', testo: 'Ciao {nome}, mi manca il tuo certificato medico. Senza certificato non possiamo fare lezione: portamelo appena riesci.' },
  mese: { nome: 'Mese da pagare', testo: 'Ciao {nome}, mi risulta ancora da pagare {mese}: {totale} € ({dettaglio}). Quando riesci, sistemiamo alla prossima lezione.' },
  quota: { nome: 'Solo la quota dei corsi', testo: 'Ciao {nome}, mi risulta ancora da pagare la quota di {mese}, {totale} €. Quando riesci, sistemiamo alla prossima lezione.' },
};
const SEGNAPOSTI = { cert30: '{nome} · {data}', cert15: '{nome} · {data} · {tra}', scaduto: '{nome} · {data}', manca: '{nome}', mese: '{nome} · {mese} · {totale} · {dettaglio}', quota: '{nome} · {mese} · {totale}' };
// Le impostazioni (menu ☰): i corsi sono gli stessi oggetti di CORSI. Il tema è di questo telefono.
const IMP = { tema: db.temaSalvato(), corsi: CORSI, prezzoPrivata: 0, chiusura: '08', notifiche: { cert30: true, cert15: true, pagamenti: true, ora: '08:00' },
  testi: JSON.parse(JSON.stringify(TESTI)), calendario: null };

const stato = { ora: adessoRoma().ora, giorno: OGGI, sezione: 'oggi', filtro: 'Tutti', cerca: '', vista: 'Lezioni', datiAperti: false, mostraUsciti: false,
  corso: 'Mortara', vistaCorso: 'Lezioni', vistaPrivate: 'Lezioni', scadenza: 'Pagamenti', piuAvanti: false, lezioni: [], allievi: [],
  email: '', push: 'spento', inAttesa: [], aggiornamento: null };

// --- Regole: i conti sono in comune/regole.js, gli stessi del server -------
const {
  allievo, roster, iniziata, iscrittiDi, presentiDi, cEra, lezioniDi, oreDi, conteggio, chiuso, scadenzaQuota, mesiDa,
  prezzoCorso, quotaCorsi, prezzoPrivata, conto, quoteRitardo, ritardo, certScaduto, formeDa, aggiornaForme, fattoNel, nonHaFatto,
} = creaRegole({
  get oggi() { return OGGI; }, get mese() { return MESE; }, get ora() { return stato.ora; },
  imp: IMP, get lezioni() { return stato.lezioni; }, get allievi() { return stato.allievi; },
});
const trova = id => stato.lezioni.find(l => l.id === id);
const titolo = l => l.tipo === 'corso' ? `Corso ${l.corso}` : `Privata · ${l.allievo}`;
const breve = l => l.tipo === 'corso' ? `Corso ${l.corso}` : `Priv. · ${l.allievo}`;   // nelle righe: niente a capo
const orario = l => l.tipo === 'corso' ? (l.orarioCorso || CORSI[l.corso].orario) : `${l.inizio}-${l.fine}`;
const quando = l => l.giorno === OGGI ? 'oggi' : dataBreve(l.giorno);
const mancano = assenti => `${assenti.length === 1 ? 'manca' : 'mancano'} ${assenti.join(', ')}`;
const testoAppello = l => l.appello.assenti.length
  ? `${presentiDi(l).length} presenti · ${mancano(l.appello.assenti)}`
  : `tutti presenti (${presentiDi(l).length})`;
const appelloBreve = l => l.appello.assenti.length > 1 ? `${presentiDi(l).length} presenti · mancano ${l.appello.assenti.length}` : testoAppello(l);
const daRaccontare = () => stato.lezioni
  .filter(l => l.giorno >= PRIMO_GIORNO && l.giorno < OGGI && l.giorno >= sposta(OGGI, -14) && !l.fatto && !l.nonFatta)
  .sort((a, b) => b.giorno.localeCompare(a.giorno));
function riassunto(l) {     // il testo vero: se non ci sta, i puntini
  if (l.tipo === 'privata') return l.fatto.testo;
  const soli = l.fatto.soli.map(s => `${s.chi}: ${s.cosa}`).join(', ');
  return l.fatto.gruppo + (soli ? ` · da solo ${soli}` : '');
}
const nonFattaTesto = l => l.motivo === 'assente' ? 'non è venuto' : l.motivo === 'annullata' ? 'annullata' : 'non si è fatta';
function segnaAppello(l, assenti) { l.iscritti = iscrittiDi(l); l.appello = { assenti: [...assenti] }; }
const contoRiga = (nome, x) => `<div class="conto"><span class="conto-nome">${nome}</span><span class="barretta" aria-hidden="true"><span class="si" style="width:${x.tot ? Math.round(x.fatte / x.tot * 100) : 0}%"></span></span><span class="conto-num">${x.fatte} su ${x.tot}</span></div>`;
function conti(c) {
  const righe = [];
  if (c.corsi.tot) righe.push(contoRiga('Corsi', c.corsi));
  if (c.private.tot) righe.push(contoRiga('Private', c.private));
  if (c.senzaRapporto.length) righe.push(`<p class="nota">${c.senzaRapporto.length === 1
    ? `manca il rapporto ${delGiorno(c.senzaRapporto[0])}`
    : `mancano ${c.senzaRapporto.length} rapporti: ${c.senzaRapporto.map(dataCorta).join(', ')}`}</p>`);
  return righe.join('');
}
const delMese = (lez, m) => lez.filter(l => l.giorno.startsWith(m));
// Il conto riga per riga: cosa e quanto
function righeConto(a, m) {
  const c = conto(a, m), r = [], mp = nomeMese(c.mesePrima), pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  if (chiuso(m)) r.push([`${nomeMese(m)}: scuola chiusa`, '0 €']);
  else for (const k of a.corsi) r.push([`Corso ${k}`, `${prezzoCorso(a, k)} €`]);
  if (c.nPriv) r.push([`${pl(c.nPriv, 'privata', 'private')} × ${prezzoPrivata(a)} €`, `${c.priv} €`]);
  if (c.nDiff < 0) r.push([`credito di ${mp}: ${pl(-c.nDiff, 'privata', 'private')}`, `−${-c.diff} €`]);
  if (c.nDiff > 0) r.push([`${pl(c.nDiff, 'privata', 'private')} in più a ${mp}`, `+${c.diff} €`]);
  return { c, r };
}
function segno(a) { return ritardo(a) ? '! pagamento' : certScaduto(a) ? '! certificato' : ''; }
function prossimaScadenza(a) {   // la prossima quota da pagare, col giorno vero
  const m = [...mesiDa(a), meseDopo(MESE, 1)].find(x => !chiuso(x) && !a.pagato[x]);
  return m ? `${dataCorta(scadenzaQuota(a, m))} · ${nomeMese(m)}` : `pagato fino a ${nomeMese(meseDopo(MESE, 1))}`;
}
const fa = a => [...a.corsi, ...(a.private ? ['Private'] : [])].join(' · ') || 'niente';
const ultimoPagamento = a => Object.values(a.pagato).filter(Boolean).sort().at(-1);
const statoForma = ({ v, n }) => v === 0 ? 'non ancora' : v >= n ? 'completa' : `${ORDINALI[v]} sezione`;

// --- Quello che la voce chiede, e cosa fa -----------------------------------
// `riordina` (sul server, Claude) risponde una lista di azioni; qui si fanno una per una, come nel prototipo.
// Ogni azione risponde [{ luogo, righe }] per "Ho capito così"; quello che non torna va nei dubbi ("Non ho capito").
const luogoLezione = l => `${breve(l)} · ${quando(l)}`;
const conNome = nome => stato.allievi.find(a => a.nome.toLowerCase() === String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase());
const corsoVero = c => Object.keys(CORSI).find(k => k.toLowerCase() === String(c || '').trim().toLowerCase());
const giornoValido = g => /^\d{4}-\d{2}-\d{2}$/.test(g || '');
const oraValida = o => /^\d{2}:\d{2}$/.test(o || '');
const dentroScheda = a => pila.at(-1)?.tipo === 'scheda' && pila.at(-1).nome === a.nome;
function lezioneDa(az, dubbi) {
  const l = trova(az.lezione);
  if (!l) dubbi.push('non trovo la lezione');
  return l;
}
function allievoDa(az, dubbi) {
  const a = conNome(az.allievo);
  if (!a) dubbi.push(`non trovo l'allievo «${az.allievo || ''}»`);
  return a;
}
const assentiDi = (l, nomi) => (nomi || []).map(n => conNome(n)?.nome).filter(n => n && iscrittiDi(l).includes(n));
function aggiungiAllievo(a) {
  stato.allievi.push(a);
  stato.allievi.sort((x, y) => x.nome.localeCompare(y.nome, 'it'));
}

const AZIONI_VOCE = {
  racconto(az, dubbi) {        // cosa si è fatto: il gruppo e chi da solo (corso), il testo (privata); il contenuto intero
    const l = lezioneDa(az, dubbi); if (!l) return [];
    const testo = String((l.tipo === 'corso' ? az.gruppo : az.testo) || '').trim();
    if (!testo) { dubbi.push(`${luogoLezione(l)}: cosa avete fatto?`); return []; }
    if (!iniziata(l)) return AZIONI_VOCE.previsto({ lezione: l.id, testo }, dubbi);   // prima della lezione è il previsto
    l.nonFatta = false; delete l.motivo;
    if (l.tipo === 'privata') { l.fatto = { testo }; aggiornaForme(l.allievo, testo); return [{ luogo: luogoLezione(l), righe: [testo] }]; }
    const soli = (az.soli || []).map(s => ({ chi: conNome(s.allievo)?.nome, cosa: String(s.cosa || '').trim() })).filter(s => s.chi && s.cosa);
    l.fatto = { gruppo: testo, soli };
    if (Array.isArray(az.assenti)) segnaAppello(l, assentiDi(l, az.assenti));
    return [{ luogo: luogoLezione(l), righe: [`gruppo: ${testo}`, ...soli.map(s => `da solo · ${s.chi}: ${s.cosa}`), ...(l.appello ? [testoAppello(l)] : [])] }];
  },
  appello(az, dubbi) {         // chi mancava: tutta la lista, anche quando si corregge
    const l = lezioneDa(az, dubbi); if (!l || l.tipo !== 'corso') return [];
    segnaAppello(l, assentiDi(l, az.assenti));
    return [{ luogo: luogoLezione(l), righe: [testoAppello(l)] }];
  },
  previsto(az, dubbi) {
    const l = lezioneDa(az, dubbi); if (!l) return [];
    const testo = String(az.testo || '').trim(); if (!testo) return [];
    l.previsto = testo;
    return [{ luogo: luogoLezione(l), righe: [`previsto: ${testo}`] }];
  },
  non_fatta(az, dubbi) {       // il corso non c'è stato; la privata è annullata, o l'allievo non è venuto
    const l = lezioneDa(az, dubbi); if (!l) return [];
    l.nonFatta = true;
    if (l.tipo === 'corso') { delete l.motivo; return [{ luogo: luogoLezione(l), righe: ['non si è fatta', 'niente ore, niente assenze'] }]; }
    if (az.motivo === 'assente' && iniziata(l)) { l.motivo = 'assente'; return [{ luogo: luogoLezione(l), righe: ['non è venuto', 'niente ore, niente da pagare'] }]; }
    l.motivo = 'annullata';
    return [{ luogo: luogoLezione(l), righe: ['annullata', 'niente ore, niente da pagare'] }];
  },
  pagato(az, dubbi) {          // il mese più vecchio da pagare, se non lo dice; tutto il conto, mai a metà
    const a = allievoDa(az, dubbi); if (!a) return [];
    let m = /^\d{4}-\d{2}$/.test(az.mese || '') ? az.mese : null;
    if (!m) m = quoteRitardo(a)[0] || (a.dal <= MESE && !a.pagato[MESE] && conto(a, MESE).tot ? MESE : null);
    if (!m) { dubbi.push(`${a.nome}: non ha niente da pagare`); return []; }
    if (a.pagato[m]) { dubbi.push(`${a.nome}: ${nomeMese(m)} è già pagato`); return []; }
    if (m < a.dal || m > meseDopo(MESE, 1) || !conto(a, m).tot) { dubbi.push(`${a.nome}: ${nomeMese(m)} non è da pagare`); return []; }
    const tot = conto(a, m).tot;
    a.cifre[m] = tot; a.pagato[m] = OGGI;
    return [{ luogo: 'Pagamenti', righe: [`${a.nome} · ${nomeMese(m)} pagato${m > MESE ? ' in anticipo' : ''}, ${tot} €`] }];
  },
  certificato(az, dubbi) {
    const a = allievoDa(az, dubbi); if (!a) return [];
    if (!giornoValido(az.fino)) { dubbi.push(`${a.nome}: fino a quando vale il certificato?`); return []; }
    a.cert = az.fino;
    const al = elide(az.fino) ? "all'" : 'al ';
    return dentroScheda(a) ? [{ luogo: `Scheda · ${a.nome}`, righe: [`certificato fino ${al}${dataPiena(az.fino)}`] }]
      : [{ luogo: 'Certificati', righe: [`${a.nome} · certificato fino ${al}${dataPiena(az.fino)}`] }];
  },
  nuovo_allievo(az, dubbi) {
    const nome = String(az.nome || '').trim().replace(/\s+/g, ' ');
    if (!nome) { dubbi.push('il nome del nuovo allievo'); return []; }
    if (conNome(nome)) { dubbi.push(`c'è già un allievo che si chiama ${nome}`); return []; }
    const corsi = [...new Set((az.corsi || []).map(corsoVero).filter(Boolean))];
    const priv = !!az.private;
    const a = nuovoAllievo(nome, corsi, priv, IMP.prezzoPrivata, String(az.telefono || '').trim(), Number.isInteger(az.private_mese) ? az.private_mese : 4);
    if (giornoValido(az.certificato)) a.cert = az.certificato;
    aggiungiAllievo(a);
    return [{ luogo: 'Allievi', righe: [`${nome} · ${fa(a)}${a.corsi.length ? ` · ${quotaCorsi(a)} € al mese` : ''}`] }];
  },
  scheda(az, dubbi) {          // i cambi nella scheda: corsi, prezzi, private, cellulare, non viene più o torna
    const a = allievoDa(az, dubbi); if (!a) return [];
    const righe = [];
    for (const c of (az.aggiungi_corsi || []).map(corsoVero)) if (c && !a.corsi.includes(c)) { a.corsi.push(c); righe.push(`fa anche ${c}`); }
    for (const c of (az.togli_corsi || []).map(corsoVero)) if (c && a.corsi.includes(c)) { a.corsi = a.corsi.filter(x => x !== c); righe.push(`non fa più ${c}`); }
    let prezzi = false;
    for (const p of az.prezzi_corsi || []) {
      const c = corsoVero(p.corso), v = Number(p.euro);
      if (!c || !Number.isFinite(v) || v < 0) continue;
      if (v === CORSI[c].prezzo) delete a.prezzi[c]; else a.prezzi[c] = v;
      righe.push(`${c}: ${v} € al mese`); prezzi = true;
    }
    if (prezzi) righe.push(`corsi: ${quotaCorsi(a)} € al mese`);
    if (Number.isInteger(az.private_mese) && az.private_mese >= 0) {
      if (az.private_mese && !a.private) a.private = true;
      a.privateMese = az.private_mese;
      righe.push(`${az.private_mese} ${az.private_mese === 1 ? 'privata' : 'private'} al mese`);
    }
    if (typeof az.private === 'boolean' && az.private !== a.private) {
      a.private = az.private;
      if (!a.private) a.privateMese = 0;
      righe.push(a.private ? 'fa le private' : 'non fa più le private');
    }
    if (typeof az.prezzo_privata === 'number' && az.prezzo_privata >= 0) {
      a.privata = az.prezzo_privata === IMP.prezzoPrivata ? null : az.prezzo_privata;
      righe.push(`privata: ${az.prezzo_privata} € a lezione`);
    }
    if (az.telefono) { a.cell = String(az.telefono).trim(); righe.push(`cellulare: ${a.cell}`); }
    if (typeof az.uscito === 'boolean' && az.uscito !== a.uscito) { a.uscito = az.uscito; righe.push(a.uscito ? 'non viene più' : 'torna a venire'); }
    return righe.length ? [{ luogo: `Scheda · ${a.nome}`, righe }] : [];
  },
  forma(az, dubbi) {           // dove è arrivato: quante sezioni di una forma
    const a = allievoDa(az, dubbi); if (!a) return [];
    const f = FORME.find(([n]) => n.toLowerCase() === String(az.forma || '').trim().toLowerCase());
    if (!f) { dubbi.push(`non conosco la forma «${az.forma || ''}»`); return []; }
    const v = Math.max(0, Math.min(f[1], Math.round(Number(az.sezioni) || 0)));
    a.forme[f[0]] = v;
    return [{ luogo: `Scheda · ${a.nome}`, righe: [`${f[0]}: ${statoForma({ v, n: f[1] })}`] }];
  },
  privata(az, dubbi) {         // una privata che non è nel calendario, detta a voce (oggi o nei giorni passati)
    const a = allievoDa(az, dubbi); if (!a) return [];
    const giorno = giornoValido(az.giorno) ? az.giorno : OGGI;
    if (giorno < PRIMO_GIORNO || giorno > OGGI) { dubbi.push(`la privata di ${a.nome}: che giorno?`); return []; }
    if (!oraValida(az.inizio)) { dubbi.push(`la privata di ${a.nome}: a che ora?`); return []; }
    const inizio = az.inizio, fine = oraValida(az.fine) && az.fine > inizio ? az.fine : `${due(Math.min(23, Number(inizio.slice(0, 2)) + 1))}:${inizio.slice(3)}`;
    const gia = stato.lezioni.find(l => l.tipo === 'privata' && l.allievo === a.nome && l.giorno === giorno && l.inizio === inizio);
    const l = gia || { id: `voce:${db.nuovoId()}`, giorno, tipo: 'privata', allievo: a.nome, inizio, fine, ore: oreFra(inizio, fine) || 1 };
    if (!gia) stato.lezioni.push(l);
    const righe = gia ? [] : [`privata nuova, ${inizio}-${fine}`];
    const testo = String(az.testo || '').trim();
    if (testo && iniziata(l)) { l.nonFatta = false; delete l.motivo; l.fatto = { testo }; aggiornaForme(a.nome, testo); righe.push(testo); }
    return righe.length ? [{ luogo: luogoLezione(l), righe }] : [];
  },
};

// Le azioni, una per una; i gruppi con lo stesso luogo si uniscono. Le segnalazioni partono a parte.
function applicaAzioni(azioni) {
  const gruppi = [], dubbi = [], segnalazioni = [];
  for (const az of Array.isArray(azioni) ? azioni : []) {
    if (az && az.tipo === 'segnalazione') { if (String(az.testo || '').trim()) segnalazioni.push(String(az.testo).trim()); continue; }
    const fn = az && Object.hasOwn(AZIONI_VOCE, az.tipo) ? AZIONI_VOCE[az.tipo] : null;
    if (fn) gruppi.push(...fn(az, dubbi));
  }
  const uniti = [];
  for (const g of gruppi) {
    const c = uniti.find(x => x.luogo === g.luogo);
    if (c) c.righe.push(...g.righe.filter(r => !c.righe.includes(r))); else uniti.push({ luogo: g.luogo, righe: [...g.righe] });
  }
  return { gruppi: uniti, dubbi, segnalazioni };
}

function nuovoAllievo(nome, corsi, priv, privata, cell, privateMese = 0) {
  const g = Number(OGGI.slice(8));
  const a = { id: db.nuovoId(), nome, corsi, private: priv, privateMese: priv ? privateMese : 0, prezzi: {}, privata: privata === IMP.prezzoPrivata ? null : privata, giorno: g, cert: '', forme: {}, cell, uscito: false,
    pagato: { [MESE]: OGGI }, cifre: {}, dal: MESE };
  a.cifre[MESE] = conto(a, MESE).tot;   // il primo mese lo paga quando comincia
  return a;
}

// --- Icone --------------------------------------------------------------
const ICONA = {
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  sx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  dx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  lente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/></svg>',
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const tastoDetta = (id, classe = '') => `<button type="button" class="tasto ${classe}" data-az="detta" data-id="${esc(id)}">${ICONA.mic}Detta</button>`;
const FRECCIA = `<span class="freccia" aria-hidden="true">${ICONA.dx}</span>`;
const selettore = (voci, scelta, az, nomi = {}) => `<div class="selettore" role="group">${voci.map(v =>
  `<button type="button" data-az="${az}" data-v="${v}" aria-pressed="${v === scelta}">${nomi[v] || v}</button>`).join('')}</div>`;

// --- La pila dei pannelli (scheda, lezione, periodo, nuovo allievo) ------
const pila = [];
const apri = p => { pila.push(p); disegnaPila(); };
const indietro = () => { pila.pop(); disegnaPila(); };

// --- Oggi ---------------------------------------------------------------
function altoOggi() {
  return `
    <button type="button" class="icona-tasto" data-az="giorno" data-passo="-1" aria-label="Giorno prima" ${stato.giorno <= PRIMO_GIORNO ? 'disabled' : ''}>${ICONA.sx}</button>
    <div class="data"><strong>${dataMedia(stato.giorno)}</strong></div>
    <button type="button" class="icona-tasto" data-az="giorno" data-passo="1" aria-label="Giorno dopo" ${stato.giorno === OGGI ? 'disabled' : ''}>${ICONA.dx}</button>
    <button type="button" class="icona-tasto" data-az="menu" aria-label="Menu">${ICONA.menu}</button>`;
}

// Una riga sola di stato: ogni lezione sta in due righe, come le sue due ore.
function statoOggi(l) {
  if (!l.fatto && !l.nonFatta && stato.inAttesa.some(r => r.ctx.tipo === 'lezione' && r.ctx.id === l.id)) return '<div class="riga attesa">in attesa</div>';   // la registrazione aspetta la rete
  if (l.nonFatta) return `<div class="riga">${maiuscola(nonFattaTesto(l))}</div>`;
  if (l.fatto) {
    if (l.tipo === 'corso' && !l.appello) return `<div class="riga da-fare">chi c'era? non detto</div>`;
    return `<div class="riga ok">${esc(riassunto(l))}</div>`;
  }
  if (iniziata(l)) {
    const presenti = l.tipo === 'corso' && l.appello ? ` · ${esc(testoAppello(l))}` : '';
    return `<div class="riga"><span class="da-fare-testo">da raccontare</span>${presenti}</div>`;
  }
  if (l.previsto) return `<div class="riga"><span class="etich">Previsto:</span> ${esc(l.previsto)}</div>`;
  if (l.tipo === 'corso' && l.appello) return `<div class="riga">${esc(testoAppello(l))}</div>`;
  return '';
}

function rigaLezione(l, statoHtml, colonna, conTasto) {
  const tasto = conTasto && !l.fatto && !l.nonFatta ? tastoDetta(l.id) : FRECCIA;
  return `
    <article class="lezione${l.nonFatta ? ' spenta' : ''}${colonna.data ? ' data-col' : ''}" id="lez-${esc(l.id)}">
      <button type="button" class="stendi" data-az="apri" data-id="${esc(l.id)}" aria-label="Apri ${esc(titolo(l))}"></button>
      <div class="ora">${colonna.su}<span class="fine">${colonna.giu}</span></div>
      <div class="titolo">${esc(colonna.titolo || breve(l))}</div>
      <div class="stato">${statoHtml}</div>
      ${tasto}
    </article>`;
}
const colonnaOra = l => ({ su: l.inizio, giu: l.tipo === 'corso' ? (l.fineCorso || CORSI[l.corso].fine) : l.fine });
const colonnaData = l => { const d = daChiave(l.giorno); return { data: true, su: `${d.getDate()}/${d.getMonth() + 1}`, giu: GG[d.getDay()] }; };

function listaOggi() {
  const lez = stato.lezioni.filter(l => l.giorno === stato.giorno).sort((a, b) => a.inizio.localeCompare(b.inizio));
  let html = lez.length ? lez.map(l => rigaLezione(l, statoOggi(l), colonnaOra(l), true)).join('') : '<div class="vuoto-logo"><span class="logo" aria-hidden="true"></span><p class="vuoto">Niente lezioni</p></div>';
  if (stato.giorno === OGGI) {
    const arretrate = daRaccontare();
    if (arretrate.length) {
      html += `<section class="blocco"><h2 class="titolo-blocco">DA RACCONTARE</h2>${arretrate.map(l => {
        const c = colonnaData(l);
        return `
        <article class="lezione arretrata">
          <button type="button" class="stendi" data-az="vai" data-giorno="${l.giorno}" data-id="${esc(l.id)}" aria-label="Vai a ${dataLunga(l.giorno)}"></button>
          <div class="ora">${c.su}<span class="fine">${c.giu}</span></div>
          <div class="titolo">${esc(breve(l))}</div>
          ${tastoDetta(l.id, 'secondario')}
        </article>`; }).join('')}</section>`;
    }
  }
  return html;
}

// --- Allievi: la lista --------------------------------------------------
function altoAllievi() {
  return `
    <label class="cerca-box">${ICONA.lente}<input class="cerca" id="cerca" type="search" placeholder="Cerca" aria-label="Cerca un allievo" value="${esc(stato.cerca)}" autocomplete="off"></label>
    <button type="button" class="aggiungi" data-az="nuovo">+ Allievo</button>
    <button type="button" class="icona-tasto" data-az="menu" aria-label="Menu">${ICONA.menu}</button>`;
}
function rigaPersona(a) {
  const ore = oreDi(a.nome, delMese(lezioniDi(a.nome), MESE));
  return `
    <article class="persona${a.uscito ? ' uscito' : ''}">
      <button type="button" class="stendi" data-az="scheda" data-nome="${esc(a.nome)}" aria-label="Apri la scheda di ${esc(a.nome)}"></button>
      <div class="nome">${esc(a.nome)}</div>
      <div class="ore">${ore} ${ore === 1 ? 'ora' : 'ore'}</div>
      <div class="fa">${a.uscito ? 'non viene più' : esc(fa(a))}</div>
      <div class="segno">${esc(segno(a))}</div>
      ${FRECCIA}
    </article>`;
}
function listaAllievi() {
  const f = stato.filtro, q = stato.cerca.trim().toLowerCase();
  const passa = a => (f === 'Tutti' || (f === 'Private' ? a.private : a.corsi.includes(f))) && (!q || a.nome.toLowerCase().includes(q));
  const attivi = stato.allievi.filter(a => !a.uscito && passa(a));
  const usciti = stato.allievi.filter(a => a.uscito && passa(a));
  let html = selettore(['Tutti', 'Mortara', 'Vigevano', 'Private'], f, 'filtro');
  html += attivi.length ? attivi.map(rigaPersona).join('') : '<p class="vuoto">Nessun allievo</p>';
  if (usciti.length) {
    html += `<button type="button" class="usciti" data-az="mostra-usciti"><span>Non vengono più · ${usciti.length}</span>${stato.mostraUsciti ? '' : ICONA.dx}</button>`;
    if (stato.mostraUsciti) html += usciti.map(rigaPersona).join('');
  }
  return html;
}

// --- La scheda dell'allievo ---------------------------------------------
function scheda(a) {
  const lez = lezioniDi(a.nome);
  const mese = delMese(lez, MESE);
  const ore = oreDi(a.nome, mese);
  const c = conteggio(a.nome, mese);
  const ult = ultimoPagamento(a);
  const riassuntoDati = [a.cert ? `cert. fino ${elide(a.cert) ? "all'" : 'al '}${dataAnno(a.cert)}` : 'certificato: manca', ult ? `pagato ${ilGiorno(ult)}` : 'mai pagato'].join(' · ');
  const forme = formeDa(a).map(x => `
    <div class="forma">
      <button type="button" class="stendi" data-az="forma" data-f="${x.f}" aria-label="${x.f}: cambia"></button>
      <span class="forma-nome">${x.f}</span>
      <span class="tacche" aria-hidden="true">${Array.from({ length: x.n }, (_, i) => `<span class="tacca${i < x.v ? ' si' : ''}"></span>`).join('')}</span>
      <span class="forma-stato">${statoForma(x)}</span>
      ${FRECCIA}
    </div>`).join('');

  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Scheda di ${esc(a.nome)}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}${stato.sezione === 'scadenze' ? 'Scadenze' : 'Allievi'}</button></header>
      <div class="corpo-pannello gutter">
        <h1>${esc(a.nome)}</h1>
        <p class="sotto">${a.uscito ? 'non viene più' : esc(fa(a))}</p>
        ${avvisiPagamento(a)}
        ${creditoScheda(a)}

        <section class="blocco">
          <h2 class="titolo-blocco">${nomeMese(MESE).toUpperCase()}</h2>
          <div class="ore-mese"><strong>${ore}</strong><span>${ore === 1 ? 'ora' : 'ore'}</span></div>
          <div class="conti">${conti(c) || '<p class="nota">nessuna lezione</p>'}</div>
        </section>

        <button type="button" class="dati-riga" data-az="dati" aria-expanded="${stato.datiAperti}">
          <strong>Dati</strong><span class="valore">${esc(riassuntoDati)}</span>${ICONA.dx}
        </button>
        ${stato.datiAperti ? dati(a) : ''}

        <section class="blocco">
          <h2 class="titolo-blocco">DOVE È ARRIVATO</h2>
          ${forme || '<p class="testo-blocco muto">Tutte le forme completate.</p>'}
        </section>

        <section class="blocco">
          <h2 class="titolo-blocco">LA SUA STORIA</h2>
          ${selettore(['Lezioni', 'Settimane', 'Mesi'], stato.vista, 'vista')}
          ${storia(a, lez)}
        </section>
      </div>
    </div>`;
}

function avvisiPagamento(a) {    // in cima alla scheda: ogni mese in ritardo, da spuntare, col messaggio già scritto
  return quoteRitardo(a).map(m => rigaRitardo(a, m, `${maiuscola(nomeMese(m))} · ${conto(a, m).tot} €`, `non pagato, ${dalGiorno(scadenzaQuota(a, m))}`, ' avviso')).join('');
}
function creditoScheda(a) {      // in alto nella scheda, solo se c'è: il credito che si toglie dal prossimo conto da pagare
  if (a.uscito) return '';
  const m = [...mesiDa(a), meseDopo(MESE, 1)].find(x => !a.pagato[x] && conto(a, x).tot);
  if (!m) return '';
  const c = conto(a, m), mp = nomeMese(c.mesePrima), perche = [];
  const credito = c.nDiff < 0 ? -c.diff : 0;
  if (!credito) return '';
  if (c.nDiff < 0) perche.push(`${-c.nDiff} ${-c.nDiff === 1 ? 'privata non fatta' : 'private non fatte'} a ${mp}`);
  return `<button type="button" class="credito" data-az="conto" data-nome="${esc(a.nome)}" data-m="${m}" aria-label="Credito di ${credito} euro, tolto dal conto di ${nomeMese(m)}">
      <span class="credito-cifra">Credito ${credito} €</span><span class="credito-perche">${perche.join(' · ')}</span>${FRECCIA}</button>`;
}

function dati(a) {
  const ult = ultimoPagamento(a);
  return `
    <div class="campo"><span class="nome-campo">Certificato</span>
      <div class="campo-valore"><input type="date" id="c-cert" data-campo="cert" value="${a.cert}" aria-label="Certificato fino al"></div></div>
    ${a.corsi.map(k => `<div class="campo"><span class="nome-campo">${k}</span>
      <div class="campo-valore"><input type="number" inputmode="numeric" min="0" id="c-prezzo-${k}" data-prezzo="${k}" value="${prezzoCorso(a, k)}" aria-label="Prezzo di ${k} al mese in euro"><span class="unita">€ al mese</span></div></div>`).join('')}
    <div class="campo"><span class="nome-campo">Corsi</span>
      <div class="campo-valore"><span class="valore">${quotaCorsi(a)} € al mese</span></div></div>
    ${a.private ? `<div class="campo"><span class="nome-campo">Private al mese</span>
      <div class="campo-valore"><input type="number" inputmode="numeric" min="0" id="c-privateMese" data-campo="privateMese" value="${a.privateMese}" aria-label="Quante private al mese"><span class="unita">al mese</span></div></div>
    <div class="campo"><span class="nome-campo">Prezzo privata</span>
      <div class="campo-valore"><input type="number" inputmode="numeric" min="0" id="c-privata" data-campo="privata" value="${prezzoPrivata(a)}" aria-label="Prezzo della privata in euro"><span class="unita">€ a lezione</span></div></div>` : ''}
    <div class="campo"><span class="nome-campo">Paga entro il</span>
      <div class="campo-valore"><span class="valore">${prossimaScadenza(a)}</span></div></div>
    <div class="campo"><span class="nome-campo">Ultimo pag.</span>
      <div class="campo-valore"><span class="valore">${ult ? dataPiena(ult) : 'mai'}</span></div></div>
    <div class="campo largo"><span class="nome-campo">Fa</span>
      <div class="scelte">${['Mortara', 'Vigevano', 'Private'].map(c => {
        const si = c === 'Private' ? a.private : a.corsi.includes(c);
        return `<button type="button" class="scelta" data-az="fa" data-c="${c}" aria-pressed="${si}">${c}</button>`; }).join('')}</div></div>
    <div class="campo largo"><span class="nome-campo">Cellulare</span>
      <div class="campo-valore"><input type="tel" id="c-cell" data-campo="cell" value="${esc(a.cell)}" aria-label="Cellulare"><button type="button" class="tasto secondario piccolo" data-az="whatsapp">WhatsApp</button></div></div>
    <div class="campo"><span class="nome-campo"></span>
      <div class="campo-valore">${a.uscito
        ? '<button type="button" class="link" data-az="torna">Torna a venire</button>'
        : '<button type="button" class="link rosso" data-az="esce">Non viene più</button>'}</div></div>`;
}

function statoStoria(l, nome) {
  if (l.nonFatta) return `<div class="riga">${nonFattaTesto(l)}</div>`;
  if (l.tipo === 'privata') return l.fatto ? `<div class="riga ok">${esc(l.fatto.testo)}</div>` : '<div class="riga">manca il rapporto</div>';
  if (!l.appello) return '<div class="riga">manca il rapporto</div>';
  if (!cEra(l, nome)) return `<div class="riga">assente${l.fatto ? ` · il gruppo: ${esc(l.fatto.gruppo)}` : ''}</div>`;
  if (!l.fatto) return '<div class="riga">c’era · manca il rapporto</div>';
  const suo = l.fatto.soli.filter(s => s.chi === nome).map(s => s.cosa);
  return `<div class="riga ok">${esc(l.fatto.gruppo)}${suo.length ? ` · da solo: ${esc(suo.join(', '))}` : ''}</div>`;
}
const righeLezioni = (lez, nome) => lez.map(l => rigaLezione(l, statoStoria(l, nome),
  { ...colonnaData(l), titolo: l.tipo === 'corso' ? `Corso ${l.corso}` : 'Privata' }, false)).join('') || '<p class="vuoto">Nessuna lezione</p>';

function righePeriodi(a, lez, per) {
  const gruppi = new Map();
  for (const l of lez) { const k = per(l.giorno); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(l); }
  return [...gruppi].map(([k, ls]) => {
    const etichetta = k.length === 7 ? nomeMese(k) : etichettaSettimana(k);
    const fatto = fattoNel(a.nome, ls), manca = nonHaFatto(a.nome, ls);
    const ore = oreDi(a.nome, ls);
    return `
      <article class="periodo">
        <button type="button" class="stendi" data-az="periodo" data-k="${k}" aria-label="Apri ${etichetta}"></button>
        <div class="corpo">
          <div class="periodo-testa"><span class="periodo-titolo">${etichetta}</span><span class="periodo-ore">${ore} ${ore === 1 ? 'ora' : 'ore'}</span></div>
          ${conti(conteggio(a.nome, ls))}
          <div class="riga">${fatto.length ? `<span class="etich">fatto:</span> ${esc(fatto.join(', '))}` : 'niente'}</div>
          ${manca.length ? `<div class="riga"><span class="da-fare-testo">non ha fatto:</span> ${esc(manca.join(', '))}</div>` : ''}
        </div>
        ${FRECCIA}
      </article>`;
  }).join('') || '<p class="vuoto">Niente</p>';
}
function storia(a, lez) {
  if (stato.vista === 'Settimane') return righePeriodi(a, lez, lunediDi);
  if (stato.vista === 'Mesi') return righePeriodi(a, lez, g => g.slice(0, 7));
  return righeLezioni(lez, a.nome);
}
function periodo(p) {
  const a = allievo(p.nome);
  const lez = lezioniDi(a.nome).filter(l => p.k.length === 7 ? l.giorno.startsWith(p.k) : lunediDi(l.giorno) === p.k)
    .filter(l => !p.soloPrivate || l.tipo === 'privata');
  const etichetta = p.k.length === 7 ? nomeMese(p.k) : etichettaSettimana(p.k);
  const manca = nonHaFatto(a.nome, lez);
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="${esc(a.nome)}, ${etichetta}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}${esc(a.nome)}</button></header>
      <div class="corpo-pannello gutter">
        <h1>${etichetta}</h1>
        <p class="sotto">${esc(a.nome)} · ${oreDi(a.nome, lez)} ${oreDi(a.nome, lez) === 1 ? 'ora' : 'ore'}</p>
        <div class="conti">${conti(conteggio(a.nome, lez))}</div>
        <section class="blocco">${righeLezioni(lez, a.nome)}</section>
        ${manca.length ? `<section class="blocco"><h2 class="titolo-blocco">NON HA FATTO</h2><div class="nomi" style="grid-template-columns:1fr">${manca.map(m => `<span>${esc(m)}</span>`).join('')}</div></section>` : ''}
      </div>
    </div>`;
}

function nuovoForm() {
  const n = stato.nuovo;
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Nuovo allievo">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}Allievi</button></header>
      <div class="corpo-pannello gutter">
        <h1>Nuovo allievo</h1>
        <p class="sotto">Oppure dillo: «nuovo allievo, fa Mortara…»</p>
        <section class="blocco">
          <div class="campo"><span class="nome-campo">Nome</span><div class="campo-valore"><input type="text" id="n-nome" data-nuovo="nome" value="${esc(n.nome)}" aria-label="Nome"></div></div>
          <div class="campo"><span class="nome-campo">Cellulare</span><div class="campo-valore"><input type="tel" id="n-cell" data-nuovo="cell" value="${esc(n.cell)}" aria-label="Cellulare"></div></div>
          <div class="campo largo"><span class="nome-campo">Fa</span><div class="scelte">${['Mortara', 'Vigevano', 'Private'].map(c =>
            `<button type="button" class="scelta" data-az="nuovo-fa" data-c="${c}" aria-pressed="${n.fa.includes(c)}">${c}</button>`).join('')}</div></div>
          <div class="campo"><span class="nome-campo">Corsi</span><div class="campo-valore"><span class="valore">${n.fa.filter(c => c !== 'Private').reduce((s, c) => s + CORSI[c].prezzo, 0)} € al mese</span></div></div>
          ${n.fa.includes('Private') ? `<div class="campo"><span class="nome-campo">Private al mese</span><div class="campo-valore"><input type="number" inputmode="numeric" min="0" id="n-privateMese" data-nuovo="privateMese" value="${n.privateMese}" aria-label="Quante private al mese"><span class="unita">al mese</span></div></div>
          <div class="campo"><span class="nome-campo">Prezzo privata</span><div class="campo-valore"><input type="number" inputmode="numeric" min="0" id="n-privata" data-nuovo="privata" value="${n.privata}" aria-label="Prezzo della privata in euro"><span class="unita">€ a lezione</span></div></div>` : ''}
          <div class="campo"><span class="nome-campo">Certificato</span><div class="campo-valore"><input type="date" id="n-cert" data-nuovo="cert" value="${n.cert}" aria-label="Certificato fino al"></div></div>
        </section>
      </div>
      <div class="piede gutter"><button type="button" class="tasto grande" data-az="aggiungi">Aggiungi</button></div>
    </div>`;
}

// --- Corsi ----------------------------------------------------------------
// Le lezioni di un corso fino a ora. Contano (grafico, argomenti) solo quelle raccontate: chi c'era è detto.
const lezioniCorso = corso => stato.lezioni
  .filter(l => l.tipo === 'corso' && l.corso === corso && (l.giorno < OGGI || (l.giorno === OGGI && iniziata(l))))
  .sort((a, b) => b.giorno.localeCompare(a.giorno));
const conRapporto = l => !l.nonFatta && !!l.appello;
const senzaRapportoDi = lez => lez.filter(l => !l.nonFatta && !l.appello).map(l => l.giorno).sort();
function notaRapporti(gg) {
  if (!gg.length) return '';
  return `<p class="nota">${gg.length === 1 ? `manca il rapporto ${delGiorno(gg[0])}` : `mancano ${gg.length} rapporti: ${gg.map(dataCorta).join(', ')}`}</p>`;
}

function altoCorsi() {
  return `${selettore(['Mortara', 'Vigevano', 'Private'], stato.corso, 'corso')}
    <button type="button" class="icona-tasto" data-az="menu" aria-label="Menu">${ICONA.menu}</button>`;
}

// Il periodo di un corso: una settimana, o due per i corsi con una lezione a settimana (Vigevano),
// così ogni periodo ha due lezioni. I periodi di due settimane partono dal lunedì del primo giorno d'uso.
const basePeriodi = () => lunediDi(PRIMO_GIORNO);
function periodoCorso(corso, g) {
  const lun = lunediDi(g), n = CORSI[corso].settimane;
  if (n === 1) return lun;
  const base = basePeriodi();
  return sposta(base, Math.floor(giorniFra(base, lun) / (7 * n)) * 7 * n);
}
const etichettaPeriodo = (corso, k) => etichettaIntervallo(k, sposta(k, 7 * CORSI[corso].settimane - 1));

// Il grafico dei presenti, lezione per lezione (vista Lezioni, settimana aperta, mese aperto)
function graficoLezioni(corso, lez, quante) {
  const voci = lez.filter(conRapporto).slice(0, quante).reverse().map(l => ({ n: presentiDi(l).length, et: dataCorta(l.giorno) }));
  if (!voci.length) return '';
  const max = Math.max(roster(corso).length, ...voci.map(v => v.n), 1);   // in scala con chi fa il corso
  return `<section class="grafico"><h2 class="titolo-blocco">PRESENTI</h2><div class="colonne" aria-hidden="true">${voci.map(v =>
    `<div class="colonna"><b>${v.n}</b><i style="height:${Math.round(v.n / max * 70)}px"></i><span>${v.et}</span></div>`).join('')}</div></section>`;
}

function rigaLezioneCorso(l) {
  const d = daChiave(l.giorno);
  const titoloRiga = l.nonFatta ? 'non si è fatta' : l.fatto ? l.fatto.gruppo : 'manca il rapporto';
  const soli = l.fatto && l.fatto.soli.length ? ` · da solo: ${l.fatto.soli.map(s => `${s.chi} (${s.cosa})`).join(', ')}` : '';
  const riga2 = l.appello ? `${testoAppello(l)}${soli}` : '';
  return `
    <article class="lezione data-col${l.nonFatta ? ' spenta' : ''}" id="lez-${esc(l.id)}">
      <button type="button" class="stendi" data-az="apri" data-id="${esc(l.id)}" aria-label="Apri ${esc(titolo(l))} ${dataLunga(l.giorno)}"></button>
      <div class="ora">${d.getDate()}/${d.getMonth() + 1}<span class="fine">${GG[d.getDay()]}</span></div>
      <div class="titolo"${l.fatto ? '' : ' style="font-weight:400;color:var(--muto)"'}>${esc(titoloRiga)}</div>
      <div class="stato">${riga2 ? `<div class="riga">${esc(riga2)}</div>` : ''}</div>
      ${FRECCIA}
    </article>`;
}

// Cosa ha fatto il gruppo (solo il gruppo: il lavoro da soli sta nelle lezioni e nelle schede)
const gruppoDi = ls => ls.filter(l => l.fatto && !l.nonFatta).map(l => l.fatto.gruppo);
const quanteLezioni = ls => { const n = ls.filter(l => !l.nonFatta).length; return `${n} ${n === 1 ? 'lezione' : 'lezioni'}`; };

function settimaneCorso(corso, lez) {
  const gruppi = new Map();
  for (const l of lez) { const k = periodoCorso(corso, l.giorno); if (!gruppi.has(k)) gruppi.set(k, []); gruppi.get(k).push(l); }
  return [...gruppi].map(([k, ls]) => {
    const gruppo = [...new Set(gruppoDi(ls).flatMap(g => g.split(', ')))];
    return `
      <article class="periodo">
        <button type="button" class="stendi" data-az="settimana-corso" data-k="${k}" aria-label="Apri ${etichettaPeriodo(corso, k)}"></button>
        <div class="corpo">
          <div class="periodo-testa"><span class="periodo-titolo">${etichettaPeriodo(corso, k)}</span><span class="periodo-ore">${quanteLezioni(ls)}</span></div>
          <div class="riga">${gruppo.length ? `<span class="etich">gruppo:</span> ${esc(gruppo.join(', '))}` : 'niente'}</div>
          ${notaRapporti(senzaRapportoDi(ls))}
        </div>
        ${FRECCIA}
      </article>`;
  }).join('') || '<p class="vuoto">Niente</p>';
}

// I mesi: una scheda per mese con cosa ha fatto il gruppo, nell'ordine in cui l'ha fatto
function mesiCorso(_corso, lez) {
  const mesi = [...new Set(lez.map(l => l.giorno.slice(0, 7)))];
  return mesi.map(m => {
    const ls = lez.filter(l => l.giorno.startsWith(m));
    const conta = new Map();
    [...gruppoDi(ls)].reverse().forEach(g => conta.set(g, (conta.get(g) || 0) + 1));
    return `
      <article class="periodo">
        <button type="button" class="stendi" data-az="mese-corso" data-k="${m}" aria-label="Apri ${nomeMese(m)}"></button>
        <div class="corpo">
          <div class="periodo-testa"><span class="periodo-titolo">${nomeMese(m)}</span><span class="periodo-ore">${quanteLezioni(ls)}</span></div>
          ${[...conta].map(([g, n]) => `<div class="cosa-mese"><span>${esc(g)}</span><span>${n} ${n === 1 ? 'lezione' : 'lezioni'}</span></div>`).join('') || '<div class="riga">niente</div>'}
          ${notaRapporti(senzaRapportoDi(ls))}
        </div>
        ${FRECCIA}
      </article>`;
  }).join('') || '<p class="vuoto">Niente</p>';
}

function listaPrivate() {
  const chi = stato.allievi.filter(a => a.private || stato.lezioni.some(l => l.tipo === 'privata' && l.allievo === a.nome));
  return chi.map(a => {
    const mese = stato.lezioni.filter(l => l.tipo === 'privata' && l.allievo === a.nome && l.giorno.startsWith(MESE) && (l.giorno < OGGI || iniziata(l)) && l.motivo !== 'annullata').length;
    return `
      <article class="persona">
        <button type="button" class="stendi" data-az="private-di" data-nome="${esc(a.nome)}" aria-label="Le private di ${esc(a.nome)}"></button>
        <div class="nome">${esc(a.nome)}</div>
        <div class="ore">${a.privateMese ? `${a.privateMese} al mese` : ''}</div>
        <div class="fa">${mese} ${mese === 1 ? 'privata' : 'private'} a ${nomeMese(MESE)}</div>
        <div class="segno"></div>
        ${FRECCIA}
      </article>`;
  }).join('') || '<p class="vuoto">Nessuno fa private</p>';
}

function listaCorsi() {
  if (stato.corso === 'Private') return listaPrivate();
  const lez = lezioniCorso(stato.corso);
  const nomi = CORSI[stato.corso].settimane === 2 ? { Settimane: '2 settimane' } : {};   // Vigevano va a due settimane
  let html = selettore(['Lezioni', 'Settimane', 'Mesi'], stato.vistaCorso, 'vista-corso', nomi);
  if (stato.vistaCorso === 'Lezioni') html += graficoLezioni(stato.corso, lez, 8) + `<section class="blocco">${lez.map(rigaLezioneCorso).join('') || '<p class="vuoto">Niente</p>'}</section>`;
  else if (stato.vistaCorso === 'Settimane') html += settimaneCorso(stato.corso, lez);
  else html += mesiCorso(stato.corso, lez);
  return html;
}

// I pannelli dei corsi: la settimana (o le due settimane) e il mese, con le lezioni come nella vista Lezioni
function pannelloSettimanaCorso(p) {
  const lez = lezioniCorso(p.corso).filter(l => periodoCorso(p.corso, l.giorno) === p.k);
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Corso ${p.corso}, ${etichettaPeriodo(p.corso, p.k)}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}Corso ${p.corso}</button></header>
      <div class="corpo-pannello gutter">
        <h1>${etichettaPeriodo(p.corso, p.k)}</h1>
        <p class="sotto">Corso ${p.corso} · ${quanteLezioni(lez)}</p>
        ${graficoLezioni(p.corso, lez, 20)}
        <section class="blocco">${lez.map(rigaLezioneCorso).join('')}</section>
      </div>
    </div>`;
}
function pannelloMeseCorso(p) {
  const lez = lezioniCorso(p.corso).filter(l => l.giorno.startsWith(p.k));
  const periodi = [...new Set(lez.map(l => periodoCorso(p.corso, l.giorno)))];
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Corso ${p.corso}, ${nomeMese(p.k)}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}Corso ${p.corso}</button></header>
      <div class="corpo-pannello gutter">
        <h1>${nomeMese(p.k).replace(/^./, c => c.toUpperCase())}</h1>
        <p class="sotto">Corso ${p.corso} · ${quanteLezioni(lez)}</p>
        ${graficoLezioni(p.corso, lez, 20)}
        ${periodi.map(k => `<section class="blocco"><h2 class="titolo-blocco">${etichettaPeriodo(p.corso, k).toUpperCase()}</h2>${lez.filter(l => periodoCorso(p.corso, l.giorno) === k).map(rigaLezioneCorso).join('')}</section>`).join('')}
      </div>
    </div>`;
}
function pannelloPrivate(p) {
  const a = allievo(p.nome);
  const lez = lezioniDi(a.nome).filter(l => l.tipo === 'privata');
  const vista = stato.vistaPrivate;
  const corpo = vista === 'Lezioni' ? righeLezioni(lez, a.nome)
    : righePeriodi(a, lez, vista === 'Settimane' ? lunediDi : g => g.slice(0, 7));
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Le private di ${esc(a.nome)}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}Private</button></header>
      <div class="corpo-pannello gutter">
        <h1>Private · ${esc(a.nome)}</h1>
        <p class="sotto">${a.privateMese ? `${a.privateMese} al mese · ` : ''}${a.private ? `${prezzoPrivata(a)} € a lezione` : ''}</p>
        ${selettore(['Lezioni', 'Settimane', 'Mesi'], vista, 'vista-private')}
        ${corpo}
      </div>
    </div>`;
}

// --- Scadenze: Pagamenti e Certificati ----------------------------------
const mesiFoglio = () => [meseDopo(MESE, -1), MESE, meseDopo(MESE, 1)];   // il mese scorso, questo, il prossimo
const CASELLA_SI = '<span class="casella si" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const CASELLA_NO = '<span class="casella" aria-hidden="true"></span>';
const dalSolo = k => `${elide(k) ? "dall'" : 'dal '}${Number(k.slice(8))}`;   // nella casella: il mese è la colonna

function altoScadenze() {
  return `${selettore(['Pagamenti', 'Certificati'], stato.scadenza, 'scadenza')}
    <button type="button" class="icona-tasto" data-az="menu" aria-label="Menu">${ICONA.menu}</button>`;
}
const listaScadenze = () => stato.scadenza === 'Certificati' ? listaCertificati() : listaPagamenti();

// Chi è in ritardo, il mese più vecchio prima
function vociRitardo() {
  return stato.allievi.flatMap(a => quoteRitardo(a).map(m => ({ a, m, entro: scadenzaQuota(a, m), tot: conto(a, m).tot })))
    .sort((x, y) => x.entro.localeCompare(y.entro));
}
// Un pagamento in ritardo: la casella da spuntare, chi (o quale mese) e cosa, WhatsApp
const rigaRitardo = (a, m, titolo, cosa, classe = '') => `
    <article class="scad rossa con-spunta${classe}">
      <button type="button" class="spunta" data-az="spunta" data-nome="${esc(a.nome)}" data-m="${m}" aria-label="Segna pagato: ${esc(a.nome)}, ${nomeMese(m)}"><span class="casella-grande" aria-hidden="true"></span></button>
      <div class="scad-nome">${titolo}</div>
      <div class="scad-cosa">${cosa}</div>
      <button type="button" class="tasto secondario piccolo" data-az="whatsapp" data-nome="${esc(a.nome)}" data-msg="mese" data-m="${m}">WhatsApp</button>
    </article>`;

function listaPagamenti() {
  const attivi = stato.allievi.filter(a => !a.uscito);
  // Il mese: chi ha pagato, chi deve ancora, chi è in ritardo; e quanto deve ricevere il Sifu, fino a questo mese
  const del = attivi.filter(a => a.dal <= MESE && (a.pagato[MESE] || conto(a, MESE).tot));
  const pagati = del.filter(a => a.pagato[MESE]).length;
  const tardi = del.filter(a => !a.pagato[MESE] && OGGI > scadenzaQuota(a, MESE)).length;
  const daPagare = del.length - pagati - tardi;
  const w = n => del.length ? (n / del.length * 100).toFixed(2) : 0;
  let daRicevere = 0, inRitardo = 0;
  for (const a of attivi) for (const m of mesiDa(a)) {
    if (a.pagato[m]) continue;
    const tot = conto(a, m).tot;
    daRicevere += tot;
    if (OGGI > scadenzaQuota(a, m)) inRitardo += tot;
  }
  let html = `
    <section class="blocco primo">
      <h2 class="titolo-blocco">${nomeMese(MESE).toUpperCase()}</h2>
      <div class="barra-mese" aria-hidden="true"><span class="pagato" style="width:${w(pagati)}%"></span><span class="ritardo" style="width:${w(tardi)}%"></span></div>
      <p class="conto-mese"><b>${pagati}</b> pagato · <b>${daPagare}</b> da pagare · <span${tardi ? ' class="r"' : ''}>${tardi} in ritardo</span></p>
      <p class="conto-mese">Da ricevere <b>${daRicevere} €</b>${inRitardo ? ` · <span class="r">in ritardo ${inRitardo} €</span>` : ''}</p>
    </section>`;
  const voci = vociRitardo();
  if (voci.length) html += `<section class="blocco"><h2 class="titolo-blocco rosso">IN RITARDO</h2>${voci.map(v =>
    rigaRitardo(v.a, v.m, `${esc(v.a.nome)} · ${v.tot} €`, `${nomeMese(v.m)}, ${dalGiorno(v.entro)}`)).join('')}</section>`;
  html += `
    <section class="blocco"><h2 class="titolo-blocco">MESE PER MESE</h2><p class="nota suggerimento">Tocca una casella per segnare pagato.</p><div class="fp">
      <div class="fp-riga fp-testa"><div></div>${mesiFoglio().map(m => `<div class="fp-mese${m === MESE ? ' ora' : ''}">${nomeMese(m)}</div>`).join('')}</div>
      ${attivi.map(rigaFoglio).join('')}
    </div></section>`;
  return html;
}

const rigaFoglio = a => `<div class="fp-riga"><button type="button" class="fp-nome${ritardo(a) ? ' rosso' : ''}" data-az="scheda" data-nome="${esc(a.nome)}" aria-label="Apri la scheda di ${esc(a.nome)}"><span>${esc(a.nome)}</span></button>${mesiFoglio().map(m => cellaMese(a, m)).join('')}</div>`;
// Una casella del foglio: sopra la cifra, sotto quando (il giorno in cui ha pagato, entro quando, da quando è in ritardo)
function casellaFoglio({ dati, classe, casella = '', cifra, quando = '', etichetta = '' }) {
  const dentro = `<span class="fp-su">${casella}<span>${cifra}</span></span>${quando ? `<span class="fp-giu">${quando}</span>` : ''}`;
  return dati ? `<button type="button" class="fp-cella ${classe}" ${dati} aria-label="${etichetta}">${dentro}</button>`
    : `<div class="fp-cella ${classe}">${dentro}</div>`;
}
// Nel suo mese basta il giorno ("il 5"); in un altro mese giorno e mese ("il 18/10")
const ilNel = (k, m) => k.slice(0, 7) === m ? `${elide(k) ? "l'" : 'il '}${Number(k.slice(8))}` : ilGiorno(k);
// Il totale del mese: corsi e private insieme. Pagato (cifra e giorno), da pagare (cifra ed "entro"), in ritardo (rossa)
function cellaMese(a, m) {
  if (m < a.dal) return '<div class="fp-cella"></div>';
  const c = conto(a, m), il = a.pagato[m], entro = scadenzaQuota(a, m), mese = nomeMese(m), nome = esc(a.nome);
  if (!il && !c.tot) return casellaFoglio({ classe: 'chiusa', cifra: chiuso(m) ? 'chiuso' : '0 €' });
  const dati = `data-az="cella" data-nome="${nome}" data-m="${m}"`;
  if (il) {
    const cifra = a.cifre[m] ?? c.tot;
    return casellaFoglio({ dati, classe: 'pagata', casella: CASELLA_SI, cifra: `${cifra} €`, quando: ilNel(il, m), etichetta: `${nome}, ${mese}: ${cifra} euro pagati ${ilGiorno(il)}, tocca per il conto` });
  }
  if (OGGI > entro) return casellaFoglio({ dati, classe: 'ritardo', cifra: `! ${c.tot} €`, quando: dalSolo(entro), etichetta: `${nome}, ${mese}: ${c.tot} euro in ritardo ${dalGiorno(entro)}, tocca per segnare pagato` });
  return casellaFoglio({ dati, classe: 'vuota', casella: CASELLA_NO, cifra: `${c.tot} €`, quando: `entro ${ilNel(entro, m)}`, etichetta: `${nome}, ${mese}: ${c.tot} euro entro ${ilGiorno(entro)}, tocca per segnare pagato` });
}

function listaCertificati() {
  const attivi = stato.allievi.filter(a => !a.uscito);
  const perData = (x, y) => x.cert.localeCompare(y.cert) || x.nome.localeCompare(y.nome);
  const validi = attivi.filter(a => a.cert && a.cert >= OGGI).sort(perData);
  const scaduti = attivi.filter(a => a.cert && a.cert < OGGI).sort(perData);
  const senza = attivi.filter(a => !a.cert);
  // Il grafico: i certificati validi per mese, da gennaio a dicembre. Un certificato dura un anno, quindi ogni mese
  // è una scadenza sola (quello che viene); col tocco si vede chi, con la data intera.
  const conta = MESI.map((_, i) => validi.filter(a => Number(a.cert.slice(5, 7)) === i + 1).length);
  const max = Math.max(...conta, 1);
  const parti = [`${conta[11]} su ${attivi.length} scadono a dicembre`];
  if (scaduti.length) parti.push(`${scaduti.length} ${scaduti.length === 1 ? 'scaduto' : 'scaduti'}`);
  if (senza.length) parti.push(`${senza.length} senza data`);
  let html = `
    <section class="grafico blocco primo">
      <h2 class="titolo-blocco">QUANDO SCADONO</h2>
      <div class="colonne dodici">${conta.map((n, i) => {
        const dentro = `<b>${n || ''}</b><i style="height:${Math.round(n / max * 70)}px"></i><span>${MESI3[i]}</span>`;
        const classe = `colonna${i === 11 ? ' dic' : ''}`;
        return n ? `<button type="button" class="${classe}" data-az="mese-cert" data-n="${i + 1}" aria-label="${maiuscola(MESI[i])}: ${n} ${n === 1 ? 'certificato' : 'certificati'}">${dentro}</button>`
          : `<div class="${classe}" aria-hidden="true">${dentro}</div>`;
      }).join('')}</div>
      <p class="nota">${parti.join(' · ')}</p>
    </section>`;
  const tra = g => g === 0 ? 'scade oggi' : g === 1 ? 'domani' : `tra ${g} giorni`;
  const presto = validi.filter(a => giorniFra(OGGI, a.cert) <= 30);
  const avanti = validi.filter(a => giorniFra(OGGI, a.cert) > 30);
  const rossi = [...senza, ...scaduti];
  if (rossi.length) html += `<section class="blocco"><h2 class="titolo-blocco rosso">SCADUTI</h2>${rossi.map(a =>
    rigaCert(a, a.cert ? `scaduto ${elide(a.cert) ? "l'" : 'il '}${dataAnno(a.cert)}` : 'manca la data', true)).join('')}</section>`;
  if (presto.length) html += `<section class="blocco"><h2 class="titolo-blocco">ENTRO 30 GIORNI</h2>${presto.map(a =>
    rigaCert(a, `${dataCorta(a.cert)} · ${tra(giorniFra(OGGI, a.cert))}`, false)).join('')}</section>`;
  if (avanti.length) {
    html += `<button type="button" class="usciti" data-az="piu-avanti" aria-expanded="${stato.piuAvanti}"><span>Più avanti · ${avanti.length}</span>${stato.piuAvanti ? '' : ICONA.dx}</button>`;
    if (stato.piuAvanti) html += avanti.map(a => `
      <article class="scad-una">
        <button type="button" class="stendi" data-az="cert" data-nome="${esc(a.nome)}" aria-label="Certificato di ${esc(a.nome)}: cambia la data"></button>
        <span class="scad-nome">${esc(a.nome)}</span><span class="scad-data">${dataAnno(a.cert)}</span>${FRECCIA}
      </article>`).join('');
  }
  return html;
}
const rigaCert = (a, testo, rossa) => `
  <article class="scad con-freccia${rossa ? ' rossa' : ''}">
    <button type="button" class="stendi" data-az="cert" data-nome="${esc(a.nome)}" aria-label="Certificato di ${esc(a.nome)}: cambia la data"></button>
    <div class="scad-nome">${esc(a.nome)}</div>
    <div class="scad-cosa">${esc(testo)}</div>
    <button type="button" class="tasto secondario piccolo" data-az="whatsapp" data-nome="${esc(a.nome)}" data-msg="cert">WhatsApp</button>
    ${FRECCIA}
  </article>`;

// I messaggi già scritti: il testo dalle Impostazioni, le parole tra { } le mette l'app. Il Sifu lo può cambiare in WhatsApp prima di Invia.
function riempi(k, valori) {
  let testo = IMP.testi[k].testo;
  if (valori.giorno) testo = testo.replace(/\bil \{data\}/g, ilData(valori.giorno));   // "il 12 novembre", "l'8 novembre"
  return testo.replace(/\{(\w+)\}/g, (s, x) => x in valori ? valori[x] : s);
}
function messaggio(a, msg, m) {
  const nome = a.nome;
  if (msg === 'mese') {
    const c = conto(a, m), mp = nomeMese(c.mesePrima), pl = (n, s, p) => `${n} ${n === 1 ? s : p}`, parti = [];
    if (c.corsi) parti.push(`corsi ${c.corsi} €`);
    if (c.nPriv) parti.push(`${pl(c.nPriv, 'privata', 'private')} ${c.priv} €`);
    if (c.nDiff < 0) parti.push(`meno ${-c.diff} € di credito di ${mp}`);
    if (c.nDiff > 0) parti.push(`${pl(c.nDiff, 'privata', 'private')} in più a ${mp} ${c.diff} €`);
    if (parti.length < 2) return riempi('quota', { nome, mese: nomeMese(m), totale: c.tot });
    return riempi('mese', { nome, mese: nomeMese(m), totale: c.tot, dettaglio: parti.join(', ') });
  }
  if (!a.cert) return riempi('manca', { nome });
  const g = giorniFra(OGGI, a.cert), valori = { nome, data: dataParole(a.cert), giorno: a.cert };
  if (g < 0) return riempi('scaduto', valori);
  if (g <= 15) return riempi('cert15', { ...valori, tra: g === 0 ? 'oggi' : g === 1 ? 'domani' : `tra ${g} giorni` });
  return riempi('cert30', valori);
}

// I fogli che salgono dal basso: il pagamento spuntato, il certificato, il messaggio
const velo = (etichetta, dentro) => `
  <div class="velo" data-az="chiudi-velo">
    <div class="foglio gutter" role="dialog" aria-modal="true" aria-label="${esc(etichetta)}">${dentro}
      <button type="button" data-az="chiudi-velo">Chiudi</button>
    </div>
  </div>`;
function apriConto(nome, m) {     // il conto di un mese: di cosa è fatto il totale; da pagare o già pagato
  const a = allievo(nome), { c, r } = righeConto(a, m), il = a.pagato[m], entro = scadenzaQuota(a, m);
  const dati = `data-nome="${esc(nome)}" data-m="${m}"`;
  const quando = il ? `pagato ${ilGiorno(il)}` : !c.tot ? 'niente da pagare' : OGGI > entro ? `in ritardo ${dalGiorno(entro)}` : `entro ${ilGiorno(entro)}`;
  const righe = r.map(([cosa, quanto]) => `<div class="cosa-mese"><span>${esc(cosa)}</span><span>${quanto}</span></div>`).join('')
    + `<div class="cosa-mese totale"><span>Totale</span><span>${c.tot} €</span></div>`;
  const note = c.finora ? `<p class="nota">${nomeMese(c.mesePrima)}: ${c.finora.n} ${c.finora.n === 1 ? 'privata fatta' : 'private fatte'} su ${a.privateMese}, finora</p>${notaRapporti(c.finora.senza)}` : '';
  let azioni;
  if (il) {
    azioni = `<div class="campo"><span class="nome-campo">Pagato il</span><div class="campo-valore"><input type="date" data-pag="il" ${dati} value="${il}" aria-label="Pagato il"></div></div>
      <button type="button" class="rosso" data-az="togli" ${dati}>Togli la spunta</button>`;
  } else if (c.tot) azioni = `<button type="button" class="tasto grande" data-az="paga" ${dati}>Segna pagato oggi</button>`;
  else azioni = '';
  $('sopra2').innerHTML = velo(`${nome}, ${nomeMese(m)}`, `
      <h2>${esc(nome)}</h2>
      <p class="sotto">${maiuscola(nomeMese(m))} · ${quando}</p>
      <div class="righe-conto">${righe}</div>
      ${note}
      ${azioni}`);
}
function segnaPagato(a, m) {     // spuntato: pagato oggi, la cifra del conto
  const prima = foto();
  a.cifre[m] = conto(a, m).tot;
  a.pagato[m] = OGGI;
  $('sopra2').innerHTML = ''; disegna(); salvato(`${a.nome}: ${nomeMese(m)} pagato`, prima);
}
function apriCert(nome) {
  const a = allievo(nome);
  $('sopra2').innerHTML = velo(`Certificato di ${nome}`, `
      <h2>${esc(nome)}</h2>
      <p class="sotto">Certificato medico</p>
      <div class="campo"><span class="nome-campo">Fino al</span><div class="campo-valore"><input type="date" data-cert="${esc(nome)}" value="${a.cert}" aria-label="Certificato fino al"></div></div>
      <button type="button" class="con-freccia" data-az="scheda" data-nome="${esc(nome)}"><span>La sua scheda</span>${FRECCIA}</button>`);
}
function apriMeseCert(n) {     // tocco su una colonna del grafico: chi scade in quel mese
  const chi = stato.allievi.filter(a => !a.uscito && a.cert && a.cert >= OGGI && Number(a.cert.slice(5, 7)) === n)
    .sort((x, y) => x.cert.localeCompare(y.cert) || x.nome.localeCompare(y.nome));
  const mese = MESI[n - 1], a_ = /^a/.test(mese) ? 'ad' : 'a';
  $('sopra2').innerHTML = velo(`Certificati che scadono ${a_} ${mese}`, `
      <h2>${maiuscola(mese)}</h2>
      <p class="sotto">${chi.length} ${chi.length === 1 ? 'certificato scade' : 'certificati scadono'} ${a_} ${mese}</p>
      ${chi.map(a => `<button type="button" class="con-freccia" data-az="cert" data-nome="${esc(a.nome)}"><span class="una-riga">${esc(a.nome)}</span><span class="destra"><span class="scad-data">${dataPiena(a.cert)}</span>${FRECCIA}</span></button>`).join('')}`);
}
// WhatsApp si apre con il numero dell'allievo e il testo già scritto: il Sifu lo può cambiare prima di Invia.
function numeroWhatsApp(cell) {     // "333 000 0001" → 393330000001; con +39 o 0039 il prefisso c'è già
  let n = String(cell || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.length <= 11) n = `39${n}`;
  return /^\d{8,15}$/.test(n) ? n : '';
}
function apriWhatsApp(a, testo) {
  const n = numeroWhatsApp(a.cell);
  if (!n) { avvisa(`Manca il cellulare di ${a.nome}.`); return; }
  globalThis.open(`https://wa.me/${n}${testo ? `?text=${encodeURIComponent(testo)}` : ''}`, '_blank', 'noopener');
}
const apriMessaggio = (nome, msg, m) => { const a = allievo(nome); apriWhatsApp(a, messaggio(a, msg, m)); };

// --- La lezione ---------------------------------------------------------
function dettaglioLezione(l) {
  let fatto;
  if (l.nonFatta) fatto = `<p class="testo-blocco">${l.motivo === 'assente' ? `${esc(l.allievo)} non è venuto.` : `${maiuscola(nonFattaTesto(l))}.`}</p>`;
  else if (!l.fatto) fatto = `<p class="testo-blocco muto">${iniziata(l) ? 'Da raccontare.' : 'Non ancora.'}</p>`;
  else if (l.tipo === 'privata') fatto = `<p class="testo-blocco">${esc(l.fatto.testo)}</p>`;
  else fatto = `<p class="testo-blocco"><strong>gruppo:</strong> ${esc(l.fatto.gruppo)}</p>` +
    l.fatto.soli.map(s => `<p class="testo-blocco"><strong>da solo · ${esc(s.chi)}:</strong> ${esc(s.cosa)}</p>`).join('');
  let chi;
  if (l.tipo === 'privata') chi = `<p class="testo-blocco">${esc(l.allievo)} · ${l.calendario ? 'dal calendario Google' : 'detta a voce'}</p>`;
  else if (l.nonFatta) chi = '<p class="testo-blocco muto">Nessuno: non si è fatta.</p>';
  else if (l.appello) chi = `<p class="testo-blocco">${esc(appelloBreve(l))}</p><div class="nomi">${presentiDi(l).map(n => `<span>${esc(n)}</span>`).join('')}</div>` +
    (l.appello.assenti.length ? `<p class="testo-blocco muto" style="margin-top:8px">mancavano</p><div class="nomi">${l.appello.assenti.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '');
  else chi = '<p class="testo-blocco muto">Non ancora detto.</p>';
  const sotto = pila.length > 1 ? (pila.at(-2).nome || (pila.at(-2).corso ? `Corso ${pila.at(-2).corso}` : 'Indietro'))
    : stato.sezione === 'oggi' ? 'Oggi' : stato.sezione === 'corsi' ? (stato.corso === 'Private' ? 'Private' : `Corso ${stato.corso}`) : 'Indietro';
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="${esc(titolo(l))}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}${esc(sotto)}</button></header>
      <div class="corpo-pannello gutter">
        <h1>${esc(titolo(l))}</h1>
        <p class="sotto">${dataLunga(l.giorno)} · ${orario(l)}</p>
        <section class="blocco"><h2 class="titolo-blocco">FATTO</h2>${fatto}</section>
        ${l.previsto && !l.fatto && !l.nonFatta ? `<section class="blocco"><h2 class="titolo-blocco">PREVISTO</h2><p class="testo-blocco">${esc(l.previsto)}</p></section>` : ''}
        <section class="blocco"><h2 class="titolo-blocco">CHI C'ERA</h2>${chi}</section>
      </div>
      <div class="piede gutter">
        ${tastoDetta(l.id, 'grande')}
        <p class="sotto">Anche per correggere: basta dirlo.</p>
      </div>
    </div>`;
}

function disegnaPila() {
  const top = pila.at(-1);
  if (!top) { $('sopra').innerHTML = ''; return; }
  const sc = $('sopra').querySelector('.corpo-pannello');
  const stessa = sc && $('sopra').dataset.chiave === JSON.stringify(top);
  const scroll = stessa ? sc.scrollTop : 0;
  if (top.tipo === 'scheda') $('sopra').innerHTML = scheda(allievo(top.nome));
  else if (top.tipo === 'lezione') $('sopra').innerHTML = dettaglioLezione(trova(top.id));
  else if (top.tipo === 'periodo') $('sopra').innerHTML = periodo(top);
  else if (top.tipo === 'nuovo') $('sopra').innerHTML = nuovoForm();
  else if (top.tipo === 'settimana-corso') $('sopra').innerHTML = pannelloSettimanaCorso(top);
  else if (top.tipo === 'mese-corso') $('sopra').innerHTML = pannelloMeseCorso(top);
  else if (top.tipo === 'private') $('sopra').innerHTML = pannelloPrivate(top);
  else if (top.tipo === 'impostazioni') $('sopra').innerHTML = pannelloImpostazioni();
  else if (top.tipo === 'pdf') $('sopra').innerHTML = pannelloPdf();
  else if (top.tipo === 'pdf-mese') $('sopra').innerHTML = pannelloPdfMese(top.m);
  $('sopra').dataset.chiave = JSON.stringify(top);
  const nuovo = $('sopra').querySelector('.corpo-pannello');
  if (nuovo) nuovo.scrollTop = scroll;
}

function disegna() {
  document.documentElement.dataset.tema = IMP.tema;   // chiaro o scuro, dalle Impostazioni
  $('alto').innerHTML = { oggi: altoOggi, allievi: altoAllievi, corsi: altoCorsi, scadenze: altoScadenze }[stato.sezione]();
  $('lista').innerHTML = { oggi: listaOggi, allievi: listaAllievi, corsi: listaCorsi, scadenze: listaScadenze }[stato.sezione]();
  document.querySelectorAll('.barra [data-s]').forEach(b => b.toggleAttribute('aria-current', b.dataset.s === stato.sezione));
  document.querySelectorAll('.barra [data-s]').forEach(b => { if (b.dataset.s === stato.sezione) b.setAttribute('aria-current', 'page'); });
  const rossi = vociRitardo().length + stato.allievi.filter(certScaduto).length;   // pagamenti in ritardo e certificati scaduti
  $('contatore').textContent = rossi;
  $('contatore').hidden = rossi === 0;
  aggiornaBadge(rossi);                              // il numero sull'icona, dove il telefono lo fa
  disegnaPila();
}
function disegnaLista() { $('lista').innerHTML = listaAllievi(); }

// --- La voce ------------------------------------------------------------------
// Tocco → "Ti ascolto", il tempo, Fine. Fine → si trascrive (trascrivi), si capisce (riordina) ed entra subito:
// "Ho capito così", con Annulla (INTERFACCIA punto 4). Senza rete la registrazione resta sul telefono e si fa dopo.
let voce = null;        // { ctx, rec, timer, secondi }
function chiudiVoce() {
  if (voce) { clearInterval(voce.timer); if (voce.rec) voce.rec.chiudi(); }
  voce = null;
  $('sopra2').innerHTML = '';
}
// Dove si è, per la segnalazione: la schermata, senza nomi
function doveSono() {
  const top = pila.at(-1);
  return top ? ({ scheda: 'una scheda', lezione: 'una lezione', impostazioni: 'Impostazioni', pdf: 'PDF del mese', 'pdf-mese': 'PDF del mese' }[top.tipo] || nomeSezione()) : nomeSezione();
}

async function apriVoce(ctx) {
  if (voce) return;
  const top = pila.at(-1);
  const l = ctx.tipo === 'lezione' ? trova(ctx.id) : null;
  const scheda = top && top.tipo === 'scheda' ? top.nome : null;
  const contesto = ctx.tipo === 'segnala' ? 'Segnala un problema' : l ? `${breve(l)} · ${quando(l)}` : scheda ? `Parla · ${scheda}` : 'Parla';
  const v = voce = { ctx: { ...ctx, scheda, sezione: stato.sezione, dove: doveSono() }, secondi: 0, rec: null };
  $('sopra2').innerHTML = `
    <div class="pannello voce-pannello" role="dialog" aria-modal="true" aria-label="Ti ascolto">
      <div class="corpo-pannello gutter" id="voce-corpo">
        <p class="contesto">${esc(contesto)}</p>
        <p class="sotto" id="voce-sotto">Ti ascolto</p>
        <p class="tempo" id="tempo">0:00</p>
        <div class="onde" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
        <button type="button" class="fine-tasto" data-az="fine">Fine</button>
        <button type="button" class="link" data-az="annulla-voce">Annulla</button>
      </div>
    </div>`;
  $('sopra2').querySelector('.fine-tasto').focus();
  try {
    v.rec = await apriMicrofono();
  } catch {
    if (voce !== v) return;
    if (ctx.tipo !== 'segnala') { chiudiVoce(); avvisa('Il microfono non si apre: dagli il permesso.'); return; }
    // per una segnalazione, senza microfono si scrive
    $('voce-sotto').textContent = 'Il microfono non si apre';
    $('tempo').remove();
    $('voce-corpo').querySelector('.onde').outerHTML = '<div class="finta"><textarea id="voce-libera" aria-label="Cosa non va" placeholder="Scrivi cosa non va"></textarea></div>';
    $('voce-corpo').querySelector('.fine-tasto').textContent = 'Invia';
    $('voce-libera').focus();
    return;
  }
  if (voce !== v) { v.rec.chiudi(); return; }
  v.rec.avvia();
  v.timer = setInterval(() => {
    v.secondi = v.rec.secondi();
    const t = $('tempo');
    if (t) t.textContent = `${Math.floor(v.secondi / 60)}:${due(v.secondi % 60)}`;
    if (v.secondi >= 600) fineVoce();      // dieci minuti al massimo
  }, 500);
}

async function fineVoce() {
  const v = voce;
  if (!v) return;
  const libera = $('voce-libera') ? $('voce-libera').value.trim() : '';
  if (!v.rec && !libera) return;
  clearInterval(v.timer);
  $('voce-corpo').innerHTML = '<p class="contesto">Sto capendo…</p><div class="onde" aria-hidden="true"><span></span><span></span><span></span></div>';
  if (libera) { await capisci({ id: db.nuovoId(), ctx: v.ctx, testo: libera, scritta: true }); return; }
  const r = await v.rec.fine();
  v.rec = null;
  if (r.secondi < 1 || r.blob.size < 200) { chiudiVoce(); avvisa('Non ho sentito niente.'); return; }
  await capisci({ id: db.nuovoId(), ctx: v.ctx, blob: r.blob, nomeFile: `voce.${estensioneDi(r.tipo)}`, creata: new Date().toISOString() });
}

// Una registrazione: il testo (trascrivi), poi cosa fare (riordina, o la segnalazione). Senza rete aspetta sul telefono.
// Risponde true se è finita (fatta, o andata male per sempre), false se aspetta ancora la rete.
async function capisci(reg, dopo = false) {
  const chiudi = () => { if (!dopo && voce) chiudiVoce(); };
  try {
    if (!reg.testo) {
      reg.testo = (await db.trascrivi(reg.blob, reg.nomeFile)).testo;
      if (dopo) await registrazioni.metti(reg).catch(() => {});   // il testo c'è: la prossima volta non si trascrive di nuovo
    }
    if (reg.ctx.tipo === 'segnala') {
      await db.segnala({ testo: reg.testo, schermata: reg.ctx.dove, versione_app: db.versione(), dispositivo: dispositivo() });
      chiudi();
      mostraCapito(segnalazione(reg.testo, reg.ctx.dove), null, 'Inviata a Simone');   // una segnalazione partita non si annulla
      return true;
    }
    const risposta = await db.riordina({ testo: reg.testo, contesto: contestoVoce(reg.ctx) });
    chiudi();
    faiQuelloCheHoCapito(reg.testo, risposta, reg.ctx);
    return true;
  } catch (e) {
    if (e.rete) {
      if (!dopo) { await mettiInAttesa(reg); chiudi(); avvisa('Registrato. Lo sistemo appena c\'è rete.'); }
      return false;
    }
    chiudi();
    avvisa(e.message || 'Non sono riuscito: riprova.');
    return true;
  }
}

function faiQuelloCheHoCapito(testo, risposta, ctx) {
  const prima = foto();
  const { gruppi, dubbi, segnalazioni } = applicaAzioni(risposta.azioni);
  for (const s of segnalazioni) {
    db.segnala({ testo: s, schermata: ctx.dove, versione_app: db.versione(), dispositivo: dispositivo() }).catch(() => avvisa('La segnalazione non è partita.'));
    gruppi.push(...segnalazione(s, ctx.dove));
  }
  if (risposta.non_capito) dubbi.push(String(risposta.non_capito));
  const cambiato = foto() !== prima;
  if (dubbi.length) gruppi.push({ luogo: 'Non ho capito', righe: dubbi });
  if (!gruppi.length) { avvisa(`Non ho capito: «${testo}»`); return; }
  disegna();
  mostraCapito(gruppi, cambiato ? prima : null);
}

// Quello che sa la voce: oggi, dove si è, le lezioni delle ultime due settimane, gli allievi, i corsi, le forme
function descrivi(l) {
  const lezione = {
    id: l.id, giorno: l.giorno, ora: `${l.inizio}-${l.tipo === 'corso' ? l.fineCorso : l.fine}`, tipo: l.tipo,
    stato: l.nonFatta ? 'non fatta' : l.fatto ? 'raccontata' : iniziata(l) ? 'da raccontare' : 'non ancora cominciata',
  };
  if (l.tipo === 'corso') Object.assign(lezione, { corso: l.corso, iscritti: iscrittiDi(l), assenti: l.appello ? l.appello.assenti : null });
  else lezione.allievo = l.allievo;
  if (l.fatto) lezione.fatto = l.tipo === 'corso' ? { gruppo: l.fatto.gruppo, soli: l.fatto.soli.map(s => ({ allievo: s.chi, cosa: s.cosa })) } : { testo: l.fatto.testo };
  if (l.previsto) lezione.previsto = l.previsto;
  if (l.nonFatta && l.motivo) lezione.motivo = l.motivo;
  return lezione;
}
function contestoVoce(ctx) {
  return {
    oggi: OGGI, ora: stato.ora, giorno: dataLunga(OGGI), mese: MESE,
    dove: ctx.tipo === 'lezione' ? 'lezione' : ctx.scheda ? 'scheda' : ctx.sezione,
    lezione: ctx.tipo === 'lezione' ? ctx.id : null,
    allievo: ctx.scheda,
    lezioni: stato.lezioni.filter(l => l.giorno >= sposta(OGGI, -14) && l.giorno <= OGGI)
      .sort((a, b) => (a.giorno + a.inizio).localeCompare(b.giorno + b.inizio)).map(descrivi),
    allievi: stato.allievi.map(a => ({ nome: a.nome, corsi: a.corsi, private: a.private, non_viene_piu: a.uscito })),
    corsi: Object.keys(CORSI),
    forme: FORME.map(([forma, sezioni]) => ({ forma, sezioni })),
  };
}
// Il telefono, senza dati personali (per le segnalazioni)
function dispositivo() {
  const ua = navigator.userAgent || '';
  const so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : 'altro';
  return `${so} · ${screen.width}x${screen.height} · ${globalThis.matchMedia('(display-mode: standalone)').matches ? 'installata' : 'browser'}`;
}

// Le registrazioni che aspettano la rete: sul telefono, e "in attesa" sulla lezione
async function mettiInAttesa(reg) {
  try { await registrazioni.metti(reg); } catch { avvisa('Non riesco a tenerla sul telefono: ridilla con la rete.'); return; }
  stato.inAttesa.push({ id: reg.id, ctx: reg.ctx });
  disegna();
}
let inElaborazione = false;
async function elaboraAttese() {
  if (inElaborazione || !navigator.onLine || !stato.inAttesa.length) return;
  inElaborazione = true;
  let fatte = 0;
  try {
    for (const reg of await registrazioni.tutte()) {
      if (!(await capisci(reg, true))) break;      // ancora senza rete: si riprova dopo
      await registrazioni.togli(reg.id);
      stato.inAttesa = stato.inAttesa.filter(x => x.id !== reg.id);
      fatte++;
    }
  } catch { /* si riprova dopo */ } finally {
    inElaborazione = false;
    if (fatte) disegna();
  }
}

// --- Ho capito così, con Annulla ----------------------------------------
const foto = () => JSON.stringify({ lezioni: stato.lezioni, allievi: stato.allievi, imp: IMP });
// Il salvataggio: le righe del database prima e dopo il cambio; le differenze vanno in coda (js/dati.js).
// La copia sul telefono diventa subito come l'app. Il tema è solo di questo telefono.
const testiCambiati = testi => Object.fromEntries(Object.entries(testi).filter(([k, x]) => TESTI[k] && x.testo !== TESTI[k].testo).map(([k, x]) => [k, x.testo]));
const righeDi = f => versoDatabase({ allievi: f.allievi, lezioni: f.lezioni, imp: f.imp, testi: testiCambiati(f.imp.testi) });
function persisti(prima) {
  const d = righeDi({ allievi: stato.allievi, lezioni: stato.lezioni, imp: IMP });
  db.salvaTema(IMP.tema);
  db.aggiornaCopia(d);
  db.salva(db.differenze(righeDi(JSON.parse(prima)), d));
}
let timerAvviso = null;
function mostraCapito(gruppi, prima, titolo = 'Ho capito così') {
  clearTimeout(timerAvviso);
  if (prima) persisti(prima);
  if (prima) $('avviso-posto').dataset.prima = prima; else delete $('avviso-posto').dataset.prima;
  $('avviso-posto').innerHTML = `
    <div class="capito" role="status">
      <div class="capito-testa"><strong>${esc(titolo)}</strong>${prima ? '<button type="button" data-az="annulla">Annulla</button>' : ''}</div>
      ${gruppi.map(g => `<h3>${esc(g.luogo)}</h3>${g.righe.map(r => `<p>${esc(r)}</p>`).join('')}`).join('')}
    </div>`;
  timerAvviso = setTimeout(() => { $('avviso-posto').innerHTML = ''; }, 8000);
}
function salvato(testo, prima) {
  clearTimeout(timerAvviso);
  persisti(prima);
  $('avviso-posto').dataset.prima = prima;
  $('avviso-posto').innerHTML = `<div class="capito" role="status"><div class="capito-testa"><strong>${esc(testo)}</strong><button type="button" data-az="annulla">Annulla</button></div></div>`;
  timerAvviso = setTimeout(() => { $('avviso-posto').innerHTML = ''; }, 6000);
}
function avvisa(testo) {
  clearTimeout(timerAvviso);
  delete $('avviso-posto').dataset.prima;
  $('avviso-posto').innerHTML = `<div class="capito" role="status"><p>${esc(testo)}</p></div>`;
  timerAvviso = setTimeout(() => { $('avviso-posto').innerHTML = ''; }, 4000);
}
function annulla() {
  const prima = $('avviso-posto').dataset.prima;
  if (!prima) return;
  const dopo = foto();
  const p = JSON.parse(prima);
  stato.lezioni.splice(0, stato.lezioni.length, ...p.lezioni);
  stato.allievi.splice(0, stato.allievi.length, ...p.allievi);
  for (const k of Object.keys(CORSI)) { for (const x of Object.keys(CORSI[k])) delete CORSI[k][x]; Object.assign(CORSI[k], p.imp.corsi[k]); }
  Object.assign(IMP, { tema: p.imp.tema, prezzoPrivata: p.imp.prezzoPrivata, chiusura: p.imp.chiusura, notifiche: p.imp.notifiche, testi: p.imp.testi });
  persisti(dopo);                                    // com'era prima: si salva anche questo
  delete $('avviso-posto').dataset.prima;
  $('avviso-posto').innerHTML = '';
  $('sopra2').innerHTML = '';
  pulisciPila();
  disegna();
}
// Dopo Annulla o dopo aver ricaricato: via i pannelli di quello che non c'è più
function pulisciPila() {
  const valido = p => ['scheda', 'private', 'periodo'].includes(p.tipo) ? !!allievo(p.nome) : p.tipo === 'lezione' ? !!trova(p.id) : true;
  const i = pila.findIndex(p => !valido(p));
  if (i >= 0) pila.length = i;
}

// --- Il menu: Impostazioni, il PDF del mese, Segnala un problema -----------
const nomeSezione = () => ({ oggi: 'Oggi', allievi: 'Allievi', corsi: 'Corsi', scadenze: 'Scadenze' })[stato.sezione];
const giorniCorso = c => [...c.giorni].sort((x, y) => (x + 6) % 7 - (y + 6) % 7).map(g => GG[g]).join(', ');
const rigaImp = (az, dati, nome, valore) => `<button type="button" class="imp-riga" data-az="${az}" ${dati}><span class="imp-nome">${nome}</span><span class="imp-valore">${valore}</span>${FRECCIA}</button>`;
const siNo = (k, acceso) => `<div class="scelte">${[['si', 'Sì'], ['no', 'No']].map(([v, n]) =>
  `<button type="button" class="scelta" data-az="imp-notifica" data-k="${k}" data-v="${v}" aria-pressed="${(v === 'si') === acceso}">${n}</button>`).join('')}</div>`;

// Il calendario: lo legge la funzione `calendario` ogni 2 minuti e scrive com'è andata (lavori_fatti)
function statoCalendario() {
  const c = IMP.calendario;
  if (!c || c.esito === 'senza_indirizzo') return '<div class="imp-stato spento"><span class="pallino spento" aria-hidden="true"></span>Da collegare</div><p class="nota">Il Google della mail Lòngkai</p><p class="nota">Lo collega Simone</p>';
  const { giorno, ora } = adessoRoma(new Date(c.fatto_il));
  const ok = String(c.esito || '').startsWith('ok');
  return `<div class="imp-stato${ok ? '' : ' rosso'}"><span class="pallino${ok ? '' : ' rosso'}" aria-hidden="true"></span>${ok ? 'Collegato' : 'Non si legge'}</div>
          <p class="nota">Il Google della mail Lòngkai</p>
          <p class="nota">Si legge ogni 2 minuti, l'ultima ${giorno === OGGI ? `alle ${ora}` : ilGiorno(giorno)}</p>`;
}
// Le notifiche su questo telefono: si accendono e si spengono qui
function notaPush() {
  const nota = { attivo: 'Arrivano su questo telefono.', negato: 'Bloccate: riaprile dal telefono.',
    non_supportato: iphoneNonInstallata() ? "Su iPhone: prima l'app nella Home." : 'Questo browser non le riceve.' }[stato.push];
  return nota ? `<p class="nota">${nota}</p>` : '';
}

// Vale dalla prossima lezione: fino a oggi le lezioni tengono i giorni e l'orario di prima (comune/regole.js, orarioNel)
function tieniOrarioDiPrima(c) {
  c.prima = c.prima || [];
  if (!c.prima.some(p => p.fino === OGGI)) c.prima.push({ fino: OGGI, giorni: [...c.giorni], inizio: c.inizio, fine: c.fine });
}

function pannelloImpostazioni() {
  const n = IMP.notifiche;
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="Impostazioni">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}${nomeSezione()}</button></header>
      <div class="corpo-pannello gutter">
        <h1>Impostazioni</h1>
        <section class="blocco"><h2 class="titolo-blocco">ASPETTO</h2>
          <div class="imp-sw"><span>Tema</span><div class="scelte">${[['chiaro', 'Chiaro'], ['scuro', 'Scuro']].map(([v, n]) =>
            `<button type="button" class="scelta" data-az="imp-tema" data-v="${v}" aria-pressed="${IMP.tema === v}">${n}</button>`).join('')}</div></div>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">CORSI</h2>
          ${Object.entries(CORSI).map(([k, c]) => rigaImp('imp-corso', `data-k="${k}"`, k, `${giorniCorso(c)} · ${c.orario} · ${c.prezzo} €`)).join('')}
          <p class="nota">I prezzi sono al mese.</p>
          <p class="nota">Per un allievo, nella sua scheda.</p>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">PRIVATE</h2>
          <div class="campo"><span class="nome-campo">Prezzo</span><div class="campo-valore"><input type="number" inputmode="numeric" min="0" data-imp="prezzoPrivata" value="${IMP.prezzoPrivata}" aria-label="Prezzo della privata, di solito, in euro"><span class="unita">€ a lezione</span></div></div>
          <p class="nota">Di solito. Per un allievo, nella sua scheda.</p>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">SCUOLA CHIUSA</h2>
          <div class="campo"><span class="nome-campo">Mese</span><div class="campo-valore"><select data-imp="chiusura" aria-label="Mese di chiusura">
            <option value=""${IMP.chiusura ? '' : ' selected'}>nessuno</option>${MESI.map((nm, i) => `<option value="${due(i + 1)}"${IMP.chiusura === due(i + 1) ? ' selected' : ''}>${nm}</option>`).join('')}</select></div></div>
          <p class="nota">Niente corsi da pagare.</p>
          <p class="nota">Le private continuano.</p>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">CALENDARIO GOOGLE</h2>
          ${statoCalendario()}
          <p class="nota">Nel titolo: "priv" e il nome dell'allievo</p>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">NOTIFICHE</h2>
          <div class="imp-sw"><span>Certificato a 30 giorni</span>${siNo('cert30', n.cert30)}</div>
          <div class="imp-sw"><span>Certificato a 15 giorni</span>${siNo('cert15', n.cert15)}</div>
          <div class="imp-sw"><span>Pagamento in ritardo</span>${siNo('pagamenti', n.pagamenti)}</div>
          <div class="imp-sw"><span>Ora degli avvisi</span><input type="time" data-imp="ora" value="${n.ora}" aria-label="Ora degli avvisi"></div>
          <div class="imp-sw"><span>Su questo telefono</span><div class="scelte">${[['si', 'Sì'], ['no', 'No']].map(([v, x]) =>
            `<button type="button" class="scelta" data-az="push" data-v="${v}" aria-pressed="${(v === 'si') === (stato.push === 'attivo')}">${x}</button>`).join('')}</div></div>
          <p class="nota">Ognuna arriva una volta sola.</p>
          ${notaPush()}
        </section>
        <section class="blocco"><h2 class="titolo-blocco">MESSAGGI WHATSAPP</h2>
          ${Object.entries(IMP.testi).map(([k, x]) => rigaImp('imp-testo', `data-k="${k}"`, x.nome, esc(x.testo))).join('')}
        </section>
        <section class="blocco"><h2 class="titolo-blocco">CHI ENTRA</h2>
          <div class="imp-riga fissa"><span class="imp-nome">Il Sifu</span><span class="imp-valore">fa tutto</span></div>
          <div class="imp-riga fissa"><span class="imp-nome">Simone</span><span class="imp-valore">fa tutto</span></div>
        </section>
        <section class="blocco"><h2 class="titolo-blocco">QUESTO TELEFONO</h2>
          <div class="imp-riga fissa"><span class="imp-nome">Entrato come</span><span class="imp-valore">${esc(stato.email)}</span></div>
          <div class="imp-riga fissa"><span class="imp-nome">Versione</span><span class="imp-valore">${esc(db.versione())}</span></div>
          <button type="button" class="link rosso" data-az="esci">Esci</button>
        </section>
      </div>
    </div>`;
}
function apriCorsoImp(k) {       // un corso: prezzo, giorni, orario
  const c = CORSI[k];
  $('sopra2').innerHTML = velo(`Corso ${k}`, `
      <h2>Corso ${k}</h2>
      <p class="sotto">Vale dalla prossima lezione</p>
      <div class="campo"><span class="nome-campo">Prezzo al mese</span><div class="campo-valore"><input type="number" inputmode="numeric" min="0" data-imp-corso="${k}" data-campo-corso="prezzo" value="${c.prezzo}" aria-label="Prezzo al mese in euro"><span class="unita">€</span></div></div>
      <div class="campo largo"><span class="nome-campo">Giorni</span><div class="giorni">${[1, 2, 3, 4, 5, 6, 0].map(g =>
        `<button type="button" class="scelta" data-az="imp-giorno" data-k="${k}" data-g="${g}" aria-pressed="${c.giorni.includes(g)}">${GG[g]}</button>`).join('')}</div></div>
      <div class="campo largo"><span class="nome-campo">Orario</span><div class="orari"><input type="time" data-imp-corso="${k}" data-campo-corso="dalle" value="${c.inizio}" aria-label="Dalle"><span>–</span><input type="time" data-imp-corso="${k}" data-campo-corso="alle" value="${c.fine}" aria-label="Alle"></div></div>`);
}
function apriTestoImp(k) {       // il testo di un messaggio
  const x = IMP.testi[k];
  $('sopra2').innerHTML = velo(x.nome, `
      <h2>${x.nome}</h2>
      <p class="sotto">Le parole tra { } le mette l'app</p>
      <p class="nota">${SEGNAPOSTI[k]}</p>
      <textarea data-testo="${k}" aria-label="Il testo del messaggio">${esc(x.testo)}</textarea>
      ${x.testo !== TESTI[k].testo ? `<button type="button" data-az="imp-testo-prima" data-k="${k}">Rimetti il testo di prima</button>` : ''}`);
}

// Il PDF del mese (V8): i mesi finiti; dentro ore e assenze di ogni allievo, i grafici, i corsi, le private
function pannelloPdf() {
  const finiti = [];
  for (let m = PRIMO_GIORNO.slice(0, 7); m < MESE; m = meseDopo(m, 1)) finiti.push(m);
  const titolo = m => `${maiuscola(nomeMese(m))} ${m.slice(0, 4)}`;
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="PDF del mese">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}${nomeSezione()}</button></header>
      <div class="corpo-pannello gutter">
        <h1>PDF del mese</h1>
        <p class="sotto">Pronto il giorno 1 del mese dopo</p>
        <section class="blocco">
          ${finiti.reverse().map(m => rigaImp('pdf-mese', `data-m="${m}"`, titolo(m), `pronto ${dalGiorno(`${meseDopo(m, 1)}-01`)}`)).join('')}
          <div class="imp-riga fissa spenta"><span class="imp-nome">${titolo(MESE)}</span><span class="imp-valore">pronto ${ilGiorno(`${meseDopo(MESE, 1)}-01`)}</span></div>
        </section>
      </div>
    </div>`;
}
function pannelloPdfMese(m) {
  const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const attivi = stato.allievi.filter(a => !a.uscito && a.dal <= m);
  const per = attivi.map(a => { const lez = delMese(lezioniDi(a.nome), m); return { a, lez, ore: oreDi(a.nome, lez), c: conteggio(a.nome, lez) }; });
  const allievi = per.map(({ a, lez, ore, c }) => {
    const parti = [];
    if (c.corsi.tot) parti.push(`corsi ${c.corsi.fatte} su ${c.corsi.tot}`);
    if (c.private.tot) parti.push(`private ${c.private.fatte} su ${c.private.tot}`);
    const assente = lez.filter(l => l.tipo === 'corso' && l.appello && !l.nonFatta && iscrittiDi(l).includes(a.nome) && l.appello.assenti.includes(a.nome)).map(l => l.giorno).sort();
    const nonVenuto = lez.filter(l => l.tipo === 'privata' && l.nonFatta && l.motivo === 'assente').map(l => l.giorno).sort();
    return `
      <div class="pdf-allievo">
        <div class="cosa-mese"><span>${esc(a.nome)}</span><span>${pl(ore, 'ora', 'ore')}</span></div>
        <div class="riga">${parti.join(' · ') || 'nessuna lezione'}</div>
        ${assente.length ? `<div class="riga">assente ${assente.map(ilGiorno).join(', ')}</div>` : ''}
        ${nonVenuto.length ? `<div class="riga">privata, non è venuto ${nonVenuto.map(ilGiorno).join(', ')}</div>` : ''}
        ${notaRapporti(c.senzaRapporto)}
      </div>`;
  }).join('');
  const corsi = Object.keys(CORSI).map(corso => {
    const lez = lezioniCorso(corso).filter(l => l.giorno.startsWith(m));
    if (!lez.length) return '';
    const fatte = lez.filter(conRapporto).reverse();
    const max = Math.max(roster(corso).length, ...fatte.map(l => presentiDi(l).length), 1);
    const colonne = fatte.map(l => { const n = presentiDi(l).length; return `<div class="colonna"><b>${n}</b><i style="height:${Math.round(n / max * 60)}px"></i><span>${dataCorta(l.giorno)}</span></div>`; }).join('');
    const conta = new Map();
    [...gruppoDi(lez)].reverse().forEach(g => conta.set(g, (conta.get(g) || 0) + 1));
    return `
      <div class="pdf-corso">
        <div class="cosa-mese"><span>Corso ${corso}</span><span>${quanteLezioni(lez)}</span></div>
        <p class="nota">presenti a ogni lezione</p>
        <div class="colonne dodici" aria-hidden="true">${colonne}</div>
        ${[...conta].map(([g, n]) => `<div class="cosa-mese piccola"><span>${esc(g)}</span><span>${pl(n, 'lezione', 'lezioni')}</span></div>`).join('')}
        ${notaRapporti(senzaRapportoDi(lez))}
      </div>`;
  }).join('');
  const priv = attivi.map(a => {
    const lez = stato.lezioni.filter(l => l.tipo === 'privata' && l.allievo === a.nome && l.giorno.startsWith(m)).sort((x, y) => x.giorno.localeCompare(y.giorno));
    if (!lez.length) return '';
    const fatte = lez.filter(l => l.fatto && !l.nonFatta).length;
    return `
      <div class="pdf-allievo">
        <div class="cosa-mese"><span>${esc(a.nome)}</span><span>${pl(fatte, 'privata fatta', 'private fatte')}</span></div>
        ${lez.map(l => `<div class="cosa-mese piccola"><span>${esc(l.nonFatta ? nonFattaTesto(l) : l.fatto ? l.fatto.testo : 'manca il rapporto')}</span><span>${dataCorta(l.giorno)}</span></div>`).join('')}
      </div>`;
  }).join('');
  const titolo = `${maiuscola(nomeMese(m))} ${m.slice(0, 4)}`;
  return `
    <div class="pannello" role="dialog" aria-modal="true" aria-label="PDF di ${titolo}">
      <header class="alto"><button type="button" class="indietro" data-az="chiudi">${ICONA.sx}PDF del mese</button></header>
      <div class="corpo-pannello gutter">
        <h1>${titolo}</h1>
        <p class="sotto">Il PDF del mese · pronto ${dalGiorno(`${meseDopo(m, 1)}-01`)}</p>
        <button type="button" class="tasto secondario" data-az="scarica-pdf" style="margin-top:10px">Scarica il PDF</button>
        <div class="pagina-pdf">
          <div class="pdf-testa"><span class="logo" aria-hidden="true"></span><div><p class="pdf-nome">Lòngkai · Wing Chun</p><p class="pdf-mese">${titolo} · Mortara e Vigevano</p></div></div>
          <section class="blocco"><h2 class="titolo-blocco">ALLIEVI</h2>${allievi}</section>
          <section class="blocco"><h2 class="titolo-blocco">CORSI</h2>${corsi}</section>
          ${priv ? `<section class="blocco"><h2 class="titolo-blocco">PRIVATE</h2>${priv}</section>` : ''}
        </div>
      </div>
    </div>`;
}

// Segnala un problema (V11): si dice a voce cosa non va; arriva a Simone con una notifica sul telefono,
// insieme alla schermata dove si era, senza nomi
function segnalazione(testo, dove) {
  return [{ luogo: 'Segnalazione', righe: [`«${testo}»`, `con la schermata: ${dove}, senza nomi`, 'a Simone arriva una notifica sul telefono'] }];
}

// --- Menu e fogli -------------------------------------------------------
function apriMenu() {
  $('sopra2').innerHTML = `
    <div class="velo" data-az="chiudi-velo">
      <div class="foglio gutter" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="menu-testa"><span class="logo menu-logo" aria-hidden="true"></span><div><p class="menu-nome">Lòngkai</p><p class="menu-sotto">Wing Chun · il gestionale del Sifu</p></div></div>
        <button type="button" class="con-freccia" data-az="pdf"><span>PDF del mese</span>${FRECCIA}</button>
        <button type="button" class="con-freccia" data-az="segnala"><span>Segnala un problema</span>${FRECCIA}</button>
        <button type="button" class="con-freccia" data-az="impostazioni"><span>Impostazioni</span>${FRECCIA}</button>
        ${stato.aggiornamento ? `<button type="button" class="con-freccia" data-az="aggiorna"><span>Aggiorna l'app</span>${FRECCIA}</button>` : ''}
        <button type="button" data-az="chiudi-velo">Chiudi</button>
      </div>
    </div>`;
  $('sopra2').querySelector('.foglio button').focus();
}
function apriForma(f) {
  const a = allievo(pila.at(-1).nome), n = FORME.find(x => x[0] === f)[1], v = a.forme[f] || 0;
  const voci = Array.from({ length: n + 1 }, (_, i) => i);
  $('sopra2').innerHTML = `
    <div class="velo" data-az="chiudi-velo">
      <div class="foglio gutter" role="dialog" aria-modal="true" aria-label="${f}">
        <h2>${f} · dove è arrivato</h2>
        ${voci.map(i => `<button type="button" data-az="imposta-forma" data-f="${f}" data-v="${i}" aria-pressed="${i === v}">${statoForma({ v: i, n })}</button>`).join('')}
        <button type="button" data-az="chiudi-velo">Chiudi</button>
      </div>
    </div>`;
}

// --- Tocchi -------------------------------------------------------------
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('[data-campo]')) {
    const prima = foto();                         // i dati non sono ancora cambiati: solo il campo
    const a = allievo(pila.at(-1).nome), k = t.dataset.campo;
    a[k] = t.type === 'number' ? Number(t.value || 0) : t.value;
    if (k === 'privata' && a.privata === IMP.prezzoPrivata) a.privata = null;   // uguale a quello di solito: segue le Impostazioni
    salvato('Salvato', prima);
    disegna();
  } else if (t.matches('[data-prezzo]')) {        // il prezzo di un corso per questo allievo
    const prima = foto(), a = allievo(pila.at(-1).nome), k = t.dataset.prezzo, v = Number(t.value || 0);
    if (v === CORSI[k].prezzo) delete a.prezzi[k]; else a.prezzi[k] = v;
    salvato('Salvato', prima);
    disegna();
  } else if (t.matches('[data-nuovo]')) {
    stato.nuovo[t.dataset.nuovo] = t.type === 'number' ? Number(t.value || 0) : t.value;
  } else if (t.matches('[data-pag]')) {          // mese pagato: la data o la cifra
    if (t.dataset.pag === 'il' && !t.value) return;
    const prima = foto(), a = allievo(t.dataset.nome), m = t.dataset.m;
    if (t.dataset.pag === 'il') a.pagato[m] = t.value;
    else a.cifre[m] = Number(t.value || 0);
    $('sopra2').innerHTML = ''; disegna(); salvato('Salvato', prima);
  } else if (t.matches('[data-imp]')) {            // le impostazioni
    const k = t.dataset.imp;
    if (k === 'ora' && !t.value) return;
    const prima = foto();
    if (k === 'prezzoPrivata') IMP.prezzoPrivata = Number(t.value || 0);
    else if (k === 'chiusura') IMP.chiusura = t.value;
    else IMP.notifiche.ora = t.value;
    disegna(); salvato('Salvato', prima);
  } else if (t.matches('[data-imp-corso]')) {      // un corso: prezzo e orario (vale dalla prossima lezione)
    const c = CORSI[t.dataset.impCorso], campo = t.dataset.campoCorso;
    if (campo !== 'prezzo' && !t.value) return;
    const prima = foto();
    if (campo === 'prezzo') c.prezzo = Number(t.value || 0);
    else { tieniOrarioDiPrima(c); c[campo === 'dalle' ? 'inizio' : 'fine'] = t.value; aggiornaOrario(c); }
    disegna(); salvato('Salvato', prima);
  } else if (t.matches('[data-testo]')) {          // il testo di un messaggio
    const prima = foto();
    IMP.testi[t.dataset.testo].testo = t.value;
    disegna(); salvato('Salvato', prima);
  } else if (t.matches('[data-cert]')) {
    const prima = foto();
    allievo(t.dataset.cert).cert = t.value;
    $('sopra2').innerHTML = ''; disegna(); salvato('Salvato', prima);
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'cerca') { stato.cerca = e.target.value; disegnaLista(); }
  else if (e.target.matches('[data-nuovo]')) stato.nuovo[e.target.dataset.nuovo] = e.target.type === 'number' ? Number(e.target.value || 0) : e.target.value;
});

document.addEventListener('click', e => {
  const t = e.target.closest('[data-az]');
  if (!t) return;
  if (t.dataset.az === 'chiudi-velo' && t.classList.contains('velo') && e.target !== t) return;   // tocco dentro il foglio
  const id = t.dataset.id;
  switch (t.dataset.az) {
    case 'sezione':
      if (stato.sezione === t.dataset.s && t.dataset.s === 'oggi') stato.giorno = OGGI;
      stato.sezione = t.dataset.s; pila.length = 0; disegna(); break;
    case 'giorno': {
      const nuovo = sposta(stato.giorno, Number(t.dataset.passo));
      if (nuovo >= PRIMO_GIORNO && nuovo <= OGGI) { stato.giorno = nuovo; disegna(); }
      break;
    }
    case 'vai': {
      stato.giorno = t.dataset.giorno; disegna();
      const riga = $(`lez-${id}`);
      if (riga) { riga.classList.add('evidenza'); riga.scrollIntoView({ block: 'nearest' }); }
      break;
    }
    case 'apri': apri({ tipo: 'lezione', id }); break;
    case 'chiudi': indietro(); break;
    case 'chiudi-velo': $('sopra2').innerHTML = ''; break;
    case 'detta': apriVoce({ tipo: 'lezione', id }); break;
    case 'parla': $('sopra2').innerHTML = ''; apriVoce({ tipo: 'parla' }); break;
    case 'fine': fineVoce(); break;
    case 'annulla-voce': chiudiVoce(); break;
    case 'menu': apriMenu(); break;
    // Il menu
    case 'impostazioni':
      $('sopra2').innerHTML = ''; apri({ tipo: 'impostazioni' });
      statoPush().then(x => { if (x !== stato.push) { stato.push = x; disegnaPila(); } });
      break;
    case 'pdf': $('sopra2').innerHTML = ''; apri({ tipo: 'pdf' }); break;
    case 'pdf-mese': apri({ tipo: 'pdf-mese', m: t.dataset.m }); break;
    case 'scarica-pdf': stampaPdf(pila.at(-1).m); break;
    case 'push': cambiaPush(t.dataset.v === 'si'); break;
    case 'esci': esci(); break;
    case 'aggiorna': aggiorna(); break;
    case 'segnala': $('sopra2').innerHTML = ''; apriVoce({ tipo: 'segnala' }); break;
    case 'imp-corso': apriCorsoImp(t.dataset.k); break;
    case 'imp-tema': { const prima = foto(); IMP.tema = t.dataset.v; disegna(); salvato(t.dataset.v === 'scuro' ? 'Tema scuro' : 'Tema chiaro', prima); break; }
    case 'imp-giorno': {
      const c = CORSI[t.dataset.k], g = Number(t.dataset.g);
      if (c.giorni.includes(g) && c.giorni.length === 1) { avvisa('Un corso ha almeno un giorno.'); break; }
      const prima = foto();
      tieniOrarioDiPrima(c);
      c.giorni = c.giorni.includes(g) ? c.giorni.filter(x => x !== g) : [...c.giorni, g];
      disegna(); apriCorsoImp(t.dataset.k); salvato('Salvato', prima);
      break;
    }
    case 'imp-testo': apriTestoImp(t.dataset.k); break;
    case 'imp-testo-prima': {
      const prima = foto();
      IMP.testi[t.dataset.k].testo = TESTI[t.dataset.k].testo;
      disegna(); apriTestoImp(t.dataset.k); salvato('Rimesso il testo di prima', prima);
      break;
    }
    case 'imp-notifica': { const prima = foto(); IMP.notifiche[t.dataset.k] = t.dataset.v === 'si'; disegnaPila(); salvato('Salvato', prima); break; }
    case 'annulla': annulla(); break;
    // Allievi
    case 'filtro': stato.filtro = t.dataset.v; disegnaLista(); break;
    case 'mostra-usciti': stato.mostraUsciti = !stato.mostraUsciti; disegnaLista(); break;
    case 'scheda': $('sopra2').innerHTML = ''; stato.datiAperti = false; apri({ tipo: 'scheda', nome: t.dataset.nome }); break;
    case 'dati': stato.datiAperti = !stato.datiAperti; disegnaPila(); break;
    case 'vista': stato.vista = t.dataset.v; disegnaPila(); break;
    case 'periodo': apri({ tipo: 'periodo', nome: pila.at(-1).nome, k: t.dataset.k, soloPrivate: pila.at(-1).tipo === 'private' }); break;
    case 'corso': stato.corso = t.dataset.v; disegna(); break;
    case 'vista-corso': stato.vistaCorso = t.dataset.v; disegna(); break;
    case 'vista-private': stato.vistaPrivate = t.dataset.v; disegnaPila(); break;
    case 'settimana-corso': apri({ tipo: 'settimana-corso', corso: stato.corso, k: t.dataset.k }); break;
    case 'mese-corso': apri({ tipo: 'mese-corso', corso: stato.corso, k: t.dataset.k }); break;
    case 'private-di': stato.vistaPrivate = 'Lezioni'; apri({ tipo: 'private', nome: t.dataset.nome }); break;
    case 'forma': apriForma(t.dataset.f); break;
    case 'imposta-forma': {
      const prima = foto();
      allievo(pila.at(-1).nome).forme[t.dataset.f] = Number(t.dataset.v);
      $('sopra2').innerHTML = ''; disegnaPila(); salvato('Salvato', prima);
      break;
    }
    case 'fa': {
      const prima = foto(), a = allievo(pila.at(-1).nome), c = t.dataset.c;
      if (c === 'Private') { a.private = !a.private; if (!a.private) a.privateMese = 0; }   // spente: niente private da pagare
      else a.corsi = a.corsi.includes(c) ? a.corsi.filter(x => x !== c) : [...a.corsi, c];
      disegna(); salvato('Salvato', prima);
      break;
    }
    case 'whatsapp':                                 // con il testo già scritto; dalla scheda, la chat e basta
      if (t.dataset.msg) apriMessaggio(t.dataset.nome, t.dataset.msg, t.dataset.m);
      else apriWhatsApp(allievo(pila.at(-1).nome), '');
      break;
    // Scadenze
    case 'scadenza': stato.scadenza = t.dataset.v; $('lista').scrollTop = 0; disegna(); break;
    case 'piu-avanti': stato.piuAvanti = !stato.piuAvanti; disegna(); break;
    case 'cert': apriCert(t.dataset.nome); break;
    case 'mese-cert': apriMeseCert(Number(t.dataset.n)); break;
    case 'cella': {                                // da pagare o rossa: si spunta subito; spuntata: il conto, la data, la cifra
      const a = allievo(t.dataset.nome), m = t.dataset.m;
      if (a.pagato[m]) apriConto(a.nome, m);
      else segnaPagato(a, m);
      break;
    }
    case 'spunta': case 'paga': segnaPagato(allievo(t.dataset.nome), t.dataset.m); break;
    case 'conto': apriConto(t.dataset.nome, t.dataset.m); break;
    case 'togli': {
      const prima = foto(), a = allievo(t.dataset.nome), m = t.dataset.m;
      delete a.pagato[m];
      delete a.cifre[m];
      $('sopra2').innerHTML = ''; disegna(); salvato('Spunta tolta', prima);
      break;
    }
    case 'esce': {
      const prima = foto(), a = allievo(pila.at(-1).nome);
      a.uscito = true; pila.pop(); disegna(); salvato(`${a.nome}: non viene più`, prima);
      break;
    }
    case 'torna': { const prima = foto(); allievo(pila.at(-1).nome).uscito = false; disegna(); salvato('Torna a venire', prima); break; }
    case 'nuovo': stato.nuovo = { nome: '', cell: '', fa: [], privata: IMP.prezzoPrivata, privateMese: 4, cert: '' }; apri({ tipo: 'nuovo' }); break;
    case 'nuovo-fa': {
      const c = t.dataset.c, f = stato.nuovo.fa;
      stato.nuovo.fa = f.includes(c) ? f.filter(x => x !== c) : [...f, c];
      disegnaPila();
      break;
    }
    case 'aggiungi': {
      const n = stato.nuovo, nome = n.nome.trim().replace(/\s+/g, ' ');
      if (!nome) { avvisa('Manca il nome.'); $('n-nome').focus(); break; }
      if (conNome(nome)) { avvisa('C\'è già un allievo con questo nome.'); $('n-nome').focus(); break; }   // il calendario riconosce dal nome
      const prima = foto();
      const a = nuovoAllievo(nome, n.fa.filter(c => c !== 'Private'), n.fa.includes('Private'), n.privata, n.cell, n.privateMese);
      a.cert = n.cert;
      aggiungiAllievo(a);
      pila.length = 0; disegna(); salvato(`${nome} aggiunto`, prima);
      break;
    }
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (voce) chiudiVoce();
  else if ($('sopra2').innerHTML) $('sopra2').innerHTML = '';
  else if (pila.length) indietro();
});
// --- I dati: dal database, o dalla copia sul telefono se manca la rete; sopra, i cambi ancora in coda ---------
async function carica() {
  let d = null;
  try { await db.svuota(); d = await db.scarica(); } catch { d = db.copiaSalvata(); }
  if (!d) return false;
  usaDati(db.conCoda(d));
  return true;
}
function usaDati(d) {
  const imp = impostazioniDa(d.valori);
  for (const k of Object.keys(CORSI)) delete CORSI[k];
  Object.assign(CORSI, imp.corsi);
  Object.assign(IMP, { prezzoPrivata: imp.prezzoPrivata, chiusura: imp.chiusura, notifiche: imp.notifiche, calendario: d.calendario || null, testi: JSON.parse(JSON.stringify(TESTI)) });
  for (const [k, testo] of Object.entries(imp.testi)) if (IMP.testi[k]) IMP.testi[k].testo = testo;
  PRIMO_GIORNO = imp.primoGiorno && imp.primoGiorno <= OGGI ? imp.primoGiorno : OGGI;
  const { allievi, lezioni } = daDatabase(d);
  stato.allievi.splice(0, stato.allievi.length, ...allievi);
  stato.lezioni.splice(0, stato.lezioni.length, ...lezioni, ...lezioniDeiCorsi(CORSI, PRIMO_GIORNO, OGGI, new Set(lezioni.map(l => l.id))));
  if (stato.giorno < PRIMO_GIORNO || stato.giorno > OGGI) stato.giorno = OGGI;
}
// Si ricarica quando l'app torna davanti e quando cambia il giorno; si ridisegna solo se non si sta scrivendo o parlando
const occupato = () => !!voce || !!$('sopra2').innerHTML || !!document.activeElement?.closest?.('input, textarea, select');
let caricando = null;
function ricarica() {
  if (caricando || !stato.email) return caricando;
  caricando = (async () => {
    if (!(await carica())) return;
    if ($('avviso-posto').dataset.prima) { delete $('avviso-posto').dataset.prima; $('avviso-posto').innerHTML = ''; }   // un Annulla di prima non vale più
    pulisciPila();
    if (!occupato()) disegna();
  })().finally(() => { caricando = null; });
  return caricando;
}
// Il salvataggio, detto al Sifu: senza rete (si salva quando torna), o un cambio che il database non prende
let senzaRete = false;
db.suSalvataggio(e => {
  if (e.tipo === 'senza_rete') {
    if (senzaRete) return;
    senzaRete = true;
    const box = $('avviso-posto').querySelector('.capito');
    if (box && $('avviso-posto').dataset.prima) box.insertAdjacentHTML('beforeend', '<p>Senza rete: lo salvo appena torna.</p>');
    else avvisa('Senza rete: lo salvo appena torna.');
  } else if (e.tipo === 'salvato') {
    if (senzaRete && !$('avviso-posto').dataset.prima) avvisa('Salvato: la rete è tornata.');
    senzaRete = false;
  } else if (e.tipo === 'errore') {
    avvisa(e.codice === '23505' ? 'C\'è già un allievo con questo nome.' : 'Non salvato: il database non l\'ha preso.');
    setTimeout(ricarica, 1500);
  }
});

// --- L'ora che passa: le lezioni cominciano, il giorno cambia ----------------------------------------------
setInterval(() => {
  const { giorno, ora } = adessoRoma();
  if (giorno !== OGGI) {
    if (stato.giorno === OGGI) stato.giorno = giorno;
    OGGI = giorno; MESE = giorno.slice(0, 7); stato.ora = ora;
    ricarica();
    return;
  }
  if (ora === stato.ora) return;
  const cominciate = stato.lezioni.filter(iniziata).length;
  stato.ora = ora;
  if (stato.lezioni.filter(iniziata).length !== cominciate && !occupato()) disegna();
}, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !stato.email) return;
  ricarica();
  elaboraAttese();
});
globalThis.addEventListener('online', () => { db.svuota(); elaboraAttese(); });

// --- Il PDF del mese: si stampa la pagina, o si salva come PDF (Stampa → Salva come PDF). Solo il foglio, bianco ----
function stampaPdf(m) {
  const pagina = $('sopra').querySelector('.pagina-pdf');
  if (!pagina) return;
  $('stampa').innerHTML = pagina.outerHTML;
  const titolo = document.title;
  document.title = `Lòngkai ${maiuscola(nomeMese(m))} ${m.slice(0, 4)}`;   // il nome del file
  globalThis.addEventListener('afterprint', () => { $('stampa').innerHTML = ''; document.title = titolo; }, { once: true });
  globalThis.print();
}

// --- Le notifiche di questo telefono ----------------------------------------------------------------------
async function cambiaPush(si) {
  try {
    if (si) await attivaPush(); else await disattivaPush();
    avvisa(si ? 'Notifiche accese su questo telefono.' : 'Notifiche spente su questo telefono.');
  } catch (e) { avvisa(e.message || 'Non ci sono riuscito: riprova.'); }
  stato.push = await statoPush();
  disegnaPila();
}

// --- Una versione nuova: si prende quando il Sifu tocca Aggiorna ------------------------------------------
let aggiornando = false;
function registraServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (aggiornando) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const pronta = w => { if (!w || !navigator.serviceWorker.controller) return; stato.aggiornamento = w; mostraAggiorna(); };
    pronta(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') pronta(w); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* senza service worker l'app va lo stesso: solo non si apre senza rete */ });
}
function mostraAggiorna() {
  if ($('avviso-posto').dataset.prima) return;      // non si toglie un Annulla: Aggiorna resta nel menu
  clearTimeout(timerAvviso);
  $('avviso-posto').innerHTML = '<div class="capito" role="status"><div class="capito-testa"><strong>Nuova versione</strong><button type="button" data-az="aggiorna">Aggiorna</button></div></div>';
  timerAvviso = setTimeout(() => { $('avviso-posto').innerHTML = ''; }, 15000);
}
function aggiorna() {
  if (!stato.aggiornamento) { location.reload(); return; }
  aggiornando = true;
  stato.aggiornamento.postMessage({ tipo: 'AGGIORNA' });
}

// --- L'accesso: email e password, la prima volta; il telefono la ricorda ------------------------------------
function mostraAccesso(modo) {
  const nuova = modo === 'nuova';
  stato.email = '';
  $('accesso').hidden = false;
  $('modulo-accesso').dataset.modo = modo;
  $('a-riga-email').hidden = nuova;
  $('a-riga-ripeti').hidden = !nuova;
  $('a-dimenticata').hidden = nuova;
  $('a-nome-password').textContent = nuova ? 'Nuova password' : 'Password';
  $('a-password').autocomplete = nuova ? 'new-password' : 'current-password';
  $('a-entra').textContent = nuova ? 'Salva la password' : 'Entra';
  $('a-errore').textContent = '';
}
$('modulo-accesso').addEventListener('submit', async e => {
  e.preventDefault();
  const modo = $('modulo-accesso').dataset.modo, errore = $('a-errore'), tasto = $('a-entra');
  errore.textContent = '';
  tasto.disabled = true;
  try {
    if (modo === 'nuova') {
      const p = $('a-password').value;
      if (p.length < 12 || !/[a-zA-Z]/.test(p) || !/\d/.test(p)) { errore.textContent = 'Almeno 12 caratteri, lettere e numeri.'; return; }
      if (p !== $('a-ripeti').value) { errore.textContent = 'Le due password non sono uguali.'; return; }
      await db.aggiornaPassword(p);
    } else {
      await db.accedi($('a-email').value.trim(), $('a-password').value);
    }
    $('a-password').value = ''; $('a-ripeti').value = '';
    await entra();
  } catch (err) {
    errore.textContent = /invalid/i.test(err.message || '') ? 'Email o password sbagliate.' : !navigator.onLine ? 'Senza rete: riprova quando torna.' : 'Non riesco a entrare: riprova.';
  } finally { tasto.disabled = false; }
});
$('a-dimenticata').addEventListener('click', async () => {
  const b = $('a-dimenticata'), email = $('a-email').value.trim();
  if (!email) { $('a-errore').textContent = 'Scrivi prima la tua email.'; return; }
  b.disabled = true;                                  // un tocco solo: la seconda email il server la rifiuta
  try { await db.passwordDimenticata(email); $('a-errore').textContent = 'Ti ho mandato un\'email con il link.'; }
  catch { $('a-errore').textContent = 'Non sono riuscito a mandare l\'email.'; }
  setTimeout(() => { b.disabled = false; }, 60000);
});

async function entra() {
  const s = await db.sessione().catch(() => null);
  if (!s) { mostraAccesso('entra'); return; }
  if (navigator.onLine) {                             // solo chi ha un profilo attivo (il Sifu e Simone)
    const p = await db.profilo().catch(() => undefined);
    if (p === null || (p && !p.attivo)) {
      await db.esci().catch(() => {});
      mostraAccesso('entra');
      $('a-errore').textContent = 'Questo account non può entrare.';
      return;
    }
  }
  stato.email = s.user?.email || '';
  if (!(await carica())) { mostraAccesso('entra'); $('a-errore').textContent = 'Senza rete: riprova quando torna.'; return; }
  $('accesso').hidden = true;
  disegna();
  stato.inAttesa = (await registrazioni.tutte().catch(() => [])).map(r => ({ id: r.id, ctx: r.ctx }));
  if (stato.inAttesa.length) { disegna(); elaboraAttese(); }
  sincronizzaPush();
  statoPush().then(x => { stato.push = x; });
}
async function esci() {
  if (db.inCoda() || stato.inAttesa.length) { avvisa('Prima serve la rete: ci sono cambi da salvare.'); return; }
  try { await db.esci(); } catch { /* si esce lo stesso da questo telefono */ }
  await registrazioni.svuota().catch(() => {});
  stato.allievi.length = 0; stato.lezioni.length = 0; pila.length = 0;
  $('sopra2').innerHTML = '';
  disegna();
  mostraAccesso('entra');
}

// --- L'avvio ---------------------------------------------------------------------------------------------
function chiudiApertura() {
  const a = $('apertura');
  if (!a || a.classList.contains('via')) return;
  a.classList.add('via');
  setTimeout(() => a.remove(), 500);
}
$('apertura').addEventListener('click', chiudiApertura);
setTimeout(chiudiApertura, 1400);

// Solo in locale, per le prove automatiche (come nel prototipo)
if (['localhost', '127.0.0.1'].includes(location.hostname)) globalThis.__app = { stato, IMP, CORSI, faiQuelloCheHoCapito, foto, ricarica };
const RECUPERO = /type=recovery/.test(location.hash);    // il link "scegli la password" dell'email
document.documentElement.dataset.tema = IMP.tema;
registraServiceWorker();
if (!db.configurato()) {
  mostraAccesso('entra');
  $('a-errore').textContent = 'Manca la configurazione (config.js).';
} else {
  db.suCambioAccesso(evento => {
    if (evento === 'PASSWORD_RECOVERY') mostraAccesso('nuova');
    else if (evento === 'SIGNED_OUT' && stato.email) mostraAccesso('entra');
  });
  if (RECUPERO) mostraAccesso('nuova'); else entra();
}
