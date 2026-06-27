import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import {
  COMPLIANCE_CATEGORY_LABELS,
  COMPLIANCE_LOG_ACTION_LABELS,
  type ComplianceCategory,
  type ComplianceLogAction,
  type RestaurantComplianceLogEntry,
  type RestaurantComplianceRecordRow,
} from "@/lib/types/compliance";
import {
  formatComplianceLogDetailsSummary,
  resolveComplianceLogActorLabel,
  resolveComplianceRecordActorLabel,
} from "@/lib/supabase/compliance-db";

const RECORD_HEADERS = [
  "Zeitpunkt",
  "Vorlage",
  "Bereich",
  "Erfasst von",
  "Quelle",
  "Status",
  "Korrekturmaßnahme",
  "Notiz",
] as const;

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatRecordValues(
  record: RestaurantComplianceRecordRow,
): string {
  const items =
    (
      record.checklist as
        | { items?: { id: string; label: string }[] }
        | null
        | undefined
    )?.items ?? [];
  const labels = new Map(items.map((i) => [i.id, i.label] as const));
  return Object.entries(record.values)
    .map(([id, entry]) => {
      const label = labels.get(id) ?? id;
      const val = entry.value;
      const suffix =
        entry.withinLimits === false ? " (!)" : "";
      return `${label}: ${String(val ?? "—")}${suffix}`;
    })
    .join(" · ");
}

export function buildComplianceRecordExportRows(
  records: RestaurantComplianceRecordRow[],
): string[][] {
  return records.map((r) => [
    whenFmt.format(new Date(r.performed_at)),
    r.checklist?.name ?? "—",
    r.checklist?.category
      ? COMPLIANCE_CATEGORY_LABELS[r.checklist.category as ComplianceCategory]
      : "—",
    resolveComplianceRecordActorLabel(r),
    r.source === "display" ? "Display" : "Dashboard",
    r.has_deviation ? "Abweichung" : "OK",
    r.corrective_action?.trim() ?? "",
    [r.notes?.trim(), formatRecordValues(r)].filter(Boolean).join(" | "),
  ]);
}

export async function downloadComplianceRecordsPdf(
  records: RestaurantComplianceRecordRow[],
  options?: { restaurantName?: string; title?: string },
): Promise<void> {
  const rows = buildComplianceRecordExportRows(records);
  await downloadTablePdf({
    documentTitle: options?.title ?? "Eigenkontrolle — Einträge",
    filenamePrefix: "eigenkontrolle-eintraege",
    headers: RECORD_HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${records.length} Eintrag${records.length === 1 ? "" : "e"}`,
    orientation: "landscape",
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 36 },
      6: { cellWidth: 40 },
      7: { cellWidth: 50 },
    },
  });
}

export function downloadComplianceRecordsCsv(
  records: RestaurantComplianceRecordRow[],
  options?: { restaurantName?: string; title?: string },
): void {
  const rows = buildComplianceRecordExportRows(records);
  downloadTableCsv({
    documentTitle: options?.title ?? "Eigenkontrolle — Einträge",
    filenamePrefix: "eigenkontrolle-eintraege",
    headers: RECORD_HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${records.length} Eintrag${records.length === 1 ? "" : "e"}`,
  });
}

const PROTOCOL_HEADERS = ["Zeit", "Aktion", "Details", "Wer"] as const;

export function buildComplianceProtocolExportRows(
  entries: RestaurantComplianceLogEntry[],
): string[][] {
  return entries.map((e) => [
    whenFmt.format(new Date(e.created_at)),
    COMPLIANCE_LOG_ACTION_LABELS[e.action as ComplianceLogAction] ?? e.action,
    formatComplianceLogDetailsSummary(e) || e.checklist?.name || "—",
    resolveComplianceLogActorLabel(e),
  ]);
}

export async function downloadComplianceProtocolPdf(
  entries: RestaurantComplianceLogEntry[],
  options?: { restaurantName?: string },
): Promise<void> {
  const rows = buildComplianceProtocolExportRows(entries);
  await downloadTablePdf({
    documentTitle: "Eigenkontrolle — Protokoll",
    filenamePrefix: "eigenkontrolle-protokoll",
    headers: PROTOCOL_HEADERS,
    rows,
    restaurantName: options?.restaurantName,
    summaryLine: `${entries.length} Protokolleinträge`,
    orientation: "portrait",
  });
}
