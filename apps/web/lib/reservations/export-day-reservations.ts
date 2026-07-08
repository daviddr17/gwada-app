import { downloadBlob } from "@/lib/export/download-blob";
import { escapeCsvCell } from "@/lib/export/escape-csv-cell";
import { printJsPdfDocument } from "@/lib/export/print-jspdf-document";
import { applyJsPdfPageNumbers } from "@/lib/pdf/jspdf-page-numbers";
import type { jsPDF } from "jspdf";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { reservationDiningTableLabel } from "@/lib/reservations/reservation-table-assignment";
import { sortReservationsByStart } from "@/lib/reservations/sort-reservations-by-start";

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

export type DayReservationExportOptions = {
  restaurantName?: string;
  dayTitle?: string;
  /** IANA-Zeitzone für Uhrzeiten in Export (Display / Restaurant). */
  timeZone?: string;
  /** Dateiname `reservierungen-YYYY-MM-DD.*` — sonst aus `day`. */
  dayYmd?: string;
};

function createTimeFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolveExportDayYmd(day: Date, options?: DayReservationExportOptions): string {
  return options?.dayYmd?.trim() || ymdLocal(day);
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

function reservationToRow(
  r: ReservationListRow,
  timeFmt: Intl.DateTimeFormat,
): string[] {
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

export function buildDayReservationExportRows(
  reservations: ReservationListRow[],
  options?: Pick<DayReservationExportOptions, "timeZone">,
): string[][] {
  const timeFmt = createTimeFormatter(options?.timeZone);
  return sortReservationsByStart(reservations).map((r) =>
    reservationToRow(r, timeFmt),
  );
}

export async function buildDayReservationsPdfDocument(
  reservations: ReservationListRow[],
  options?: DayReservationExportOptions,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const timeFmt = createTimeFormatter(options?.timeZone);
  const sorted = sortReservationsByStart(reservations);
  const title = options?.dayTitle?.trim() || "Reservierungen";

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

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
  const totals = dayReservationExportTotals(sorted);
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
    body: sorted.map((r) => reservationToRow(r, timeFmt)),
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

  return doc;
}

export async function printDayReservations(
  reservations: ReservationListRow[],
  options?: DayReservationExportOptions,
): Promise<void> {
  const sorted = sortReservationsByStart(reservations);
  if (sorted.length === 0) return;
  const dayYmd = resolveExportDayYmd(new Date(), options);
  const title = options?.dayTitle?.trim() || "Reservierungen";
  const totals = dayReservationExportTotals(sorted);
  const doc = await buildDayReservationsPdfDocument(sorted, options);
  await printJsPdfDocument(doc, {
    shareFilename: `reservierungen-${dayYmd}.pdf`,
    htmlFallback: {
      documentTitle: "Reservierungen",
      headers: HEADERS,
      rows: buildDayReservationExportRows(sorted, options),
      restaurantName: options?.restaurantName,
      summaryLine: `${title} · ${totalsSummaryDe(totals)}`,
    },
  });
}

export function downloadDayReservationsCsv(
  day: Date,
  reservations: ReservationListRow[],
  options?: DayReservationExportOptions,
): void {
  const timeFmt = createTimeFormatter(options?.timeZone);
  const dayYmd = resolveExportDayYmd(day, options);
  const totals = dayReservationExportTotals(reservations);
  const sorted = sortReservationsByStart(reservations);
  const lines = [
    ["Reservierungen gesamt", String(totals.reservationCount)]
      .map(escapeCsvCell)
      .join(";"),
    ["Personen gesamt", String(totals.guestCount)].map(escapeCsvCell).join(";"),
    "",
    HEADERS.join(";"),
    ...sorted.map((r) =>
      reservationToRow(r, timeFmt).map(escapeCsvCell).join(";"),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(`reservierungen-${dayYmd}.csv`, blob);
}

export async function downloadDayReservationsPdf(
  day: Date,
  reservations: ReservationListRow[],
  options?: DayReservationExportOptions,
): Promise<void> {
  const dayYmd = resolveExportDayYmd(day, options);
  const doc = await buildDayReservationsPdfDocument(reservations, options);
  doc.save(`reservierungen-${dayYmd}.pdf`);
}
