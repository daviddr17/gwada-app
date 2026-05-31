import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import { formatRestaurantTimezoneLabel } from "@/lib/restaurant/restaurant-timezone";
import type { SuperadminRestaurantRow } from "@/lib/supabase/platform-superadmin-db";

const HEADERS = [
  "Name",
  "Slug",
  "Owner",
  "Owner E-Mail",
  "Kontakt E-Mail",
  "Telefon",
  "Zeitzone",
  "Team",
  "Status",
  "Angelegt am",
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

function restaurantStatusLabel(row: SuperadminRestaurantRow): string {
  return row.is_published ? "Live" : "Entwurf";
}

function restaurantToRow(row: SuperadminRestaurantRow): string[] {
  return [
    row.name.trim(),
    row.slug.trim(),
    row.owner_display_name?.trim() ?? "",
    row.owner_email?.trim() ?? "",
    row.email?.trim() ?? "",
    row.phone?.trim() ?? "",
    formatRestaurantTimezoneLabel(row.timezone),
    String(row.employee_count),
    restaurantStatusLabel(row),
    formatWhen(row.created_at),
  ];
}

export function buildSuperadminRestaurantsExportRows(
  rows: SuperadminRestaurantRow[],
): string[][] {
  return [...rows]
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map(restaurantToRow);
}

export function downloadSuperadminRestaurantsCsv(
  rows: SuperadminRestaurantRow[],
  options?: { platformName?: string },
): void {
  const body = buildSuperadminRestaurantsExportRows(rows);
  downloadTableCsv({
    documentTitle: "Restaurants",
    filenamePrefix: "superadmin-restaurants",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.platformName,
    summaryLine: `${rows.length} Restaurant${rows.length === 1 ? "" : "s"}`,
  });
}

export async function downloadSuperadminRestaurantsPdf(
  rows: SuperadminRestaurantRow[],
  options?: { platformName?: string },
): Promise<void> {
  const body = buildSuperadminRestaurantsExportRows(rows);
  await downloadTablePdf({
    documentTitle: "Restaurants",
    filenamePrefix: "superadmin-restaurants",
    headers: HEADERS,
    rows: body,
    restaurantName: options?.platformName,
    summaryLine: `${rows.length} Restaurant${rows.length === 1 ? "" : "s"}`,
    orientation: "landscape",
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 28 },
      3: { cellWidth: 40 },
      4: { cellWidth: 36 },
    },
  });
}
