"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Pencil, Plus, Search, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModulePaginatedDataTable } from "@/lib/ui/module-paginated-data-table";
import {
  StaffTodosFilterDrawer,
  countStaffTodosActiveFilters,
} from "@/components/staff/todos/staff-todos-filter-drawer";
import { StaffTodoFormDrawer } from "@/components/staff/todos/staff-todo-form-drawer";
import { StaffTodoDetailDrawer } from "@/components/staff/todos/staff-todo-detail-drawer";
import { StaffTodosTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import { ChecklistTaxonomyPanel } from "@/components/checklisten/checklist-taxonomy-panel";
import { ChecklistenTodosOverviewSection } from "@/components/checklisten/checklisten-todos-overview-section";
import {
  fetchStaffTodosForRestaurant,
  staffTodoAssigneeLabel,
  assignedStaffIds,
  assignedPositionTagIds,
  completeStaffTodoForStaff,
  insertStaffTodoLogEntry,
  reopenStaffTodo,
} from "@/lib/supabase/staff-todos-db";
import { isAssignedToStaffMember } from "@/lib/staff/assignee-matching";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { filterStaffForSelect } from "@/lib/staff/staff-select-options";
import {
  peekStaffListCache,
  writeStaffListCache,
} from "@/lib/staff/staff-list-client-cache";
import {
  peekStaffTodosCache,
  writeStaffTodosCache,
} from "@/lib/staff/staff-todos-client-cache";
import {
  fetchComplianceRecords,
  fetchComplianceSettings,
} from "@/lib/supabase/compliance-db";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useChecklistAreasStorage } from "@/lib/hooks/use-checklist-areas-storage";
import { useChecklistDevicesStorage } from "@/lib/hooks/use-checklist-devices-storage";
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
  staffTodoPriorityBadgeClass,
  staffTodoStatusBadgeClass,
} from "@/lib/staff/staff-todo-status";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";
import {
  formatStaffTodoStatusLabel,
  staffTodoAssigneeCount,
  staffTodoCanReopen,
} from "@/lib/staff/staff-todo-completion-display";
import {
  staffTodoAreaLabel,
  staffTodoCaptureLabel,
  staffTodoDeviceLabel,
  staffTodoLimitsLabel,
  staffTodoRecurrenceLabel,
  todoMatchesAreaFilter,
} from "@/lib/staff/staff-todo-meta";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleDataTableHeadRowClassName,
} from "@/lib/ui/module-data-table";
import { ModuleTableSortHeader, ModuleTableStaticColumnHeader } from "@/lib/ui/module-table-sort-header";
import {
  ModuleTableActionsCell,
  ModuleTableIconActionButton,
  ModuleTableIconActionsColumnHeader,
} from "@/lib/ui/module-table-icon-tooltip";
import { ModuleTableStickyBodyCell } from "@/lib/ui/module-table-sticky-column";
import {
  defaultStaffTodosSortDir,
  STAFF_TODO_STATUS_SORT_ORDER,
  type StaffTodosSortDir,
  type StaffTodosSortKey,
} from "@/lib/staff/staff-todos-sort";
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

function formatWhen(iso: string | null, timeZone: string): string {
  return formatRestaurantDateTime(iso, timeZone);
}

