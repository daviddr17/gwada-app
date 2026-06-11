import {
  loadNotificationContact,
  updateNotificationContact,
} from "@/lib/notifications/notification-contact-server";
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

  const contact = await loadNotificationContact(sb, user.id);
  if (!contact) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({ data: contact });
}

export async function PUT(req: Request) {
  let body: { notificationEmail?: string; phone?: string };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await updateNotificationContact(sb, user.id, {
    notificationEmail:
      typeof body.notificationEmail === "string" ? body.notificationEmail : "",
    phone: typeof body.phone === "string" ? body.phone : "",
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error, field: result.field },
      { status: 400 },
    );
  }

  return Response.json({ data: result.contact });
}
