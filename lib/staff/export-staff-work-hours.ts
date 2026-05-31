import {
  downloadTableCsv,
  downloadTablePdf,
} from "@/lib/export/table-document-export";
import {
  entryDurationHours,
  formatHoursDe,
  formatStaffWorkHoursSummaryLine,
  type StaffWorkHoursSummary,
} from "@/lib/staff/staff-work-hours-summary";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import {
  STAFF_WORK_ENTRY_LABELS,
  staffDisplayName,
  type RestaurantStaffRow,
} from "@/lib/types/staff";

const HEADERS = ["Datum", "Art", "Von", "Bis", "Dauer", "Notiz"] as const;

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateDe = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function localDayKeyFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function entryToRow(e: RestaurantStaffWorkEntryRow): string[] {
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  return [
    dateDe.format(start),
    STAFF_WORK_ENTRY_LABELS[e.entry_type],
    timeDe.format(start),
    timeDe.format(end),
    formatHoursDe(entryDurationHours(e)),
    e.note?.trim() ?? "",
  ];
}

export function buildStaffWorkHoursExportRows(
  entries: RestaurantStaffWorkEntryRow[],
): string[][] {
  return [...entries]
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    .map(entryToRow);
}

export type StaffWorkHoursExportOptions = {
  restaurantName?: string;
  staff: RestaurantStaffRow;
  rangeStartYmd: string;
  rangeEndYmd: string;
  summary: StaffWorkHoursSummary;
};

function exportMeta(options: StaffWorkHoursExportOptions) {
  const staffName = staffDisplayName(options.staff);
  return {
    documentTitle: "Arbeitszeiten",
    filenamePrefix: `arbeitszeiten-${staffName.replace(/\s+/g, "-").toLowerCase()}-${options.rangeStartYmd}_${options.rangeEndYmd}`,
    summaryLine: `${staffName} · ${options.rangeStartYmd} – ${options.rangeEndYmd} · ${formatStaffWorkHoursSummaryLine(options.summary)}`,
    restaurantName: options.restaurantName,
  };
}

export function downloadStaffWorkHoursCsv(
  entries: RestaurantStaffWorkEntryRow[],
  options: StaffWorkHoursExportOptions,
): void {
  const meta = exportMeta(options);
  const body = buildStaffWorkHoursExportRows(entries);
  downloadTableCsv({
    ...meta,
    headers: HEADERS,
    rows: body,
  });
}

export async function downloadStaffWorkHoursPdf(
  entries: RestaurantStaffWorkEntryRow[],
  options: StaffWorkHoursExportOptions,
): Promise<void> {
  const meta = exportMeta(options);
  const body = buildStaffWorkHoursExportRows(entries);
  await downloadTablePdf({
    ...meta,
    headers: HEADERS,
    rows: body,
    orientation: "portrait",
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: 40 },
    },
  });
}

/** Gruppiert Einträge nach lokalem Kalendertag (für Vorschau). */
export function groupStaffWorkEntriesByDay(
  entries: RestaurantStaffWorkEntryRow[],
): { dayKey: string; heading: string; entries: RestaurantStaffWorkEntryRow[] }[] {
  const map = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const e of entries) {
    const k = localDayKeyFromIso(e.starts_at);
    const list = map.get(k) ?? [];
    list.push(e);
    map.set(k, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, dayEntries]) => {
      const [y, m, d] = dayKey.split("-").map(Number);
      const day = new Date(y, m - 1, d);
      return {
        dayKey,
        heading: formatDayHeadingDe(day),
        entries: dayEntries.sort(
          (a, b) =>
            new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
        ),
      };
    });
}

export function currentCalendarMonthYmdRange(): {
  startYmd: string;
  endYmd: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    startYmd: `${y}-${pad(m + 1)}-01`,
    endYmd: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}
