import { runAccountingLexofficeSyncCron } from "@/lib/accounting/accounting-lexoffice-sync-cron";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lexoffice Buchführung (Belege, Rechnungen, Angebote) — Hintergrund-Sync in DB. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const stats = await runAccountingLexofficeSyncCron(admin);
  return Response.json(stats);
}
