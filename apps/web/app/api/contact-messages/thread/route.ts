import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchContactThreadPageServer } from "@/lib/contact-messages/fetch-contact-thread-server";
import type { ContactThreadTiming } from "@/lib/contact-messages/contact-thread-timing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function threadJsonResponse(
  body: Record<string, unknown>,
  init: { status?: number; timing?: ContactThreadTiming },
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init.timing) {
    headers.set(
      "X-Contact-Thread-Timing",
      Buffer.from(JSON.stringify(init.timing)).toString("base64url"),
    );
  }
  return Response.json(body, { status: init.status ?? 200, headers });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const contactId = searchParams.get("contactId")?.trim() ?? "";
  const before = searchParams.get("before")?.trim() || null;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  if (!contactId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const result = await fetchContactThreadPageServer(admin, {
    restaurantId: auth.restaurantId,
    contactId,
    before,
    limit: Number.isFinite(limit) && limit! > 0 ? limit : undefined,
  });

  if (result.error) {
    const status =
      result.error === "imap_not_configured" ||
      result.error === "waha_not_configured" ||
      result.error === "meta_not_connected"
        ? 502
        : 400;
    return threadJsonResponse(
      {
        error: result.error,
        data: [],
        hasMore: false,
        oldestCursor: null,
        contact: result.contact,
      },
      { status, timing: result.timing },
    );
  }

  return threadJsonResponse(
    {
      data: result.messages,
      hasMore: result.hasMore,
      oldestCursor: result.oldestCursor,
      contact: result.contact,
      error: null,
    },
    { timing: result.timing },
  );
}
