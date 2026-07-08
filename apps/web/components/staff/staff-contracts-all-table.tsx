"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { StaffContractStatusBadge } from "@/components/staff/staff-contract-status-badge";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import {
  formatStaffContractDateDe,
  formatStaffContractEndDe,
} from "@/lib/staff/staff-contract-period";
import { formatStaffContractPaySummary } from "@/lib/staff/staff-contract-pay";
import {
  staffContractBadgeKind,
  type StaffContractBadgeKind,
} from "@/lib/staff/staff-contract-status";
import { staffEmploymentTypeLabel } from "@/lib/staff/staff-employment-type-label";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowClassName,
  moduleDataTableHeadSortButtonCn,
} from "@/lib/ui/module-data-table";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { cn } from "@/lib/utils";

type SortKey = "staff" | "valid_from" | "valid_to" | "status" | "pay";
type SortDir = "asc" | "desc";

const STAFF_CONTRACT_STATUS_LABELS: Record<StaffContractBadgeKind, string> = {
  pending_employee: "Wartet auf MA",
  signed: "Unterschrieben",
  draft: "Entwurf",
  external_draft: "Extern · Entwurf",
  external_open: "Extern · offen",
  external_signed: "Extern · unterschrieben",
};

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

function staffNameForContract(
  staffList: readonly RestaurantStaffRow[],
  staffId: string,
): string {
  const row = staffList.find((s) => s.id === staffId);
  return row ? staffFamilyFirstDisplayName(row) : "—";
}

type StaffContractsAllTableProps = {
  contracts: readonly RestaurantStaffContractRow[];
  staffList: readonly RestaurantStaffRow[];
  employmentTypes: readonly StaffEmploymentTypeDefinition[];
  onSelectContract: (contract: RestaurantStaffContractRow) => void;
};

export function StaffContractsAllTable({
  contracts,
  staffList,
  employmentTypes,
  onSelectContract,
}: StaffContractsAllTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valid_from");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...contracts];
    if (q) {
      list = list.filter((c) => {
        const employment = staffEmploymentTypeLabel(c, employmentTypes);
        const hay = [
          staffNameForContract(staffList, c.staff_id),
          formatStaffContractDateDe(c.valid_from),
          formatStaffContractEndDe(c.valid_to),
          formatStaffContractPaySummary(c),
          employment ?? "",
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
            staffNameForContract(staffList, a.staff_id).localeCompare(
              staffNameForContract(staffList, b.staff_id),
              "de",
            ) * dirMul
          );
        case "valid_from":
          return a.valid_from.localeCompare(b.valid_from) * dirMul;
        case "valid_to": {
          const av = a.valid_to ?? "9999-12-31";
          const bv = b.valid_to ?? "9999-12-31";
          return av.localeCompare(bv) * dirMul;
        }
        case "pay":
          return (
            formatStaffContractPaySummary(a).localeCompare(
              formatStaffContractPaySummary(b),
              "de",
            ) * dirMul
          );
        case "status":
        default:
          return a.valid_from.localeCompare(b.valid_from) * dirMul;
      }
    });
    return list;
  }, [contracts, employmentTypes, search, sortDir, sortKey, staffList]);

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
      setSortDir(key === "valid_from" ? "desc" : "asc");
    }
  };

  const tableExport = useMemo(
    () => ({
      documentTitle: "Verträge",
      filenamePrefix: "mitarbeiter-vertraege",
      headers: [
        "Mitarbeiter",
        "Start",
        "Ende",
        "Status",
        "Vergütung",
        "Beschäftigung",
      ],
      rows: filtered.map((c) => [
        staffNameForContract(staffList, c.staff_id),
        formatStaffContractDateDe(c.valid_from),
        formatStaffContractEndDe(c.valid_to),
        STAFF_CONTRACT_STATUS_LABELS[staffContractBadgeKind(c)],
        formatStaffContractPaySummary(c),
        staffEmploymentTypeLabel(c, employmentTypes) ?? "—",
      ]),
      summaryLine: `${filtered.length} Vertrag${filtered.length === 1 ? "" : "e"}`,
      orientation: "landscape" as const,
    }),
    [filtered, staffList, employmentTypes],
  );

  return (
    <div className="space-y-4">
      <div className={moduleSearchFilterRowClassName}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Verträge suchen …"
            className={moduleSearchInputClassName}
            aria-label="Verträge suchen"
          />
        </div>
      </div>

      <ModulePaginatedDataTable
        shown={paginated.length}
        totalCount={filtered.length}
        itemLabel="Verträge"
        page={currentPage}
        totalPages={totalPages}
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        tableExport={tableExport}
      >
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className={moduleDataTableHeadRowClassName}>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[9rem]")}>
                <SortHeader
                  label="Mitarbeiter"
                  sortKey="staff"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[6rem]")}>
                <SortHeader
                  label="Start"
                  sortKey="valid_from"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[6rem]")}>
                <SortHeader
                  label="Ende"
                  sortKey="valid_to"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}>
                Status
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}>
                <SortHeader
                  label="Vergütung"
                  sortKey="pay"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}>
                Beschäftigung
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {search.trim()
                    ? "Keine Verträge zum Suchbegriff."
                    : "Noch keine Verträge angelegt."}
                </td>
              </tr>
            ) : (
              paginated.map((c) => {
                const employmentLabel = staffEmploymentTypeLabel(
                  c,
                  employmentTypes,
                );
                return (
                  <tr
                    key={c.id}
                    className="group/tr cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
                    onClick={() => onSelectContract(c)}
                  >
                    <td className="px-4 py-3">
                      <TableCellTruncateTooltip
                        text={staffNameForContract(staffList, c.staff_id)}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatStaffContractDateDe(c.valid_from)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatStaffContractEndDe(c.valid_to)}
                    </td>
                    <td className="px-4 py-3">
                      <StaffContractStatusBadge contract={c} />
                    </td>
                    <td className="px-4 py-3">
                      <TableCellTruncateTooltip
                        text={formatStaffContractPaySummary(c)}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <TableCellTruncateTooltip
                        text={employmentLabel ?? "—"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ModulePaginatedDataTable>
    </div>
  );
}
