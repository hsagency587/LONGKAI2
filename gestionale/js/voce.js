/* Longkai — voce.js: registra la voce del Sifu con il microfono del telefono. Pausa, riprendi, fine; il livello per le tacchette.
   Risponde un Blob (webm/opus su Android e PC, mp4/aac su iPhone) con la durata in secondi. */

export function formatoSupportato() {
  if (!globalThis.MediaRecorder) return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}
export function puoRegistrare() { return Boolean(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder); }

/** Apre il microfono. Risponde un registratore: avvia(), pausa(), riprendi(), fine() → { blob, secondi, tipo }, livello() → 0..1, chiudi(). */
export async function apriMicrofono() {
  const flusso = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const tipo = formatoSupportato() || undefined;
  const rec = new MediaRecorder(flusso, tipo ? { mimeType: tipo, audioBitsPerSecond: 48000 } : undefined);
  const pezzi = [];
  rec.addEventListener('dataavailable', (e) => { if (e.data && e.data.size) pezzi.push(e.data); });
  let inizio = 0; let accumulato = 0; let inPausa = false;
  // il livello: un analizzatore sul flusso, per le tacchette
  let contesto = null; let analizzatore = null; let dati = null;
  try {
    contesto = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const sorgente = contesto.createMediaStreamSource(flusso);
    analizzatore = contesto.createAnalyser(); analizzatore.fftSize = 512;
    sorgente.connect(analizzatore);
    dati = new Uint8Array(analizzatore.frequencyBinCount);
  } catch { /* senza livello si registra lo stesso */ }
  return {
    tipo: rec.mimeType || tipo || 'audio/webm',
    avvia() { rec.start(1000); inizio = Date.now(); inPausa = false; },
    pausa() { if (rec.state === 'recording') { rec.pause(); accumulato += Date.now() - inizio; inPausa = true; } },
    riprendi() { if (rec.state === 'paused') { rec.resume(); inizio = Date.now(); inPausa = false; } },
    inPausa: () => inPausa,
    secondi() { return Math.round((accumulato + (inPausa || rec.state === 'inactive' ? 0 : Date.now() - inizio)) / 1000); },
    livello() {
      if (!analizzatore) return 0;
      analizzatore.getByteTimeDomainData(dati);
      let somma = 0;
      for (const v of dati) { const x = (v - 128) / 128; somma += x * x; }
      return Math.min(1, Math.sqrt(somma / dati.length) * 4);
    },
    fine() {
      return new Promise((risolvi) => {
        const chiudiTutto = () => { flusso.getTracks().forEach((t) => t.stop()); contesto?.close?.().catch(() => {}); };
        if (rec.state === 'inactive') { chiudiTutto(); risolvi({ blob: new Blob(pezzi, { type: rec.mimeType }), secondi: this.secondi(), tipo: rec.mimeType }); return; }
        const secondi = this.secondi();
        rec.addEventListener('stop', () => { chiudiTutto(); risolvi({ blob: new Blob(pezzi, { type: rec.mimeType }), secondi, tipo: rec.mimeType }); }, { once: true });
        rec.stop();
      });
    },
    chiudi() { try { if (rec.state !== 'inactive') rec.stop(); } catch { /* niente */ } flusso.getTracks().forEach((t) => t.stop()); contesto?.close?.().catch(() => {}); },
  };
}

/** L'estensione del file per il server. */
export function estensioneDi(tipo) {
  const t = String(tipo || '');
  if (t.includes('mp4')) return 'm4a';
  if (t.includes('ogg')) return 'ogg';
  if (t.includes('wav')) return 'wav';
  return 'webm';
}
