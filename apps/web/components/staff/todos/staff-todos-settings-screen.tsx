"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StaffTodosSubnav } from "@/components/staff/todos/staff-todos-subnav";
import { Button } from "@/components/ui/button";
import {
  fetchStaffTodoSettings,
  upsertStaffTodoSettings,
} from "@/lib/supabase/staff-todos-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { StaffTodoSettingsRow } from "@/lib/types/staff-todos";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

export function StaffTodosSettingsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "staff_todos");
  const canUpdate = hasModuleUpdate(has, "staff_todos");

  const [settings, setSettings] = useState<StaffTodoSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [saving, setSaving] = useState(false);

  const [deferDefault, setDeferDefault] = useState("");
  const [notifyCompleted, setNotifyCompleted] = useState(true);
  const [notifyDeferred, setNotifyDeferred] = useState(true);

  const reload = useCallback(async () => {
    if (!restaurantId || !canRead) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchStaffTodoSettings(restaurantId);
    setLoading(false);
    if (error) toast.error(error);
    else {
      setSettings(data);
      setDeferDefault(data?.defer_reason_default ?? "");
      setNotifyCompleted(data?.notify_on_completed ?? true);
      setNotifyDeferred(data?.notify_on_deferred ?? true);
    }
  }, [restaurantId, canRead]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleSave = async () => {
    if (!restaurantId || !canUpdate) return;
    setSaving(true);
    const { error } = await upsertStaffTodoSettings(restaurantId, {
      defer_reason_default: deferDefault.trim() || null,
      notify_on_completed: notifyCompleted,
      notify_on_deferred: notifyDeferred,
    });
    setSaving(false);
    if (error) toast.error(error);
    else {
      toast.success("Einstellungen gespeichert.");
      void reload();
    }
  };

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="ToDo-Einstellungen" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="w-full max-w-xl pb-16">
      <StaffTodosSubnav />

      {loading && !showSkeleton ? (
        <div className="min-h-[12rem]" aria-busy="true" />
      ) : (
        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="defer-default">Standard-Grund Verschieben</Label>
              <Input
                id="defer-default"
                value={deferDefault}
                onChange={(e) => setDeferDefault(e.target.value)}
                placeholder="z. B. Später in der Schicht"
                disabled={!canUpdate}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Optionaler Vorschlag auf dem Display, wenn ein Grund erforderlich ist.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-3">
              <div>
                <Label htmlFor="notify-completed">Benachrichtigung bei Erledigen</Label>
                <p className="text-xs text-muted-foreground">
                  Glocke und Push für Nutzer mit ToDo-Rechten
                </p>
              </div>
              <Switch
                id="notify-completed"
                checked={notifyCompleted}
                onCheckedChange={setNotifyCompleted}
                disabled={!canUpdate}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-3">
              <div>
                <Label htmlFor="notify-deferred">Benachrichtigung bei Verschieben</Label>
                <p className="text-xs text-muted-foreground">
                  Wenn Mitarbeitende ein ToDo am Display verschieben
                </p>
              </div>
              <Switch
                id="notify-deferred"
                checked={notifyDeferred}
                onCheckedChange={setNotifyDeferred}
                disabled={!canUpdate}
              />
            </div>

            {canUpdate ? (
              <Button
                type="button"
                className={cn("h-12 w-full rounded-xl", settingsAccentSaveButtonClassName)}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "Speichern …" : "Speichern"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
