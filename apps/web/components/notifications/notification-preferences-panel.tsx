"use client";

import { useMemo } from "react";
import {
  NotificationGroupBulkChannelActions,
  NotificationModuleChannelRow,
  type NotificationDeliveryChannel,
  isModuleChannelEnabled,
  isModulePushEnabled,
} from "@/components/notifications/notification-module-channel-pills";
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
import { NewsletterSubscriptionCard } from "@/components/notifications/newsletter-subscription-card";
import { NotificationPushHistorySection } from "@/components/notifications/notification-push-history-section";
import { NotificationPreferencesPanelSkeleton } from "@/components/notifications/notification-preferences-panel-skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useNotificationContact } from "@/lib/hooks/use-notification-contact";
import { useNotificationPreferences } from "@/lib/hooks/use-notification-preferences";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { normalizeNotificationPhoneForStorage } from "@/lib/notifications/notification-contact-validation";
import {
  filterNotificationModulesForUser,
  type NotificationModuleAccessContext,
} from "@/lib/notifications/notification-module-permissions";
import {
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import { NOTIFICATION_SETTINGS_GROUPS } from "@/lib/notifications/notification-module-groups";
import type { NotificationSettingsGroup } from "@/lib/notifications/notification-module-groups";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

export function NotificationPreferencesPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const { staff, loading: staffLoading } = useMyRestaurantStaff();
  const contact = useNotificationContact();
  const {
    ready,
    isLoading,
    dirty: prefsDirty,
    draft,
    channels,
    patchPreferences,
    reload: reloadPrefs,
  } = useNotificationPreferences();

  const isLoadingAll =
    isLoading || contact.isLoading || permissionsLoading || staffLoading;
  const dirty = contact.dirty;
  const isSaving = contact.isSaving;
  const showSkeleton = useDeferredSkeleton(isLoadingAll);

  const notificationAccess = useMemo(
    (): NotificationModuleAccessContext => ({
      has,
      hasStaffProfile: Boolean(staff),
    }),
    [has, staff],
  );

  const visibleNotificationGroups = useMemo((): NotificationSettingsGroup[] => {
    return NOTIFICATION_SETTINGS_GROUPS.map((group) => ({
      ...group,
      moduleIds: filterNotificationModulesForUser(
        group.moduleIds,
        notificationAccess,
      ),
    })).filter((group) => group.moduleIds.length > 0);
  }, [notificationAccess]);

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

  const emailChannelAvailable = Boolean(
    channels?.restaurantEmailConfigured ||
      channels?.platformEmailFallbackAvailable,
  );
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
    patchPreferences({
      [field]: { ...draft[field], [moduleId]: enabled },
    });
  };

  const whatsappDisabledHint = !whatsappConnected
    ? "WhatsApp unter Einstellungen → Integrationen verbinden."
    : "Telefonnummer unter Zustellung eintragen.";

  const fieldForChannel = (channel: NotificationDeliveryChannel) => {
    switch (channel) {
      case "inApp":
        return "inAppModules";
      case "email":
        return "pushEmailModules";
      case "whatsapp":
        return "pushWhatsappModules";
    }
  };

  const setChannelForModules = (
    channel: NotificationDeliveryChannel,
    enabled: boolean,
    moduleIds: NotificationModuleId[],
  ) => {
    if (channel === "email" && !emailPushAvailable) return;
    if (channel === "whatsapp" && !whatsappPushAvailable) return;
    const field = fieldForChannel(channel);
    const next = { ...draft[field] };
    for (const id of moduleIds) {
      next[id] = enabled;
    }
    patchPreferences({ [field]: next });
  };

  const setAllChannelsForModules = (
    enabled: boolean,
    moduleIds: NotificationModuleId[],
  ) => {
    const inApp = { ...draft.inAppModules };
    const pushEmail = { ...draft.pushEmailModules };
    const pushWhatsapp = { ...draft.pushWhatsappModules };
    for (const id of moduleIds) {
      inApp[id] = enabled;
      if (emailPushAvailable) pushEmail[id] = enabled;
      if (whatsappPushAvailable) pushWhatsapp[id] = enabled;
    }
    patchPreferences({
      inAppModules: inApp,
      pushEmailModules: pushEmail,
      pushWhatsappModules: pushWhatsapp,
    });
  };

  const handleModuleChannelChange = (
    moduleId: NotificationModuleId,
    channel: NotificationDeliveryChannel,
    enabled: boolean,
  ) => {
    patchModuleToggle(fieldForChannel(channel), moduleId, enabled);
  };

  const handleSave = async () => {
    const phoneCleared =
      contact.dirty &&
      !normalizeNotificationPhoneForStorage(contact.draft.phone);

    if (!contact.dirty) return;

    const contactResult = await contact.save();
    if (!contactResult.ok) return;
    // Server löscht WhatsApp-Prefs ohne Nummer — UI nachziehen.
    if (phoneCleared) {
      await reloadPrefs();
    }
  };

  const handleReset = () => {
    contact.resetDraft();
  };

  const emailHelper =
    contact.authEmail.trim().length > 0
      ? `Leer lassen = ${contact.authEmail}`
      : "Für Push-Benachrichtigungen per E-Mail.";

  return (
    <div className="space-y-6">
      <NotificationPushHistorySection />

      <NewsletterSubscriptionCard />

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
          <CardTitle className="text-xl">Benachrichtigungen</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Pro Hinweis Glocke, E-Mail und WhatsApp einzeln oder kombiniert —
            kompakt in einer Liste. Sichtbare Module hängen von deinen
            Berechtigungen ab (z. B. Reservierungen nur mit Zugriff auf
            Reservierungen).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {!emailPushAvailable || !whatsappPushAvailable ? (
            <div className="space-y-1 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
              {!emailPushAvailable ? <p>{emailNote}</p> : null}
              {!whatsappPushAvailable ? (
                <p>
                  {!whatsappConnected
                    ? "WhatsApp-Push: Integration unter Einstellungen → Integrationen verbinden."
                    : "WhatsApp-Push: Telefonnummer unter Zustellung eintragen."}
                </p>
              ) : null}
            </div>
          ) : null}
          {visibleNotificationGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Für deine Berechtigungen sind keine Modul-Benachrichtigungen
              verfügbar. Zustellung per E-Mail/WhatsApp kannst du oben trotzdem
              pflegen.
            </p>
          ) : (
            visibleNotificationGroups.map((group) => (
              <section key={group.id} className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      {group.title}
                    </h3>
                    {group.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {group.description}
                      </p>
                    ) : null}
                  </div>
                  <NotificationGroupBulkChannelActions
                    moduleIds={group.moduleIds}
                    emailAvailable={emailPushAvailable}
                    whatsappAvailable={whatsappPushAvailable}
                    onSetChannel={setChannelForModules}
                    onSetAllChannels={setAllChannelsForModules}
                  />
                </div>
                <ul className="list-none divide-y divide-border/50 border-y border-border/50 p-0">
                  {group.moduleIds.map((moduleId) => (
                    <NotificationModuleChannelRow
                      key={moduleId}
                      moduleId={moduleId}
                      inApp={isModuleChannelEnabled(
                        draft.inAppModules,
                        moduleId,
                      )}
                      email={isModulePushEnabled(
                        draft.pushEmailModules,
                        moduleId,
                      )}
                      whatsapp={isModulePushEnabled(
                        draft.pushWhatsappModules,
                        moduleId,
                      )}
                      emailDisabled={!emailPushAvailable}
                      whatsappDisabled={!whatsappPushAvailable}
                      emailDisabledHint={emailNote}
                      whatsappDisabledHint={whatsappDisabledHint}
                      onChange={(channel, enabled) =>
                        handleModuleChannelChange(moduleId, channel, enabled)
                      }
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
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
