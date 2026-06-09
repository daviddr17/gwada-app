import type { RestaurantStaffRow } from "@/lib/types/staff";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import {
  formatScheduledHoursMinutes,
  formatShiftTimeRangeDe,
  scheduledShiftDisplayLabel,
  STAFF_SCHEDULED_SHIFT_STATUS_LABELS,
} from "@/lib/types/staff-shift-schedule";
import { shiftDayKeyFromIso } from "@/lib/staff/shift-schedule-range";
import { scheduledShiftDurationMinutes } from "@/lib/types/staff-shift-schedule";
import { staffDisplayName } from "@/lib/types/staff";

const CSV_HEADERS = [
  "Datum",
  "Mitarbeiter",
  "Schicht",
  "Beginn",
  "Ende",
  "Dauer",
  "Status",
  "Notiz",
] as const;

function shiftToCsvRow(
  shift: RestaurantStaffScheduledShiftRow,
  staffName: string,
): string[] {
  const day = shiftDayKeyFromIso(shift.starts_at);
  const durationMin = scheduledShiftDurationMinutes(
    shift.starts_at,
    shift.ends_at,
  );
  const [start, end] = formatShiftTimeRangeDe(shift.starts_at, shift.ends_at).split(
    " – ",
  );
  return [
    day,
    staffName,
    scheduledShiftDisplayLabel(shift),
    start ?? "",
    end ?? "",
    formatScheduledHoursMinutes(durationMin),
    STAFF_SCHEDULED_SHIFT_STATUS_LABELS[shift.status],
    shift.note?.trim() ?? "",
  ];
}

export function buildShiftScheduleExportRows(
  shifts: RestaurantStaffScheduledShiftRow[],
  staffById: Map<string, RestaurantStaffRow>,
): string[][] {
  const sorted = [...shifts].sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime() ||
      staffDisplayName(staffById.get(a.staff_id)!).localeCompare(
        staffDisplayName(staffById.get(b.staff_id)!),
      ),
  );
  return [
    [...CSV_HEADERS],
    ...sorted.map((s) => {
      const staff = staffById.get(s.staff_id);
      return shiftToCsvRow(s, staff ? staffDisplayName(staff) : s.staff_id);
    }),
  ];
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadShiftScheduleCsv(
  rows: string[][],
  filenamePrefix: string,
): void {
  const body = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + body], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadShiftSchedulePdf(
  rows: string[][],
  title: string,
  filenamePrefix: string,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    head: [rows[0] ?? []],
    body: rows.slice(1),
    startY: 22,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [100, 116, 139] },
  });
  doc.save(`${filenamePrefix}.pdf`);
}
