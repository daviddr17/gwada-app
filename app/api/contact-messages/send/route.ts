import { parseMultipartSend } from "@/lib/contact-messages/parse-multipart-send";
import {
  parseOutboundAttachmentFiles,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";
import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let restaurantId = "";
  let contactId = "";
  let messageBody = "";
  let direction: "inbound" | "outbound" | null = null;
  let channels: ("gwada" | "whatsapp" | "email")[] = [];
  let reservationId: string | null = null;
  let restaurantName: string | null = null;
  let attachmentFiles: OutboundAttachmentFile[] = [];
  let notifyWhatsapp = false;
  let notifyEmail = false;

  const multipart = await parseMultipartSend(req);
  if (multipart) {
    const parsedFiles = await parseOutboundAttachmentFiles(multipart.files);
    if (!parsedFiles.ok) {
      return Response.json({ error: parsedFiles.error }, { status: 400 });
    }
    attachmentFiles = parsedFiles.files;
    restaurantId = multipart.fields.restaurantId?.trim() ?? "";
    contactId = multipart.fields.contactId?.trim() ?? "";
    messageBody = multipart.messageBody;
    direction =
      multipart.fields.direction === "inbound" ||
      multipart.fields.direction === "outbound"
        ? multipart.fields.direction
        : null;
    channels = (multipart.fields.channels ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c): c is "gwada" | "whatsapp" | "email" =>
        c === "gwada" || c === "whatsapp" || c === "email",
      );
    reservationId = multipart.fields.reservationId?.trim() || null;
    restaurantName = multipart.fields.restaurantName?.trim() || null;
    notifyWhatsapp = multipart.fields.notifyWhatsapp === "true";
    notifyEmail = multipart.fields.notifyEmail === "true";
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      restaurantId?: string;
      contactId?: string;
      messageBody?: string;
      direction?: "inbound" | "outbound";
      channels?: ("gwada" | "whatsapp" | "email")[];
      reservationId?: string | null;
      restaurantName?: string | null;
      notifyWhatsapp?: boolean;
      notifyEmail?: boolean;
    };
    restaurantId = body.restaurantId?.trim() ?? "";
    contactId = body.contactId?.trim() ?? "";
    messageBody = body.messageBody?.trim() ?? "";
    direction = body.direction ?? null;
    channels = body.channels ?? [];
    reservationId = body.reservationId?.trim() || null;
    restaurantName = body.restaurantName?.trim() || null;
    notifyWhatsapp = body.notifyWhatsapp === true;
    notifyEmail = body.notifyEmail === true;
  }

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(contactId) ||
    (!messageBody && attachmentFiles.length === 0) ||
    (direction !== "inbound" && direction !== "outbound") ||
    channels.length === 0
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: allowed } = await userSb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: contact } = await userSb
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!contact) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  if (reservationId && !isUuidRestaurantId(reservationId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await sendContactMessageServer(admin, {
    restaurantId,
    contactId,
    body: messageBody,
    direction,
    channels: [...new Set(channels)],
    reservationId,
    sentBy: direction === "outbound" ? user.id : null,
    restaurantName,
    attachmentFiles,
    notifyWhatsapp,
    notifyEmail,
  });

  return Response.json(result);
}
