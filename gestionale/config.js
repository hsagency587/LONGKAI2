/* Longkai — config.js
   L'indirizzo del progetto Supabase e la sua chiave pubblica (anon): sono pubblici per natura,
   le regole per riga fanno la guardia. Nessun segreto qui: mai. */
globalThis.CONFIG = {
  supabaseUrl: 'https://ybyeddabeqrkqxthajbo.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlieWVkZGFiZXFya3F4dGhhamJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjE2NDcsImV4cCI6MjEwNzg5NzY0N30.AXv3axCYC_SzRP13JgOF4QdunoM5E3YS-7NJc4vxivA',
  versione: '2026-10-18-f244769',
  ambiente: /longkai-it\.com$/.test(location.hostname) ? 'produzione' : 'locale',
  regioneAttesa: 'eu-central-1',
};