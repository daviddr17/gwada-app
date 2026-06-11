import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

/** Vorschau-Icon: Bild > Video > Sprache > Datei. */
export function primaryAttachmentKind(
  kinds: Iterable<ContactMessageAttachmentKind> | undefined,
): ContactMessageAttachmentKind | undefined {
  if (!kinds) return undefined;
  let fallback: ContactMessageAttachmentKind | undefined;
  for (const kind of kinds) {
    if (kind === "image") return "image";
    if (kind === "video") return "video";
    if (kind === "voice") return "voice";
    fallback = "file";
  }
  return fallback;
}
