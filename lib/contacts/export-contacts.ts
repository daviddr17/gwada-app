import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import {
  allEmailsLabel,
  allPhonesLabel,
  contactAddressLabel,
  type ContactListRow,
} from "@/lib/supabase/contacts-db";

const HEADERS = [
  "Nachname",
  "Vorname",
  "Firma",
  "E-Mail",
  "Telefon",
  "Adresse",
  "Notizen",
  "Reservierungen",
  "Zuletzt",
] as const;

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return whenFmt.format(new Date(iso));
}

function contactToRow(row: ContactListRow): string[] {
  return [
    row.last_name.trim(),
    row.first_name.trim(),
    row.company?.trim() ?? "",
    allEmailsLabel(row) === "—" ? "" : allEmailsLabel(row),
    allPhonesLabel(row) === "—" ? "" : allPhonesLabel(row),
    contactAddressLabel(row) === "—" ? "" : contactAddressLabel(row),
    row.notes?.trim() ?? "",
    String(row.reservation_count),
    formatWhen(row.last_interaction_at),
  ];
}

export function buildContactsExportRows(rows: ContactListRow[]): string[][] {
  return [...rows]
    .sort((a, b) => {
      const la = a.last_name.localeCompare(b.last_name, "de");
      if (la !== 0) return la;
      return a.first_name.localeCompare(b.first_name, "de");
    })
    .map(contactToRow);
}

export function downloadContactsCsv(
  rows: ContactListRow[],
  options?: { restaurantName?: string },
): void {
  const body = buildContactsExportRows(rows);
  downloadTableCsv({
    documentTitle: "Kontakte",
    filenamePrefix: "kontakte",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.restaurantName,
    summaryLine: `${rows.length} Kontakt${rows.length === 1 ? "" : "e"}`,
  });
}

export async function downloadContactsPdf(
  rows: ContactListRow[],
  options?: { restaurantName?: string },
): Promise<void> {
  const body = buildContactsExportRows(rows);
  await downloadTablePdf({
    documentTitle: "Kontakte",
    filenamePrefix: "kontakte",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.restaurantName,
    summaryLine: `${rows.length} Kontakt${rows.length === 1 ? "" : "e"}`,
    orientation: "landscape",
    columnStyles: {
      3: { cellWidth: 40 },
      4: { cellWidth: 32 },
      5: { cellWidth: 44 },
      6: { cellWidth: 36 },
    },
  });
}
