import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runAccountingLexofficeSyncCron } from "@/lib/accounting/accounting-lexoffice-sync-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lexoffice Buchführung (Belege, Rechnungen, Angebote) — Hintergrund-Sync in DB. */
export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runAccountingLexofficeSyncCron(admin);
  return Response.json(stats);
}
