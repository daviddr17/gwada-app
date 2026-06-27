import { isPlatformWeatherAvailableAdmin } from "@/lib/supabase/platform-weather-secrets-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Ob Wetter-Widget/API nutzbar ist (Superadmin aktiv + API-Key). Kein Secret-Leak. */
export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const available = await isPlatformWeatherAvailableAdmin();
  return Response.json(
    { available },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
