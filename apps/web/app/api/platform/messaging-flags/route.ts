import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const flags = await fetchPlatformMessagingFlags(sb);
  return Response.json(
    {
      whatsappEnabled: flags.whatsappEnabled,
      emailEnabled: flags.emailEnabled,
      facebookEnabled: flags.facebookEnabled,
      instagramEnabled: flags.instagramEnabled,
      googleBusinessEnabled: flags.googleBusinessEnabled,
      lexofficeEnabled: flags.lexofficeEnabled,
      mollieEnabled: flags.mollieEnabled,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
