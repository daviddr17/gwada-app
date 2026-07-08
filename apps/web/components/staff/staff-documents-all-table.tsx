"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StaffDocumentPdfPreviewDialog } from "@/components/staff/staff-document-pdf-preview-dialog";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import {
  downloadStaffDocument,
  formatStaffDocumentMeta,
  type StaffDocumentListItem,
} from "@/lib/staff/staff-documents-api";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowClassName,
  moduleDataTableHeadSortButtonCn,
} from "@/lib/ui/module-data-table";
import {
  ModuleTableActionsCell,
  ModuleTableIconActionButton,
  ModuleTableIconActionsColumnHeader,
} from "@/lib/ui/module-table-icon-tooltip";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

type SortKey = "staff" | "title" | "created_at";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      className={cn(
        moduleDataTableHeadSortButtonCn(active),
        "uppercase tracking-wide",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        <span className="text-foreground normal-case" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
}

function staffNameForDocument(
  staffList: readonly RestaurantStaffRow[],
  staffId: string | null,
): string {
  if (!staffId) return "—";
  const row = staffList.find((s) => s.id === staffId);
  return row ? staffFamilyFirstDisplayName(row) : "—";
}

type StaffDocumentsAllTableProps = {
  restaurantId: string;
  documents: readonly StaffDocumentListItem[];
  staffList: readonly RestaurantStaffRow[];
  onSelectStaff?: (staffId: string) => void;
};

export function StaffDocumentsAllTable({
  restaurantId,
  documents,
  staffList,
  onSelectStaff,
}: StaffDocumentsAllTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<StaffDocumentListItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...documents];
    if (q) {
      list = list.filter((doc) => {
        const hay = [
          staffNameForDocument(staffList, doc.staff_id),
          doc.title,
          doc.file_name,
          formatStaffDocumentMeta(doc),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const dirMul = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "staff":
          return (
            staffNameForDocument(staffList, a.staff_id).localeCompare(
              staffNameForDocument(staffList, b.staff_id),
              "de",
            ) * dirMul
          );
        case "title":
          return a.title.localeCompare(b.title, "de") * dirMul;
        case "created_at":
        default:
          return a.created_at.localeCompare(b.created_at) * dirMul;
      }
    });
    return list;
  }, [documents, search, sortDir, sortKey, staffList]);

  const totalPages = totalPagesFromCount(filtered.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filtered.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [currentPage, filtered]);

  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  };

  const tableExport = useMemo(
    () => ({
      documentTitle: "Mitarbeiter-Dokumente",
      filenamePrefix: "mitarbeiter-dokumente",
      headers: ["Mitarbeiter", "Titel", "Dateiname", "Hochgeladen"],
      rows: filtered.map((doc) => [
        staffNameForDocument(staffList, doc.staff_id),
        doc.title,
        doc.file_name,
        formatStaffDocumentMeta(doc),
      ]),
      summaryLine: `${filtered.length} Dokument${filtered.length === 1 ? "" : "e"}`,
      orientation: "landscape" as const,
    }),
    [filtered, staffList],
  );

  return (
    <>
      <div className="space-y-4">
        <div className={moduleSearchFilterRowClassName}>
          <div className={moduleSearchFieldWrapClassName}>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dokumente suchen …"
              className={moduleSearchInputClassName}
              aria-label="Dokumente suchen"
            />
          </div>
        </div>

        <ModulePaginatedDataTable
          shown={paginated.length}
          totalCount={filtered.length}
          itemLabel="Dokumente"
          page={currentPage}
          totalPages={totalPages}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          tableExport={tableExport}
        >
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowClassName}>
                <th
                  className={cn(moduleDataTableHeadCellClassName, "min-w-[9rem]")}
                >
                  <SortHeader
                    label="Mitarbeiter"
                    sortKey="staff"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th
                  className={cn(moduleDataTableHeadCellClassName, "min-w-[10rem]")}
                >
                  <SortHeader
                    label="Titel"
                    sortKey="title"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th
                  className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}
                >
                  <SortHeader
                    label="Hochgeladen"
                    sortKey="created_at"
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <ModuleTableIconActionsColumnHeader />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {search.trim()
                      ? "Keine Dokumente zum Suchbegriff."
                      : "Noch keine Mitarbeiter-Dokumente vorhanden."}
                  </td>
                </tr>
              ) : (
                paginated.map((doc) => (
                  <tr
                    key={doc.id}
                    className="group/tr cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
                    onClick={() => {
                      if (doc.staff_id) onSelectStaff?.(doc.staff_id);
                    }}
                  >
                    <td className="px-4 py-3">
                      <TableCellTruncateTooltip
                        text={staffNameForDocument(staffList, doc.staff_id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <TableCellTruncateTooltip text={doc.title} />
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {doc.file_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {formatStaffDocumentMeta(doc)}
                    </td>
                    <ModuleTableActionsCell>
                      {doc.mime_type === "application/pdf" ? (
                        <ModuleTableIconActionButton
                          label="Vorschau"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreview(doc);
                          }}
                        >
                          <Eye className="size-4" />
                        </ModuleTableIconActionButton>
                      ) : null}
                      <ModuleTableIconActionButton
                        label="Download"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadStaffDocument({
                            restaurantId,
                            documentId: doc.id,
                          });
                        }}
                      >
                        <Download className="size-4" />
                      </ModuleTableIconActionButton>
                    </ModuleTableActionsCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      </div>

      {preview ? (
        <StaffDocumentPdfPreviewDialog
          open={preview !== null}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
          restaurantId={restaurantId}
          documentId={preview.id}
          title={preview.title}
        />
      ) : null}
    </>
  );
}
