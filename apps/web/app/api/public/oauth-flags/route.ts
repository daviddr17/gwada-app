import { fetchPlatformOAuthAvailability } from "@/lib/supabase/platform-oauth-flags";

export const dynamic = "force-dynamic";

/** Öffentliche Verfügbarkeit von OAuth-Anbietern (Login/Registrierung, keine Secrets). */
export async function GET() {
  const flags = await fetchPlatformOAuthAvailability();
  return Response.json(flags, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
