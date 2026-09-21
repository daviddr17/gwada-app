import { CONTACT_MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/constants/contact-message-attachments";
import { attachmentDownloadHeaders } from "@/lib/contact-messages/attachment-download-headers";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { parseImapAttachmentStoragePath } from "@/lib/contact-messages/imap-attachment-storage-path";
import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { fetchImapAttachmentContent } from "@/lib/email/imap-inbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";
  const messageId = url.searchParams.get("messageId")?.trim() ?? "";
  const attachmentId = url.searchParams.get("attachmentId")?.trim() ?? "";

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(messageId) ||
    !isUuidRestaurantId(attachmentId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { data: row, error } = await auth.supabase
    .from("contact_message_attachments")
    .select("file_name, mime_type, storage_path")
    .eq("id", attachmentId)
    .eq("message_id", messageId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!row?.storage_path) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const storagePath = row.storage_path as string;
  const imapRef = parseImapAttachmentStoragePath(storagePath);
  if (imapRef) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return Response.json({ error: "server_misconfigured" }, { status: 503 });
    }
    const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
    if (!creds) {
      return Response.json({ error: "imap_not_configured" }, { status: 503 });
    }
    const { data, error: imapErr } = await fetchImapAttachmentContent(
      creds,
      imapRef.uid,
      imapRef.index,
    );
    if (imapErr) {
      return Response.json({ error: imapErr }, { status: 500 });
    }
    if (!data) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    const fileName =
      data.fileName || (row.file_name as string) || "Anhang";
    const mimeType =
      data.mimeType || (row.mime_type as string) || "application/octet-stream";
    return new Response(new Uint8Array(data.bytes), {
      headers: attachmentDownloadHeaders({ fileName, mimeType }),
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: blob, error: dlError } = await admin.storage
    .from(CONTACT_MESSAGE_ATTACHMENTS_BUCKET)
    .download(storagePath);

  if (dlError || !blob) {
    return Response.json(
      { error: dlError?.message ?? "download_failed" },
      { status: 500 },
    );
  }

  const fileName = (row.file_name as string) || "Anhang";
  const mimeType = (row.mime_type as string) || "application/octet-stream";

  return new Response(blob, {
    headers: attachmentDownloadHeaders({ fileName, mimeType }),
  });
}
