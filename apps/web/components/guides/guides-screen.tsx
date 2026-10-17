"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { CategoriesManageDrawer } from "@/components/menu/categories-manage-drawer";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  GuidesFilterDrawer,
  countGuidesActiveFilters,
  type GuidesActiveFilter,
  type GuidesCategoryFilter,
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
  hasModuleDelete,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  deleteGuideCategory,
  fetchGuideCategoriesForRestaurant,
  fetchGuidesForRestaurant,
  reorderGuideCategories,
  setGuideActive,
  upsertGuideCategory,
} from "@/lib/supabase/guides-db";
import type {
  RestaurantGuideCategoryRow,
  RestaurantGuideRow,
} from "@/lib/types/guides";
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
  const canDelete = hasModuleDelete(has, "guides");

  const [guides, setGuides] = useState<RestaurantGuideRow[]>([]);
  const [categories, setCategories] = useState<RestaurantGuideCategoryRow[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<GuidesActiveFilter>("all");
  const [filterCategory, setFilterCategory] =
    useState<GuidesCategoryFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantGuideRow | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<RestaurantGuideCategoryRow | null>(null);

  const showSkeleton = useDeferredSkeleton(
    (loading || permissionsLoading) && guides.length === 0,
  );

  const loadCategories = useCallback(async () => {
    if (!restaurantId) return;
    const result = await fetchGuideCategoriesForRestaurant(restaurantId, {
      includeInactive: true,
    });
    if (result.error) {
      toast.error(result.error);
      setCategories([]);
    } else {
      setCategories(result.data);
    }
  }, [restaurantId]);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [guidesResult] = await Promise.all([
      fetchGuidesForRestaurant(restaurantId),
      loadCategories(),
    ]);
    if (guidesResult.error) {
      toast.error(guidesResult.error);
      setGuides([]);
    } else {
      setGuides(guidesResult.data);
    }
    setLoading(false);
  }, [restaurantId, loadCategories]);

  useEffect(() => {
    if (!ready || !restaurantId || !canRead) return;
    void load();
  }, [ready, restaurantId, canRead, load]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.id, c.name);
    return map;
  }, [categories]);

  const activeFilterCount = countGuidesActiveFilters({
    filterActive,
    filterCategory,
  });

  const filtered = useMemo(() => {
    let rows = guides;
    if (filterActive === "active") {
      rows = rows.filter((g) => g.is_active);
    } else if (filterActive === "inactive") {
      rows = rows.filter((g) => !g.is_active);
    }
    if (filterCategory === "none") {
      rows = rows.filter((g) => !g.category_id);
    } else if (filterCategory !== "all") {
      rows = rows.filter((g) => g.category_id === filterCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          (g.short_description ?? "").toLowerCase().includes(q) ||
          (g.category_id
            ? (categoryNameById.get(g.category_id) ?? "").toLowerCase().includes(q)
            : false),
      );
    }
    return rows;
  }, [guides, filterActive, filterCategory, search, categoryNameById]);

  useEffect(() => {
    setPage(1);
  }, [search, filterActive, filterCategory]);

  const totalPages = totalPagesFromCount(filtered.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filtered.slice(start, start + LIST_PAGE_SIZE_DEFAULT);
  }, [filtered, currentPage]);

  const manageItems = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        active: c.is_active,
      })),
    [categories],
  );

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

      {canCreate || canUpdate ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setManageOpen(true)}
          >
            Kategorien
          </Button>
        </div>
      ) : null}

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
                  label="Kategorie"
                  className="hidden sm:table-cell"
                />
                <ModuleTableStaticColumnHeader
                  label="Beschreibung"
                  className="hidden md:table-cell"
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
                    colSpan={6}
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
                    <td className="hidden max-w-[10rem] px-4 py-3 sm:table-cell">
                      <TableCellTruncateTooltip
                        text={
                          guide.category_id
                            ? (categoryNameById.get(guide.category_id) ?? "—")
                            : "—"
                        }
                      />
                    </td>
                    <td className="hidden max-w-[14rem] px-4 py-3 md:table-cell">
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
        filterCategory={filterCategory}
        onFilterCategoryChange={setFilterCategory}
        categories={categories}
      />

      <GuideFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        restaurantId={restaurantId}
        guide={editing}
        categories={categories}
        onSaved={() => void load()}
      />

      <CategoriesManageDrawer
        open={manageOpen}
        onOpenChange={setManageOpen}
        categories={manageItems}
        copy={{
          title: "Anleitungs-Kategorien",
          description:
            "Reihenfolge per Ziehen ändern. Inaktive Kategorien stehen bei neuen Anleitungen nicht zur Auswahl.",
          newButton: "Neue Kategorie",
        }}
        onReorder={async (next) => {
          const { error } = await reorderGuideCategories(
            restaurantId,
            next.map((n) => n.id),
          );
          if (error) {
            toast.error(error);
            return;
          }
          await loadCategories();
        }}
        onEdit={(row) => {
          const found = categories.find((c) => c.id === row.id) ?? null;
          setEditingCategory(found);
          setCategoryFormOpen(true);
        }}
        onNew={() => {
          if (!canCreate) {
            toast.error("Keine Berechtigung zum Anlegen.");
            return;
          }
          setEditingCategory(null);
          setCategoryFormOpen(true);
        }}
      />

      <CategoryDrawer
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
        mode={editingCategory ? "edit" : "create"}
        initial={
          editingCategory
            ? {
                id: editingCategory.id,
                name: editingCategory.name,
                active: editingCategory.is_active,
              }
            : null
        }
        labels={{
          titleCreate: "Neue Kategorie",
          titleEdit: "Kategorie bearbeiten",
          description: "Name und Sichtbarkeit für Anleitungen.",
          namePlaceholder: "z. B. Küche",
          activeDescription:
            "Inaktive Kategorien stehen bei neuen Anleitungen nicht zur Auswahl.",
          deleteLabel: "Kategorie löschen",
          deleteConfirmTitle: "Kategorie wirklich löschen?",
        }}
        onSave={async (payload) => {
          if (payload.id) {
            if (!canUpdate) {
              toast.error("Keine Berechtigung zum Bearbeiten.");
              return;
            }
            const { error } = await upsertGuideCategory(
              restaurantId,
              {
                name: payload.name,
                is_active: payload.active !== false,
                sort_order:
                  categories.find((c) => c.id === payload.id)?.sort_order ?? 0,
              },
              payload.id,
            );
            if (error) {
              toast.error(error);
              return;
            }
          } else {
            if (!canCreate) {
              toast.error("Keine Berechtigung zum Anlegen.");
              return;
            }
            const { error } = await upsertGuideCategory(restaurantId, {
              name: payload.name,
              is_active: payload.active !== false,
            });
            if (error) {
              toast.error(error);
              return;
            }
          }
          toast.success("Kategorie gespeichert");
          await loadCategories();
        }}
        onDelete={
          editingCategory && canDelete
            ? async (id) => {
                const { error } = await deleteGuideCategory(restaurantId, id);
                if (error) {
                  toast.error(error);
                  return;
                }
                toast.success("Kategorie gelöscht");
                await loadCategories();
                await load();
              }
            : undefined
        }
      />
    </div>
  );
}
