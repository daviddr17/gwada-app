"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import type { RestaurantStaffRow } from "@/lib/types/staff";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import { cn } from "@/lib/utils";
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

type StaffSortKey =
  | "lastName"
  | "firstName"
  | "position"
  | "contact"
  | "status"
  | "app"
  | "createdAt";

type SortDir = "asc" | "desc";

const createdFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatStaffCreatedAt(iso: string): string {
  try {
    return createdFmt.format(new Date(iso));
  } catch {
    return "—";
  }
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: StaffSortKey;
  activeKey: StaffSortKey;
  dir: SortDir;
  onSort: (key: StaffSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      className={cn(moduleDataTableHeadSortButtonCn(active), "uppercase tracking-wide", className)}
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

type StaffOverviewTableProps = {
  rows: RestaurantStaffRow[];
  workingIds: Set<string>;
  breakIds: Set<string>;
  onEdit: (row: RestaurantStaffRow) => void;
};

export function StaffOverviewTable({
  rows,
  workingIds,
  breakIds,
  onEdit,
}: StaffOverviewTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<StaffSortKey>("lastName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: StaffSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    let list = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.family_name,
          r.given_name,
          r.email ?? "",
          r.phone ?? "",
          r.position_tag?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "lastName":
          return a.family_name.localeCompare(b.family_name, "de") * dir;
        case "firstName":
          return a.given_name.localeCompare(b.given_name, "de") * dir;
        case "position":
          return (a.position_tag?.name ?? "").localeCompare(
            b.position_tag?.name ?? "",
            "de",
          ) * dir;
        case "contact": {
          const ca = a.email ?? a.phone ?? "";
          const cb = b.email ?? b.phone ?? "";
          return ca.localeCompare(cb, "de") * dir;
        }
        case "status":
          return (Number(a.is_active) - Number(b.is_active)) * dir;
        case "app":
          return (
            (Number(Boolean(a.profile_id)) - Number(Boolean(b.profile_id))) *
            dir
          );
        case "createdAt":
          return (
            (new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()) *
            dir
          );
        default:
          return 0;
      }
    });
    return list;
  }, [rows, search, sortKey, sortDir]);

  const totalCount = filteredSorted.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredSorted.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredSorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <>
      <div className="border-b border-border/50 px-4 py-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nachname, Vorname, E-Mail, Telefon, Position …"
            className="h-10 rounded-xl pl-9"
            aria-label="Mitarbeiter durchsuchen"
          />
        </div>
      </div>
      <ModulePaginatedDataTable
        page={currentPage}
        totalPages={totalPages}
        shown={paginatedRows.length}
        totalCount={totalCount}
        itemLabel="Mitarbeiter"
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      >
          <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className={moduleDataTableHeadRowClassName}>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[7rem]")}>
                <SortHeader
                  label="Nachname"
                  sortKey="lastName"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[7rem]")}>
                <SortHeader
                  label="Vorname"
                  sortKey="firstName"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}>
                <SortHeader
                  label="Position"
                  sortKey="position"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[9rem]")}>
                <SortHeader
                  label="Kontakt"
                  sortKey="contact"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[6rem]")}>
                <SortHeader
                  label="Status"
                  sortKey="status"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[5rem]")}>
                <SortHeader
                  label="App"
                  sortKey="app"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[6.5rem]")}>
                <SortHeader
                  label="Angelegt"
                  sortKey="createdAt"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <ModuleTableIconActionsColumnHeader />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => {
              const tag = row.position_tag;
              const presence = breakIds.has(row.id)
                ? "Pause"
                : workingIds.has(row.id)
                  ? "Aktiv"
                  : null;
              return (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/30"
                  onClick={() => onEdit(row)}
                >
                  <td className="px-4 py-3 font-medium">{row.family_name}</td>
                  <td className="px-4 py-3">{row.given_name}</td>
                  <td className="px-4 py-3">
                    {tag ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className="size-2.5 rounded-full border border-border/50"
                          style={{ backgroundColor: tag.background_color }}
                          aria-hidden
                        />
                        {tag.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[12rem] px-4 py-3 text-muted-foreground">
                    <TableCellTruncateTooltip text={row.email ?? row.phone ?? "—"} />
                  </td>
                  <td className="px-4 py-3">
                    {row.is_active ? (
                      <Badge variant="secondary">Aktiv</Badge>
                    ) : (
                      <Badge variant="outline">Inaktiv</Badge>
                    )}
                    {presence ? (
                      <Badge className="ml-1" variant="default">
                        {presence}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.profile_id
                      ? formatLinkedProfileLabel(row.linked_profile)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatStaffCreatedAt(row.created_at)}
                  </td>
                  <ModuleTableActionsCell>
                    <ModuleTableIconActionButton
                      label="Bearbeiten"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(row);
                      }}
                    >
                      <Pencil className="size-4" />
                    </ModuleTableIconActionButton>
                  </ModuleTableActionsCell>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredSorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Noch keine Mitarbeiter angelegt."
              : "Keine Treffer für die Suche."}
          </p>
        ) : null}
      </ModulePaginatedDataTable>
    </>
  );
}
