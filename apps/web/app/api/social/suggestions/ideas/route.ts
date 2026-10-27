import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { listSocialAutopilotIdeas } from "@/lib/social/social-autopilot-ideas-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Ideen-Auswahl ohne LLM und ohne Draft-Insert. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const rotate = url.searchParams.get("rotate") === "1";

  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await listSocialAutopilotIdeas(admin, restaurantId, {
    rotate,
  });

  return Response.json({
    ideas: result.ideas,
    maxSelect: result.maxSelect,
    pendingOpen: result.pendingOpen,
    tasksCreated: result.tasksCreated,
    aiConfigured: result.aiConfigured,
    aiProvider: result.aiProvider,
    skippedReason: result.skippedReason,
  });
}
