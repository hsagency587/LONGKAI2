/* Longkai — comune/schema-sessione.js
   Lo schema della risposta di Claude per la revisione di una sessione (strumento `compila_sessione`).
   Lo usano il server (per obbligare e validare la risposta) e l'app (per leggerla).
   Gli id sono stringhe (uuid). Niente qui dentro è un dato: è la forma dei dati. */

export const SCHEMA_SESSIONE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    titolo: { type: 'string', description: 'Tre o quattro parole prese da quello che è stato detto.' },
    presenti: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          allievo_id: { type: 'string' },
          minuti: { type: 'integer', description: 'Minuti di presenza. Se non detto, la durata del corso.' },
          tipo: { type: 'string', enum: ['normale', 'extra', 'recupero'] },
          nota: { type: 'string' },
        },
        required: ['allievo_id'],
      },
    },
    assenti_detti: { type: 'array', items: { type: 'string' }, description: 'Id di chi è stato detto assente.' },
    gruppo: {
      type: 'object', additionalProperties: false,
      properties: { argomenti: { type: 'array', items: { type: 'string' } }, nota: { type: 'string' } },
    },
    singoli: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          allievo_id: { type: 'string' },
          argomenti: { type: 'array', items: { type: 'string' } },
          nota: { type: 'string' },
          osservazione: { type: 'string' },
        },
        required: ['allievo_id'],
      },
    },
    forme: {
      type: 'array',
      description: 'Avanzamenti nelle forme detti dal Sifu.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          allievo_id: { type: 'string' },
          forma_id: { type: 'string' },
          sezione: { type: 'integer' },
          stato: { type: 'string', enum: ['non_iniziata', 'in_apprendimento', 'completa', 'in_rifinitura'] },
        },
        required: ['allievo_id', 'forma_id'],
      },
    },
    private: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          sessione_id: { type: 'string', description: 'La privata del giorno a cui si riferisce, se esiste.' },
          allievo_id: { type: 'string' },
          ora: { type: 'string', description: 'HH:MM se è una privata nuova.' },
          minuti: { type: 'integer' },
          argomenti: { type: 'array', items: { type: 'string' } },
          nota: { type: 'string' },
          osservazione: { type: 'string' },
          prossimo_passo: { type: 'string' },
        },
      },
    },
    pagamenti: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          allievo_id: { type: 'string' },
          importo_cent: { type: 'integer' },
          periodo: { type: 'string', description: 'Mese o periodo detto, es. "novembre".' },
          metodo: { type: 'string', enum: ['contanti', 'bonifico', 'altro'] },
          nota: { type: 'string' },
        },
        required: ['allievo_id', 'importo_cent'],
      },
    },
    prossima_volta: {
      type: 'object', additionalProperties: false,
      properties: { argomenti: { type: 'array', items: { type: 'string' } }, nota: { type: 'string' } },
    },
    piani: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { allievo_id: { type: 'string' }, prossimo_passo: { type: 'string' }, argomenti: { type: 'array', items: { type: 'string' } } },
        required: ['allievo_id'],
      },
    },
    non_riconosciuti: {
      type: 'object', additionalProperties: false,
      properties: {
        nomi: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { sentito: { type: 'string' }, minuti: { type: 'integer' }, candidati: { type: 'array', items: { type: 'string' } } }, required: ['sentito'] } },
        argomenti: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { sentito: { type: 'string' }, dove: { type: 'string' } }, required: ['sentito'] } },
      },
    },
    da_smistare: { type: 'array', items: { type: 'string' } },
  },
  required: ['presenti'],
};

/**
 * Controlla una risposta contro gli elenchi veri: ogni id deve esistere, ogni durata essere sensata.
 * Risponde { ok, errori: [], pulita } dove `pulita` è la risposta con gli id sconosciuti spostati in non_riconosciuti.
 */
export function validaSessione(risposta, { allievi = [], argomenti = [], private: priv = [] } = {}) {
  const errori = [];
  const idAllievi = new Set(allievi.map((a) => a.id));
  const idArgomenti = new Set(argomenti.map((a) => a.id));
  const idPrivate = new Set(priv.map((p) => p.id));
  const r = JSON.parse(JSON.stringify(risposta || {}));
  r.non_riconosciuti = r.non_riconosciuti || { nomi: [], argomenti: [] };
  r.non_riconosciuti.nomi = r.non_riconosciuti.nomi || [];
  r.non_riconosciuti.argomenti = r.non_riconosciuti.argomenti || [];

  const filtraArgomenti = (lista, dove) => (lista || []).filter((id) => {
    if (idArgomenti.has(id)) return true;
    r.non_riconosciuti.argomenti.push({ sentito: String(id), dove });
    return false;
  });

  r.presenti = (r.presenti || []).filter((p) => {
    if (!idAllievi.has(p.allievo_id)) { r.non_riconosciuti.nomi.push({ sentito: String(p.allievo_id), minuti: p.minuti }); return false; }
    if (p.minuti != null && (p.minuti < 30 || p.minuti > 360)) { errori.push(`minuti fuori misura per ${p.allievo_id}: ${p.minuti}`); p.minuti = undefined; }
    return true;
  });
  r.assenti_detti = (r.assenti_detti || []).filter((id) => idAllievi.has(id));
  if (r.gruppo) r.gruppo.argomenti = filtraArgomenti(r.gruppo.argomenti, 'gruppo');
  r.singoli = (r.singoli || []).filter((s) => idAllievi.has(s.allievo_id)).map((s) => ({ ...s, argomenti: filtraArgomenti(s.argomenti, 'singoli') }));
  r.forme = (r.forme || []).filter((f) => idAllievi.has(f.allievo_id) && idArgomenti.has(f.forma_id));
  r.private = (r.private || []).map((p) => ({ ...p, argomenti: filtraArgomenti(p.argomenti, 'private') })).filter((p) => {
    if (p.sessione_id && !idPrivate.has(p.sessione_id)) { errori.push(`privata sconosciuta: ${p.sessione_id}`); return false; }
    if (p.allievo_id && !idAllievi.has(p.allievo_id)) { r.non_riconosciuti.nomi.push({ sentito: String(p.allievo_id) }); return false; }
    return true;
  });
  r.pagamenti = (r.pagamenti || []).filter((p) => {
    if (!idAllievi.has(p.allievo_id)) { r.non_riconosciuti.nomi.push({ sentito: String(p.allievo_id) }); return false; }
    if (!(p.importo_cent > 0 && p.importo_cent < 1000000)) { errori.push(`importo fuori misura: ${p.importo_cent}`); return false; }
    return true;
  });
  if (r.prossima_volta) r.prossima_volta.argomenti = filtraArgomenti(r.prossima_volta.argomenti, 'prossima_volta');
  r.piani = (r.piani || []).filter((p) => idAllievi.has(p.allievo_id)).map((p) => ({ ...p, argomenti: filtraArgomenti(p.argomenti, 'piani') }));
  return { ok: errori.length === 0, errori, pulita: r };
}
