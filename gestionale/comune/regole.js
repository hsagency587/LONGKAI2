/* Lòngkai — regole.js: le date e i conti. Sono quelli del prototipo approvato (prototipi/app.html, versione 16).
   Li usano l'app sul telefono e il server: la copia in supabase/functions/_condivise/regole.js è uguale (lo controlla un test).
   Le cifre sono in euro, i giorni "AAAA-MM-GG", i mesi "AAAA-MM", le ore "HH:MM". Gli allievi si riconoscono dal nome
   (nel database il nome è unico); dal database e verso il database si passa con i loro id. */

// --- Date ------------------------------------------------------------------
export const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export const MESI3 = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
export const ORDINALI = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava'];
export const due = n => String(n).padStart(2, '0');
export const daChiave = k => { const [a, m, g] = k.split('-').map(Number); return new Date(a, m - 1, g); };
export const chiave = d => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const sposta = (k, n) => { const d = daChiave(k); d.setDate(d.getDate() + n); return chiave(d); };
export const dataLunga = k => { const d = daChiave(k); return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
export const dataMedia = k => { const d = daChiave(k); return `${GG[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
export const dataBreve = k => { const d = daChiave(k); return `${GG[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
export const dataCorta = k => { const d = daChiave(k); return `${d.getDate()}/${d.getMonth() + 1}`; };
export const elide = k => [1, 8, 11].includes(daChiave(k).getDate());       // l'1, l'8, l'11
export const ilGiorno = k => elide(k) ? `l'${dataCorta(k)}` : `il ${dataCorta(k)}`;
export const dataPiena = k => { const d = daChiave(k); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
export const giorniFra = (a, b) => Math.round((daChiave(b) - daChiave(a)) / 86400000);
export const lunediDi = k => sposta(k, -((daChiave(k).getDay() + 6) % 7));
export const nomeMese = m => MESI[Number(m.slice(5, 7)) - 1];
export function etichettaIntervallo(da, fino) {
  const a = daChiave(da), b = daChiave(fino);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}-${b.getDate()} ${MESI[a.getMonth()]}`
    : `${a.getDate()} ${MESI3[a.getMonth()]}-${b.getDate()} ${MESI3[b.getMonth()]}`;
}
export const etichettaSettimana = lun => etichettaIntervallo(lun, sposta(lun, 6));
export const meseDopo = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${due(d.getMonth() + 1)}`; };
export const fineMese = m => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
export const giornoNel = (m, g) => `${m}-${due(Math.min(g, fineMese(m)))}`;     // il 31 in un mese di 30 giorni: il 30
export const spostaAnni = (k, n) => giornoNel(`${Number(k.slice(0, 4)) + n}${k.slice(4, 7)}`, Number(k.slice(8, 10)));   // il 29/2 diventa il 28/2
// Il certificato medico vale un anno dal giorno in cui l'ha fatto (Simone, 21/10): la scadenza la calcola l'app
export const scadenzaCertificato = fatto => fatto ? spostaAnni(fatto, 1) : '';
export const dalGiorno = k => elide(k) ? `dall'${dataCorta(k)}` : `dal ${dataCorta(k)}`;
export const alGiorno = k => elide(k) ? `all'${dataCorta(k)}` : `al ${dataCorta(k)}`;
export const delGiorno = k => elide(k) ? `dell'${dataCorta(k)}` : `del ${dataCorta(k)}`;
export const dataParole = k => { const d = daChiave(k); return `${d.getDate()} ${MESI[d.getMonth()]}`; };   // 12 novembre
export const ilData = k => `${elide(k) ? "l'" : 'il '}${dataParole(k)}`;
export const maiuscola = s => s.charAt(0).toUpperCase() + s.slice(1);
// Una privata annullata sparisce dall'app (Simone, 21/10): resta nel database, non si conta e non si mostra
export const annullata = l => l.tipo === 'privata' && !!l.nonFatta && l.motivo === 'annullata';
// Un nome detto è di una scheda se è lo stesso (senza badare alle maiuscole), o se è solo il nome e la scheda comincia così
export function stessoNome(detto, scheda) {
  const d = String(detto || '').trim().toLowerCase(), s = String(scheda || '').trim().toLowerCase();
  return !!d && (d === s || (!d.includes(' ') && s.split(/ +/)[0] === d));
}

/** Il giorno e l'ora a Roma, qualunque sia il fuso del telefono o del server. */
export function adessoRoma(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map(x => [x.type, x.value]));
  return { giorno: `${p.year}-${p.month}-${p.day}`, ora: `${p.hour}:${p.minute}` };
}

// --- Le forme, con quante sezioni ha ognuna ---------------------------------
export const FORME = [['Siu Nim Tao', 3], ['Chum Kiu', 3], ['Biu Jee', 3], ['Muk Yan Jong', 8], ['Luk Dim Boon Kwan', 7], ['Baat Cham Dao', 8]];
// Le cinture del Sistema Wing Chun Tradizionale (la tabella della scuola, Simone 20/10), in ordine: il percorso seniores
// dal bianco (8° Kap) al nero (1° Kap, con il bordo d'oro) e dal 1° all'8° Dyun (le strisce d'oro); prima di ogni colore,
// il passo chiaro del percorso juniores. Il 9° e il 10° Dyun non si assegnano. k: come nel database. Chi arriva parte dal bianco.
const kap = (k, nome, grado, colore, chiaro) => [
  ...(chiaro ? [{ k: `${k}-junior`, nome: `${nome} chiaro`, grado: 'juniores', colore: chiaro, junior: true }] : []),
  { k, nome, grado, colore }];
export const CINTURE = [
  ...kap('bianca', 'Bianco', '8° Kap', '#f7f5f0'),
  ...kap('gialla', 'Giallo', '7° Kap', '#f5e10a', '#fbf28a'),
  ...kap('arancione', 'Arancione', '6° Kap', '#f7850f', '#fbb066'),
  ...kap('verde', 'Verde', '5° Kap', '#22a52a', '#6fe36f'),
  ...kap('marrone', 'Marrone', '4° Kap', '#7b5308', '#c48a1c'),
  ...kap('blu', 'Blu', '3° Kap', '#13238f', '#3f8be8'),
  ...kap('rossa', 'Rosso', '2° Kap', '#c1121b', '#f37b74'),
  { k: 'nera-junior', nome: 'Nero', grado: 'juniores', colore: '#141414', junior: true },
  { k: 'nera', nome: 'Nero', grado: '1° Kap', colore: '#141414', bordo: true },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ k: `dyun-${n}`, nome: `${n}° Dyun`, grado: 'Duan', colore: '#141414', strisce: n })),
];
export const TESSERAMENTO = 40;   // la quota di solito, in euro: a dicembre, nel conto di ogni allievo

