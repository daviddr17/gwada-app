"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StaffTodosSubnav } from "@/components/staff/todos/staff-todos-subnav";
import { StaffTodosProtocolTableSkeleton } from "@/components/staff/todos/staff-todos-skeleton";
import {
  fetchStaffTodoLogEntries,
  formatStaffTodoLogDetails,
  resolveStaffTodoLogActorLabel,
} from "@/lib/supabase/staff-todos-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { RestaurantStaffTodoLogEntry } from "@/lib/types/staff-todos";
import { STAFF_TODO_LOG_ACTION_LABELS } from "@/lib/types/staff-todos";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StaffTodosProtocolScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "staff_todos");

  const [entries, setEntries] = useState<RestaurantStaffTodoLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    if (!restaurantId || !canRead) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffTodoLogEntries(restaurantId);
    setLoading(false);
    if (error) toast.error(error);
    else setEntries(data);
  }, [restaurantId, canRead]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="ToDo-Protokoll" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full pb-16">
      <StaffTodosSubnav />

      <p className="mb-4 text-sm text-muted-foreground">
        Anlegen, Bearbeiten, Erledigen und Verschieben — wer hat wann welches ToDo
        geändert.
      </p>

      <div className="relative mb-4 max-w-xl">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ToDo, Nutzer, Aktion …"
          className="h-11 rounded-2xl border-border/50 bg-card pl-10 shadow-none dark:shadow-sm"
        />
      </div>

      {loading && !showSkeleton ? (
        <div className="min-h-[20rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <StaffTodosProtocolTableSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {entries.length === 0
              ? "Noch keine Protokolleinträge."
              : "Keine Treffer für die Suche."}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/50 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Nutzer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    ToDo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Aktion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatWhen(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {resolveStaffTodoLogActorLabel(e)}
                    </td>
                    <td className="px-4 py-3">{e.todo?.title ?? "—"}</td>
                    <td className="px-4 py-3">
                      {STAFF_TODO_LOG_ACTION_LABELS[e.action]}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatStaffTodoLogDetails(e)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
