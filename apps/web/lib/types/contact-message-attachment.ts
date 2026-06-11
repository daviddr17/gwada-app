export type ContactMessageAttachmentKind = "image" | "video" | "voice" | "file";

export type ContactMessageAttachment = {
  id: string;
  kind: ContactMessageAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize?: number | null;
  /** Authentifizierte Download-URL (relativ oder absolut). */
  url: string;
  /** Optional: Dauer in Sekunden (Sprachnachricht). */
  durationSeconds?: number | null;
};
