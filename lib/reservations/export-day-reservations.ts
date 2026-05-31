import { downloadBlob } from "@/lib/export/download-blob";
import { escapeCsvCell } from "@/lib/export/escape-csv-cell";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { reservationDiningTableLabel } from "@/lib/reservations/reservation-table-assignment";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const HEADERS = [
  "Zeit",
  "Nachname",
  "Vorname",
  "Pers.",
  "Tisch",
  "Status",
  "Telefon",
  "E-Mail",
  "Nr.",
  "Kommentare",
] as const;

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayReservationExportTotals(
  reservations: ReservationListRow[],
): { reservationCount: number; guestCount: number } {
  let guestCount = 0;
  for (const r of reservations) {
    guestCount += r.party_size;
  }
  return { reservationCount: reservations.length, guestCount };
}

function totalsSummaryDe(totals: {
  reservationCount: number;
  guestCount: number;
}): string {
  const r = totals.reservationCount;
  const p = totals.guestCount;
  return `${r} Reservierung${r === 1 ? "" : "en"} · ${p} Person${p === 1 ? "" : "en"} gesamt`;
}

function reservationToRow(r: ReservationListRow): string[] {
  const start = timeFmt.format(new Date(r.starts_at));
  const end = timeFmt.format(new Date(r.ends_at));
  return [
    `${start}–${end}`,
    r.guest_last_name.trim(),
    r.guest_first_name.trim(),
    String(r.party_size),
    reservationDiningTableLabel(r) ?? "",
    r.reservation_statuses?.name ?? "",
    r.guest_phone?.trim() ?? "",
    r.guest_email?.trim() ?? "",
    String(r.reservation_number),
    "",
  ];
}

export function downloadDayReservationsCsv(
  day: Date,
  reservations: ReservationListRow[],
): void {
  const totals = dayReservationExportTotals(reservations);
  const lines = [
    ["Reservierungen gesamt", String(totals.reservationCount)]
      .map(escapeCsvCell)
      .join(";"),
    ["Personen gesamt", String(totals.guestCount)].map(escapeCsvCell).join(";"),
    "",
    HEADERS.join(";"),
    ...reservations.map((r) => reservationToRow(r).map(escapeCsvCell).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(`reservierungen-${ymdLocal(day)}.csv`, blob);
}

export async function downloadDayReservationsPdf(
  day: Date,
  reservations: ReservationListRow[],
  options?: { restaurantName?: string; dayTitle?: string },
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const title = options?.dayTitle ?? day.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setFontSize(14);
  doc.text("Reservierungen", 14, 16);
  doc.setFontSize(10);
  let y = 22;
  doc.text(title, 14, y);
  y += 5;
  if (options?.restaurantName?.trim()) {
    doc.text(options.restaurantName.trim(), 14, y);
    y += 5;
  }
  const totals = dayReservationExportTotals(reservations);
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text(totalsSummaryDe(totals), 14, y + 2);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(`Export ${new Date().toLocaleString("de-DE")}`, 14, y + 2);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 6,
    head: [HEADERS as unknown as string[]],
    body: reservations.map((r) => reservationToRow(r)),
    styles: {
      fontSize: 9,
      cellPadding: { top: 4, right: 2, bottom: 4, left: 2 },
      minCellHeight: 14,
      valign: "middle",
    },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: 255,
      fontStyle: "bold",
      minCellHeight: 10,
    },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 14, halign: "center" },
      9: { cellWidth: 52, minCellHeight: 18 },
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 10, right: 10, bottom: 14 },
  });

  applyJsPdfPageNumbers(doc);

  doc.save(`reservierungen-${ymdLocal(day)}.pdf`);
}
