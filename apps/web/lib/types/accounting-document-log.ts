export type AccountingDocumentLogKind = "invoice" | "quotation" | "voucher";

export type AccountingDocumentLogAction =
  | "created"
  | "updated"
  | "sent"
  | "deleted"
  | "synced"
  | "attachment_uploaded";

export type AccountingDocumentLogChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type AccountingDocumentLogDetails = {
  actorGivenName?: string;
  actorFamilyName?: string;
  summary?: string;
  changes?: AccountingDocumentLogChange[];
  source?: "gwada" | "lexoffice";
  voucherNumber?: string | null;
  channels?: string[];
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  fileName?: string | null;
  correctsNumber?: string | null;
  documentVariant?: string | null;
};

export type AccountingDocumentLogEntry = {
  id: string;
  restaurant_id: string;
  document_kind: AccountingDocumentLogKind;
  document_id: string;
  actor_user_id: string | null;
  action: AccountingDocumentLogAction;
  details: AccountingDocumentLogDetails;
  created_at: string;
};

export function formatAccountingDocumentLogActorLabel(
  details: AccountingDocumentLogDetails,
  fallback = "—",
): string {
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

export function accountingDocumentLogActionLabel(
  action: AccountingDocumentLogAction,
): string {
  switch (action) {
    case "created":
      return "Angelegt";
    case "updated":
      return "Geändert";
    case "sent":
      return "Versendet";
    case "deleted":
      return "Gelöscht";
    case "synced":
      return "Lexware-Sync";
    case "attachment_uploaded":
      return "Anhang";
    default:
      return action;
  }
}

export function formatAccountingDocumentLogSummary(
  details: AccountingDocumentLogDetails,
  action?: AccountingDocumentLogAction,
): string {
  if (details.summary?.trim()) {
    return details.summary.trim();
  }

  if (action === "sent") {
    const parts: string[] = [];
    if (details.channels?.length) {
      parts.push(
        details.channels
          .map((c) => (c === "email" ? "E-Mail" : c === "whatsapp" ? "WhatsApp" : c))
          .join(", "),
      );
    }
    const recipient = details.recipientName?.trim();
    if (recipient) parts.push(`an ${recipient}`);
    if (details.recipientEmail?.trim()) {
      parts.push(`(${details.recipientEmail.trim()})`);
    }
    if (details.recipientPhone?.trim() && !details.recipientEmail?.trim()) {
      parts.push(`(${details.recipientPhone.trim()})`);
    }
    return parts.length ? parts.join(" ") : "Versendet";
  }

  if (action === "attachment_uploaded" && details.fileName?.trim()) {
    return details.fileName.trim();
  }

  const changes = details.changes ?? [];
  if (changes.length === 0) {
    if (details.source === "lexoffice") return "Aus Lexware";
    return "—";
  }

  return changes
    .map((c) => `${c.field}: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`)
    .join(" · ");
}
