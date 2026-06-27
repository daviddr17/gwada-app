"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import {
  fetchComplianceSettings,
  upsertComplianceSettings,
} from "@/lib/supabase/compliance-db";
import {
  fetchStaffTodoSettings,
  upsertStaffTodoSettings,
} from "@/lib/supabase/staff-todos-db";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

type SavedSnapshot = {
  deferReasonDefault: string;
  notifyOnCompleted: boolean;
  notifyOnDeferred: boolean;
  requireCorrective: boolean;
  showDueReminders: boolean;
};

export function ChecklistenSettingsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canUpdateTodos = hasModuleUpdate(has, "staff_todos");
  const canReadCompliance = hasModuleRead(has, "compliance");
  const canUpdateCompliance = hasModuleUpdate(has, "compliance");
  const canAccess = canReadTodos || canReadCompliance;
  const canUpdate = canUpdateTodos || canUpdateCompliance;

  const [deferReasonDefault, setDeferReasonDefault] = useState("");
  const [notifyOnCompleted, setNotifyOnCompleted] = useState(true);
  const [notifyOnDeferred, setNotifyOnDeferred] = useState(true);
  const [requireCorrective, setRequireCorrective] = useState(true);
  const [showDueReminders, setShowDueReminders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<SavedSnapshot | null>(null);

  useEffect(() => {
    if (!restaurantId || !canAccess) return;
    let cancel = false;
    setLoading(true);
    savedRef.current = null;

    void (async () => {
      const [todoSettings, complianceSettings] = await Promise.all([
        canReadTodos
          ? fetchStaffTodoSettings(restaurantId)
          : Promise.resolve({ data: null, error: null }),
        canReadCompliance
          ? fetchComplianceSettings(restaurantId)
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancel) return;
      setLoading(false);

      if (todoSettings.error) toast.error(todoSettings.error);
      if (complianceSettings.error) toast.error(complianceSettings.error);

      const deferDefault = todoSettings.data?.defer_reason_default ?? "";
      const notifyCompleted = todoSettings.data?.notify_on_completed ?? true;
      const notifyDeferred = todoSettings.data?.notify_on_deferred ?? true;
      const corrective =
        complianceSettings.data?.require_corrective_on_deviation ?? true;
      const dueReminders = complianceSettings.data?.show_due_reminders ?? true;

      setDeferReasonDefault(deferDefault);
      setNotifyOnCompleted(notifyCompleted);
      setNotifyOnDeferred(notifyDeferred);
      setRequireCorrective(corrective);
      setShowDueReminders(dueReminders);

      savedRef.current = {
        deferReasonDefault: deferDefault,
        notifyOnCompleted: notifyCompleted,
        notifyOnDeferred: notifyDeferred,
        requireCorrective: corrective,
        showDueReminders: dueReminders,
      };
    })();

    return () => {
      cancel = true;
    };
  }, [restaurantId, canAccess, canReadTodos, canReadCompliance]);

  const dirty =
    savedRef.current !== null &&
    !loading &&
    ((canReadTodos &&
      (deferReasonDefault !== savedRef.current.deferReasonDefault ||
        notifyOnCompleted !== savedRef.current.notifyOnCompleted ||
        notifyOnDeferred !== savedRef.current.notifyOnDeferred)) ||
      (canReadCompliance &&
        (requireCorrective !== savedRef.current.requireCorrective ||
          showDueReminders !== savedRef.current.showDueReminders)));

  const save = () => {
    if (!restaurantId) return;
    setSaving(true);
    void (async () => {
      const tasks: Promise<{ error: string | null }>[] = [];

      if (canUpdateTodos) {
        tasks.push(
          upsertStaffTodoSettings(restaurantId, {
            deferReasonDefault: deferReasonDefault.trim() || null,
            notifyOnCompleted,
            notifyOnDeferred,
          }),
        );
      }

      if (canUpdateCompliance) {
        tasks.push(
          upsertComplianceSettings(restaurantId, {
            requireCorrectiveOnDeviation: requireCorrective,
            showDueReminders,
          }),
        );
      }

      const results = await Promise.all(tasks);
      setSaving(false);

      const error = results.find((r) => r.error)?.error;
      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Einstellungen gespeichert.");
      savedRef.current = {
        deferReasonDefault,
        notifyOnCompleted,
        notifyOnDeferred,
        requireCorrective,
        showDueReminders,
      };
    })();
  };

  if (!permissionsLoading && !canAccess) {
    return <ModuleAccessDenied label="Checklisten" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="space-y-6 pb-4">
      {canReadTodos ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">ToDo-Listen</CardTitle>
            <CardDescription>
              Restaurant-weite Vorgaben für ToDos am Display und Benachrichtigungen
              in der Glocke.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/15 p-4">
              <Label htmlFor="todo-defer-reason-default">
                Vorschlag für Verschiebe-Grund
              </Label>
              <Input
                id="todo-defer-reason-default"
                value={deferReasonDefault}
                onChange={(e) => setDeferReasonDefault(e.target.value)}
                placeholder="Optional, z. B. „Später erledigen“"
                disabled={loading || !canUpdateTodos}
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Wird vorausgefüllt, wenn am Display ein Grund für das Verschieben
                verlangt wird. Leer lassen, wenn kein Vorschlag erscheinen soll.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Glocke bei erledigten ToDos</p>
                <p className="text-xs text-muted-foreground">
                  Erzeugt Benachrichtigungen, wenn ein ToDo am Display oder im
                  Dashboard erledigt wurde. Einzelne Nutzer können das in ihren
                  Benachrichtigungs-Einstellungen weiter einschränken.
                </p>
              </div>
              <Switch
                checked={notifyOnCompleted}
                onCheckedChange={setNotifyOnCompleted}
                disabled={loading || !canUpdateTodos}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Glocke bei verschobenen ToDos</p>
                <p className="text-xs text-muted-foreground">
                  Erzeugt Benachrichtigungen, wenn ein ToDo am Display verschoben
                  wurde (mit optionalem Grund).
                </p>
              </div>
              <Switch
                checked={notifyOnDeferred}
                onCheckedChange={setNotifyOnDeferred}
                disabled={loading || !canUpdateTodos}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canReadCompliance ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Eigenkontrolle</CardTitle>
            <CardDescription>
              Verhalten bei Abweichungen und Erinnerungen für HACCP-Checklisten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Korrekturmaßnahme bei Abweichung</p>
                <p className="text-xs text-muted-foreground">
                  Wenn ein Messwert außerhalb der Grenzen liegt, muss eine
                  Korrekturmaßnahme dokumentiert werden.
                </p>
              </div>
              <Switch
                checked={requireCorrective}
                onCheckedChange={setRequireCorrective}
                disabled={loading || !canUpdateCompliance}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Erinnerungen bei offenen Kontrollen</p>
                <p className="text-xs text-muted-foreground">
                  Zeigt auf der Übersicht, welche Aufgaben für die aktuelle Periode
                  noch fehlen (z. B. Temperatur heute noch offen).
                </p>
              </div>
              <Switch
                checked={showDueReminders}
                onCheckedChange={setShowDueReminders}
                disabled={loading || !canUpdateCompliance}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <SettingsStickySaveBar show={dirty && canUpdate}>
        <Button
          type="button"
          disabled={saving || loading}
          className={cn(
            "h-11 w-full min-w-[12rem] sm:w-auto",
            settingsAccentSaveButtonClassName,
          )}
          onClick={save}
        >
          {saving ? "Speichern …" : "Einstellungen speichern"}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
