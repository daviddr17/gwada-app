import {
  LEGACY_NOTIFICATION_MODULE_ALIASES,
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
      changelog: false,
      reservations_pending: true,
      reservations_change_request: true,
      reservations_cancellation: true,
      staff_shift_start: false,
      staff_shift_end: false,
      inventory_low_stock: true,
      accounting_quotation: true,
      accounting_invoice: true,
      accounting_voucher: true,
    },
    pushEmailModules: {
      messages: true,
      reviews: true,
      changelog: true,
      reservations_pending: true,
      reservations_change_request: true,
      reservations_cancellation: true,
      staff_shift_start: true,
      staff_shift_end: true,
      inventory_low_stock: true,
      accounting_quotation: true,
      accounting_invoice: true,
      accounting_voucher: true,
    },
  };
}

function applyLegacyModuleAliases(
  raw: Record<string, unknown>,
  next: NotificationModuleToggles,
): void {
  for (const [legacyId, targets] of Object.entries(
    LEGACY_NOTIFICATION_MODULE_ALIASES,
  )) {
    if (typeof raw[legacyId] !== "boolean") continue;
    for (const targetId of targets) {
      if (typeof raw[targetId] !== "boolean") {
        next[targetId] = raw[legacyId];
      }
    }
  }
}

function parseModuleToggles(
  raw: Record<string, unknown> | null | undefined,
  fallback: NotificationModuleToggles,
): NotificationModuleToggles {
  const next = { ...fallback };
  if (!raw || typeof raw !== "object") return next;
  applyLegacyModuleAliases(raw, next);
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

/** Master-Kanal-Flags aus per-Modul-Push-Toggles ableiten (UI zeigt keine globalen Kanäle). */
export function deriveChannelFlagsFromModules(
  prefs: Pick<
    NotificationPreferences,
    "pushWhatsappModules" | "pushEmailModules"
  >,
): Pick<
  NotificationPreferences,
  "channelWhatsappEnabled" | "channelEmailEnabled"
> {
  return {
    channelWhatsappEnabled: Object.values(prefs.pushWhatsappModules).some(
      (enabled) => enabled,
    ),
    channelEmailEnabled: Object.values(prefs.pushEmailModules).some(
      (enabled) => enabled,
    ),
  };
}

export function notificationPreferencesToRow(
  prefs: NotificationPreferences,
  profileId: string,
  restaurantId: string,
) {
  const channels = deriveChannelFlagsFromModules(prefs);
  return {
    profile_id: profileId,
    restaurant_id: restaurantId,
    channel_whatsapp_enabled: channels.channelWhatsappEnabled,
    channel_email_enabled: channels.channelEmailEnabled,
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

export function isPushModuleEnabled(
  prefs: NotificationPreferences,
  channel: "whatsapp" | "email",
  moduleId: NotificationModuleId,
): boolean {
  const toggles =
    channel === "whatsapp" ? prefs.pushWhatsappModules : prefs.pushEmailModules;
  return toggles[moduleId] === true;
}
