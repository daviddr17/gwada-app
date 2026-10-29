import {
  createInboxLabelServer,
  listInboxLabelsServer,
} from "@/lib/contact-messages/inbox-labels-server";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const labels = await listInboxLabelsServer(admin, auth.restaurantId);
  return Response.json({ ok: true, labels });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    name?: string;
    backgroundColor?: string;
    syncWaha?: boolean;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const write = await authorizeModuleCrud(restaurantId, "contacts", "create");
  if (!write.ok) {
    return Response.json({ error: write.error }, { status: write.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await createInboxLabelServer(admin, {
    restaurantId,
    name: body.name ?? "",
    backgroundColor: body.backgroundColor,
    syncWaha: body.syncWaha !== false,
  });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true, label: result.label });
}
