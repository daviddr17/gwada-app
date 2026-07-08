"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  countStaffOverviewActiveFilters,
  StaffOverviewFilterDrawer,
  STAFF_OVERVIEW_FILTER_DEFAULTS,
  type StaffOverviewFilterState,
} from "@/components/staff/staff-overview-filter-drawer";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffEmploymentTypeDefinition,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";
import { StaffLastLoginCell } from "@/components/staff/staff-last-login-cell";
import {
  formatStaffLastLogin,
  resolveStaffLastLogin,
  staffLastLoginIso,
} from "@/lib/staff/staff-last-login";
import { formatLinkedProfileLabel } from "@/lib/staff/format-linked-profile-label";
import {
  staffPresenceStatusForRow,
  STAFF_PRESENCE_STATUS_LABELS,
} from "@/lib/staff/staff-presence-labels";
import { findStaffContractForDay } from "@/lib/staff/staff-day-wage";
import { formatRestaurantPositionLabel } from "@/lib/restaurant/format-restaurant-position-label";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/types/employee-role";
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
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";

type StaffSortKey =
  | "lastName"
  | "firstName"
  | "position"
  | "role"
  | "contact"
  | "status"
  | "presence"
  | "lastLogin"
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

function applyStaffOverviewFilters(
  rows: RestaurantStaffRow[],
  filters: StaffOverviewFilterState,
  workingIds: Set<string>,
  breakIds: Set<string>,
  contracts: RestaurantStaffContractRow[],
  dayDate: string,
  search: string,
): RestaurantStaffRow[] {
  let list = [...rows];

  if (filters.statusFilter === "active") {
    list = list.filter((r) => r.is_active);
  } else if (filters.statusFilter === "inactive") {
    list = list.filter((r) => !r.is_active);
  }

  if (filters.positionFilter === "__none__") {
    list = list.filter((r) => !r.position_tag_id);
  } else if (filters.positionFilter !== "all") {
    list = list.filter((r) => r.position_tag_id === filters.positionFilter);
  }

  if (filters.appFilter === "linked") {
    list = list.filter((r) => Boolean(r.profile_id));
  } else if (filters.appFilter === "unlinked") {
    list = list.filter((r) => !r.profile_id);
  }

  if (filters.presenceFilter === "working") {
    list = list.filter((r) => workingIds.has(r.id));
  } else if (filters.presenceFilter === "on_break") {
    list = list.filter((r) => breakIds.has(r.id));
  } else if (filters.presenceFilter === "off") {
    list = list.filter((r) => !workingIds.has(r.id) && !breakIds.has(r.id));
  }

  if (filters.roleFilter === "__none__") {
    list = list.filter((r) => !r.restaurant_position_id);
  } else if (filters.roleFilter !== "all") {
    list = list.filter((r) => r.restaurant_position_id === filters.roleFilter);
  }

  if (filters.employmentFilter !== "all") {
    list = list.filter((r) => {
      const contract = findStaffContractForDay(contracts, r.id, dayDate);
      if (filters.employmentFilter === "__none__") {
        return !contract?.employment_type_id;
      }
      return contract?.employment_type_id === filters.employmentFilter;
    });
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((r) => {
      const hay = [
        r.family_name,
        r.given_name,
        r.email ?? "",
        r.phone ?? "",
        r.position_tag?.name ?? "",
        r.restaurant_position?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return list;
}

function staffRoleSortKey(row: RestaurantStaffRow): string {
  const position =
    row.restaurant_position ?? row.linked_employee?.restaurant_position;
  if (position) return formatRestaurantPositionLabel(position);
  const role = row.linked_employee?.role;
  if (!role) return "";
  return EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

function staffRoleDisplay(row: RestaurantStaffRow): {
  label: string;
  color?: string;
} | null {
  const position =
    row.restaurant_position ?? row.linked_employee?.restaurant_position;
  if (position) {
    return {
      label: formatRestaurantPositionLabel(position),
      color: normalizeRestaurantPositionColor(undefined, position.id),
    };
  }
  const role = row.linked_employee?.role;
  if (!role) return null;
  return {
    label: EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role,
  };
}

function presenceSortRank(
  staffId: string,
  workingIds: Set<string>,
  breakIds: Set<string>,
): number {
  if (breakIds.has(staffId)) return 2;
  if (workingIds.has(staffId)) return 1;
  return 0;
}

type StaffOverviewTableProps = {
  rows: RestaurantStaffRow[];
  workingIds: Set<string>;
  breakIds: Set<string>;
  lastDisplayLoginByStaffId: Map<string, string>;
  positionTags: StaffPositionTagDefinition[];
  contracts: RestaurantStaffContractRow[];
  employmentTypes: StaffEmploymentTypeDefinition[];
  dayDate: string;
  onEdit: (row: RestaurantStaffRow) => void;
};

export function StaffOverviewTable({
  rows,
  workingIds,
  breakIds,
  lastDisplayLoginByStaffId,
  positionTags,
  contracts,
  employmentTypes,
  dayDate,
  onEdit,
}: StaffOverviewTableProps) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StaffOverviewFilterState>(
    STAFF_OVERVIEW_FILTER_DEFAULTS,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<StaffSortKey>("lastName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const roleOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.restaurant_position) {
        byId.set(row.restaurant_position.id, row.restaurant_position.name);
      }
    }
    const options = [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
    return [
      { value: "all", label: "Alle Rollen" },
      ...options,
      { value: "__none__", label: "Ohne Rolle" },
    ];
  }, [rows]);

  const toggleSort = (key: StaffSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const filteredSorted = useMemo(() => {
    const list = applyStaffOverviewFilters(
      rows,
      filters,
      workingIds,
      breakIds,
      contracts,
      dayDate,
      search,
    );

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
        case "role":
          return staffRoleSortKey(a).localeCompare(staffRoleSortKey(b), "de") * dir;
        case "contact": {
          const ca = a.email ?? a.phone ?? "";
          const cb = b.email ?? b.phone ?? "";
          return ca.localeCompare(cb, "de") * dir;
        }
        case "status":
          return (Number(a.is_active) - Number(b.is_active)) * dir;
        case "presence":
          return (
            (presenceSortRank(a.id, workingIds, breakIds) -
              presenceSortRank(b.id, workingIds, breakIds)) *
            dir
          );
        case "lastLogin": {
          const la = staffLastLoginIso(a, lastDisplayLoginByStaffId.get(a.id));
          const lb = staffLastLoginIso(b, lastDisplayLoginByStaffId.get(b.id));
          if (!la && !lb) return 0;
          if (!la) return 1;
          if (!lb) return -1;
          return (new Date(la).getTime() - new Date(lb).getTime()) * dir;
        }
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
  }, [
    rows,
    search,
    filters,
    sortKey,
    sortDir,
    workingIds,
    breakIds,
    lastDisplayLoginByStaffId,
    contracts,
    dayDate,
  ]);

  const activeFilterCount = countStaffOverviewActiveFilters(filters);

  const totalCount = filteredSorted.length;
  const totalPages = totalPagesFromCount(totalCount, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);

  const paginatedRows = useMemo(() => {
    const from = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredSorted.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredSorted, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const emptyMessage = useMemo(() => {
    if (rows.length === 0) return "Noch keine Mitarbeiter angelegt.";
    if (search.trim()) return "Keine Treffer für die Suche.";
    if (activeFilterCount > 0) return "Keine Mitarbeiter für die aktiven Filter.";
    return "Keine Mitarbeiter.";
  }, [rows.length, search, activeFilterCount]);

  const tableExport = useMemo(
    () => ({
      documentTitle: "Mitarbeiter",
      filenamePrefix: "mitarbeiter",
      headers: [
        "Nachname",
        "Vorname",
        "Position",
        "Rolle",
        "Kontakt",
        "Status",
        "Anwesenheit",
        "Letzter Login",
        "App",
        "Angelegt",
      ],
      rows: filteredSorted.map((row) => {
        const role = staffRoleDisplay(row);
        const presenceStatus = staffPresenceStatusForRow(
          row.id,
          workingIds,
          breakIds,
        );
        const lastLogin = resolveStaffLastLogin(
          row,
          lastDisplayLoginByStaffId.get(row.id),
        );
        return [
          row.family_name,
          row.given_name,
          row.position_tag?.name ?? "—",
          role?.label ?? "—",
          row.email ?? row.phone ?? "—",
          row.is_active ? "Aktiv" : "Inaktiv",
          presenceStatus === "off"
            ? "—"
            : STAFF_PRESENCE_STATUS_LABELS[presenceStatus],
          lastLogin ? formatStaffLastLogin(lastLogin.iso) : "—",
          row.profile_id
            ? formatLinkedProfileLabel(row.linked_profile)
            : "—",
          formatStaffCreatedAt(row.created_at),
        ];
      }),
      summaryLine: `${filteredSorted.length} Mitarbeiter`,
      orientation: "landscape" as const,
    }),
    [filteredSorted, workingIds, breakIds, lastDisplayLoginByStaffId],
  );

  return (
    <>
      <div className={cn("mb-4", moduleSearchFilterRowClassName)}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nachname, Vorname, E-Mail, Telefon, Position …"
            className={moduleSearchInputClassName}
            aria-label="Mitarbeiter durchsuchen"
          />
        </div>
        <div className={moduleSearchFilterButtonWrapClassName}>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={moduleSearchFilterButtonClassName}
            aria-label="Filter"
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="size-4" />
          </Button>
          {activeFilterCount > 0 ? (
            <Badge
              variant="secondary"
              className={moduleSearchFilterActiveBadgeClassName}
            >
              {activeFilterCount}
            </Badge>
          ) : null}
        </div>
      </div>

      <StaffOverviewFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onFiltersChange={(patch) => {
          setFilters((prev) => ({ ...prev, ...patch }));
          setPage(1);
        }}
        positionTags={positionTags}
        roleOptions={roleOptions}
        employmentTypes={employmentTypes}
      />

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
        tableExport={tableExport}
      >
        <table className="w-full min-w-[72rem] text-left text-sm">
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
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[7rem]")}>
                <SortHeader
                  label="Rolle"
                  sortKey="role"
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
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[6.5rem]")}>
                <SortHeader
                  label="Anwesenheit"
                  sortKey="presence"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                />
              </th>
              <th className={cn(moduleDataTableHeadCellClassName, "min-w-[8rem]")}>
                <SortHeader
                  label="Letzter Login"
                  sortKey="lastLogin"
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
              const role = staffRoleDisplay(row);
              const presenceStatus = staffPresenceStatusForRow(
                row.id,
                workingIds,
                breakIds,
              );
              const presenceLabel = STAFF_PRESENCE_STATUS_LABELS[presenceStatus];
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
                  <td className="px-4 py-3">
                    {role ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {role.color ? (
                          <TagColorStripe
                            color={role.color}
                            className="mr-0 h-4 shrink-0"
                          />
                        ) : null}
                        {role.label}
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
                  </td>
                  <td className="px-4 py-3">
                    {presenceStatus === "off" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={
                          presenceStatus === "on_break" ? "outline" : "default"
                        }
                      >
                        {presenceLabel}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StaffLastLoginCell
                      row={row}
                      lastDisplayActivityAt={lastDisplayLoginByStaffId.get(
                        row.id,
                      )}
                    />
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
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : null}
      </ModulePaginatedDataTable>
    </>
  );
}
