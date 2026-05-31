import { formatLocaleLabel } from "@/lib/constants/locale-labels";
import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import type { SuperadminUserRow } from "@/lib/supabase/platform-superadmin-db";

const HEADERS = [
  "E-Mail",
  "Vorname",
  "Nachname",
  "Anzeigename",
  "Telefon",
  "Sprache",
  "Online",
  "Restaurants",
  "Registriert",
  "Letzte Anmeldung",
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

function userToRow(row: SuperadminUserRow): string[] {
  return [
    row.email?.trim() ?? "",
    row.given_name?.trim() ?? "",
    row.family_name?.trim() ?? "",
    row.display_name?.trim() ?? "",
    row.phone?.trim() ?? "",
    row.locale ? formatLocaleLabel(row.locale) : "",
    row.is_online ? "Online" : "Offline",
    String(row.restaurant_count),
    formatWhen(row.created_at),
    formatWhen(row.last_sign_in_at),
  ];
}

export function buildSuperadminUsersExportRows(
  rows: SuperadminUserRow[],
): string[][] {
  return [...rows]
    .sort((a, b) => {
      const ea = a.email?.trim() ?? "";
      const eb = b.email?.trim() ?? "";
      return ea.localeCompare(eb, "de");
    })
    .map(userToRow);
}

export function downloadSuperadminUsersCsv(
  rows: SuperadminUserRow[],
  options?: { platformName?: string },
): void {
  const body = buildSuperadminUsersExportRows(rows);
  downloadTableCsv({
    documentTitle: "User",
    filenamePrefix: "superadmin-user",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.platformName,
    summaryLine: `${rows.length} User`,
  });
}

export async function downloadSuperadminUsersPdf(
  rows: SuperadminUserRow[],
  options?: { platformName?: string },
): Promise<void> {
  const body = buildSuperadminUsersExportRows(rows);
  await downloadTablePdf({
    documentTitle: "User",
    filenamePrefix: "superadmin-user",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.platformName,
    summaryLine: `${rows.length} User`,
    orientation: "landscape",
    columnStyles: {
      0: { cellWidth: 44 },
      5: { cellWidth: 24 },
    },
  });
}