export function StaffTodosScreen() {
  const searchParams = useSearchParams();
  const staffFilterFromUrl = searchParams.get("staff");

  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");
  const canCreate = hasModuleCreate(has, "staff_todos");
  const canUpdate = hasModuleUpdate(has, "staff_todos");

  const positionTagsStorage = useStaffPositionTagsStorage(restaurantId);
  const positionTags = positionTagsStorage.items;
  const areasStorage = useChecklistAreasStorage(restaurantId);
  const devicesStorage = useChecklistDevicesStorage(restaurantId);
  const [staffList, setStaffList] = useState<RestaurantStaffRow[]>([]);
  const [todos, setTodos] = useState<RestaurantStaffTodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [capturesToday, setCapturesToday] = useState(0);
  const [showDueReminders, setShowDueReminders] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && todos.length === 0);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterAreaId, setFilterAreaId] = useState<string | null>(null);
  const [filterDeviceId, setFilterDeviceId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StaffTodosSortKey>("priority");
  const [sortDir, setSortDir] = useState<StaffTodosSortDir>("desc");
  const [page, setPage] = useState(1);
  const [restaurantTimezone, setRestaurantTimezone] = useState(
    DEFAULT_RESTAURANT_TIMEZONE,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<RestaurantStaffTodoRow | null>(null);
  const [detailTodo, setDetailTodo] = useState<RestaurantStaffTodoRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    const staffCached = peekStaffListCache(restaurantId);
    if (staffCached) setStaffList(staffCached.rows);
    const todosCached = peekStaffTodosCache(restaurantId);
    if (todosCached) {
      setTodos(todosCached.todos);
      setRestaurantTimezone(todosCached.restaurantTimezone);
      setLoading(false);
    }
  }, [restaurantId]);

  const reload = useCallback(async () => {
    if (!restaurantId || !canRead) {
      setTodos([]);
      setStaffList([]);
      setLoading(false);
      return;
    }
    const todosCached = peekStaffTodosCache(restaurantId);
    const staffCached = peekStaffListCache(restaurantId);
    if (todosCached) {
      setTodos(todosCached.todos);
      setRestaurantTimezone(todosCached.restaurantTimezone);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (staffCached) setStaffList(staffCached.rows);

    const [todoRes, staffRes, recordsRes, settingsRes] = await Promise.all([
      fetchStaffTodosForRestaurant(restaurantId),
      fetchStaffForRestaurant(restaurantId),
      canReadCompliance
        ? fetchComplianceRecords(restaurantId, { limit: 500 })
        : Promise.resolve({ data: [], error: null }),
      fetchComplianceSettings(restaurantId),
    ]);
    setLoading(false);
    if (todoRes.error && !isMissingSchemaError(todoRes.error)) toast.error(todoRes.error);
    else {
      setTodos(todoRes.data);
      setRestaurantTimezone(todoRes.restaurantTimezone);
    }
    if (staffRes.error) toast.error(staffRes.error);
    else setStaffList(staffRes.data);
    if (!todoRes.error) {
      writeStaffTodosCache(restaurantId, {
        todos: todoRes.data,
        restaurantTimezone: todoRes.restaurantTimezone,
      });
    }
    if (!staffRes.error) {
      const staffCachedAfter = peekStaffListCache(restaurantId);
      writeStaffListCache(restaurantId, {
        rows: staffRes.data,
        contracts: staffCachedAfter?.contracts ?? [],
      });
    }

    let todayCaptures = 0;
    for (const todo of todoRes.data) {
      for (const c of todo.completions ?? []) {
        if (
          c.completed_at &&
          !c.reopened_at &&
          isSameRestaurantCalendarDay(c.completed_at, new Date(), todoRes.restaurantTimezone)
        ) {
          todayCaptures += 1;
        }
      }
    }
    if (canReadCompliance && !recordsRes.error) {
      todayCaptures += recordsRes.data.filter((r) =>
        isSameRestaurantCalendarDay(r.performed_at, new Date(), todoRes.restaurantTimezone),
      ).length;
    }
    setCapturesToday(todayCaptures);

    if (!settingsRes.error) {
      setShowDueReminders(settingsRes.data?.show_due_reminders ?? true);
    }
  }, [restaurantId, canRead, canReadCompliance]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  useEffect(() => {
    if (!detailTodo) return;
    const fresh = todos.find((t) => t.id === detailTodo.id);
    if (fresh) setDetailTodo(fresh);
  }, [todos, detailTodo?.id]);

  const staffById = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList],
  );

  const assigneeFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Alle Zuordnungen" }];
    for (const s of filterStaffForSelect(staffList)) {
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

  const areaFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Alle Bereiche" }];
    for (const a of areasStorage.items.filter((x) => x.active)) {
      opts.push({ value: a.id, label: a.name });
    }
    return opts;
  }, [areasStorage.items]);

  const deviceFilterOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Alle Geräte" }];
    for (const d of devicesStorage.items.filter((x) => x.is_active)) {
      opts.push({ value: d.id, label: d.name });
    }
    return opts;
  }, [devicesStorage.items]);

  const toggleSort = useCallback((key: StaffTodosSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(defaultStaffTodosSortDir(key));
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, [sortKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = todos;

    if (staffFilterFromUrl) {
      const staff = staffById.get(staffFilterFromUrl);
      rows = rows.filter((t) =>
        isAssignedToStaffMember(t, staffFilterFromUrl, staff?.position_tag_id ?? null, {
          emptyMeansAll: false,
        }),
      );
    }

    rows = rows.filter((t) => {
      const status = computeStaffTodoStatus(
        t,
        t.completions,
        staffTodoAssigneeCount(t),
        new Date(),
        restaurantTimezone,
      );
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterAssignee !== "all") {
        const [kind, id] = filterAssignee.split(":");
        if (kind === "staff" && !assignedStaffIds(t).includes(id)) return false;
        if (kind === "tag" && !assignedPositionTagIds(t).includes(id)) return false;
      }
      if (filterAreaId && !todoMatchesAreaFilter(t, filterAreaId)) return false;
      if (filterDeviceId && t.checklist_device_id !== filterDeviceId) return false;
      if (q) {
        const hay = [
          t.title,
          t.description ?? "",
          staffTodoAssigneeLabel(t),
          staffTodoAreaLabel(t) ?? "",
          staffTodoDeviceLabel(t) ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title, "de") * dir;
        case "assignee":
          return (
            staffTodoAssigneeLabel(a).localeCompare(staffTodoAssigneeLabel(b), "de") *
            dir
          );
        case "priority": {
          const pa = PRIORITY_ORDER[a.priority] ?? 9;
          const pb = PRIORITY_ORDER[b.priority] ?? 9;
          if (pa !== pb) return (pa - pb) * dir;
          return a.title.localeCompare(b.title, "de") * dir;
        }
        case "status": {
          const sa = STAFF_TODO_STATUS_SORT_ORDER[
            computeStaffTodoStatus(
              a,
              a.completions,
              staffTodoAssigneeCount(a),
              new Date(),
              restaurantTimezone,
            )
          ];
          const sb = STAFF_TODO_STATUS_SORT_ORDER[
            computeStaffTodoStatus(
              b,
              b.completions,
              staffTodoAssigneeCount(b),
              new Date(),
              restaurantTimezone,
            )
          ];
          if (sa !== sb) return (sa - sb) * dir;
          return a.title.localeCompare(b.title, "de") * dir;
        }
        case "due": {
          const au = a.display_until ? new Date(a.display_until).getTime() : Infinity;
          const bu = b.display_until ? new Date(b.display_until).getTime() : Infinity;
          return (au - bu) * dir;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [
    todos,
    search,
    filterStatus,
    filterPriority,
    filterAssignee,
    filterAreaId,
    filterDeviceId,
    sortKey,
    sortDir,
    staffFilterFromUrl,
    staffById,
    restaurantTimezone,
  ]);

  const totalPages = totalPagesFromCount(filtered.length, LIST_PAGE_SIZE_DEFAULT);
  const currentPage = clampListPage(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * LIST_PAGE_SIZE_DEFAULT,
    currentPage * LIST_PAGE_SIZE_DEFAULT,
  );

  const tableExport = useMemo(
    () => ({
      documentTitle: "ToDos",
      filenamePrefix: "mitarbeiter-todos",
      headers: [
        "Titel",
        "Priorität",
        "Status",
        "Zuständig",
        "Fällig",
        "Bereich",
        "Gerät",
      ],
      rows: filtered.map((todo) => {
        const statusLabel = formatStaffTodoStatusLabel(
          todo,
          restaurantTimezone,
          staffById,
        );
        const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
        return [
          todo.title,
          STAFF_TODO_PRIORITY_LABELS[todo.priority],
          statusLabel,
          staffTodoAssigneeLabel(todo),
          recurrence ?? formatWhen(todo.display_until, restaurantTimezone),
          staffTodoAreaLabel(todo) ?? "—",
          staffTodoDeviceLabel(todo) ?? "—",
        ];
      }),
      summaryLine: `${filtered.length} ToDo${filtered.length === 1 ? "" : "s"}`,
      orientation: "landscape" as const,
    }),
    [filtered, restaurantTimezone, staffById],
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterStatus,
    filterPriority,
    filterAssignee,
    filterAreaId,
    filterDeviceId,
    sortKey,
    sortDir,
    staffFilterFromUrl,
  ]);

  const activeFilterCount = countStaffTodosActiveFilters({
    filterStatus,
    filterPriority,
    filterAssignee,
    filterAreaId,
    filterDeviceId,
  });

  const handleMarkDone = async (todo: RestaurantStaffTodoRow) => {
    if (!restaurantId || !canUpdate || actionBusy) return;
    setActionBusy(true);
    let staffId: string | null =
      assignedStaffIds(todo)[0] ?? todo.staff_id ?? null;
    if (!staffId) {
      const tagIds = assignedPositionTagIds(todo);
      staffId =
        staffList.find(
          (s) =>
            s.is_active &&
            s.position_tag_id != null &&
            tagIds.includes(s.position_tag_id),
        )?.id ?? null;
    }
    if (!staffId) {
      setActionBusy(false);
      toast.error("Kein Mitarbeiter für die Erledigung gefunden.");
      return;
    }
    const { error } = await completeStaffTodoForStaff(todo.id, staffId, {
      recurrence: todo.recurrence,
      timeZone: restaurantTimezone,
    });
    if (error) {
      setActionBusy(false);
      toast.error(error);
      return;
    }
    await insertStaffTodoLogEntry({
      restaurantId,
      todoId: todo.id,
      action: "completed_by_manager",
      details: { title: todo.title },
    });
    setActionBusy(false);
    toast.success("ToDo als erledigt markiert.");
    void reload();
  };

  const handleReopen = async (todo: RestaurantStaffTodoRow) => {
    if (!restaurantId || !canUpdate || actionBusy) return;
    setActionBusy(true);
    const { error } = await reopenStaffTodo(restaurantId, todo.id, {
      recurrence: todo.recurrence,
      timeZone: restaurantTimezone,
      todoTitle: todo.title,
    });
    setActionBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("ToDo wieder geöffnet.");
    void reload();
  };

  const openTodoDetail = (todo: RestaurantStaffTodoRow) => {
    setDetailTodo(todo);
    setDetailOpen(true);
  };

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Checklisten" />;
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

      <ChecklistenTodosOverviewSection
        loading={loading}
        todos={todos}
        capturesToday={capturesToday}
        showDueReminders={showDueReminders}
        canReadTodos={canRead}
        canReadCompliance={canReadCompliance}
        restaurantTimezone={restaurantTimezone}
        canUpdateTodos={canUpdate}
        onTodoClick={openTodoDetail}
        taxonomySlot={
          canUpdate ? (
            <ChecklistTaxonomyPanel
              layout="inline"
              areasStorage={areasStorage}
              devicesStorage={devicesStorage}
              filterAreaId={filterAreaId}
              onFilterAreaIdChange={setFilterAreaId}
              filterDeviceId={filterDeviceId}
              onFilterDeviceIdChange={setFilterDeviceId}
              canManage={canUpdate}
            />
          ) : undefined
        }
      />

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
        <ModulePaginatedDataTable
          shown={paginated.length}
          totalCount={filtered.length}
          itemLabel="ToDos"
          page={currentPage}
          totalPages={totalPages}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          tableExport={tableExport}
        >
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowClassName}>
                    <ModuleTableSortHeader
                      label="Titel"
                      sortKey="title"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                      stickyIdentityColumn
                    />
                    <ModuleTableStaticColumnHeader label="Bereich" />
                    <ModuleTableStaticColumnHeader label="Gerät" />
                    <ModuleTableSortHeader
                      label="Zuordnung"
                      sortKey="assignee"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <ModuleTableSortHeader
                      label="Priorität"
                      sortKey="priority"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <ModuleTableSortHeader
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <ModuleTableStaticColumnHeader label="Art" />
                    <ModuleTableSortHeader
                      label="Fällig"
                      sortKey="due"
                      activeKey={sortKey}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    {canUpdate ? (
                      <ModuleTableIconActionsColumnHeader />
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((todo) => {
                    const assigneeCount = staffTodoAssigneeCount(todo);
                    const status = computeStaffTodoStatus(
                      todo,
                      todo.completions,
                      assigneeCount,
                      new Date(),
                      restaurantTimezone,
                    );
                    const statusLabel = formatStaffTodoStatusLabel(
                      todo,
                      restaurantTimezone,
                      staffById,
                    );
                    const recurrence = staffTodoRecurrenceLabel(todo.recurrence);
                    const limits = staffTodoLimitsLabel(todo);
                    const areaLabel = staffTodoAreaLabel(todo);
                    const deviceLabel = staffTodoDeviceLabel(todo);
                    const showReopen = canUpdate && staffTodoCanReopen(todo, restaurantTimezone);
                    return (
                      <tr
                        key={todo.id}
                        className="group/tr cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20"
                        onClick={() => openTodoDetail(todo)}
                      >
                        <ModuleTableStickyBodyCell
                          tone="muted-hover-20"
                          className="px-4 py-3"
                        >
                          <p className="font-medium">{todo.title}</p>
                        </ModuleTableStickyBodyCell>
                        <td className="max-w-[8rem] px-4 py-3 text-muted-foreground">
                          {areaLabel ? (
                            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                              {todo.checklist_area?.background_color ? (
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      todo.checklist_area.background_color,
                                  }}
                                  aria-hidden
                                />
                              ) : null}
                              <TableCellTruncateTooltip text={areaLabel} />
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="max-w-[8rem] px-4 py-3 text-muted-foreground">
                          <TableCellTruncateTooltip text={deviceLabel ?? "—"} />
                        </td>
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
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <p className="text-sm">{staffTodoCaptureLabel(todo.capture_type)}</p>
                          {limits ? (
                            <p className="text-xs">{limits}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {recurrence ?? formatWhen(todo.display_until, restaurantTimezone)}
                        </td>
                        {canUpdate ? (
                          <ModuleTableActionsCell
                            onClick={(e) => e.stopPropagation()}
                          >
                              {status !== "done" && status !== "archived" ? (
                                <ModuleTableIconActionButton
                                  label="Als erledigt markieren"
                                  className="rounded-full"
                                  disabled={actionBusy}
                                  onClick={() => void handleMarkDone(todo)}
                                >
                                  <Check className="size-4" />
                                </ModuleTableIconActionButton>
                              ) : null}
                              {showReopen ? (
                                <ModuleTableIconActionButton
                                  label="Nicht erledigt"
                                  className="rounded-full"
                                  disabled={actionBusy}
                                  onClick={() => void handleReopen(todo)}
                                >
                                  <RotateCcw className="size-4" />
                                </ModuleTableIconActionButton>
                              ) : null}
                              <ModuleTableIconActionButton
                                label="Bearbeiten"
                                className="rounded-full"
                                onClick={() => {
                                  setEditTodo(todo);
                                  setDrawerOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                              </ModuleTableIconActionButton>
                          </ModuleTableActionsCell>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
        </ModulePaginatedDataTable>
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
        filterAreaId={filterAreaId}
        onFilterAreaIdChange={setFilterAreaId}
        areaOptions={areaFilterOptions}
        filterDeviceId={filterDeviceId}
        onFilterDeviceIdChange={setFilterDeviceId}
        deviceOptions={deviceFilterOptions}
      />

      <StaffTodoDetailDrawer
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTodo(null);
        }}
        todo={detailTodo}
        restaurantTimezone={restaurantTimezone}
        staffList={staffList}
        canUpdate={canUpdate}
        busy={actionBusy}
        onMarkDone={handleMarkDone}
        onReopen={handleReopen}
        onEdit={(todo) => {
          setDetailOpen(false);
          setEditTodo(todo);
          setDrawerOpen(true);
        }}
      />

      <StaffTodoFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        restaurantId={restaurantId}
        todo={editTodo}
        staffList={staffList}
        positionTags={positionTags}
        checklistAreas={areasStorage.items}
        checklistDevices={devicesStorage.items}
        canManageChecklistTaxonomy={canUpdate}
        onAddChecklistArea={areasStorage.add}
        onUpsertChecklistDevice={devicesStorage.upsert}
        onSaved={() => void reload()}
      />
    </div>
  );
}
