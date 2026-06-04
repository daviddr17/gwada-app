export type ContactMessageAttachmentKind = "image" | "file";

export type ContactMessageAttachment = {
  id: string;
  kind: ContactMessageAttachmentKind;
  fileName: string;
  mimeType: string;
  byteSize?: number | null;
  /** Authentifizierte Download-URL (relativ oder absolut). */
  url: string;
};
