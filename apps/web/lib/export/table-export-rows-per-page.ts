/** Voreinstellungen: Artikel/Zeilen pro A4-Seite (PDF/Druck). */
export const TABLE_EXPORT_ROWS_PER_PAGE_OPTIONS = [
  15, 20, 25, 30, 40, 50,
] as const;

export type TableExportRowsPerPage =
  (typeof TABLE_EXPORT_ROWS_PER_PAGE_OPTIONS)[number];

export const DEFAULT_TABLE_EXPORT_ROWS_PER_PAGE: TableExportRowsPerPage = 25;

const STORAGE_KEY = "gwada-table-export-rows-per-page";

export function isTableExportRowsPerPage(
  value: unknown,
): value is TableExportRowsPerPage {
  return (
    typeof value === "number" &&
    (TABLE_EXPORT_ROWS_PER_PAGE_OPTIONS as readonly number[]).includes(value)
  );
}

export function parseTableExportRowsPerPage(
  raw: string | null | undefined,
): TableExportRowsPerPage | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw, 10);
  return isTableExportRowsPerPage(n) ? n : null;
}

export function readStoredTableExportRowsPerPage(): TableExportRowsPerPage {
  if (typeof window === "undefined") return DEFAULT_TABLE_EXPORT_ROWS_PER_PAGE;
  try {
    const stored = parseTableExportRowsPerPage(
      window.localStorage.getItem(STORAGE_KEY),
    );
    return stored ?? DEFAULT_TABLE_EXPORT_ROWS_PER_PAGE;
  } catch {
    return DEFAULT_TABLE_EXPORT_ROWS_PER_PAGE;
  }
}

export function writeStoredTableExportRowsPerPage(
  value: TableExportRowsPerPage,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function tableExportRowsPerPageSelectOptions(): {
  value: string;
  label: string;
}[] {
  return TABLE_EXPORT_ROWS_PER_PAGE_OPTIONS.map((n) => ({
    value: String(n),
    label: `${n} pro Seite`,
  }));
}

export function estimateTableExportPageCount(
  rowCount: number,
  rowsPerPage: number,
): number {
  if (rowCount <= 0 || rowsPerPage <= 0) return 0;
  return Math.ceil(rowCount / rowsPerPage);
}

export type TablePdfRowStyles = {
  fontSize: number;
  cellPadding: { top: number; right: number; bottom: number; left: number };
  minCellHeight: number;
  headMinCellHeight: number;
};

/**
 * Zeilenhöhe / Schrift aus „Artikel pro Seite“ ableiten.
 * Ziel: ca. `rowsPerPage` Datenzeilen auf einer A4-Seite (Quer-/Hochformat).
 */
export function resolveTablePdfRowStyles(params: {
  rowsPerPage?: number | null;
  orientation?: "landscape" | "portrait";
}): TablePdfRowStyles {
  if (params.rowsPerPage == null || params.rowsPerPage <= 0) {
    return {
      fontSize: 9,
      cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
      minCellHeight: 12,
      headMinCellHeight: 10,
    };
  }

  const pageHeightMm = params.orientation === "portrait" ? 297 : 210;
  /** Titel + Meta + startY-Abstand über der Tabelle. */
  const topBlockMm = 38;
  const bottomMarginMm = 14;
  const headReserveMm = 10;
  const usableBodyMm = Math.max(
    70,
    pageHeightMm - topBlockMm - bottomMarginMm - headReserveMm,
  );

  const minCellHeight = Math.max(
    5.2,
    Math.min(14, usableBodyMm / params.rowsPerPage),
  );
  const fontSize =
    minCellHeight >= 11 ? 9 : minCellHeight >= 8.5 ? 8 : minCellHeight >= 6.5 ? 7 : 6;
  const padV = Math.max(0.8, Math.min(3, minCellHeight * 0.2));

  return {
    fontSize,
    cellPadding: { top: padV, right: 1.5, bottom: padV, left: 1.5 },
    minCellHeight,
    headMinCellHeight: Math.min(10, Math.max(6.5, minCellHeight * 0.8)),
  };
}
