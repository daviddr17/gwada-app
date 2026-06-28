export type ContactMessageProtocolEventKind =
  | "created"
  | "sent_by"
  | "gwada_read"
  | "external_whatsapp"
  | "external_email"
  | "marked_unread";

export type ContactMessageProtocolEvent = {
  kind: ContactMessageProtocolEventKind;
  /** null = Zeitpunkt nicht protokolliert (z. B. WA-Zustellstatus ohne Timestamp). */
  at: string | null;
  label: string;
  detail: string | null;
  actorName: string | null;
};

export type ContactMessageProtocolPayload = {
  messageId: string;
  platform: string;
  direction: "inbound" | "outbound";
  preview: string;
  events: ContactMessageProtocolEvent[];
};
