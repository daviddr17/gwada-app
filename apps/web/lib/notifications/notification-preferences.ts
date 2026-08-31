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

/** In-App-Defaults: nur zeitkritische Ops — Rest bewusst aus. */
export const DEFAULT_IN_APP_ENABLED_MODULE_IDS: readonly NotificationModuleId[] =
  [
    "messages",
    "messages_follow_up",
    "reviews",
    "reservations_pending",
    "reservations_change_request",
    "reservations_cancellation",
    "events_inquiry",
    "staff_permissions_granted",
    "inventory_po_delivery_due",
    "personal_reminder",
    "staff_messages",
  ];

export function defaultModuleToggles(
  enabled = true,
): NotificationModuleToggles {
  return Object.fromEntries(
    NOTIFICATION_MODULE_IDS.map((id) => [id, enabled]),
  ) as NotificationModuleToggles;
}

export function defaultInAppModuleToggles(): NotificationModuleToggles {
  const toggles = defaultModuleToggles(false);
  for (const id of DEFAULT_IN_APP_ENABLED_MODULE_IDS) {
    toggles[id] = true;
  }
  return toggles;
}

/**
 * Defaults für Nutzer ohne gespeicherte Prefs (z. B. neu akzeptierte Einladung).
 * Glocke: nur die wichtigsten Module — Push (WA/E-Mail): aus, Nutzer schaltet aktiv ein.
 */
export function defaultNotificationPreferences(): NotificationPreferences {
  return {
    channelWhatsappEnabled: false,
    channelEmailEnabled: false,
    inAppModules: defaultInAppModuleToggles(),
    pushWhatsappModules: defaultModuleToggles(false),
    pushEmailModules: defaultModuleToggles(false),
  };
}

/** WhatsApp-Push nur mit hinterlegter Profil-Telefonnummer. */
export function clearWhatsappPushModules(
  prefs: NotificationPreferences,
): NotificationPreferences {
  const pushWhatsappModules = defaultModuleToggles(false);
  const channels = deriveChannelFlagsFromModules({
    pushWhatsappModules,
    pushEmailModules: prefs.pushEmailModules,
  });
  return {
    ...prefs,
    pushWhatsappModules,
    ...channels,
  };
}

export function applyNotificationPushContactGates(
  prefs: NotificationPreferences,
  opts: { hasPhone: boolean },
): NotificationPreferences {
  if (opts.hasPhone) return prefs;
  return clearWhatsappPushModules(prefs);
}

export function notificationPreferencesEqual(
  a: NotificationPreferences,
  b: NotificationPreferences,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
