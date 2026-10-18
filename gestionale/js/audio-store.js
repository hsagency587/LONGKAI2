/* Longkai — audio-store.js: gli audio dettati stanno in IndexedDB finché la coda non li ha mandati (localStorage non regge i file). */

const NOME = 'longkai-audio';
const DEPOSITO = 'audio';

function apri() {
  return new Promise((risolvi, rifiuta) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(DEPOSITO); };
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}
function esegui(modo, fn) {
  return apri().then((db) => new Promise((risolvi, rifiuta) => {
    const t = db.transaction(DEPOSITO, modo);
    const d = t.objectStore(DEPOSITO);
    const richiesta = fn(d);
    t.oncomplete = () => { db.close(); risolvi(richiesta?.result); };
    t.onerror = () => { db.close(); rifiuta(t.error); };
    t.onabort = () => { db.close(); rifiuta(t.error); };
  }));
}

export const audioStore = {
  metti: (id, blob) => esegui('readwrite', (d) => d.put(blob, id)),
  prendi: (id) => esegui('readonly', (d) => d.get(id)),
  togli: (id) => esegui('readwrite', (d) => d.delete(id)),
  chiavi: () => esegui('readonly', (d) => d.getAllKeys()),
};
