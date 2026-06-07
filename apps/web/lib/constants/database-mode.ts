import { isPublicGwadaSupabaseOnly } from "@/lib/public-env";

/**
 * Test-Branch / lokale Supabase: nur Remote-DB, kein localStorage für App-Daten.
 * In `.env.local`: `NEXT_PUBLIC_GWADA_SUPABASE_ONLY=true`
 */
export function isSupabaseOnlyMode(): boolean {
  return isPublicGwadaSupabaseOnly();
}

export const GWADA_DB_UNAVAILABLE_MESSAGE =
  "Es können keine Daten abgerufen oder gespeichert werden, weil die Datenbank nicht erreichbar ist.";
