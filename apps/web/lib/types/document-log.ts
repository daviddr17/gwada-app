export type DocumentLogAction =
  | "uploaded"
  | "updated"
  | "deleted"
  | "note_updated"
  | "note_added";

export type DocumentLogChangeField = "title" | "tag";

export type DocumentLogChange = {
  field: DocumentLogChangeField;
  from: string | null;
  to: string | null;
};

export type DocumentLogDetails = {
  actorGivenName?: string;
  actorFamilyName?: string;
  changes?: DocumentLogChange[];
  /** Protokoll-Notiz (note_added) oder Vorschau bei note_updated */
  noteBody?: string;
  noteFrom?: string | null;
  noteTo?: string | null;
};

export type RestaurantDocumentLogEntry = {
  id: string;
  restaurant_id: string;
  document_id: string | null;
  employee_id: string | null;
  actor_user_id: string | null;
  action: DocumentLogAction;
  document_title: string;
  file_name: string | null;
  details: DocumentLogDetails;
  created_at: string;
};

export function formatDocumentLogActorLabel(
  details: DocumentLogDetails,
  fallback = "—",
): string {
  const name = [details.actorGivenName?.trim(), details.actorFamilyName?.trim()]
    .filter(Boolean)
    .join(" ");
  return name || fallback;
}

export function documentLogActionLabel(action: DocumentLogAction): string {
  switch (action) {
    case "uploaded":
      return "Hochgeladen";
    case "updated":
      return "Geändert";
    case "deleted":
      return "Gelöscht";
    default:
      return action;
  }
}

export function formatDocumentLogDetailsSummary(
  details: DocumentLogDetails,
  action?: DocumentLogAction,
): string {
  if (action === "note_added" && details.noteBody?.trim()) {
    return details.noteBody.trim();
  }
  if (action === "note_updated") {
    const from = details.noteFrom?.trim() || "—";
    const to = details.noteTo?.trim() || "—";
    return `Notiz: „${from}“ → „${to}“`;
  }
  const changes = details.changes ?? [];
  if (changes.length === 0) return "—";
  return changes
    .map((c) => {
      if (c.field === "title") {
        return `Titel: „${c.from ?? "—"}“ → „${c.to ?? "—"}“`;
      }
      return `Tag: ${c.from ?? "—"} → ${c.to ?? "—"}`;
    })
    .join(" · ");
}
