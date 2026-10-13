"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  GuidesFilterDrawer,
  countGuidesActiveFilters,
  type GuidesActiveFilter,
} from "@/components/guides/guides-filter-drawer";
import { GuideFormDrawer } from "@/components/guides/guide-form-drawer";
import { GuidesTableSkeleton } from "@/components/guides/guides-skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  hasModuleCreate,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  fetchGuidesForRestaurant,
  setGuideActive,
} from "@/lib/supabase/guides-db";
import type { RestaurantGuideRow } from "@/lib/types/guides";
import { moduleDataTableHeadRowClassName } from "@/lib/ui/module-data-table";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import {
  ModuleTableActionsCell,
  ModuleTableIconActionButton,
  ModuleTableIconActionsColumnHeader,
} from "@/lib/ui/module-table-icon-tooltip";
import { ModuleTableStickyBodyCell } from "@/lib/ui/module-table-sticky-column";
import { ModuleTableStaticColumnHeader } from "@/lib/ui/module-table-sort-header";

export function GuidesScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "guides");
  const canCreate = hasModuleCreate(has, "guides");
  const canUpdate = hasModuleUpdate(has, "guides");

  const [guides, setGuides] = useState<RestaurantGuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<GuidesActiveFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantGuideRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showSkeleton = useDeferredSkeleton(
    (loading || permissionsLoading) && guides.length === 0,
  );

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const result = await fetchGuidesForRestaurant(restaurantId);
    if (result.error) {
      toast.error(result.error);
      setGuides([]);
    } else {
      setGuides(result.data);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!ready || !restaurantId || !canRead) return;
    void load();
  }, [ready, restaurantId, canRead, load]);

  const activeFilterCount = countGuidesActiveFilters({ filterActive });

  const filtered = useMemo(() => {
    let rows = guides;
    if (filterActive === "active") {
      rows = rows.filter((g) => g.is_active);
    } else if (filterActive === "inactive") {
      rows = rows.filter((g) => !g.is_active);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          (g.short_description ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [guides, filterActive, search]);

  useEffect(() => {
    setPage(1);
  }, [search, filterActive]);

  const totalPages = totalPagesFromCount(filtered.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filtered.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [filtered, currentPage]);

  async function handleToggleActive(guide: RestaurantGuideRow, next: boolean) {
    if (!restaurantId || !canUpdate) return;
    const prev = guide.is_active;
    setGuides((rows) =>
      rows.map((g) => (g.id === guide.id ? { ...g, is_active: next } : g)),
    );
    setTogglingId(guide.id);
    const { error } = await setGuideActive(restaurantId, guide.id, next);
    setTogglingId(null);
    if (error) {
      setGuides((rows) =>
        rows.map((g) => (g.id === guide.id ? { ...g, is_active: prev } : g)),
      );
      toast.error(error);
    }
  }

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }
  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Anleitungen" />;
  }

  return (
    <div className="space-y-4">
      <div className={moduleSearchFilterRowClassName}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Anleitungen suchen…"
            className={moduleSearchInputClassName}
          />
        </div>
        <div className={moduleSearchFilterButtonWrapClassName}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={moduleSearchFilterButtonClassName}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter"
          >
            <Filter className="size-4" />
          </Button>
          {activeFilterCount > 0 ? (
            <Badge className={moduleSearchFilterActiveBadgeClassName}>
              {activeFilterCount}
            </Badge>
          ) : null}
        </div>
      </div>

      {canCreate ? (
        <Button
          type="button"
          size="lg"
          className={modulePrimaryAddButtonFullWidthClassName}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Anleitung anlegen
        </Button>
      ) : null}

      {showSkeleton ? (
        <GuidesTableSkeleton />
      ) : (
        <ModulePaginatedDataTable
          shown={paginated.length}
          totalCount={filtered.length}
          itemLabel="Anleitungen"
          page={currentPage}
          totalPages={totalPages}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className={moduleDataTableHeadRowClassName}>
                <ModuleTableStaticColumnHeader
                  label="Titel"
                  stickyIdentityColumn
                />
                <ModuleTableStaticColumnHeader
                  label="Beschreibung"
                  className="hidden sm:table-cell"
                />
                <ModuleTableStaticColumnHeader label="Schritte" />
                <ModuleTableStaticColumnHeader label="Aktiv" />
                <ModuleTableIconActionsColumnHeader />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Keine Anleitungen gefunden.
                  </td>
                </tr>
              ) : (
                paginated.map((guide) => (
                  <tr
                    key={guide.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <ModuleTableStickyBodyCell>
                      <TableCellTruncateTooltip text={guide.title} />
                    </ModuleTableStickyBodyCell>
                    <td className="hidden max-w-[14rem] px-4 py-3 sm:table-cell">
                      <TableCellTruncateTooltip
                        text={guide.short_description?.trim() || "—"}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {guide.steps?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={guide.is_active}
                        disabled={!canUpdate || togglingId === guide.id}
                        onCheckedChange={(next) =>
                          void handleToggleActive(guide, next)
                        }
                        aria-label={`${guide.title} aktiv`}
                      />
                    </td>
                    <ModuleTableActionsCell>
                      {canUpdate ? (
                        <ModuleTableIconActionButton
                          label="Bearbeiten"
                          onClick={() => {
                            setEditing(guide);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </ModuleTableIconActionButton>
                      ) : null}
                    </ModuleTableActionsCell>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ModulePaginatedDataTable>
      )}

      <GuidesFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filterActive={filterActive}
        onFilterActiveChange={setFilterActive}
      />

      <GuideFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        restaurantId={restaurantId}
        guide={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
