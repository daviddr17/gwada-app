"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Pencil, Plus, Search, Check, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  StaffTodosFilterDrawer,
  countStaffTodosActiveFilters,
  type StaffTodosSortKey,
} from "@/components/staff/todos/staff-todos-filter-drawer";
import { StaffTodoFormDrawer } from "@/components/staff/todos/staff-todo-form-drawer";
import { StaffTodosProtocolDrawer } from "@/components/staff/todos/staff-todos-protocol-drawer";
import { StaffTodosTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import {
  fetchStaffTodosForRestaurant,
  staffTodoAssigneeLabel,
  completeStaffTodoForStaff,
  insertStaffTodoLogEntry,
} from "@/lib/supabase/staff-todos-db";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleCreate,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { RestaurantStaffTodoRow } from "@/lib/types/staff-todos";
import { STAFF_TODO_PRIORITY_LABELS } from "@/lib/types/staff-todos";
import {
  computeStaffTodoStatus,
  STAFF_TODO_STATUS_LABELS,
  staffTodoPriorityBadgeClass,
  staffTodoStatusBadgeClass,
} from "@/lib/staff/staff-todo-status";
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
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";
import type { RestaurantStaffRow } from "@/lib/types/staff";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StaffTodosScreen() {
  const searchParams = useSearchParams();
  const staffFilterFromUrl = searchParams.get("staff");

  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "staff_todos");
  const canCreate = hasModuleCreate(has, "staff_todos");
  const canUpdate = hasModuleUpdate(has, "staff_todos");

  const positionTagsStorage = useStaffPositionTagsStorage(restaurantId);
  const positionTags = positionTagsStorage.items;
  const [staffList, setStaffList] = useState<RestaurantStaffRow[]>([]);
  const [todos, setTodos] = useState<RestaurantStaffTodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [sortKey, setSortKey] = useState<StaffTodosSortKey>("priority");
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<RestaurantStaffTodoRow | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId || !canRead) {
      setTodos([]);
      setStaffList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [todoRes, staffRes] = await Promise.all([
      fetchStaffTodosForRestaurant(restaurantId),
      fetchStaffForRestaurant(restaurantId),
    ]);
    setLoading(false);
    if (todoRes.error) toast.error(todoRes.error);
    else setTodos(todoRes.data);
    if (staffRes.error) toast.error(staffRes.error);
    else setStaffList(staffRes.data);
  }, [restaurantId, canRead]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const staffById = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList],
  );

  const assigneeFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Alle Zuordnungen" }];
    for (const s of staffList.filter((x) => x.is_active)) {
      opts.push({
        value: `staff:${s.id}`,
        label: `MA: ${s.given_name} ${s.family_name ?? ""}`.trim(),
      });
    }
    for (const t of positionTags.filter((x) => x.active)) {
      opts.push({ value: `tag:${t.id}`, label: `Position: ${t.name}` });
    }
    return opts;
  }, [staffList, positionTags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = todos;

    if (staffFilterFromUrl) {
      const staff = staffById.get(staffFilterFromUrl);
      rows = rows.filter((t) => {
        if (t.staff_id === staffFilterFromUrl) return true;
        if (
          t.assignee_type === "position_tag" &&
          staff?.position_tag_id &&
          t.position_tag_id === staff.position_tag_id
        ) {
          return true;
        }
        return false;
      });
    }

    rows = rows.filter((t) => {
      const status = computeStaffTodoStatus(t, t.completions);
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterAssignee !== "all") {
        const [kind, id] = filterAssignee.split(":");
        if (kind === "staff" && !(t.assignee_type === "staff" && t.staff_id === id))
          return false;
        if (
          kind === "tag" &&
          !(t.assignee_type === "position_tag" && t.position_tag_id === id)
        )
          return false;
      }
      if (q) {
        const hay = [
          t.title,
          t.description ?? "",
          staffTodoAssigneeLabel(t),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...rows].sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title, "de");
      if (sortKey === "created") {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (sortKey === "due") {
        const au = a.display_until ? new Date(a.display_until).getTime() : Infinity;
        const bu = b.display_until ? new Date(b.display_until).getTime() : Infinity;
        return au - bu;
      }
      const pa = PRIORITY_ORDER[a.priority] ?? 9;
      const pb = PRIORITY_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title, "de");
    });

    return sorted;
  }, [
    todos,
    search,
    filterStatus,
    filterPriority,
    filterAssignee,
    sortKey,
    staffFilterFromUrl,
    staffById,
  ]);

  const totalPages = totalPagesFromCount(filtered.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT,
    currentPage * LIST_PAGE_SIZE_DEFAULT,
  );

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterPriority, filterAssignee, sortKey, staffFilterFromUrl]);

  const activeFilterCount = countStaffTodosActiveFilters({
    filterStatus,
    filterPriority,
    filterAssignee,
    sortKey,
  });

  const handleMarkDone = async (todo: RestaurantStaffTodoRow) => {
    if (!restaurantId || !canUpdate) return;
    let staffId = todo.staff_id;
    if (!staffId && todo.assignee_type === "position_tag" && todo.position_tag_id) {
      staffId =
        staffList.find(
          (s) => s.is_active && s.position_tag_id === todo.position_tag_id,
        )?.id ?? null;
    }
    if (!staffId) {
      toast.error("Kein Mitarbeiter für die Erledigung gefunden.");
      return;
    }
    const { error } = await completeStaffTodoForStaff(todo.id, staffId);
    if (error) {
      toast.error(error);
      return;
    }
    await insertStaffTodoLogEntry({
      restaurantId,
      todoId: todo.id,
      action: "completed_by_manager",
      details: { title: todo.title },
    });
    toast.success("ToDo als erledigt markiert.");
    void reload();
  };

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="ToDo-Listen" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full pb-16">
      {staffFilterFromUrl ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Gefiltert nach Mitarbeiter —{" "}
          {staffById.get(staffFilterFromUrl)
            ? `${staffById.get(staffFilterFromUrl)!.given_name} ${staffById.get(staffFilterFromUrl)!.family_name ?? ""}`.trim()
            : staffFilterFromUrl}
        </p>
      ) : null}

      <div className={cn("mb-4", moduleSearchFilterRowClassName)}>
        <div className={moduleSearchFieldWrapClassName}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ToDo suchen …"
            className={moduleSearchInputClassName}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className={moduleSearchFilterButtonClassName}
          onClick={() => setProtocolOpen(true)}
          aria-label="ToDo-Protokoll"
        >
          <ScrollText className="size-4" />
        </Button>
        <div className={moduleSearchFilterButtonWrapClassName}>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className={moduleSearchFilterButtonClassName}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter"
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

      {canCreate ? (
        <Button
          type="button"
          size="lg"
          className={cn("mb-4", modulePrimaryAddButtonFullWidthClassName)}
          onClick={() => {
            setEditTodo(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          ToDo anlegen
        </Button>
      ) : null}

      {loading && !showSkeleton ? (
        <div className="min-h-[20rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <StaffTodosTableSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {todos.length === 0
              ? "Noch keine ToDos — legen Sie die erste Aufgabe an."
              : "Keine Treffer für Suche oder Filter."}
          </CardContent>
        </Card>
      ) : (
        <ListPaginationSurround
          classNameAbove="px-0 pt-0"
          classNameBelow="px-0 pb-0"
          shown={paginated.length}
          totalCount={filtered.length}
          itemLabel="ToDos"
          page={currentPage}
          totalPages={totalPages}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <Card className="overflow-hidden border-border/50 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Titel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Zuordnung
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Priorität
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Fällig
                    </th>
                    {canUpdate ? (
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        Aktion
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((todo) => {
                    const status = computeStaffTodoStatus(todo, todo.completions);
                    return (
                      <tr
                        key={todo.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{todo.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {staffTodoAssigneeLabel(todo)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={staffTodoPriorityBadgeClass(todo.priority)}
                          >
                            {STAFF_TODO_PRIORITY_LABELS[todo.priority]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={staffTodoStatusBadgeClass(status)}
                          >
                            {STAFF_TODO_STATUS_LABELS[status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatWhen(todo.display_until)}
                        </td>
                        {canUpdate ? (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {status !== "done" && status !== "archived" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="rounded-full"
                                  aria-label="Als erledigt markieren"
                                  onClick={() => void handleMarkDone(todo)}
                                >
                                  <Check className="size-4" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full"
                                aria-label="Bearbeiten"
                                onClick={() => {
                                  setEditTodo(todo);
                                  setDrawerOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </ListPaginationSurround>
      )}

      <StaffTodosFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        filterAssignee={filterAssignee}
        onFilterAssigneeChange={setFilterAssignee}
        assigneeOptions={assigneeFilterOptions}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
      />

      <StaffTodosProtocolDrawer
        open={protocolOpen}
        onOpenChange={setProtocolOpen}
        restaurantId={restaurantId}
      />

      <StaffTodoFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        restaurantId={restaurantId}
        todo={editTodo}
        staffList={staffList}
        positionTags={positionTags}
        onSaved={() => void reload()}
      />
    </div>
  );
}
