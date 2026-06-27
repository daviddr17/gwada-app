"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
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
  defaultCorrectiveOnDeviation: boolean;
  showDueReminders: boolean;
};

function ChecklistenSettingsToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/60 p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="max-w-prose text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
    </div>
  );
}

export function ChecklistenSettingsScreen() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canReadTodos = hasModuleRead(has, "staff_todos");
  const canUpdateTodos = hasModuleUpdate(has, "staff_todos");

  const [deferReasonDefault, setDeferReasonDefault] = useState("");
  const [notifyOnCompleted, setNotifyOnCompleted] = useState(true);
  const [notifyOnDeferred, setNotifyOnDeferred] = useState(true);
  const [defaultCorrectiveOnDeviation, setDefaultCorrectiveOnDeviation] =
    useState(true);
  const [showDueReminders, setShowDueReminders] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<SavedSnapshot | null>(null);

  useEffect(() => {
    if (!restaurantId || !canReadTodos) return;
    let cancel = false;
    setLoading(true);
    savedRef.current = null;

    void (async () => {
      const [todoSettings, complianceSettings] = await Promise.all([
        fetchStaffTodoSettings(restaurantId),
        fetchComplianceSettings(restaurantId),
      ]);

      if (cancel) return;
      setLoading(false);

      if (todoSettings.error) toast.error(todoSettings.error);
      if (complianceSettings.error) toast.error(complianceSettings.error);

      const deferDefault = todoSettings.data?.defer_reason_default ?? "";
      const notifyCompleted = todoSettings.data?.notify_on_completed ?? true;
      const notifyDeferred = todoSettings.data?.notify_on_deferred ?? true;
      const defaultCorrective =
        complianceSettings.data?.require_corrective_on_deviation ?? true;
      const dueReminders = complianceSettings.data?.show_due_reminders ?? true;

      setDeferReasonDefault(deferDefault);
      setNotifyOnCompleted(notifyCompleted);
      setNotifyOnDeferred(notifyDeferred);
      setDefaultCorrectiveOnDeviation(defaultCorrective);
      setShowDueReminders(dueReminders);

      savedRef.current = {
        deferReasonDefault: deferDefault,
        notifyOnCompleted: notifyCompleted,
        notifyOnDeferred: notifyDeferred,
        defaultCorrectiveOnDeviation: defaultCorrective,
        showDueReminders: dueReminders,
      };
    })();

    return () => {
      cancel = true;
    };
  }, [restaurantId, canReadTodos]);

  const dirty =
    savedRef.current !== null &&
    !loading &&
    (deferReasonDefault !== savedRef.current.deferReasonDefault ||
      notifyOnCompleted !== savedRef.current.notifyOnCompleted ||
      notifyOnDeferred !== savedRef.current.notifyOnDeferred ||
      defaultCorrectiveOnDeviation !==
        savedRef.current.defaultCorrectiveOnDeviation ||
      showDueReminders !== savedRef.current.showDueReminders);

  const save = () => {
    if (!restaurantId || !canUpdateTodos) return;
    setSaving(true);
    void (async () => {
      const [todoResult, complianceResult] = await Promise.all([
        upsertStaffTodoSettings(restaurantId, {
          deferReasonDefault: deferReasonDefault.trim() || null,
          notifyOnCompleted,
          notifyOnDeferred,
        }),
        upsertComplianceSettings(restaurantId, {
          requireCorrectiveOnDeviation: defaultCorrectiveOnDeviation,
          showDueReminders,
        }),
      ]);

      setSaving(false);

      const error = todoResult.error ?? complianceResult.error;
      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Einstellungen gespeichert.");
      savedRef.current = {
        deferReasonDefault,
        notifyOnCompleted,
        notifyOnDeferred,
        defaultCorrectiveOnDeviation,
        showDueReminders,
      };
    })();
  };

  if (!permissionsLoading && !canReadTodos) {
    return <ModuleAccessDenied label="Checklisten" />;
  }
  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  return (
    <div className="pb-4">
      <Card className="border-border/50 shadow-card">
        <CardContent className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border/40 bg-background/60 p-4">
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

          <ChecklistenSettingsToggleRow
            id="checklisten-show-due-reminders"
            label="Erinnerungen bei offenen Kontrollen"
            description='Zeigt auf der Übersicht „Braucht Aufmerksamkeit“ für offene Aufgaben der aktuellen Periode (z. B. Temperatur heute noch offen).'
            checked={showDueReminders}
            disabled={loading || !canUpdateTodos}
            onCheckedChange={setShowDueReminders}
          />

          <ChecklistenSettingsToggleRow
            id="checklisten-default-corrective"
            label="Korrekturmaßnahme bei neuen Temperatur-ToDos"
            description="Voreinstellung beim Anlegen eines Temperatur-ToDos. Pro ToDo lässt sich die Option im Formular weiter an- oder abschalten — bestehende ToDos ändern sich nicht."
            checked={defaultCorrectiveOnDeviation}
            disabled={loading || !canUpdateTodos}
            onCheckedChange={setDefaultCorrectiveOnDeviation}
          />

          <ChecklistenSettingsToggleRow
            id="checklisten-notify-completed"
            label="Glocke bei erledigten ToDos"
            description="Erzeugt Benachrichtigungen, wenn ein ToDo am Display oder im Dashboard erledigt wurde. Einzelne Nutzer können das in ihren Benachrichtigungs-Einstellungen weiter einschränken."
            checked={notifyOnCompleted}
            disabled={loading || !canUpdateTodos}
            onCheckedChange={setNotifyOnCompleted}
          />

          <ChecklistenSettingsToggleRow
            id="checklisten-notify-deferred"
            label="Glocke bei verschobenen ToDos"
            description="Erzeugt Benachrichtigungen, wenn ein ToDo am Display verschoben wurde (mit optionalem Grund)."
            checked={notifyOnDeferred}
            disabled={loading || !canUpdateTodos}
            onCheckedChange={setNotifyOnDeferred}
          />
        </CardContent>
      </Card>

      <SettingsStickySaveBar show={dirty && canUpdateTodos}>
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
