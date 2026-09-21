import { authorizeDashboardRestaurant } from "@/lib/dashboard/authorize-dashboard-restaurant";
import {
  createAssistantThread,
  listAssistantThreads,
} from "@/lib/assistant/assistant-chat-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const auth = await authorizeDashboardRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const threads = await listAssistantThreads(
      auth.sb,
      auth.restaurantId,
      auth.userId,
    );
    return Response.json({ threads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "load_failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    title?: string;
  };
  const auth = await authorizeDashboardRestaurant(body.restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const thread = await createAssistantThread(
      auth.sb,
      auth.restaurantId,
      auth.userId,
      body.title?.trim() || "Neuer Chat",
    );
    return Response.json({ thread });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
