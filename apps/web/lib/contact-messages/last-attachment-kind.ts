import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

/** Vorschau-Icon: Bild hat Vorrang, wenn mehrere Anhänge. */
export function primaryAttachmentKind(
  kinds: Iterable<ContactMessageAttachmentKind> | undefined,
): ContactMessageAttachmentKind | undefined {
  if (!kinds) return undefined;
  let hasFile = false;
  for (const kind of kinds) {
    if (kind === "image") return "image";
    hasFile = true;
  }
  return hasFile ? "file" : undefined;
}