// --- I corsi: l'orario e le ore di una lezione -------------------------------
const minuti = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
const oraBreve = s => s.endsWith(':00') ? String(Number(s.slice(0, 2))) : `${Number(s.slice(0, 2))}:${s.slice(3, 5)}`;
export const orarioDi = (inizio, fine) => `${oraBreve(inizio)}-${oraBreve(fine)}`;   // "19-20"
export const oreFra = (inizio, fine) => Math.max(0, minuti(fine) - minuti(inizio)) / 60;
export function aggiornaOrario(c) { c.orario = orarioDi(c.inizio, c.fine); c.ore = oreFra(c.inizio, c.fine); }
// Se nelle Impostazioni cambiano i giorni o l'orario, vale dalla prossima lezione: le lezioni fino a quel giorno
// tengono quello di prima, scritto in `prima` ({ fino, giorni, inizio, fine }).
export function orarioNel(c, giorno) {
  return (c.prima || []).filter(p => giorno <= p.fino).sort((x, y) => x.fino.localeCompare(y.fino))[0] || c;
}

/** Le lezioni dei corsi dal primo giorno d'uso a oggi, dai giorni della settimana. Quelle che il database ha già restano sue. */
export function lezioniDeiCorsi(corsi, primoGiorno, oggi, esistenti) {
  const out = [];
  for (let k = primoGiorno; k <= oggi; k = sposta(k, 1)) {
    const dow = daChiave(k).getDay();
    for (const [corso, c] of Object.entries(corsi)) {
      const v = orarioNel(c, k);
      const id = `corso:${corso}:${k}`;
      if (!v.giorni.includes(dow) || esistenti.has(id)) continue;
      out.push({ id, giorno: k, tipo: 'corso', corso, inizio: v.inizio, ore: oreFra(v.inizio, v.fine), orarioCorso: orarioDi(v.inizio, v.fine), fineCorso: v.fine });
    }
  }
  return out;
}

