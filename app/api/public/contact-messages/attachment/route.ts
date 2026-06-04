import { loadPublicContactAttachment } from "@/lib/contacts/public-contact-messages-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contactId =
    url.searchParams.get("kontakt")?.trim() ??
    url.searchParams.get("contact")?.trim() ??
    "";
  const messageId = url.searchParams.get("messageId")?.trim() ?? "";
  const attachmentId = url.searchParams.get("attachmentId")?.trim() ?? "";

  if (
    !isUuidRestaurantId(contactId) ||
    !isUuidRestaurantId(messageId) ||
    !isUuidRestaurantId(attachmentId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await loadPublicContactAttachment(
    contactId,
    messageId,
    attachmentId,
  );

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const disposition = result.mimeType.startsWith("image/")
    ? "inline"
    : "attachment";

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(result.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
