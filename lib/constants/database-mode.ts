/**
 * Test-Branch / lokale Supabase: nur Remote-DB, kein localStorage für App-Daten.
 * In `.env.local`: `NEXT_PUBLIC_GWADA_SUPABASE_ONLY=true`
 */
export function isSupabaseOnlyMode(): boolean {
  const v = process.env.NEXT_PUBLIC_GWADA_SUPABASE_ONLY?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export const GWADA_DB_UNAVAILABLE_MESSAGE =
  "Es können keine Daten abgerufen oder gespeichert werden, weil die Datenbank nicht erreichbar ist.";
