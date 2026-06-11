import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export function inboxPreviewSnippet(
  body: string,
  attachmentKind?: ContactConversationPreview["last_attachment_kind"],
  max = 72,
): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t) {
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }
  if (attachmentKind === "image") return "Bild";
  if (attachmentKind === "video") return "Video";
  if (attachmentKind === "voice") return "Sprachnachricht";
  if (attachmentKind === "file") return "Datei";
  return "—";
}
