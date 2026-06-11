import {
  NOTIFICATION_MODULE_IDS,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";

export type NotificationModuleToggles = Record<NotificationModuleId, boolean>;

export type NotificationPreferences = {
  channelWhatsappEnabled: boolean;
  channelEmailEnabled: boolean;
  inAppModules: NotificationModuleToggles;
  pushWhatsappModules: NotificationModuleToggles;
  pushEmailModules: NotificationModuleToggles;
};

export const NOTIFICATION_BELL_POLL_MS = 45_000;

export function defaultModuleToggles(
  enabled = true,
): NotificationModuleToggles {
  return Object.fromEntries(
    NOTIFICATION_MODULE_IDS.map((id) => [id, enabled]),
  ) as NotificationModuleToggles;
}

export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    channelWhatsappEnabled: false,
    channelEmailEnabled: true,
    inAppModules: defaultModuleToggles(true),
    pushWhatsappModules: {
      messages: true,
      reviews: false,
      reservations: true,
      changelog: false,
    },
    pushEmailModules: {
      messages: true,
      reviews: true,
      reservations: true,
      changelog: true,
    },
  };
}

function parseModuleToggles(
  raw: Record<string, unknown> | null | undefined,
  fallback: NotificationModuleToggles,
): NotificationModuleToggles {
  const next = { ...fallback };
  if (!raw || typeof raw !== "object") return next;
  for (const id of NOTIFICATION_MODULE_IDS) {
    if (typeof raw[id] === "boolean") {
      next[id] = raw[id];
    }
  }
  return next;
}

export function mergeNotificationPreferences(
  raw: Partial<{
    channel_whatsapp_enabled: boolean;
    channel_email_enabled: boolean;
    in_app_modules: Record<string, unknown>;
    push_whatsapp_modules: Record<string, unknown>;
    push_email_modules: Record<string, unknown>;
  }> | null,
): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  if (!raw) return defaults;
  return {
    channelWhatsappEnabled:
      raw.channel_whatsapp_enabled ?? defaults.channelWhatsappEnabled,
    channelEmailEnabled:
      raw.channel_email_enabled ?? defaults.channelEmailEnabled,
    inAppModules: parseModuleToggles(raw.in_app_modules, defaults.inAppModules),
    pushWhatsappModules: parseModuleToggles(
      raw.push_whatsapp_modules,
      defaults.pushWhatsappModules,
    ),
    pushEmailModules: parseModuleToggles(
      raw.push_email_modules,
      defaults.pushEmailModules,
    ),
  };
}

export function notificationPreferencesToRow(
  prefs: NotificationPreferences,
  profileId: string,
  restaurantId: string,
) {
  return {
    profile_id: profileId,
    restaurant_id: restaurantId,
    channel_whatsapp_enabled: prefs.channelWhatsappEnabled,
    channel_email_enabled: prefs.channelEmailEnabled,
    in_app_modules: prefs.inAppModules,
    push_whatsapp_modules: prefs.pushWhatsappModules,
    push_email_modules: prefs.pushEmailModules,
  };
}

export function isInAppModuleEnabled(
  prefs: NotificationPreferences,
  moduleId: NotificationModuleId,
): boolean {
  return prefs.inAppModules[moduleId] !== false;
}
