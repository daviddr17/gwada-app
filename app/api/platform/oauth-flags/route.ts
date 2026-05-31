import { fetchPlatformOAuthFlags } from "@/lib/supabase/platform-oauth-flags";
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

  const flags = await fetchPlatformOAuthFlags();
  return Response.json(flags, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
