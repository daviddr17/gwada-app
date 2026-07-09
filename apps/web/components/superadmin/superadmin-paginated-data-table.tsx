"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import {
  SuperadminDataTable,
  sortSuperadminRows,
  type SuperadminColumn,
  type SuperadminSortDir,
} from "@/components/superadmin/superadmin-data-table";
import { SuperadminTableFullscreenSurround } from "@/components/superadmin/superadmin-table-fullscreen-surround";
import { formatListPageSummary } from "@/lib/ui/list-range-count";

type SuperadminPaginatedDataTableProps<T> = {
  columns: readonly SuperadminColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  loading?: boolean;
  itemLabel: string;
  /** Such-/Filterwechsel → Seite 1 (wie in App-Modulen). */
  resetPageKey?: string;
  classNameAbove?: string;
  classNameBelow?: string;
  /** Tabellen-Vollbild (Standard: an). */
  tableFullscreen?: boolean;
  /** Titel im Vollbild-Overlay — Standard: `itemLabel`. */
  fullscreenTitle?: string;
};

export function SuperadminPaginatedDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  loading = false,
  itemLabel,
  resetPageKey = "",
  classNameAbove,
  classNameBelow,
  tableFullscreen = true,
  fullscreenTitle,
}: SuperadminPaginatedDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SuperadminSortDir>("asc");

  useEffect(() => {
    setPage(1);
  }, [resetPageKey]);

  const sortedRows = useMemo(
    () => sortSuperadminRows(rows, columns, sortKey, sortDir),
    [rows, columns, sortKey, sortDir],
  );

  const totalCount = sortedRows.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return sortedRows.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [sortedRows, currentPage]);

  const toggleSort = (id: string) => {
    if (sortKey !== id) {
      setSortKey(id);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const overlayLabel = fullscreenTitle?.trim() || itemLabel.trim() || "Tabelle";
  const summaryText =
    formatListPageSummary({
      shown: paginatedRows.length,
      totalCount,
      itemLabel,
      page: currentPage,
      totalPages,
    }) ?? undefined;

  const tableProps = {
    loading,
    rows: paginatedRows,
    rowKey,
    emptyMessage,
    columns,
    sortKey,
    sortDir,
    onToggleSort: toggleSort,
  };

  return (
    <SuperadminTableFullscreenSurround
      page={currentPage}
      totalPages={totalPages}
      shown={paginatedRows.length}
      totalCount={totalCount}
      itemLabel={itemLabel}
      canPrevious={currentPage > 1}
      canNext={currentPage < totalPages}
      busy={loading}
      onPrevious={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      overlayLabel={overlayLabel}
      summaryText={summaryText}
      classNameAbove={classNameAbove}
      classNameBelow={classNameBelow}
      tableFullscreen={tableFullscreen}
      fullscreenChildren={<SuperadminDataTable {...tableProps} embedded />}
    >
      <SuperadminDataTable {...tableProps} />
    </SuperadminTableFullscreenSurround>
  );
}
