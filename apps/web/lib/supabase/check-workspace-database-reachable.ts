import { GWADA_DB_UNAVAILABLE_MESSAGE } from "@/lib/constants/database-mode";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_SUPABASE_FETCH_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";

function workspacePersistenceConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Erreichbarkeitsprobe — eigenes Modul für dynamischen Import (Marketing ohne initiales Supabase-JS). */
export async function checkWorkspaceDatabaseReachable(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!workspacePersistenceConfigured()) {
    return {
      ok: false,
      message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (Umgebungsvariablen NEXT_PUBLIC_SUPABASE_* fehlen.)`,
    };
  }
  try {
    const supabase = createSupabaseBrowserClient();
    /* Vor Login: anon darf nur `is_published` sehen — Slug-Check schlägt sonst oft fehl
       (falscher Slug / noch kein Seed). Ein lesbarer Demo-Row reicht als „API+DB ok“. */
    const { error } = await raceWithTimeout(
      supabase
        .from("restaurants")
        .select("id")
        .eq("is_published", true)
        .limit(1),
      GWADA_SUPABASE_FETCH_TIMEOUT_MS,
      "Supabase-Restaurants",
    );
    if (error) {
      return {
        ok: false,
        message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (${error.message})`,
      };
    }
    return { ok: true, message: "" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (${detail})`,
    };
  }
}
