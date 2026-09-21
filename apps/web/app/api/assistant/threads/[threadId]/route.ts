import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  getAssistantThreadForUser,
  listAssistantMessages,
} from "@/lib/assistant/assistant-chat-db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(req: Request, { params }: Params) {
  const { threadId } = await params;
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const thread = await getAssistantThreadForUser(
      auth.sb,
      threadId,
      auth.userId,
    );
    if (!thread || thread.restaurant_id !== auth.restaurantId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const messages = await listAssistantMessages(auth.sb, threadId);
    const visible = messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    return Response.json({ thread, messages: visible });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "load_failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
