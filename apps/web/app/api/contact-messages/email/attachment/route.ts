import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchImapAttachmentContent } from "@/lib/email/imap-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const uidRaw = url.searchParams.get("uid")?.trim() ?? "";
  const indexRaw = url.searchParams.get("index")?.trim() ?? "";

  const uid = Number.parseInt(uidRaw, 10);
  const index = Number.parseInt(indexRaw, 10);

  if (
    !isUuidRestaurantId(restaurantId) ||
    !Number.isFinite(uid) ||
    !Number.isFinite(index)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  if (!creds) {
    return Response.json({ error: "imap_not_configured" }, { status: 503 });
  }

  const { data, error } = await fetchImapAttachmentContent(creds, uid, index);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }
  if (!data) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const disposition = data.mimeType.startsWith("image/")
    ? "inline"
    : "attachment";

  return new Response(new Uint8Array(data.bytes), {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(data.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
