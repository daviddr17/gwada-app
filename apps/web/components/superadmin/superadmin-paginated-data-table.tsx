"use client";

import { useEffect, useMemo, useState } from "react";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
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

  return (
    <ListPaginationSurround
      classNameAbove={classNameAbove}
      classNameBelow={classNameBelow}
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
    >
      <SuperadminDataTable
        loading={loading}
        rows={paginatedRows}
        rowKey={rowKey}
        emptyMessage={emptyMessage}
        columns={columns}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
      />
    </ListPaginationSurround>
  );
}