// --- Dal database e verso il database ----------------------------------------
const euro = cent => cent / 100;
const cent = e => Math.round(Number(e || 0) * 100);
const hhmm = s => String(s || '').slice(0, 5);
const NOTIFICHE = { cert30: true, cert15: true, pagamenti: true, ora: '08:00' };

/** Le Impostazioni come le usa l'app: i corsi con il prezzo in euro, l'orario e le ore. */
export function impostazioniDa(v = {}) {
  const corsi = {};
  for (const [k, c] of Object.entries(v.corsi || {})) {
    corsi[k] = { giorni: [...(c.giorni || [])], inizio: c.inizio, fine: c.fine, prezzo: euro(c.prezzo_cent || 0), settimane: c.settimane || 1 };
    if (c.prima && c.prima.length) corsi[k].prima = c.prima.map(p => ({ fino: p.fino, giorni: [...p.giorni], inizio: p.inizio, fine: p.fine }));
    aggiornaOrario(corsi[k]);
  }
  return {
    corsi, prezzoPrivata: euro(v.prezzo_privata_cent || 0), chiusura: v.chiusura ?? '08',
    notifiche: { ...NOTIFICHE, ...(v.notifiche || {}) }, testi: { ...(v.testi || {}) }, primoGiorno: v.primo_giorno || null,
    tesseramento: v.tesseramento_cent == null ? TESSERAMENTO : euro(v.tesseramento_cent),
  };
}

/** Dal database alle forme dell'app: gli allievi (con i pagamenti) e le lezioni che ci sono. */
export function daDatabase({ allievi = [], lezioni = [], pagamenti = [] }) {
  const perId = new Map();
  const tutti = allievi.map(r => {
    const a = {
      id: r.id, nome: r.nome, corsi: [...(r.corsi || [])], private: !!r.fa_private, privateMese: r.private_mese || 0,
      prezzi: Object.fromEntries(Object.entries(r.prezzi || {}).map(([k, v]) => [k, euro(v)])),
      privata: r.prezzo_privata_cent == null ? null : euro(r.prezzo_privata_cent),
      giorno: r.giorno_pagamento || 1, certFatto: r.certificato_fatto || '', cert: scadenzaCertificato(r.certificato_fatto || ''), forme: { ...(r.forme || {}) }, cell: r.telefono || '',
      uscito: !!r.uscito, pagato: {}, cifre: {}, dal: String(r.dal).slice(0, 7), cintura: r.cintura || 'bianca',
    };
    if (r.protetto) a.protetto = true;
    perId.set(r.id, a);
    return a;
  });
  for (const p of pagamenti) {
    const a = perId.get(p.allievo_id);
    if (!a) continue;
    const m = String(p.mese).slice(0, 7);
    a.pagato[m] = p.il;
    a.cifre[m] = euro(p.cifra_cent);
  }
  const nome = id => perId.get(id)?.nome;
  const nomi = ids => (ids || []).map(nome).filter(Boolean);
  const lez = [];
  for (const r of lezioni) {
    const l = { id: r.id, giorno: r.giorno, tipo: r.tipo, inizio: hhmm(r.inizio) };
    if (r.tipo === 'corso') Object.assign(l, { corso: r.corso, ore: Number(r.ore), orarioCorso: orarioDi(hhmm(r.inizio), hhmm(r.fine)), fineCorso: hhmm(r.fine) });
    else {
      l.allievo = nome(r.allievo_id);
      if (!l.allievo) continue;
      Object.assign(l, { fine: hhmm(r.fine), ore: Number(r.ore) });
    }
    if (r.iscritti) l.iscritti = nomi(r.iscritti);
    if (r.assenti) l.appello = { assenti: nomi(r.assenti) };
    if (l.appello && r.presenti_senza_scheda && r.presenti_senza_scheda.length) l.appello.senzaScheda = [...r.presenti_senza_scheda];
    if (r.fatto) {
      l.fatto = r.tipo === 'corso'   // chi lavora da solo: un allievo, o un nome senza scheda
        ? { gruppo: r.fatto.gruppo || '', soli: (r.fatto.soli || []).map(s => ({ chi: nome(s.allievo_id) || s.nome, cosa: s.cosa })).filter(s => s.chi) }
        : { testo: r.fatto.testo || '' };
    }
    if (r.previsto) l.previsto = r.previsto;
    if (r.non_fatta) { l.nonFatta = true; if (r.motivo) l.motivo = r.motivo; }
    if (r.dal_calendario) l.calendario = true;
    lez.push(l);
  }
  tutti.sort((x, y) => x.nome.localeCompare(y.nome, 'it'));
  return { allievi: tutti, lezioni: lez };
}

