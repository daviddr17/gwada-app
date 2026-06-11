"use client";

import { Mail } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NotificationPreferencesPanelSkeleton } from "@/components/notifications/notification-preferences-panel-skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNotificationContact } from "@/lib/hooks/use-notification-contact";
import { useNotificationPreferences } from "@/lib/hooks/use-notification-preferences";
import { normalizeNotificationPhoneForStorage } from "@/lib/notifications/notification-contact-validation";
import {
  notificationModulesInOrder,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import type { NotificationModuleToggles } from "@/lib/notifications/notification-preferences";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const contact = useNotificationContact();
  const {
    ready,
    isLoading,
    isSaving: isSavingPrefs,
    dirty: prefsDirty,
    draft,
    channels,
    updateDraft,
    save: savePrefs,
    resetDraft: resetPrefsDraft,
  } = useNotificationPreferences();

  const isLoadingAll = isLoading || contact.isLoading;
  const dirty = prefsDirty || contact.dirty;
  const isSaving = isSavingPrefs || contact.isSaving;
  const showSkeleton = useDeferredSkeleton(isLoadingAll);

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (workspaceReady && !restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (!ready || isLoadingAll) {
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
  const hasPhoneForPush = Boolean(
    normalizeNotificationPhoneForStorage(contact.draft.phone),
  );
  const whatsappPushAvailable = whatsappConnected && hasPhoneForPush;

  const emailChannelAvailable =
    channels?.restaurantEmailConfigured ||
    channels?.platformEmailFallbackAvailable;
  const hasEmailForPush = Boolean(contact.effectiveEmail.trim());
  const emailPushAvailable = hasEmailForPush && emailChannelAvailable;

  const emailNote = !hasEmailForPush
    ? "Trage oben unter Zustellung eine E-Mail ein (oder nutze deine Login-E-Mail)."
    : !emailChannelAvailable
      ? "E-Mail-Kanal derzeit nicht verfügbar."
      : channels?.restaurantEmailConfigured
        ? "Über die Restaurant-Mailbox, sonst Gwada-Fallback."
        : "Restaurant-Mailbox nicht konfiguriert — Gwada-Fallback.";

  const patchModuleToggle = (
    field: "inAppModules" | "pushWhatsappModules" | "pushEmailModules",
    moduleId: NotificationModuleId,
    enabled: boolean,
  ) => {
    updateDraft({
      [field]: { ...draft[field], [moduleId]: enabled },
    });
  };

  const handleSave = async () => {
    const saveBoth = contact.dirty && prefsDirty;

    if (contact.dirty) {
      const contactResult = await contact.save({ silent: saveBoth });
      if (!contactResult.ok) return;
    }
    if (prefsDirty) {
      const prefsResult = await savePrefs({ silent: saveBoth });
      if (!prefsResult.ok) return;
    }
    if (saveBoth) {
      toast.success("Benachrichtigungen gespeichert.");
    }
  };

  const handleReset = () => {
    if (contact.dirty) contact.resetDraft();
    if (prefsDirty) resetPrefsDraft();
  };

  const emailHelper =
    contact.authEmail.trim().length > 0
      ? `Leer lassen = ${contact.authEmail}`
      : "Für Push-Benachrichtigungen per E-Mail.";

  return (
    <div className="space-y-6">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Zustellung</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Für Push-Benachrichtigungen per E-Mail/WhatsApp — gilt für alle
            Restaurants deines Accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notification-contact-email">E-Mail</Label>
            <Input
              id="notification-contact-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={contact.authEmail || "name@beispiel.de"}
              value={contact.draft.notificationEmail}
              onChange={(e) =>
                contact.updateDraft({ notificationEmail: e.target.value })
              }
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">{emailHelper}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notification-contact-phone">Telefonnummer</Label>
            <Input
              id="notification-contact-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+49 171 1234567"
              value={contact.draft.phone}
              onChange={(e) => contact.updateDraft({ phone: e.target.value })}
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Für WhatsApp-Push. Internationale Form mit Ländervorwahl (z. B. +49
              …) oder deutsche Nummer (z. B. 0151 …).
            </p>
          </div>
          {contact.effectiveEmail ? (
            <p className="text-xs text-muted-foreground">
              Aktive E-Mail-Zustellung:{" "}
              <span className="font-medium text-foreground">
                {contact.effectiveEmail}
              </span>
            </p>
          ) : null}
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
              {whatsappPushAvailable
                ? "Push über die verbundene Restaurant-WhatsApp."
                : !whatsappConnected
                  ? "Nur verfügbar, wenn WhatsApp unter Einstellungen → Integrationen verbunden ist."
                  : "Trage oben unter Zustellung eine Telefonnummer ein."}
            </p>
            <ModuleToggleRows
              toggles={draft.pushWhatsappModules}
              disabled={!whatsappPushAvailable}
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
              disabled={!emailPushAvailable}
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
          onClick={handleReset}
        >
          Verwerfen
        </Button>
        <Button
          type="button"
          className={settingsAccentSaveButtonClassName}
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving ? "Speichern…" : "Speichern"}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
