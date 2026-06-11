"use client";

import { Bell, Mail } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NotificationPreferencesPanelSkeleton } from "@/components/notifications/notification-preferences-panel-skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNotificationPreferences } from "@/lib/hooks/use-notification-preferences";
import {
  notificationModulesInOrder,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import type { NotificationModuleToggles } from "@/lib/notifications/notification-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

function ModuleToggleRows({
  toggles,
  onChange,
  labelFor,
  disabled,
}: {
  toggles: NotificationModuleToggles;
  onChange: (moduleId: NotificationModuleId, enabled: boolean) => void;
  labelFor: (moduleId: NotificationModuleId) => string;
  disabled?: boolean;
}) {
  return (
    <ul className="list-none space-y-2 p-0">
      {notificationModulesInOrder().map((mod) => (
        <li
          key={mod.id}
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3",
            disabled && "opacity-60",
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{mod.labelPlural}</p>
            <p className="text-xs text-muted-foreground">{labelFor(mod.id)}</p>
          </div>
          <Switch
            checked={toggles[mod.id] !== false}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(mod.id, checked)}
            aria-labelledby={`notification-module-${mod.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

export function NotificationPreferencesPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const {
    ready,
    isLoading,
    isSaving,
    dirty,
    draft,
    channels,
    updateDraft,
    save,
    resetDraft,
  } = useNotificationPreferences();

  const showSkeleton = useDeferredSkeleton(isLoading);

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (workspaceReady && !restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (!ready || isLoading) {
    if (showSkeleton) {
      return <NotificationPreferencesPanelSkeleton />;
    }
    return (
      <div
        className="min-h-[16rem] w-full"
        aria-busy="true"
        aria-label="Benachrichtigungen werden geladen"
      />
    );
  }

  const whatsappConnected = channels?.whatsappConnected ?? false;
  const emailNote = channels?.restaurantEmailConfigured
    ? "Über die Restaurant-Mailbox, sonst Gwada-Fallback."
    : channels?.platformEmailFallbackAvailable
      ? "Restaurant-Mailbox nicht konfiguriert — Gwada-Fallback."
      : "E-Mail-Kanal derzeit nicht verfügbar.";

  const patchModuleToggle = (
    field: "inAppModules" | "pushWhatsappModules" | "pushEmailModules",
    moduleId: NotificationModuleId,
    enabled: boolean,
  ) => {
    updateDraft({
      [field]: { ...draft[field], [moduleId]: enabled },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">In der App</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Welche Module in der Glocken-Leiste oben rechts erscheinen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleToggleRows
            toggles={draft.inAppModules}
            onChange={(id, enabled) =>
              patchModuleToggle("inAppModules", id, enabled)
            }
            labelFor={(id) =>
              notificationModulesInOrder().find((m) => m.id === id)!
                .settingsInAppLabel
            }
          />
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Push pro Modul</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Externe Zustellung per WhatsApp oder E-Mail — pro Modul einzeln
            steuerbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <WhatsAppGlyph className="size-4 shrink-0" />
              WhatsApp
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {whatsappConnected
                ? "Push über die verbundene Restaurant-WhatsApp."
                : "Nur verfügbar, wenn WhatsApp unter Einstellungen → Integrationen verbunden ist."}
            </p>
            <ModuleToggleRows
              toggles={draft.pushWhatsappModules}
              disabled={!whatsappConnected}
              onChange={(id, enabled) =>
                patchModuleToggle("pushWhatsappModules", id, enabled)
              }
              labelFor={(id) =>
                notificationModulesInOrder().find((m) => m.id === id)!
                  .settingsPushWhatsappLabel
              }
            />
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="size-4 text-muted-foreground" />
              E-Mail
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{emailNote}</p>
            <ModuleToggleRows
              toggles={draft.pushEmailModules}
              onChange={(id, enabled) =>
                patchModuleToggle("pushEmailModules", id, enabled)
              }
              labelFor={(id) =>
                notificationModulesInOrder().find((m) => m.id === id)!
                  .settingsPushEmailLabel
              }
            />
          </div>
        </CardContent>
      </Card>

      <SettingsStickySaveBar show={dirty}>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={isSaving}
          onClick={resetDraft}
        >
          Verwerfen
        </Button>
        <Button
          type="button"
          className={settingsAccentSaveButtonClassName}
          disabled={isSaving}
          onClick={() => void save()}
        >
          {isSaving ? "Speichern…" : "Speichern"}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