/** Le righe per il database, da allievi, lezioni e Impostazioni dell'app. Una lezione di un corso senza niente non ha riga.
    `testi`: solo i messaggi che il Sifu ha cambiato, { chiave: testo }. */
export function versoDatabase({ allievi, lezioni, imp, testi = {} }) {
  const idDi = new Map(allievi.map(a => [a.nome, a.id]));
  const ids = nomi => nomi.map(n => idDi.get(n)).filter(Boolean);
  const righeAllievi = new Map(), righePagamenti = new Map(), righeLezioni = new Map();
  for (const a of allievi) {
    righeAllievi.set(a.id, {
      id: a.id, nome: a.nome, telefono: a.cell || '', corsi: [...a.corsi], fa_private: !!a.private, private_mese: a.privateMese || 0,
      prezzi: Object.fromEntries(Object.entries(a.prezzi).map(([k, v]) => [k, cent(v)])),
      prezzo_privata_cent: a.privata == null ? null : cent(a.privata), giorno_pagamento: a.giorno, dal: `${a.dal}-01`,
      certificato_fatto: a.certFatto || null, forme: { ...a.forme }, uscito: !!a.uscito, cintura: a.cintura || 'bianca',
    });
    for (const [m, il] of Object.entries(a.pagato)) {
      if (!il) continue;
      righePagamenti.set(`${a.id}|${m}`, { allievo_id: a.id, mese: `${m}-01`, il, cifra_cent: cent(a.cifre[m]) });
    }
  }
  for (const l of lezioni) {
    const solito = l.tipo === 'corso' && imp.corsi[l.corso] ? orarioNel(imp.corsi[l.corso], l.giorno) : null;
    const comeSempre = !solito || (l.inizio === solito.inizio && l.fineCorso === solito.fine);   // l'orario di quella sola, cambiato: si tiene
    const vuota = l.tipo === 'corso' && !l.appello && !l.fatto && !l.previsto && !l.nonFatta && comeSempre;
    if (vuota) continue;
    const corso = l.tipo === 'corso';
    let fatto = null;
    if (l.fatto) fatto = corso ? { gruppo: l.fatto.gruppo, soli: l.fatto.soli.map(s => (idDi.has(s.chi) ? { allievo_id: idDi.get(s.chi), cosa: s.cosa } : { nome: s.chi, cosa: s.cosa })) } : { testo: l.fatto.testo };
    righeLezioni.set(l.id, {
      id: l.id, giorno: l.giorno, tipo: l.tipo, corso: corso ? l.corso : null, allievo_id: corso ? null : (idDi.get(l.allievo) || null),
      inizio: l.inizio, fine: corso ? l.fineCorso : l.fine, ore: l.ore ?? 1,
      iscritti: l.iscritti ? ids(l.iscritti) : null, assenti: l.appello ? ids(l.appello.assenti) : null, fatto,
      presenti_senza_scheda: l.appello && l.appello.senzaScheda && l.appello.senzaScheda.length ? [...l.appello.senzaScheda] : null,
      previsto: l.previsto || null, non_fatta: !!l.nonFatta, motivo: l.nonFatta ? (l.motivo || null) : null, dal_calendario: !!l.calendario,
    });
  }
  const corsi = {};
  for (const [k, c] of Object.entries(imp.corsi)) {
    corsi[k] = { giorni: [...c.giorni], inizio: c.inizio, fine: c.fine, prezzo_cent: cent(c.prezzo), settimane: c.settimane || 1 };
    if (c.prima && c.prima.length) corsi[k].prima = c.prima.map(p => ({ ...p, giorni: [...p.giorni] }));
  }
  const valori = { corsi, prezzo_privata_cent: cent(imp.prezzoPrivata), chiusura: imp.chiusura, notifiche: { ...imp.notifiche }, testi: { ...testi },
    tesseramento_cent: cent(imp.tesseramento ?? TESSERAMENTO) };
  return { allievi: righeAllievi, pagamenti: righePagamenti, lezioni: righeLezioni, valori };
}

