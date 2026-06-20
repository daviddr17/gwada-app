"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { StaffTodosProtocolTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import {
  fetchStaffTodoLogEntries,
  formatStaffTodoLogDetails,
  resolveStaffTodoLogActorLabel,
} from "@/lib/supabase/staff-todos-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { RestaurantStaffTodoLogEntry } from "@/lib/types/staff-todos";
import { STAFF_TODO_LOG_ACTION_LABELS } from "@/lib/types/staff-todos";
import { moduleSearchInputClassName } from "@/lib/ui/module-search-filter-toolbar";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StaffTodosProtocolDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
};

export function StaffTodosProtocolDrawer({
  open,
  onOpenChange,
  restaurantId,
}: StaffTodosProtocolDrawerProps) {
  const [entries, setEntries] = useState<RestaurantStaffTodoLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await fetchStaffTodoLogEntries(restaurantId);
    setLoading(false);
    if (error) setEntries([]);
    else setEntries(data);
  }, [restaurantId]);

  useEffect(() => {
    if (!open || !restaurantId) return;
    void reload();
  }, [open, restaurantId, reload]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const actor = resolveStaffTodoLogActorLabel(e).toLowerCase();
      const title = (e.todo?.title ?? "").toLowerCase();
      const action = STAFF_TODO_LOG_ACTION_LABELS[e.action].toLowerCase();
      const details = formatStaffTodoLogDetails(e).toLowerCase();
      return (
        actor.includes(q) ||
        title.includes(q) ||
        action.includes(q) ||
        details.includes(q)
      );
    });
  }, [entries, search]);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            ToDo-Protokoll
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            Anlegen, Bearbeiten, Erledigen und Verschieben — wer hat wann welches
            ToDo geändert.
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName("4-6")}>
          <DrawerFormSection contentPadding="4-6" className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ToDo, Nutzer, Aktion …"
                className={moduleSearchInputClassName}
              />
            </div>

            {loading && !showSkeleton ? (
              <div className="min-h-48" aria-busy="true" />
            ) : null}
            {showSkeleton ? (
              <StaffTodosProtocolTableSkeleton />
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {entries.length === 0
                  ? "Noch keine Protokolleinträge."
                  : "Keine Treffer für die Suche."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full min-w-[720px] table-fixed text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                      <th className="whitespace-nowrap px-2 py-2 sm:px-3">
                        Datum
                      </th>
                      <th className="min-w-[7rem] px-2 py-2 sm:px-3">Nutzer</th>
                      <th className="min-w-[8rem] px-2 py-2 sm:px-3">ToDo</th>
                      <th className="min-w-[6rem] px-2 py-2 sm:px-3">Aktion</th>
                      <th className="min-w-[10rem] px-2 py-2 sm:px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground sm:px-3 sm:py-3">
                          {formatWhen(e.created_at)}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          {resolveStaffTodoLogActorLabel(e)}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          {e.todo?.title ?? "—"}
                        </td>
                        <td className="px-2 py-2 sm:px-3 sm:py-3">
                          {STAFF_TODO_LOG_ACTION_LABELS[e.action]}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground sm:px-3 sm:py-3">
                          {formatStaffTodoLogDetails(e)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
