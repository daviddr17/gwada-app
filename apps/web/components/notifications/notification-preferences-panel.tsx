"use client";

import { Mail, MessageSquare } from "lucide-react";
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

function ModuleToggleRows({
  toggles,
  onChange,
  labelFor,
}: {
  toggles: NotificationModuleToggles;
  onChange: (moduleId: NotificationModuleId, enabled: boolean) => void;
  labelFor: (moduleId: NotificationModuleId) => string;
}) {
  return (
    <ul className="list-none space-y-2 p-0">
      {notificationModulesInOrder().map((mod) => (
        <li
          key={mod.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{mod.labelPlural}</p>
            <p className="text-xs text-muted-foreground">{labelFor(mod.id)}</p>
          </div>
          <Switch
            checked={toggles[mod.id] !== false}
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
          <CardTitle className="text-xl">Kanäle</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Externe Zustellung ist vorbereitet — Push per WhatsApp oder E-Mail
            folgt, sobald die Kanäle aktiv sind. In der App steuern Sie die
            Glocken-Hinweise unabhängig davon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <WhatsAppGlyph className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {channels?.whatsappConnected
                    ? "Restaurant ist verbunden — Push möglich, sobald aktiviert."
                    : "Nur verfügbar, wenn WhatsApp unter Integrationen verbunden ist."}
                </p>
              </div>
            </div>
            <Switch
              checked={draft.channelWhatsappEnabled}
              disabled={!channels?.whatsappConnected}
              onCheckedChange={(checked) =>
                updateDraft({ channelWhatsappEnabled: checked })
              }
              aria-label="WhatsApp-Benachrichtigungen"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">E-Mail</p>
                <p className="text-xs text-muted-foreground">
                  {channels?.restaurantEmailConfigured
                    ? "Über die Restaurant-Mailbox, sonst Gwada-Fallback."
                    : channels?.platformEmailFallbackAvailable
                      ? "Restaurant-Mailbox nicht konfiguriert — Gwada-Fallback."
                      : "E-Mail-Kanal derzeit nicht verfügbar."}
                </p>
              </div>
            </div>
            <Switch
              checked={draft.channelEmailEnabled}
              onCheckedChange={(checked) =>
                updateDraft({ channelEmailEnabled: checked })
              }
              aria-label="E-Mail-Benachrichtigungen"
            />
          </div>
        </CardContent>
      </Card>

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
            labelFor={(id) => notificationModulesInOrder().find((m) => m.id === id)!.settingsInAppLabel}
          />
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Push pro Modul</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Feingranulare Zustellung über WhatsApp und E-Mail — wird mit den
            Kanälen oben kombiniert.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquare className="size-4 text-muted-foreground" />
              WhatsApp
            </div>
            <ModuleToggleRows
              toggles={draft.pushWhatsappModules}
              onChange={(id, enabled) =>
                patchModuleToggle("pushWhatsappModules", id, enabled)
              }
              labelFor={(id) =>
                notificationModulesInOrder().find((m) => m.id === id)!
                  .settingsPushLabel
              }
            />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Mail className="size-4 text-muted-foreground" />
              E-Mail
            </div>
            <ModuleToggleRows
              toggles={draft.pushEmailModules}
              onChange={(id, enabled) =>
                patchModuleToggle("pushEmailModules", id, enabled)
              }
              labelFor={(id) =>
                notificationModulesInOrder().find((m) => m.id === id)!
                  .settingsPushLabel
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