// --- I conti -------------------------------------------------------------------
// ctx: { oggi, mese, ora, imp: { corsi, chiusura, prezzoPrivata }, lezioni, allievi }. L'app passa dei getter, il server i valori.
export function creaRegole(ctx) {
  const corsi = () => ctx.imp.corsi;
  const allievo = nome => ctx.allievi.find(a => a.nome === nome);
  const roster = corso => ctx.allievi.filter(a => a.corsi.includes(corso) && !a.uscito).map(a => a.nome);
  const iniziata = l => l.giorno < ctx.oggi || (l.giorno === ctx.oggi && l.inizio <= ctx.ora);
  const iscrittiDi = l => l.iscritti || roster(l.corso);
  // chi c'era: gli iscritti meno gli assenti, più chi non ha ancora la scheda (Simone, 21/10)
  const presentiDi = l => [...iscrittiDi(l).filter(a => !l.appello.assenti.includes(a)), ...(l.appello.senzaScheda || [])];

  // Le ore e le presenze di un allievo
  const durata = l => l.ore ?? (l.tipo === 'corso' ? corsi()[l.corso].ore : 1);
  function cEra(l, nome) {
    if (l.nonFatta) return false;
    if (l.tipo === 'privata') return l.allievo === nome && iniziata(l) && !!l.fatto;   // conta quando è raccontata
    return !!l.appello && iscrittiDi(l).includes(nome) && !l.appello.assenti.includes(nome);
  }
  const lezioniDi = nome => ctx.lezioni
    .filter(l => !annullata(l))
    .filter(l => l.giorno <= ctx.oggi && (l.tipo === 'privata' ? l.allievo === nome : iscrittiDi(l).includes(nome)))
    .filter(l => l.giorno < ctx.oggi || iniziata(l))
    .sort((a, b) => (b.giorno + b.inizio).localeCompare(a.giorno + a.inizio));
  const oreDi = (nome, lez) => lez.reduce((t, l) => t + (cEra(l, nome) ? durata(l) : 0), 0);
  // Le lezioni di un allievo in un periodo, contate in un modo solo (cima della scheda, settimane, mesi, periodo).
  // Corsi: i corsi che fa e che si sono tenuti fino a ora; fatte = c'era. Un corso non ancora raccontato non conta
  //   (non è lui indietro: manca il rapporto del Sifu) e si scrive a parte con la data.
  // Private: quelle che ha nel calendario fino a ora; fatte = raccontate. Se non è venuto, conta come mancata;
  //   se è annullata, non conta; se non è ancora raccontata, non conta e si scrive a parte (come i corsi).
  function conteggio(nome, lez) {
    const c = { corsi: { tot: 0, fatte: 0 }, private: { tot: 0, fatte: 0 }, senzaRapporto: [] };
    for (const l of lez) {
      if (l.tipo === 'privata') {
        if (l.nonFatta && l.motivo !== 'assente') continue;            // annullata: non conta
        if (l.nonFatta) { c.private.tot++; continue; }                  // non è venuto: mancata
        if (!l.fatto) { c.senzaRapporto.push(l.giorno); continue; }     // non ancora raccontata: non conta
        c.private.tot++; c.private.fatte++;
      } else {
        if (l.nonFatta) continue;
        if (!l.appello) { c.senzaRapporto.push(l.giorno); continue; }
        c.corsi.tot++;
        if (cEra(l, nome)) c.corsi.fatte++;
      }
    }
    c.senzaRapporto.sort();
    return c;
  }

  // Quando si paga (V10): un mese va pagato entro il giorno in cui ha pagato il mese prima (il mese chiuso si salta).
  // Se il mese prima non l'ha pagato, vale il giorno di quel mese. Il primo mese: il giorno segnato (a.giorno).
  const chiuso = m => m.slice(5) === ctx.imp.chiusura;   // il mese di chiusura, dalle Impostazioni
  function giornoScadenza(a, m) {
    let p = meseDopo(m, -1);
    if (chiuso(p)) p = meseDopo(p, -1);
    if (p < a.dal) return a.giorno;
    return a.pagato[p] ? Number(a.pagato[p].slice(8)) : giornoScadenza(a, p);
  }
  const scadenzaQuota = (a, m) => giornoNel(m, giornoScadenza(a, m));
  const mesiDa = a => { const ms = []; for (let m = a.dal; m <= ctx.mese; m = meseDopo(m, 1)) ms.push(m); return ms; };
  // Quanto paga (V10, Simone 20/10): a inizio mese i corsi che fa e le private del mese.
  //  - corsi: il prezzo di ogni corso (Impostazioni), o il suo se il Sifu l'ha cambiato nella scheda; due corsi, due prezzi;
  //  - private: le private al mese (dalla scheda) per il prezzo della privata;
  //  - a fine mese contano i rapporti: le private fatte in meno sono credito, quelle in più si pagano, sul mese dopo.
  //    Non è venuto e annullata non sono fatte; una privata senza rapporto non conta finché il Sifu non la racconta;
  //  - a dicembre, il tesseramento (Simone 20/10): la quota delle Impostazioni, per ogni allievo;
  //  - si segna pagato solo quando ci sono tutti i soldi (Simone): niente cifre a metà.
  const prezzoCorso = (a, c) => a.prezzi[c] ?? corsi()[c]?.prezzo ?? 0;
  const quotaCorsi = a => a.corsi.reduce((t, c) => t + prezzoCorso(a, c), 0);
  const prezzoPrivata = a => a.privata ?? ctx.imp.prezzoPrivata;   // come i corsi: il suo, se il Sifu l'ha scritto; se no quello di solito
  function privateFatte(a, m) {
    const lez = ctx.lezioni.filter(l => l.tipo === 'privata' && l.allievo === a.nome && l.giorno.startsWith(m) && (l.giorno < ctx.oggi || iniziata(l)));
    return { n: lez.filter(l => l.fatto && !l.nonFatta).length, senza: lez.filter(l => !l.fatto && !l.nonFatta).map(l => l.giorno).sort() };
  }
  function conto(a, m) {
    const c = { corsi: chiuso(m) ? 0 : quotaCorsi(a), nPriv: a.privateMese, priv: a.privateMese * prezzoPrivata(a), mesePrima: meseDopo(m, -1), nDiff: 0, diff: 0, finora: null,
      tess: m.slice(5) === '12' ? (ctx.imp.tesseramento ?? TESSERAMENTO) : 0 };
    const p = c.mesePrima;
    if (p >= a.dal) {
      const f = privateFatte(a, p);
      if (p < ctx.mese) { c.nDiff = f.n - a.privateMese; c.diff = c.nDiff * prezzoPrivata(a); }   // mese finito: il conto delle private
      else if (a.privateMese || f.n) c.finora = f;                                      // mese in corso: si sa a fine mese
    }
    c.tot = Math.max(0, c.corsi + c.priv + c.diff + c.tess);
    return c;
  }
  const quoteRitardo = a => a.uscito ? [] : mesiDa(a).filter(m => !a.pagato[m] && ctx.oggi > scadenzaQuota(a, m) && conto(a, m).tot > 0);
  const ritardo = a => quoteRitardo(a).length > 0;
  const certScaduto = a => !a.uscito && a.cert < ctx.oggi;

  // Dove è arrivato: solo la forma che sta imparando (le completate non si mostrano)
  function formeDa(a) {
    for (const [f, n] of FORME) { const v = a.forme[f] || 0; if (v < n) return [{ f, n, v }]; }
    return [];
  }
  function aggiornaForme(nome, testo) {   // "Chum Kiu seconda sezione" → la scheda si aggiorna
    const a = allievo(nome); if (!a) return;
    for (const [f] of FORME) {
      const m = testo.match(new RegExp(`${f} (prima|seconda|terza|quarta|quinta|sesta|settima|ottava) sezione`, 'i'));
      if (m) a.forme[f] = Math.max(a.forme[f] || 0, ORDINALI.indexOf(m[1].toLowerCase()));
    }
  }

  // Cosa ha fatto e cosa non ha fatto in un periodo. L'argomento di un gruppo è quello prima della virgola ("calci, velocità": calci).
  const argomentiDi = g => [g.split(', ')[0]];
  function fattoNel(nome, lez) {
    const cose = [];
    for (const l of lez) {
      if (!cEra(l, nome) || !l.fatto) continue;
      if (l.tipo === 'privata') cose.push(...l.fatto.testo.split(', '));
      else { cose.push(...l.fatto.gruppo.split(', ')); l.fatto.soli.filter(s => s.chi === nome).forEach(s => cose.push(s.cosa)); }
    }
    return [...new Set(cose)];
  }
  function nonHaFatto(nome, lez) {
    const fatti = new Set(), corso = new Map();
    for (const l of [...lez].reverse()) {
      if (!l.fatto || l.nonFatta) continue;
      if (l.tipo === 'privata') { if (cEra(l, nome)) l.fatto.testo.split(', ').forEach(t => fatti.add(t)); continue; }
      const presente = cEra(l, nome);
      for (const t of argomentiDi(l.fatto.gruppo)) {
        if (presente) fatti.add(t);
        else if (!corso.has(t)) corso.set(t, `assente ${ilGiorno(l.giorno)}`);
      }
      for (const s of l.fatto.soli) {
        if (s.chi === nome) fatti.add(s.cosa);
        if (!corso.has(s.cosa)) corso.set(s.cosa, 'non preso');
      }
    }
    return [...corso].filter(([t]) => !fatti.has(t)).map(([t, perche]) => `${t} (${perche})`);
  }

  return {
    allievo, roster, iniziata, iscrittiDi, presentiDi, durata, cEra, lezioniDi, oreDi, conteggio, chiuso, giornoScadenza, scadenzaQuota,
    mesiDa, prezzoCorso, quotaCorsi, prezzoPrivata, privateFatte, conto, quoteRitardo, ritardo, certScaduto, formeDa, aggiornaForme,
    fattoNel, nonHaFatto,
  };
}
